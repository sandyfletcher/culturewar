// =============================================
// root/javascript/bots/CGPT5.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * ChampionBot
 *
 * Core strategy (one-liner):
 *  - Fast, surgical expansion early, transition to value-targeted crippling attacks mid-game,
 *    and perform coordinated all-in pushes in the late game using accurate arrival predictions.
 *
 * Strategic pillars:
 * 1) Precision strikes: use predictPlanetState and travel times to send the minimal winning force (+buffer).
 * 2) Value targeting: prefer planets with high production/size/centrality or low defense-to-value ratios.
 * 3) Resilient defense: keep a configurable minimum garrison on each owned planet and avoid sending
 *    planets that are under imminent threat (incoming enemy fleets).
 * 4) Mission tracking: avoid over-committing to the same target from multiple planets when unnecessary.
 */

export default class CGPT5 extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);

        // memory defaults
        this.memory.actionCooldown = 0;
        this.memory.missions = this.memory.missions || {}; // targetId -> {expiresAt}
        this.memory.lastPhase = null;
        // configuration (tweakable)
        this.config = {
            minGarrisonBase: 8,        // base min troops to keep on small planets
            minGarrisonScale: 0.25,    // fraction of planet.troops to keep if planet is large
            safetyBuffer: 4,           // extra troops above predicted defender to reduce failed attacks
            earlyExpansionBias: 1.2,   // be more greedy early game for neutral planets
            maxSendFraction: 0.9,      // never send more than X fraction of a planet's troops
            missionTimeout: 20,        // seconds to consider a mission active (prevents duplicates)
            lateGameAggressionRatio: 0.95, // when stronger than top opponent, be agressive
            capacityLimit: 999         // planet capacity
        };
    }

    // --- Helper utilities (all internal, do not change game state) ---
    _now() {
        return this.api.getElapsedTime();
    }

    _isMissionActive(targetId) {
        const m = this.memory.missions[targetId];
        return m && m.expiresAt > this._now();
    }

    _setMission(targetId, durationSeconds = this.config.missionTimeout) {
        this.memory.missions[targetId] = { expiresAt: this._now() + durationSeconds };
    }

    _minGarrisonFor(planet) {
        // keep a larger garrison for larger or high-production planets
        const base = this.config.minGarrisonBase;
        const scale = Math.max(base, Math.floor(planet.troops * this.config.minGarrisonScale));
        // also consider production: high production should keep slightly more
        const prod = Math.ceil(this.api.getPlanetProductionRate(planet) || 0);
        return Math.max(base, scale, prod * 2);
    }

    _planetValue(planet) {
        // prefer planets by production, size and centrality (0..1).
        // Uses calculatePlanetValue() if available else falls back to heuristic.
        if (typeof this.api.calculatePlanetValue === 'function') {
            // safe to call read-only helper
            try {
                return this.api.calculatePlanetValue(planet);
            } catch (e) { /* fallthrough to heuristic */ }
        }
        const production = this.api.getPlanetProductionRate(planet) || planet.productionRate || 0;
        const size = planet.size || 1;
        const centrality = (typeof this.api.getPlanetCentrality === 'function')
            ? (this.api.getPlanetCentrality(planet) || 0.5)
            : 0.5;
        // simple weighted score
        return production * 10 + size * 0.5 + centrality * 5;
    }

    _estimatedTroopsAfterTravel(targetPlanet, travelTime, attackerId) {
        // Use the API's predictPlanetState if available. It returns {owner, troops}
        try {
            const prediction = this.api.predictPlanetState(targetPlanet, travelTime);
            return prediction; // {owner, troops}
        } catch (e) {
            // fallback: naive estimate - current troops + production*travelTime
            const production = this.api.getPlanetProductionRate(targetPlanet) || targetPlanet.productionRate || 0;
            return {
                owner: targetPlanet.owner,
                troops: targetPlanet.troops + production * travelTime
            };
        }
    }

    _incomingEnemyTo(planet) {
        try {
            return this.api.getIncomingAttacks(planet) || [];
        } catch (e) {
            return [];
        }
    }

    _incomingFriendlyTo(planet) {
        try {
            return this.api.getIncomingReinforcements(planet) || [];
        } catch (e) {
            return [];
        }
    }

    _chooseSourcePlanet(target, candidates) {
        // choose a planet that can send the needed troops with minimal overcommit and safe garrison left.
        // candidates is an array of my planets.
        const travelTimes = candidates.map(p => ({
            p,
            t: this.api.getTravelTime(p, target)
        }));

        // sort by travel time ascending (prefer closer sources for quick strikes)
        travelTimes.sort((a, b) => a.t - b.t);

        return travelTimes.map(x => x.p);
    }

    _neededForCaptureAtArrival(targetPlanet, travelTime, attackerId) {
        const predicted = this._estimatedTroopsAfterTravel(targetPlanet, travelTime, attackerId);
        // If the planet will be owned by attacker already, don't need to attack.
        // To capture, need (predicted.troops + 1) if defender present, or > predicted.troops to take the planet.
        const defenderTroops = Math.max(0, predicted.troops || 0);
        const required = Math.floor(defenderTroops + 1 + this.config.safetyBuffer);
        return required;
    }

    // --- Core decision function (all logic must be here) ---
    makeDecision(dt) {
        // local cooldown to avoid needless re-evaluation
        if (!this.memory) this.memory = {};
        if (!this.memory.missions) this.memory.missions = {};

        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets || myPlanets.length === 0) return null; // no planets, nothing to do

        const neutralPlanets = this.api.getNeutralPlanets() || [];
        const enemyPlanets = this.api.getEnemyPlanets() || [];
        const phase = this.api.getGamePhase ? this.api.getGamePhase() : 'MID';
        const myStrengthRatio = (typeof this.api.getMyStrengthRatio === 'function')
            ? (this.api.getMyStrengthRatio() || 1.0)
            : 1.0;

        // clear expired missions (light housekeeping)
        for (const tid of Object.keys(this.memory.missions)) {
            if (this.memory.missions[tid].expiresAt <= this._now()) {
                delete this.memory.missions[tid];
            }
        }

        // Phase transitions (used for behavior tweaks)
        this.memory.lastPhase = phase;

        // Prioritize defense: if any of my planets has imminent incoming enemy fleets that would
        // lose the planet unless reinforced, attempt to defend by sending reinforcements from nearest safe planets.
        // Defensive logic
        for (const myP of myPlanets) {
            const incomingEnemy = this._incomingEnemyTo(myP).filter(f => f.owner !== this.playerId);
            if (incomingEnemy.length === 0) continue;

            // Sum enemy incoming amounts and earliest arrival
            let totalIncoming = 0;
            let earliest = Infinity;
            for (const f of incomingEnemy) {
                totalIncoming += f.amount;
                earliest = Math.min(earliest, f.duration || 0);
            }

            // predict garrison at earliest arrival (account production)
            const predicted = this._estimatedTroopsAfterTravel(myP, earliest, this.playerId);
            const garrisonAtArrival = Math.max(0, predicted.troops || 0);

            // if expected garrison < incoming, we will lose => try to reinforce
            if (garrisonAtArrival + 0.5 < totalIncoming) {
                // find nearest friendly planets with spare troops
                const donors = myPlanets
                    .filter(p => p.id !== myP.id)
                    .map(p => ({
                        p,
                        dist: this.api.getDistance(p, myP),
                        travel: this.api.getTravelTime(p, myP),
                        spare: Math.floor(Math.min(p.troops * this.config.maxSendFraction, p.troops - this._minGarrisonFor(p)))
                    }))
                    .filter(d => d.spare > 0)
                    .sort((a, b) => a.travel - b.travel);

                if (donors.length) {
                    const donor = donors[0];
                    const sendAmt = Math.min(donor.spare, Math.ceil(totalIncoming - garrisonAtArrival + this.config.safetyBuffer));
                    // set mission to avoid double-use
                    this._setMission(myP.id, donor.travel + 5);
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return {
                        fromId: donor.p.id,
                        toId: myP.id,
                        troops: sendAmt
                    };
                }
            }
        }

        // --- Offensive logic ---
        // 1) EARLY: expand to neutral planets (prefer high value/low cost)
        if (phase === 'EARLY' && neutralPlanets.length > 0) {
            // score neutral planets by value/difficulty (troops)
            const scored = neutralPlanets.map(n => {
                const val = this._planetValue(n);
                return {
                    planet: n,
                    score: val / Math.max(1, n.troops + 1)
                };
            }).sort((a, b) => b.score - a.score);

            for (const s of scored) {
                const target = s.planet;
                if (this._isMissionActive(target.id)) continue;

                // select best source: prefer nearest friendly planet with spare troops
                const sourceCandidates = this._chooseSourcePlanet(target, myPlanets);
                for (const src of sourceCandidates) {
                    // don't dispatch if this source is threatened or would drop below min garrison
                    const minG = this._minGarrisonFor(src);
                    const spare = Math.floor(Math.min(src.troops * this.config.maxSendFraction, src.troops - minG));
                    if (spare <= 0) continue;

                    const travel = this.api.getTravelTime(src, target);
                    const required = this._neededForCaptureAtArrival(target, travel, this.playerId);

                    // bias to be slightly greedier on neutral early
                    const adjustedRequired = Math.ceil(required * this.config.earlyExpansionBias);

                    if (spare >= adjustedRequired) {
                        // commit mission and fire
                        this._setMission(target.id, travel + 6);
                        const toSend = Math.min(spare, adjustedRequired, Math.floor(src.troops * this.config.maxSendFraction));
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return {
                            fromId: src.id,
                            toId: target.id,
                            troops: Math.max(1, toSend)
                        };
                    }
                }
            }
        }

        // 2) MID: target high-value enemy or neutral planets that reduce opponents' production.
        // Build a combined candidate list (prefer enemy planets with low defense to value ratio)
        const enemyCandidates = enemyPlanets.map(ep => {
            const val = this._planetValue(ep);
            return { planet: ep, score: val / Math.max(1, ep.troops + 1) };
        });

        const neutralCandidates = neutralPlanets.map(np => {
            const val = this._planetValue(np);
            return { planet: np, score: (val * 0.9) / Math.max(1, np.troops + 1) }; // neutral slightly lower priority mid
        });

        const allTargets = enemyCandidates.concat(neutralCandidates)
            .filter(x => x.planet) // safety
            .sort((a, b) => b.score - a.score)
            .map(x => x.planet);

        for (const target of allTargets) {
            if (this._isMissionActive(target.id)) continue; // already being tasked
            // pick sources, prioritize by travel time
            const orderedSources = this._chooseSourcePlanet(target, myPlanets);

            // attempt to compose a multi-source strike if single planet can't do it (but return only one action).
            // We will prioritize single-planet strikes first.
            for (const src of orderedSources) {
                const minG = this._minGarrisonFor(src);
                const spare = Math.floor(Math.min(src.troops * this.config.maxSendFraction, src.troops - minG));
                if (spare <= 0) continue;
                const travel = this.api.getTravelTime(src, target);
                const required = this._neededForCaptureAtArrival(target, travel, this.playerId);

                if (spare >= required) {
                    // Send from this single source
                    const sendAmt = Math.min(spare, required);
                    // guard against sending more than capacity limitations (not strictly necessary, but safe)
                    const safeSend = Math.min(sendAmt, this.config.capacityLimit);

                    this._setMission(target.id, travel + 6);
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return {
                        fromId: src.id,
                        toId: target.id,
                        troops: Math.max(1, Math.floor(safeSend))
                    };
                }
            }

            // If we reach here, no single source could capture - try to send from the closest healthy source to start pressure
            const helperSource = orderedSources.find(src => {
                const spare = Math.floor(Math.min(src.troops * this.config.maxSendFraction, src.troops - this._minGarrisonFor(src)));
                return spare > Math.max(1, Math.floor(target.troops * 0.25));
            });

            if (helperSource) {
                const travel = this.api.getTravelTime(helperSource, target);
                const spare = Math.floor(Math.min(helperSource.troops * this.config.maxSendFraction, helperSource.troops - this._minGarrisonFor(helperSource)));
                const sendAmt = Math.max(1, Math.min(spare, Math.ceil(spare * 0.8)));
                this._setMission(target.id, travel + 6);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: helperSource.id,
                    toId: target.id,
                    troops: sendAmt
                };
            }
        }

        // 3) LATE: if we're stronger than opponents, perform aggressive consolidation/sweeps
        if (phase === 'LATE') {
            // If our strength ratio is strong, attack the weakest enemy planets to end quickly
            if (myStrengthRatio > 1.1 || myStrengthRatio > this.config.lateGameAggressionRatio) {
                // find weakest enemy planet by troops-to-value
                const weakEnemy = enemyPlanets
                    .map(ep => ({ ep, ratio: (ep.troops + 1) / Math.max(1, this._planetValue(ep)) }))
                    .sort((a, b) => a.ratio - b.ratio)[0];

                if (weakEnemy && weakEnemy.ep) {
                    const target = weakEnemy.ep;
                    if (!this._isMissionActive(target.id)) {
                        // pick the best donor planet
                        const donors = myPlanets
                            .map(p => ({
                                p,
                                travel: this.api.getTravelTime(p, target),
                                spare: Math.floor(Math.min(p.troops * this.config.maxSendFraction, p.troops - this._minGarrisonFor(p)))
                            }))
                            .filter(d => d.spare > 0)
                            .sort((a, b) => a.travel - b.travel);

                        if (donors.length) {
                            // send from the fastest donor first
                            const donor = donors[0];
                            const required = this._neededForCaptureAtArrival(target, donor.travel, this.playerId);

                            // if donor spare is insufficient, send what it has (pressure)
                            const toSend = Math.min(donor.spare, Math.max(required, Math.floor(donor.spare * 0.9)));
                            this._setMission(target.id, donor.travel + 6);
                            this.memory.actionCooldown = this.api.getDecisionCooldown();
                            return {
                                fromId: donor.p.id,
                                toId: target.id,
                                troops: Math.max(1, toSend)
                            };
                        }
                    }
                }
            }
        }

        // If no strategic attack decided, but we have a planet with large surplus, send it to nearest enemy/neutral to keep pressure.
        // This avoids stalling for long games.
        const surplusPlanet = myPlanets
            .map(p => ({ p, spare: Math.floor(p.troops - this._minGarrisonFor(p)) }))
            .filter(x => x.spare > 15) // only act if substantial spare
            .sort((a, b) => b.spare - a.spare)[0];

        if (surplusPlanet) {
            // find nearest valuable target (enemy preferred, else neutral)
            const targets = enemyPlanets.length ? enemyPlanets : neutralPlanets;
            if (targets && targets.length) {
                // choose nearest
                let nearest = targets[0];
                let bestDist = this.api.getDistance(surplusPlanet.p, nearest);
                for (const t of targets) {
                    const d = this.api.getDistance(surplusPlanet.p, t);
                    if (d < bestDist) { bestDist = d; nearest = t; }
                }

                // figure safe send amount
                const sendAmt = Math.floor(Math.min(surplusPlanet.spare, Math.max(1, surplusPlanet.spare * 0.6)));
                this._setMission(nearest.id, this.api.getTravelTime(surplusPlanet.p, nearest) + 6);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: surplusPlanet.p.id,
                    toId: nearest.id,
                    troops: Math.max(1, sendAmt)
                };
            }
        }

        // Nothing decisive to do this tick
        return null;
    }
}