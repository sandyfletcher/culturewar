// =============================================
// root/javascript/bots/Gemini20FlashE.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    AggressiveExplorer focuses on rapid expansion and overwhelming opponents with superior troop numbers.
    Strategic Pillars:
    1.  Aggressive Expansion: Prioritizes capturing neutral planets and enemy planets with weak defenses early in the game.
    2.  Troop Concentration: Sends large fleets to quickly conquer planets.
    3.  Threat Assessment: Identifies and defends against incoming attacks on its planets.
    4.  Dynamic Targeting: Adapts its attack targets based on enemy strength and vulnerability.
*/

export default class Gemini20FlashE extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        this.memory.expansionTarget = null;
    }

    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();

        if (myPlanets.length === 0) {
            return null;
        }

        // --- Strategy Logic ---

        // 1. Defend against incoming attacks
        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length > 0) {
                // Reinforce threatened planet from closest strong planet
                let bestSourcePlanet = null;
                let troopsToSend = 0;
                let minTravelTime = Infinity;

                for (const sourcePlanet of myPlanets) {
                    if (sourcePlanet.id !== myPlanet.id && sourcePlanet.troops > 50) {
                        const travelTime = this.api.getTravelTime(sourcePlanet, myPlanet);
                        const predictedState = this.api.predictPlanetState(myPlanet, travelTime);
                        let incomingTroops = 0;
                        for (const attack of incomingAttacks) {
                            incomingTroops += attack.amount;
                        }
                        if (predictedState.troops < incomingTroops && travelTime < minTravelTime) {
                            minTravelTime = travelTime;
                            bestSourcePlanet = sourcePlanet;
                            troopsToSend = Math.min(sourcePlanet.troops * 0.75, incomingTroops - predictedState.troops + 20); // Send enough to defend, plus a buffer.

                        }
                    }
                }
                if(bestSourcePlanet) {
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return {
                        fromId: bestSourcePlanet.id,
                        toId: myPlanet.id,
                        troops: Math.floor(troopsToSend)
                    };
                }

            }
        }

        // 2. Expand to neutral planets
        if (neutralPlanets.length > 0) {
            // Find the closest neutral planet to any of our planets
            let closestNeutralPlanet = null;
            let minDistance = Infinity;
            let sourcePlanet = null;
            for(const planet of myPlanets) {
                const nearest = this.api.findNearestPlanet(planet, neutralPlanets);
                if(nearest) {
                    const distance = this.api.getDistance(planet, nearest);
                    if(distance < minDistance) {
                        minDistance = distance;
                        closestNeutralPlanet = nearest;
                        sourcePlanet = planet;
                    }
                }
            }

            if (sourcePlanet && closestNeutralPlanet && sourcePlanet.troops > 30) {
                const troopsToSend = Math.floor(sourcePlanet.troops * 0.6);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: sourcePlanet.id,
                    toId: closestNeutralPlanet.id,
                    troops: troopsToSend
                };
            }
        }

        // 3. Attack weakly defended enemy planets
        if (enemyPlanets.length > 0) {
            for (const myPlanet of myPlanets) {
                //find nearest enemy planet
                const nearestEnemy = this.api.getNearestEnemyPlanet(myPlanet);
                if (nearestEnemy && myPlanet.troops > 50) {
                    const travelTime = this.api.getTravelTime(myPlanet, nearestEnemy);
                    const predictedEnemyState = this.api.predictPlanetState(nearestEnemy, travelTime);

                    if (myPlanet.troops > predictedEnemyState.troops + 20) {
                        const troopsToSend = Math.floor(Math.min(myPlanet.troops * 0.75, predictedEnemyState.troops + 50));
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return {
                            fromId: myPlanet.id,
                            toId: nearestEnemy.id,
                            troops: troopsToSend
                        };
                    }
                }
            }
        }

        // 4. Reinforce our planets with low troop counts
        for (const myPlanet of myPlanets) {
            if (myPlanet.troops < 50) {
                // Find the closest friendly planet with sufficient troops to send reinforcements
                let bestSourcePlanet = null;
                let troopsToSend = 0;
                for (const sourcePlanet of myPlanets) {
                    if (sourcePlanet.id !== myPlanet.id && sourcePlanet.troops > 50) {
                        bestSourcePlanet = sourcePlanet;
                        troopsToSend = Math.floor(Math.min(sourcePlanet.troops * 0.5, 80)); // Send up to 80 troops, or half of the source's troops.
                        break; // Only need one reinforcement source
                    }
                }

                if (bestSourcePlanet) {
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return {
                        fromId: bestSourcePlanet.id,
                        toId: myPlanet.id,
                        troops: troopsToSend
                    };
                }
            }
        }

        return null;
    }
}