// =============================================
// root/javascript/bots/Gemini20FlashB.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    This bot prioritizes aggressive early-game expansion, focusing on capturing neutral and weakly defended enemy planets.
    It uses a threat assessment system to identify vulnerable targets and reinforce planets under attack.
    In the mid-to-late game, it adapts to target the weakest opponent and consolidate its forces.
*/

export default class Gemini20FlashB extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        this.memory.expansionTarget = null; // Track the target planet for expansion
        this.memory.defenseTargets = {};    // Track planets needing defense
        this.memory.aggressionMode = 'EXPAND'; // EXPAND, DEFEND, ATTACK
    }

    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }

        const gamePhase = this.api.getGamePhase();

        // 1. Phase-Dependent Strategy Selection
        if (gamePhase === 'EARLY') {
            return this.earlyGameStrategy(dt, myPlanets);
        } else if (gamePhase === 'MID') {
            return this.midGameStrategy(dt, myPlanets);
        } else {
            return this.lateGameStrategy(dt, myPlanets);
        }
    }

    earlyGameStrategy(dt, myPlanets) {
        // Prioritize expansion to nearby neutral planets.
        if (this.memory.expansionTarget === null) {
            const neutralPlanets = this.api.getNeutralPlanets();
            if (neutralPlanets.length > 0) {
                this.memory.expansionTarget = this.findNearestPlanetToGroup(myPlanets, neutralPlanets).id;
            }
        }

        if (this.memory.expansionTarget) {
            const target = this.api.getPlanetById(this.memory.expansionTarget);
            if (!target) {
                this.memory.expansionTarget = null; // Reset if target is gone
                return null;
            }

            // Calculate total troops and potential source planet.
            let totalAvailableTroops = 0;
            let bestSourcePlanet = null;
            for (const planet of myPlanets) {
                if (planet.troops > 10) {
                  if(bestSourcePlanet === null || planet.troops > bestSourcePlanet.troops) {
                    bestSourcePlanet = planet;
                  }
                  totalAvailableTroops += planet.troops;
                }
            }

            if (bestSourcePlanet && totalAvailableTroops > 10) {
                const troopsToSend = Math.min(Math.floor(bestSourcePlanet.troops * 0.75), 999);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: bestSourcePlanet.id,
                    toId: target.id,
                    troops: troopsToSend
                };
            } else {
                return null;
            }
        }

        return null; // No expansion target, do nothing.
    }

    midGameStrategy(dt, myPlanets) {
        // Assess threats and target the weakest opponent.
        this.assessDefenseNeeds(myPlanets);
        const defenseDecision = this.handleDefense(myPlanets);
        if (defenseDecision) {
            return defenseDecision;
        }

        //Identify Weakest Opponent
        const opponentIds = this.api.getOpponentIds();
        let weakestOpponent = null;
        let lowestTroopCount = Infinity;

        for (const opponentId of opponentIds) {
            const opponentStats = this.api.getPlayerStats(opponentId);
            if (opponentStats && opponentStats.totalTroops < lowestTroopCount && opponentStats.isActive) {
                weakestOpponent = opponentId;
                lowestTroopCount = opponentStats.totalTroops;
            }
        }

        if(weakestOpponent === null) {
          return null;
        }

        const enemyPlanets = this.api.getEnemyPlanets().filter(planet => planet.owner === weakestOpponent);
        if (enemyPlanets.length > 0) {

            const attackTarget = this.findNearestPlanetToGroup(myPlanets, enemyPlanets);

            let totalAvailableTroops = 0;
            let bestSourcePlanet = null;
            for (const planet of myPlanets) {
                if (planet.troops > 10) {
                    if(bestSourcePlanet === null || planet.troops > bestSourcePlanet.troops) {
                      bestSourcePlanet = planet;
                    }
                    totalAvailableTroops += planet.troops;
                }
            }

            if (bestSourcePlanet && totalAvailableTroops > 10) {
                const troopsToSend = Math.min(Math.floor(bestSourcePlanet.troops * 0.75), 999);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: bestSourcePlanet.id,
                    toId: attackTarget.id,
                    troops: troopsToSend
                };
            }
            return null;
        }
        return null;
    }

    lateGameStrategy(dt, myPlanets) {
        // Focus on consolidating forces and overwhelming the strongest opponent.
        // For simplicity, re-using the midGame strategy for now.  A more advanced bot could have a truly unique late-game strategy.
        return this.midGameStrategy(dt, myPlanets);
    }

    // --- Helper Functions ---
    findNearestPlanetToGroup(sourcePlanets, targetPlanets) {
        let nearestPlanet = null;
        let minDistance = Infinity;

        for (const source of sourcePlanets) {
          for (const target of targetPlanets) {
            const distance = this.api.getDistance(source, target);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlanet = target;
            }
          }
        }

        return nearestPlanet;
    }

    assessDefenseNeeds(myPlanets) {
        this.memory.defenseTargets = {};
        for (const planet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            let threatLevel = 0;
            for (const attack of incomingAttacks) {
                threatLevel += attack.amount;
            }

            if (threatLevel > planet.troops) {
                this.memory.defenseTargets[planet.id] = threatLevel;
            }
        }
    }

    handleDefense(myPlanets) {
        for (const targetId in this.memory.defenseTargets) {
            const targetPlanet = this.api.getPlanetById(targetId);
            if (!targetPlanet) {
                delete this.memory.defenseTargets[targetId]; // Target no longer exists
                continue;
            }

            //Find the strongest planet that can send reinforcements
            let strongestReinforcer = null;
            for (const planet of myPlanets) {
                if (planet.id !== targetId && planet.troops > 10 && (strongestReinforcer === null || planet.troops > strongestReinforcer.troops)) {
                  strongestReinforcer = planet;
                }
            }

            if (strongestReinforcer) {
                const troopsToSend = Math.min(Math.floor(strongestReinforcer.troops * 0.75), this.memory.defenseTargets[targetId] - targetPlanet.troops + 10, 999); // Send enough to defend + buffer.
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: strongestReinforcer.id,
                    toId: targetId,
                    troops: troopsToSend
                };
            }
        }
        return null;
    }
}