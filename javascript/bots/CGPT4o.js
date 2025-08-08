// =============================================
// root/javascript/bots/CGPT4o.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * CGPT4o
 *
 * Core strategy (one-line): Adaptive value-driven expansion with layered defense and
 * opportunistic punishment — play smart, conserve forces, and strike where predictions
 * guarantee value.
 *
 * Strategic pillars:
 * 1. Early expansion: prioritize high-value neutral planets (calculatePlanetValue) and
 *    send the minimal winning force using predictPlanetState to avoid overcommitment.
 * 2. Defense-first safety: monitor calculateThreat and incoming attacks; reinforce
 *    planets that are at risk using nearby safe reserves.
 * 3. Opportunistic offense: in MID/LATE phases search for vulnerable enemy planets
 *    predicted to fall with a small investment; preferentially attack high-production
 *    planets when the odds are good.
 * 4. Resource awareness: use getMyStrengthRatio() and per-source safety margins to
 *    avoid crippling sacrifices; maintain local reserves based on threat and production.
 *
 * All decision logic is kept inside makeDecision(dt) as required.
 */
export default class CGPT4o extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);

        // Initialize any custom memory fields we want to persist.
        // memory.missions: Map(targetPlanetId -> {type, deadline})
        // memory.actionCooldown: seconds until we can act again
        // memory.phase: GAME_START / EARLY / MID / LATE (we'll sync with api)
        this.memory.missions = this.memory.missions || new Map();
        this.memory.actionCooldown = this.memory.actionCooldown || 0;
        this.memory.phase = this.memory.phase || 'GAME_START';
    }

    /**
     * Called every AI tick; implement all behavior here.
     * @param {number} dt - elapsed game seconds since last call (already scaled).
     * @returns {{from: Planet, to: Planet, troops: number} | null}
     */
    makeDecision(dt) {
        // Reduce cooldown timers
        this.memory.actionCooldown = Math.max(0, (this.memory.actionCooldown || 0) - dt);

        // Keep missions map tidy: drop expired missions
        const now = this.api.getElapsedTime();
        for (const [targetId, meta] of this.memory.missions.entries()) {
            if (meta.deadline && meta.deadline <= now) {
                this.memory.missions.delete(targetId);
            }
        }

        // Respect global minimum decision cooldown to avoid acting too often
        if (this.memory.actionCooldown > 0) {
            return null;
        }

        // Sample game state
        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets || myPlanets.length === 0) return null; // we lost or can't act

        const allPlanets = this.api.getAllPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const phase = this.api.getGamePhase(); // 'EARLY'|'MID'|'LATE'
        this.memory.phase = phase;

        // Basic strategic metrics
        const myTotalTroops = this.api.getMyTotalTroops();
        const strengthRatio = this.api.getMyStrengthRatio(); // >1 means we're stronger
        const gameRemaining = Math.max(0, this.api.getGameDuration() - this.api.getElapsedTime());

        // Helper: select a source planet that can safely spare 'needed' troops
        const selectSource = (targetPlanet, needed) => {
            // Candidate planets: owned planets sorted by (available spare) descending, prefer closer ones
            const candidates = myPlanets
                .map(p => {
                    // safety margin: base reserve + threat-based reserve + production cushion for travel
                    const threat = this.api.calculateThreat(p) || 0;
                    const travel = Math.max(0.5, this.api.getTravelTime(p, targetPlanet) || 1);
                    const baseReserve = 6; // never leave planet nearly empty
                    const prodCushion = p.productionRate * travel; // allow production during travel
                    const safetyReserve = baseReserve + Math.ceil(threat * 1.5) + Math.ceil(prodCushion);
                    const spare = Math.floor(p.troops - safetyReserve);
                    return { planet: p, spare, safetyReserve, dist: this.api.getDistance(p, targetPlanet) || 0 };
                })
                .filter(c => c.spare > 0)
                .sort((a, b) => {
                    // prefer planet with greater spare, closer distance, and higher production to be safer
                    const scoreA = a.spare - a.dist * 0.01;
                    const scoreB = b.spare - b.dist * 0.01;
                    return scoreB - scoreA;
                });

            if (candidates.length === 0) return null;
            // pick the top candidate but ensure it has at least 'needed'
            for (const c of candidates) {
                if (c.spare >= needed) return c.planet;
            }
            // if none can supply full amount, return the best candidate (we might send partial)
            return candidates[0].planet;
        };

        // Helper: schedule a small cooldown after acting to avoid spamming
        const setCooldown = (seconds) => {
            // a little randomization prevents lockstep with other bots
            this.memory.actionCooldown = seconds + Math.random() * 0.05;
        };

        // Helper: estimate troops required to capture a planet arriving after travelTime seconds
        const estimateRequiredToCapture = (planet, travelTime) => {
            // Use the powerful predictor to account for incoming fleets and production
            const prediction = this.api.predictPlanetState(planet, travelTime);
            // If it predicts we'll own it already, zero required
            if (prediction.owner === this.playerId) return 0;
            // Need one more than predicted troops to capture
            const baseNeeded = Math.ceil(prediction.troops) + 1;
            // Add a small buffer based on uncertainty: longer travel -> larger buffer
            const buffer = Math.ceil(Math.min(8, travelTime * 0.25));
            return baseNeeded + buffer;
        };

        // 1) DEFENSIVE CHECK: Reinforce planets under imminent threat (highest priority)
        // For each planet we own, check incoming enemy attacks and threat score; pick best reinforcement
        let bestDefenseOrder = null;
        for (const p of myPlanets) {
            const incoming = this.api.getIncomingAttacks(p) || [];
            // If there are incoming enemy fleets, compute net arriving force vs our troops at arrival times
            if (incoming.length > 0) {
                // Sum of incoming enemy troops arriving within next N seconds
                const dangerous = incoming.reduce((sum, mv) => sum + (mv.owner !== this.playerId ? mv.amount : 0), 0);
                // We also check high threat score
                const threatScore = this.api.calculateThreat(p) || 0;
                // Only consider if threat is meaningful (either enemy fleets incoming or threat score > threshold)
                if (dangerous > 0 || threatScore > 4) {
                    // Determine how many reinforcements needed to survive most imminent attack:
                    // We'll look a short horizon (max travel of potential reinforcements)
                    const need = Math.max(0, Math.ceil(dangerous - p.troops + 2)); // +2 cushion
                    if (need > 0) {
                        // find a nearby friendly with spare troops
                        const source = selectSource(p, need);
                        if (source) {
                            // create a defense order candidate with urgency score
                            const urgency = dangerous + threatScore * 1.5 - p.troops;
                            if (!bestDefenseOrder || urgency > bestDefenseOrder.urgency) {
                                bestDefenseOrder = { from: source, to: p, troops: Math.min(Math.floor(source.troops - 6), need), urgency };
                            }
                        }
                    }
                }
            }
        }
        if (bestDefenseOrder) {
            // Guard rails: troops must be >=1
            if (bestDefenseOrder.troops >= 1) {
                this.log(`DEFEND: sending ${bestDefenseOrder.troops} from ${bestDefenseOrder.from.id} to ${bestDefenseOrder.to.id}`);
                setCooldown(0.28); // slightly above globalDecisionCooldown to be safe
                // track mission so we don't spam multiple reinforcements to same planet immediately
                this.memory.missions.set(bestDefenseOrder.to.id, { type: 'DEFEND', deadline: now + 6 });
                return {
                    from: bestDefenseOrder.from,
                    to: bestDefenseOrder.to,
                    troops: bestDefenseOrder.troops
                };
            }
        }

        // 2) OPPORTUNISTIC ATTACKS: Look for enemy planets we can capture cheaply (MID/LATE higher priority)
        // Build a prioritized list of candidate enemy targets (value / cost)
        const enemyCandidates = enemyPlanets
            .filter(ep => !this.memory.missions.has(ep.id)) // don't double target
            .map(ep => {
                // Prefer high value planets and those near our frontier
                // compute nearest friendly planet and travelTime
                const nearestFriendly = this.api.findNearestPlanet(ep, myPlanets) || myPlanets[0];
                const travelTime = Math.max(0.5, this.api.getTravelTime(nearestFriendly, ep) || 1);
                const required = estimateRequiredToCapture(ep, travelTime);
                const value = this.api.calculatePlanetValue(ep) || (ep.productionRate || ep.size / 20);
                // score: higher value and lower cost better
                const score = (value + Math.min(5, ep.productionRate)) / Math.max(1, required);
                return { planet: ep, required, travelTime, nearestFriendly, score };
            })
            .filter(c => c.required > 0 && c.required < 500) // sanity
            .sort((a, b) => b.score - a.score);

        // If we are relatively strong, be more aggressive
        if (enemyCandidates.length > 0 && (phase !== 'EARLY' || strengthRatio > 0.9)) {
            // pick top candidate where we can find a source to send troops
            for (const cand of enemyCandidates) {
                const source = selectSource(cand.planet, cand.required);
                if (!source) continue;
                // compute send amount conservatively: either exact required or limited fraction of spare
                const spare = Math.floor(source.troops - 6);
                let send = Math.min(spare, cand.required);
                // When stronger, allow sending a bit more to account for prediction noise
                if (strengthRatio > 1.1) send = Math.min(spare, Math.ceil(cand.required * 1.15));
                if (send < 1) continue;

                // Safety check: don't send almost all forces unless we're far stronger
                if (send > Math.floor(source.troops * 0.6) && strengthRatio < 1.0) {
                    // skip this source to avoid crippling it
                    continue;
                }

                // Commit to attack
                this.memory.missions.set(cand.planet.id, { type: 'ATTACK', deadline: now + Math.max(6, cand.travelTime * 2) });
                setCooldown(0.28);
                this.log(`ATTACK: ${send} from ${source.id} -> ${cand.planet.id} (req ${cand.required}, val ${this.api.calculatePlanetValue(cand.planet).toFixed(2)})`);
                return { from: source, to: cand.planet, troops: send };
            }
        }

        // 3) VALUE-BASED EXPANSION: in EARLY phase favor neutral high-value planets
        if (neutralPlanets.length > 0 && (phase === 'EARLY' || myPlanets.length < Math.max(3, Math.ceil(allPlanets.length * 0.18)))) {
            // compute candidate list by value/required
            const neutralCandidates = neutralPlanets
                .filter(np => !this.memory.missions.has(np.id))
                .map(np => {
                    // choose a nearby friendly source for travel estimate
                    const nearestFriendly = this.api.findNearestPlanet(np, myPlanets) || myPlanets[0];
                    const travel = Math.max(0.5, this.api.getTravelTime(nearestFriendly, np) || 1);
                    const required = estimateRequiredToCapture(np, travel);
                    const value = this.api.calculatePlanetValue(np) || (np.productionRate || np.size / 20);
                    const score = (value + np.productionRate) / Math.max(1, required);
                    return { planet: np, required, travel, nearestFriendly, score };
                })
                .filter(c => c.required > 0 && c.required < 500)
                .sort((a, b) => b.score - a.score);

            for (const cand of neutralCandidates) {
                const source = selectSource(cand.planet, cand.required);
                if (!source) continue;
                const spare = Math.floor(source.troops - 6);
                const send = Math.min(spare, cand.required);
                if (send < 1) continue;

                // Commit to expansion
                this.memory.missions.set(cand.planet.id, { type: 'EXPAND', deadline: now + Math.max(6, cand.travel * 2) });
                setCooldown(0.28);
                this.log(`EXPAND: ${send} from ${source.id} -> ${cand.planet.id} (val ${this.api.calculatePlanetValue(cand.planet).toFixed(2)})`);
                return { from: source, to: cand.planet, troops: send };
            }
        }

        // 4) MID/LATE cleanup: If no high-priority actions, do small reinforcements or transfers to consolidate
        // Transfer small reinforcements from weaker border planets to stronger hubs (to prepare for final pushes)
        // Identify weakest owned planet with low production but far from center and transfer a small fraction to nearest strong hub
        const weakest = myPlanets.slice().sort((a, b) => a.troops - b.troops)[0];
        const strongest = myPlanets.slice().sort((a, b) => (b.troops + b.productionRate * 5) - (a.troops + a.productionRate * 5))[0];
        if (weakest && strongest && weakest.id !== strongest.id && weakest.troops > 8) {
            // if weakest is dangerously isolated or nearly empty, send half its spare to the hub
            const travel = this.api.getTravelTime(weakest, strongest) || 1;
            // only consolidate if travel not extremely long or we're in late game
            if (travel < 20 || phase === 'LATE') {
                const spare = Math.floor(weakest.troops - 6);
                if (spare >= 3) {
                    const send = Math.max(1, Math.floor(spare / 2));
                    this.log(`CONSOLIDATE: ${send} from ${weakest.id} -> ${strongest.id}`);
                    setCooldown(0.26);
                    return { from: weakest, to: strongest, troops: send };
                }
            }
        }

        // 5) Fallback: if we're very strong and no missions, do a probing attack to pressure opponents
        if (strengthRatio > 1.4 && enemyPlanets.length > 0) {
            const target = enemyPlanets.sort((a, b) => (this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a)))[0];
            const nearest = this.api.findNearestPlanet(target, myPlanets) || myPlanets[0];
            const travelTime = Math.max(0.5, this.api.getTravelTime(nearest, target) || 1);
            const required = estimateRequiredToCapture(target, travelTime);
            const source = selectSource(target, Math.min(required, Math.ceil(nearest.troops * 0.5)));
            if (source && source.troops > 10) {
                const send = Math.min(Math.floor(source.troops * 0.5), Math.max(4, required));
                this.memory.missions.set(target.id, { type: 'PROBE', deadline: now + travelTime * 2 });
                this.log(`PROBE: ${send} from ${source.id} -> ${target.id}`);
                setCooldown(0.26);
                return { from: source, to: target, troops: send };
            }
        }

        // Nothing worth doing right now
        return null;
    }
}