// =============================================
// root/javascript/bots/CGPT5D.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * ChampionBot
 * Core strategy (one sentence):
 *   Efficient, phase-aware expansion -> opportunistic strikes -> decisive late-game consolidation.
 *
 * Strategic pillars:
 *  - Value-driven expansion: prioritize neutral/enemy planets by production, size and centrality (value/distance).
 *  - Predictive strikes: use predictPlanetState + travelTime to send the minimal successful force (plus buffer).
 *  - Defensive awareness: avoid over-committing; reinforce planets under incoming attack or preserve a local reserve.
 *  - Phased behavior: EARLY = expand fast, MID = cripple the strongest opponent, LATE = pick highest-impact all-ins.
 */

export default class CGPT5D extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);

        // persistent memory across turns
        this.memory.actionCooldown = 0;
        this.memory.missions = this.memory.missions || {}; // { targetPlanetId: {fromId, createdAt} }
        this.memory.lastPhase = null;
        this.memory.reserveFraction = 0.20; // fraction of troops to keep as local reserve on a source planet
    }

    // Utility: safe numeric floor of troops to send (can't send fractional troops)
    _sendableTroopsOn(planet) {
        // keep a local reserve to avoid leaving source defenseless
        const reserve = Math.ceil(planet.troops * this.memory.reserveFraction);
        const sendable = Math.floor(Math.max(0, planet.troops - reserve));
        return sendable;
    }

    // Evaluate planet 'value': production + size weighted by centrality and a small constant to prefer expansion
    _planetValue(planet) {
        const prod = this.api.getPlanetProductionRate(planet) || planet.productionRate || 0;
        const centrality = this.api.getPlanetCentrality(planet) || 0.5;
        const size = planet.size || 0;
        // value formula tuned for expansion vs distance scoring later
        return prod * 6 + size * 0.7 + centrality * 3;
    }

    // Minimal troops required to capture, using prediction at arrival + safety buffer
    _troopsNeededToCapture(targetPlanet, arrivalTimeSeconds, safetyBuffer = 2) {
        // predictPlanetState returns {owner, troops}
        const predicted = this.api.predictPlanetState(targetPlanet, arrivalTimeSeconds);
        const defTroops = Math.max(0, predicted.troops || 0);
        // if predicted owner is friendly, need 0 (but sometimes we might want to reinforce)
        if (predicted.owner === this.playerId) {
            return 0;
        }
        // attackers must exceed defending troops (1-for-1), so need defTroops + 1 (+ buffer)
        return Math.ceil(defTroops + 1 + safetyBuffer);
    }

    // Choose the best source planet to send troops from given a minimum troops requirement
    _chooseSourceFor(targetPlanet, minNeeded) {
        const myPlanets = this.api.getMyPlanets();
        // prefer nearest planet with enough sendable troops
        let best = null;
        let bestScore = Infinity;
        for (const p of myPlanets) {
            const sendable = this._sendableTroopsOn(p);
            if (sendable < minNeeded) continue;
            const travel = this.api.getTravelTime(p, targetPlanet);
            // score prioritizes short travel and higher production source (faster reinforcement)
            const prod = this.api.getPlanetProductionRate(p) || p.productionRate || 0;
            const score = travel - Math.log(1 + prod) * 0.2; // lower is better
            if (score < bestScore) {
                bestScore = score;
                best = { planet: p, sendable, travel };
            }
        }
        return best;
    }

    // Find a defensible frontline planet (my planet nearest to enemy) to stage attacks from
    _frontlinePlanets() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return myPlanets;
        // compute distance to nearest enemy for each my planet
        return myPlanets
            .map(p => {
                const nearest = this.api.findNearestPlanet(p, enemyPlanets);
                const d = nearest ? this.api.getDistance(p, nearest) : Infinity;
                return { planet: p, distanceToEnemy: d };
            })
            .sort((a, b) => a.distanceToEnemy - b.distanceToEnemy)
            .map(x => x.planet);
    }

    // Reinforce any friendly planet under incoming attack if our nearby planets can spare troops
    _attemptReinforce() {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        // check for my planets with incoming enemy fleets
        for (const p of myPlanets) {
            const incoming = this.api.getIncomingAttacks(p) || [];
            if (incoming.length === 0) continue;
            // compute predicted state at earliest incoming fleet arrival
            let earliest = Infinity;
            for (const f of incoming) earliest = Math.min(earliest, f.duration || Infinity);
            if (!isFinite(earliest)) continue;
            const needed = this._troopsNeededToCapture(p, earliest, 1); // positive if we need help
            const predicted = this.api.predictPlanetState(p, earliest);
            // if predicted.owner !== playerId, we might need to reinforce
            if (predicted.owner !== this.playerId || predicted.troops < Math.max(4, needed)) {
                // find nearest friendly planet that can spare troops
                const donors = this.api.getMyPlanets()
                    .map(dp => ({ dp, dist: this.api.getTravelTime(dp, p), sendable: this._sendableTroopsOn(dp) }))
                    .filter(x => x.dp.id !== p.id && x.sendable > 0)
                    .sort((a, b) => a.dist - b.dist);
                for (const donor of donors) {
                    const send = Math.min(donor.sendable, Math.ceil(Math.max(1, needed - predicted.troops)));
                    if (send <= 0) continue;
                    return { fromId: donor.dp.id, toId: p.id, troops: send };
                }
            }
        }
        return null;
    }

    makeDecision(dt) {
        // small performance cooldown to avoid re-evaluating uselessly
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets || myPlanets.length === 0) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return null;
        }

        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const phase = this.api.getGamePhase ? this.api.getGamePhase() : 'MID';
        this.memory.lastPhase = phase;

        // 1) Immediate safety: attempt to reinforce any friendly planet under attack
        const reinforceDecision = this._attemptReinforce();
        if (reinforceDecision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return reinforceDecision;
        }

        // 2) Phase-aware priorities
        // EARLY: expand rapidly to neutrals prioritized by value/distance
        if (phase === 'EARLY') {
            // rank neutral targets by value/distance from nearest of our frontline planets
            const frontlines = this._frontlinePlanets();
            const candidateScores = neutralPlanets.map(t => {
                // find nearest frontline planet
                let nearestSource = null;
                let bestTime = Infinity;
                for (const s of frontlines) {
                    const ttime = this.api.getTravelTime(s, t);
                    if (ttime < bestTime) {
                        bestTime = ttime;
                        nearestSource = s;
                    }
                }
                const value = this._planetValue(t);
                const score = bestTime / (value + 0.001); // lower score better
                return { target: t, nearestSource, travel: bestTime, score, value };
            }).filter(x => x.nearestSource);

            candidateScores.sort((a, b) => a.score - b.score);

            for (const cand of candidateScores) {
                // compute troops needed at arrival
                const needed = this._troopsNeededToCapture(cand.target, cand.travel, 2);
                const sourceChoice = this._chooseSourceFor(cand.target, needed);
                if (sourceChoice) {
                    const troops = Math.min(sourceChoice.sendable, needed);
                    if (troops >= 1) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return { fromId: sourceChoice.planet.id, toId: cand.target.id, troops };
                    }
                }
            }
        }

        // MID: look for opportunistic attacks on weak enemy planets (value-weighted)
        if (phase === 'MID' || phase === 'EARLY') {
            // build list of enemy targets sorted by (value / travelTime) but also prefer weak defenders
            const myTotalProduction = this.api.getMyTotalProduction ? this.api.getMyTotalProduction() : 0;
            const enemyCandidates = enemyPlanets.map(t => {
                // nearest frontline source
                const frontlines = this._frontlinePlanets();
                let nearest = null;
                let bestTime = Infinity;
                for (const s of frontlines) {
                    const ttime = this.api.getTravelTime(s, t);
                    if (ttime < bestTime) { bestTime = ttime; nearest = s; }
                }
                const value = this._planetValue(t);
                // estimate troops needed
                const needed = this._troopsNeededToCapture(t, bestTime, 1);
                const score = (needed / Math.max(1, value)) + bestTime * 0.01; // lower better
                return { target: t, nearestSource: nearest, travel: bestTime, score, needed, value };
            });

            // prefer small needed & high value (so low score)
            enemyCandidates.sort((a, b) => a.score - b.score);

            for (const cand of enemyCandidates) {
                if (!cand.nearestSource) continue;
                const sourceChoice = this._chooseSourceFor(cand.target, cand.needed);
                if (sourceChoice) {
                    // be slightly bold: if we are stronger overall, send slightly more to increase success
                    const strengthRatio = this.api.getMyStrengthRatio ? this.api.getMyStrengthRatio() : 1.0;
                    const bias = strengthRatio > 1.2 ? 1.2 : 1.0;
                    const troopsToSend = Math.min(sourceChoice.sendable, Math.ceil(cand.needed * bias));
                    if (troopsToSend >= 1) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return { fromId: sourceChoice.planet.id, toId: cand.target.id, troops: troopsToSend };
                    }
                }
            }
        }

        // LATE: focus on high-impact moves:
        //  - either capture a high-value neutral that flips map control, or
        //  - send concentrated force at the strongest opponent's weak planet
        if (phase === 'LATE') {
            // 1) neutral high-value opportunistic
            const neutralByValue = neutralPlanets
                .map(t => ({ t, value: this._planetValue(t), nearest: this._chooseSourceFor(t, 1) }))
                .filter(x => x.nearest)
                .sort((a, b) => b.value - a.value);

            if (neutralByValue.length > 0) {
                const top = neutralByValue[0];
                const travel = top.nearest.travel;
                const need = this._troopsNeededToCapture(top.t, travel, 3);
                if (top.nearest.sendable >= need && need >= 1) {
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return { fromId: top.nearest.planet.id, toId: top.t.id, troops: Math.min(top.nearest.sendable, need + 2) };
                }
            }

            // 2) strike the strongest opponent: identify the strongest opponent (by production) and attack its weakest planet
            const opponents = this.api.getOpponentIds ? this.api.getOpponentIds() : [];
            let bestOpponent = null;
            let bestProd = -Infinity;
            for (const op of opponents) {
                const stats = this.api.getPlayerStats ? this.api.getPlayerStats(op) : null;
                if (stats && stats.isActive && stats.totalProduction > bestProd) {
                    bestProd = stats.totalProduction;
                    bestOpponent = op;
                }
            }
            if (bestOpponent) {
                const theirPlanets = (this.api.getAllPlanets() || []).filter(p => p.owner === bestOpponent);
                // pick the one with lowest predicted troops in short window
                theirPlanets.sort((a, b) => {
                    const pa = this.api.predictPlanetState(a, 4).troops || 0;
                    const pb = this.api.predictPlanetState(b, 4).troops || 0;
                    return (pa - pb);
                });
                if (theirPlanets.length > 0) {
                    const target = theirPlanets[0];
                    const nearest = this._chooseSourceFor(target, 1);
                    if (nearest) {
                        const travel = nearest.travel;
                        const need = this._troopsNeededToCapture(target, travel, 2);
                        const send = Math.min(nearest.sendable, Math.ceil(need * 1.15));
                        if (send >= 1) {
                            this.memory.actionCooldown = this.api.getDecisionCooldown();
                            return { fromId: nearest.planet.id, toId: target.id, troops: send };
                        }
                    }
                }
            }
        }

        // Fallback: if nothing else, try to expand to any neutral planet we can capture cheaply
        // Choose the most valuable neutral by simple (value - estimated troops needed)
        const fallbackCandidates = neutralPlanets.map(t => {
            const nearest = this._chooseSourceFor(t, 1);
            if (!nearest) return null;
            const travel = nearest.travel;
            const need = this._troopsNeededToCapture(t, travel, 1);
            const value = this._planetValue(t);
            return { t, nearest, need, score: value - need };
        }).filter(x => x && x.nearest && x.need <= x.nearest.sendable && x.need >= 1);

        if (fallbackCandidates.length > 0) {
            fallbackCandidates.sort((a, b) => b.score - a.score);
            const pick = fallbackCandidates[0];
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return { fromId: pick.nearest.planet.id, toId: pick.t.id, troops: Math.min(pick.nearest.sendable, pick.need) };
        }

        // Nothing to do: set cooldown and do nothing
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        return null;
    }
}
