// =============================================
// root/javascript/bots/CGPT5E.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * ChampionBot
 * -----------
 * One-sentence: Phased, predictive, and coordinated—expand fast early, pressure smart midgame, and all-in with coordinated strikes late.
 *
 * Strategic pillars:
 *  - Predictive precision: use predictPlanetState and travel times to send just-enough troops (plus a small safety buffer).
 *  - Coordinated attacks: combine forces from multiple nearby planets when single-planet attacks would waste troops.
 *  - Adaptive phasing: change aggression level based on getGamePhase() and strength ratio.
 *  - Defensive awareness: prioritize saving planets under imminent threat using incoming predictions.
 */

export default class CGPT5E extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // memory for cooldowns, missions, and simple persistent values
        this.memory.actionCooldown = 0;
        this.memory.missions = {}; // keyed by target planet id
        this.memory.lastPhase = null;
        this.CONFIG = {
            SAFETY_BUFFER: 1.15, // multiplier to ensure success vs predicted defenders
            COORDINATION_RADIUS: 200, // distance within which planets will pool troops
            EARLY_EXPAND_THRESHOLD: 6, // number of planets we try to reach early
            MAX_SEND_FRACTION: 0.85, // never send more than this fraction from a planet (keep defence)
            REINFORCE_MIN: 8, // don't send tiny fleets
            LATE_ALLIN_THRESHOLD: 1.25, // strength ratio threshold to attempt all-in
            MAX_PLANET_CAPACITY: 999
        };
    }

    // Small helper: reduce re-eval when cooldown active
    _tryCooldown(dt) {
        if (!this.memory.actionCooldown) this.memory.actionCooldown = 0;
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return true;
        }
        return false;
    }

    // Choose the "best" neutral/enemy targets based on a computed value
    _rankTargets(candidatePlanets) {
        // use provided API helpers to compute value
        const scored = candidatePlanets.map(p => {
            const baseVal = this.api.calculatePlanetValue(p) || (p.size * p.productionRate || 1);
            const centrality = this.api.getPlanetCentrality ? this.api.getPlanetCentrality(p) : 0.5;
            // prefer higher production and central planets; slightly penalize high owner (enemy)
            const ownerPenalty = (p.owner === 'neutral') ? 0 : 0.9;
            return {planet: p, score: baseVal * (1 + centrality) * ownerPenalty};
        });
        // sort descending
        scored.sort((a,b) => b.score - a.score);
        return scored.map(s => s.planet);
    }

    // Calculate troops needed to capture a planet arriving after travelTime (uses prediction)
    _troopsNeededForCapture(targetPlanet, travelTime) {
        // The API's predictPlanetState should return something like { owner, troops }
        let predicted = null;
        try {
            predicted = this.api.predictPlanetState(targetPlanet, travelTime);
        } catch (e) {
            // If predictPlanetState unavailable, fallback to crude estimate
            const growth = (targetPlanet.productionRate || 0) * travelTime;
            predicted = { owner: targetPlanet.owner, troops: Math.max(0, (targetPlanet.troops || 0) + growth) };
        }
        let defenders = predicted.troops || 0;
        // if predicted owner is neutral we still must beat defenders
        const needed = Math.ceil(defenders * this.CONFIG.SAFETY_BUFFER + 1);
        return { needed, predictedOwner: predicted.owner };
    }

    // find best source planet to send from (tries to maintain defense)
    _chooseSourcePlanet(minTroops, avoidPlanetIds = []) {
        const myPlanets = this.api.getMyPlanets();
        let best = null;
        for (const p of myPlanets) {
            if (avoidPlanetIds.includes(p.id)) continue;
            // prefer planets with spare troops beyond some defensive cushion
            const incomingThreat = this.api.calculateThreat ? this.api.calculateThreat(p) : 0;
            const defensiveCushion = Math.max(6, incomingThreat * 1.5);
            const spare = (p.troops || 0) - defensiveCushion;
            if (spare >= minTroops && spare > (best ? (best.spare) : -Infinity)) {
                best = { planet: p, spare };
            }
        }
        return best ? best.planet : null;
    }

    // assemble a coordinated attack from nearby planets to meet required troops
    _assembleCoordinatedAttack(targetPlanet, requiredTroops) {
        const myPlanets = this.api.getMyPlanets();
        // sort by proximity to target and available spare troops
        const byProximity = myPlanets
            .map(p => {
                const dist = this.api.getDistance ? this.api.getDistance(p, targetPlanet) : 
                             Math.hypot(p.x - targetPlanet.x, p.y - targetPlanet.y);
                // conservative spare calculation
                const incomingThreat = this.api.calculateThreat ? this.api.calculateThreat(p) : 0;
                const spare = Math.max(0, (p.troops || 0) - Math.max(6, incomingThreat * 1.5));
                return {p, dist, spare};
            })
            .filter(x => x.spare >= this.CONFIG.REINFORCE_MIN) // filter out tiny contributors
            .sort((a,b) => a.dist - b.dist);

        const contributors = [];
        let gathered = 0;
        for (const c of byProximity) {
            if (gathered >= requiredTroops) break;
            // don't send more than MAX_SEND_FRACTION of a single planet
            const sendable = Math.floor(c.spare * this.CONFIG.MAX_SEND_FRACTION);
            if (sendable <= 0) continue;
            const send = Math.min(sendable, requiredTroops - gathered);
            contributors.push({ from: c.p, troops: send });
            gathered += send;
        }

        if (gathered >= requiredTroops) {
            return contributors;
        }
        // Could not gather enough
        return null;
    }

    // Emergency defense: try to save a planet under attack by reinforcing if possible
    _tryDefendPlanet(targetPlanet) {
        const incoming = this.api.getIncomingAttacks ? this.api.getIncomingAttacks(targetPlanet) : [];
        if (!incoming || incoming.length === 0) return null;
        // compute total incoming enemy troops
        const enemyIncoming = incoming.filter(f => f.owner !== this.playerId)
                                      .reduce((s,f) => s + (f.amount || 0), 0);
        // time until first enemy fleet arrives
        const soonest = incoming.reduce((m,f) => Math.min(m, f.duration || Infinity), Infinity);

        // get predicted defenders at that time (including production)
        const reqObj = this._troopsNeededForCapture(targetPlanet, soonest);
        const required = reqObj.needed;

        // if the planet will be lost and we can reinforce, attempt to reinforce
        const currentPl = targetPlanet.troops || 0;
        if (currentPl >= required) return null; // already enough

        const deficit = required - currentPl;
        // try to assemble reinforcements from nearby friendly planets
        const myPlanets = this.api.getMyPlanets().filter(p => p.id !== targetPlanet.id);
        // sort by travel time
        const providers = myPlanets.map(p => {
            const time = this.api.getTravelTime ? this.api.getTravelTime(p, targetPlanet) :
                                                   Math.hypot(p.x - targetPlanet.x, p.y - targetPlanet.y) / 100;
            const incomingThreat = this.api.calculateThreat ? this.api.calculateThreat(p) : 0;
            const spare = Math.max(0, (p.troops || 0) - Math.max(6, incomingThreat * 1.5));
            return { p, time, spare };
        }).filter(x => x.spare >= this.CONFIG.REINFORCE_MIN)
          .sort((a,b) => a.time - b.time);

        // pick the fastest providers until deficit covered (only if they can arrive before enemy)
        let gathered = 0;
        const plan = [];
        for (const prov of providers) {
            if (prov.time > soonest) continue; // arrive too late
            const send = Math.min(Math.floor(prov.spare * this.CONFIG.MAX_SEND_FRACTION), deficit - gathered);
            if (send <= 0) continue;
            plan.push({ from: prov.p, troops: send });
            gathered += send;
            if (gathered >= deficit) break;
        }

        if (gathered >= deficit) {
            // return a single reinforcement action (we can issue one action per cooldown; pick largest contributor)
            // Choose provider with largest send amount to avoid fragmentation.
            plan.sort((a,b) => b.troops - a.troops);
            const main = plan[0];
            return {
                fromId: main.from.id,
                toId: targetPlanet.id,
                troops: main.troops
            };
        }
        return null;
    }

    // Main decision method: everything happens inside here per rules.
    makeDecision(dt) {
        // handle optional internal cooldown to avoid unnecessary evals
        if (this._tryCooldown(dt)) {
            return null;
        }

        // set a fresh cooldown only when we return an action (below)
        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets || myPlanets.length === 0) {
            return null;
        }

        const gamePhase = this.api.getGamePhase ? this.api.getGamePhase() : 'MID';
        const elapsed = this.api.getElapsedTime ? this.api.getElapsedTime() : 0;
        const totalDuration = this.api.getGameDuration ? this.api.getGameDuration() : 300;
        const timeLeft = totalDuration - elapsed;

        // Update memory phase
        this.memory.lastPhase = gamePhase;

        // 1) Emergency defense: if any of our planets are about to fall, try to reinforce
        for (const p of myPlanets) {
            const defendAction = this._tryDefendPlanet(p);
            if (defendAction) {
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return defendAction;
            }
        }

        // Evaluate strength and decide mode
        const strengthRatio = this.api.getMyStrengthRatio ? this.api.getMyStrengthRatio() : 1.0;
        const enemyPlanets = this.api.getEnemyPlanets() || [];
        const neutralPlanets = this.api.getNeutralPlanets() || [];

        // EARLY GAME: aggressive expansion to capture neutrals quickly
        if (gamePhase === 'EARLY' || (gamePhase === 'MID' && myPlanets.length < this.CONFIG.EARLY_EXPAND_THRESHOLD)) {
            const neutralTargets = this._rankTargets(neutralPlanets);
            for (const target of neutralTargets) {
                // find nearest source with enough troops
                const travelers = myPlanets.map(p => {
                    const time = this.api.getTravelTime ? this.api.getTravelTime(p, target) :
                                                         Math.hypot(p.x - target.x, p.y - target.y) / 100;
                    const incomingThreat = this.api.calculateThreat ? this.api.calculateThreat(p) : 0;
                    const spare = Math.max(0, (p.troops || 0) - Math.max(6, incomingThreat * 1.5));
                    return { p, time, spare };
                }).filter(x => x.spare >= this.CONFIG.REINFORCE_MIN)
                  .sort((a,b) => a.time - b.time);

                if (travelers.length === 0) continue;

                // pick fastest source and check needed troops
                const fastest = travelers[0];
                const neededObj = this._troopsNeededForCapture(target, fastest.time);
                const needed = neededObj.needed;

                if (fastest.spare >= needed) {
                    const send = Math.min(Math.floor(fastest.spare * this.CONFIG.MAX_SEND_FRACTION), needed);
                    if (send >= this.CONFIG.REINFORCE_MIN) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return { fromId: fastest.p.id, toId: target.id, troops: send };
                    }
                } else {
                    // attempt coordinated attack if single planet insufficient
                    const coordinators = this._assembleCoordinatedAttack(target, needed);
                    if (coordinators && coordinators.length) {
                        // return the biggest contributor as our single action; missions will keep track
                        coordinators.sort((a,b) => b.troops - a.troops);
                        const main = coordinators[0];
                        // mark mission to avoid double-issuing from same contributor repeatedly
                        this.memory.missions[target.id] = { contributors: coordinators.map(c => c.from.id), startedAt: elapsed };
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return { fromId: main.from.id, toId: target.id, troops: main.troops };
                    }
                }
            }
        }

        // MID GAME: pressure the weakest valuable enemy planet (production-weighted)
        if (gamePhase === 'MID') {
            const rankedEnemies = this._rankTargets(enemyPlanets);
            for (const target of rankedEnemies) {
                // avoid attacking if too far or if we are weaker and not prepared
                const nearestMy = this.api.findNearestPlanet ? this.api.findNearestPlanet(target, myPlanets) : null;
                const travelTime = nearestMy ? (this.api.getTravelTime ? this.api.getTravelTime(nearestMy, target) :
                                                                           Math.hypot(nearestMy.x - target.x, nearestMy.y - target.y) / 100)
                                             : 5;
                const neededObj = this._troopsNeededForCapture(target, travelTime);
                const needed = neededObj.needed;

                // If we're significantly stronger, be bolder
                const aggressionMultiplier = strengthRatio > 1.1 ? 0.95 : 1.2;
                const adjustedNeeded = Math.ceil(needed * aggressionMultiplier);

                // try single source first
                const donor = this._chooseSourcePlanet(adjustedNeeded, []);
                if (donor) {
                    const spare = Math.floor((donor.troops || 0) - Math.max(6, this.api.calculateThreat ? this.api.calculateThreat(donor) : 6));
                    const send = Math.min(Math.floor(spare * this.CONFIG.MAX_SEND_FRACTION), adjustedNeeded);
                    if (send >= this.CONFIG.REINFORCE_MIN) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return { fromId: donor.id, toId: target.id, troops: send };
                    }
                } else {
                    // coordinated attempt
                    const coordinators = this._assembleCoordinatedAttack(target, adjustedNeeded);
                    if (coordinators && coordinators.length) {
                        coordinators.sort((a,b) => b.troops - a.troops);
                        const main = coordinators[0];
                        this.memory.missions[target.id] = { contributors: coordinators.map(c => c.from.id), startedAt: elapsed };
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return { fromId: main.from.id, toId: target.id, troops: main.troops };
                    }
                }
            }
        }

        // LATE GAME: either consolidate defensively or attempt decisive strikes
        if (gamePhase === 'LATE' || timeLeft < 45) {
            // if we are strongest and can finish, all-in on high value enemy planets
            if (strengthRatio > this.CONFIG.LATE_ALLIN_THRESHOLD && enemyPlanets.length > 0) {
                const priority = this._rankTargets(enemyPlanets)[0];
                // plan a big coordinated strike using most of our forces (but keep a minimal defense)
                const totalTroops = this.api.getMyTotalTroops ? this.api.getMyTotalTroops() : myPlanets.reduce((s,p) => s + (p.troops || 0), 0);
                const targetForce = Math.min(Math.floor(totalTroops * 0.6), 700); // cap to avoid weird numbers
                const coordinators = this._assembleCoordinatedAttack(priority, targetForce);
                if (coordinators && coordinators.length) {
                    coordinators.sort((a,b) => b.troops - a.troops);
                    const main = coordinators[0];
                    this.memory.missions[priority.id] = { contributors: coordinators.map(c => c.from.id), startedAt: elapsed, type: 'ALLIN' };
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return { fromId: main.from.id, toId: priority.id, troops: main.troops };
                }
            }

            // fallback: reinforce border planets closest to enemy
            // find friendly planets closest to enemy borders and send spare from central planets
            const borderTargets = myPlanets.map(p => {
                const nearestEnemy = this.api.getNearestEnemyPlanet ? this.api.getNearestEnemyPlanet(p) : null;
                const dist = nearestEnemy ? this.api.getDistance(p, nearestEnemy) : Infinity;
                return { p, dist };
            }).sort((a,b) => a.dist - b.dist);

            if (borderTargets.length > 0) {
                // try moving reinforcement from our largest spare planet to the most threatened border planet
                const toDefend = borderTargets[0].p;
                const provider = myPlanets.slice().sort((a,b) => (b.troops||0) - (a.troops||0))[0];
                if (provider && provider.id !== toDefend.id) {
                    const incomingThreat = this.api.calculateThreat ? this.api.calculateThreat(toDefend) : 0;
                    const spare = Math.max(0, (provider.troops || 0) - Math.max(8, incomingThreat * 1.5));
                    const send = Math.floor(spare * 0.6);
                    if (send >= this.CONFIG.REINFORCE_MIN) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return { fromId: provider.id, toId: toDefend.id, troops: send };
                    }
                }
            }
        }

        // Opportunistic small attacks: if any enemy or neutral planet is underdefended relative to a nearby source, take the chance
        const opportunisticTargets = [].concat(neutralPlanets, enemyPlanets);
        for (const target of opportunisticTargets) {
            // find nearest friendly planet
            const nearest = this.api.findNearestPlanet ? this.api.findNearestPlanet(target, myPlanets) : null;
            if (!nearest) continue;
            const travelTime = this.api.getTravelTime ? this.api.getTravelTime(nearest, target) :
                                                       Math.hypot(nearest.x - target.x, nearest.y - target.y) / 100;
            const needed = this._troopsNeededForCapture(target, travelTime).needed;
            const spare = Math.floor((nearest.troops || 0) - Math.max(6, this.api.calculateThreat ? this.api.calculateThreat(nearest) : 6));
            if (spare >= needed && needed >= this.CONFIG.REINFORCE_MIN) {
                const send = Math.min(spare, needed);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return { fromId: nearest.id, toId: target.id, troops: send };
            }
        }

        // If nothing worth doing this turn, return null
        return null;
    }
}
