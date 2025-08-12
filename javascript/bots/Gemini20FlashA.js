// =============================================
// root/javascript/bots/Gemini20FlashA.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    An aggressive expansionist bot that prioritizes conquering neutral planets and then attacking weaker opponents.
    It uses a combination of distance, production rate, and threat assessment to determine the best targets and allocate troops efficiently.
*/

export default class Gemini20FlashA extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        this.memory.expansionTarget = null;
        this.memory.attackTarget = null;
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

        // Prioritize expanding to neutral planets
        if (this.memory.expansionTarget === null || !this.api.getPlanetById(this.memory.expansionTarget)) {
            this.memory.expansionTarget = this.chooseExpansionTarget(myPlanets);
        }

        if (this.memory.expansionTarget) {
            const expansionTargetPlanet = this.api.getPlanetById(this.memory.expansionTarget);
            const attackResult = this.launchAttack(myPlanets, expansionTargetPlanet);
            if (attackResult) {
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return attackResult;
            }
        }

        // If no neutral planets available, attack the weakest enemy.
        if (this.api.getNeutralPlanets().length === 0) {
            if (this.memory.attackTarget === null || !this.api.isPlayerActive(this.memory.attackTarget)) {
                this.memory.attackTarget = this.chooseAttackTarget();
            }

            if (this.memory.attackTarget) {
                const enemyPlanets = this.api.getEnemyPlanets().filter(p => p.owner === this.memory.attackTarget);
                if (enemyPlanets.length > 0) {
                    const attackTargetPlanet = enemyPlanets[0]; // Attack any planet of the chosen enemy
                    const attackResult = this.launchAttack(myPlanets, attackTargetPlanet);
                    if (attackResult) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return attackResult;
                    }
                } else {
                    this.memory.attackTarget = null; // Reset attack target if no planets are found.
                }
            }
        }

        // If no attack possible, redistribute troops to threatened planets
        this.redistributeTroops(myPlanets);

        return null;
    }


    chooseExpansionTarget(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) {
            return null;
        }

        let bestTarget = null;
        let bestValue = -1;

        for (const planet of neutralPlanets) {
            let totalDistance = 0;
            for (const myPlanet of myPlanets) {
                totalDistance += this.api.getDistance(myPlanet, planet);
            }
            const averageDistance = totalDistance / myPlanets.length;
            const value = planet.productionRate / averageDistance; // Prioritize production and proximity

            if (value > bestValue) {
                bestValue = value;
                bestTarget = planet.id;
            }
        }

        return bestTarget;
    }

    chooseAttackTarget() {
        const opponentIds = this.api.getOpponentIds();
        let weakestOpponent = null;
        let weakestStrength = Infinity;

        for (const opponentId of opponentIds) {
            const playerStats = this.api.getPlayerStats(opponentId);
            if (playerStats.totalTroops < weakestStrength) {
                weakestStrength = playerStats.totalTroops;
                weakestOpponent = opponentId;
            }
        }

        return weakestOpponent;
    }

    launchAttack(myPlanets, targetPlanet) {
        let strongestPlanet = null;
        let maxTroops = 0;

        for (const planet of myPlanets) {
            if (planet.troops > maxTroops) {
                maxTroops = planet.troops;
                strongestPlanet = planet;
            }
        }

        if (!strongestPlanet) {
            return null; // No planets to attack from
        }

        const distance = this.api.getDistance(strongestPlanet, targetPlanet);
        const travelTime = this.api.getTravelTime(strongestPlanet, targetPlanet);
        const predictedTargetState = this.api.predictPlanetState(targetPlanet, travelTime);

        let troopsNeeded = predictedTargetState.troops + 10; // Overestimate a bit.
        troopsNeeded = Math.min(troopsNeeded, strongestPlanet.troops * 0.75); // Don't send all troops

        if (troopsNeeded > 10 && strongestPlanet.troops > 20) {
            return {
                fromId: strongestPlanet.id,
                toId: targetPlanet.id,
                troops: Math.floor(troopsNeeded)
            };
        }

        return null;
    }


    redistributeTroops(myPlanets) {
        let mostThreatenedPlanet = null;
        let maxThreat = -Infinity;
        let planetToReinforce = null;

        for (const planet of myPlanets) {
            const threat = this.calculateThreat(planet);
            if (threat > maxThreat) {
                maxThreat = threat;
                mostThreatenedPlanet = planet;
                planetToReinforce = planet.id;
            }
        }

        if (mostThreatenedPlanet) {
            let strongestPlanet = null;
            let maxTroops = 0;

            for (const planet of myPlanets) {
                if (planet.id !== mostThreatenedPlanet.id && planet.troops > maxTroops) {
                    maxTroops = planet.troops;
                    strongestPlanet = planet;
                }
            }

            if (strongestPlanet && strongestPlanet.troops > 20) {
                const troopsToSend = Math.floor(strongestPlanet.troops * 0.25); // Send 25% of troops

                if (troopsToSend > 10) {
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return {
                        fromId: strongestPlanet.id,
                        toId: planetToReinforce,
                        troops: troopsToSend
                    };
                }
            }
        }
    }

    calculateThreat(planet) {
        const incomingAttacks = this.api.getIncomingAttacks(planet);
        let incomingEnemyTroops = 0;
        for(const attack of incomingAttacks) {
            incomingEnemyTroops += attack.amount;
        }

        const nearestEnemyPlanet = this.api.getNearestEnemyPlanet(planet);
        let distanceToNearestEnemy = 0;
        if (nearestEnemyPlanet) {
             distanceToNearestEnemy = this.api.getDistance(planet, nearestEnemyPlanet);
        } else {
            return 0; //No threat if there are no enemies.
        }

        const enemyTroopRatio = distanceToNearestEnemy > 0 ? incomingEnemyTroops / distanceToNearestEnemy : incomingEnemyTroops;
        return enemyTroopRatio;
    }
}