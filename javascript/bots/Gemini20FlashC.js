// =============================================
// root/javascript/bots/Gemini20FlashC.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    This bot prioritizes aggressive expansion, focusing on capturing neutral and weakly defended enemy planets.
    It uses a threat assessment system to balance offense and defense.
*/

export default class Gemini20FlashC extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            actionCooldown: 0,
            expansionTargets: [],
            defenseTargets: []
        };
        this.aggressionFactor = 0.7;  // Adjust for more/less aggressive behavior
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

        this.updateTargets();  // Refresh target lists

        const expansionMove = this.executeExpansion(myPlanets);
        if (expansionMove) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return expansionMove;
        }

        const defenseMove = this.executeDefense(myPlanets);
        if (defenseMove) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return defenseMove;
        }

        // Default: Reinforce strongest planet
        const strongestPlanet = myPlanets.reduce((a, b) => a.troops > b.troops ? a : b);
        const weakestFriendly = myPlanets.reduce((a, b) => a.troops < b.troops ? a : b);

        if (strongestPlanet.id !== weakestFriendly.id && weakestFriendly.troops < strongestPlanet.troops * 0.5) {
            const troopsToSend = Math.floor(strongestPlanet.troops * 0.2);
            if (troopsToSend > 10) {
              this.memory.actionCooldown = this.api.getDecisionCooldown();
              return {
                  fromId: strongestPlanet.id,
                  toId: weakestFriendly.id,
                  troops: troopsToSend
              };
            }

        }


        return null;
    }


    updateTargets() {
        this.memory.expansionTargets = this.api.getNeutralPlanets();
        this.memory.defenseTargets = this.api.getMyPlanets();
    }


    executeExpansion(myPlanets) {
        if (this.memory.expansionTargets.length === 0) {
            return null;
        }

        const strongestPlanet = myPlanets.reduce((a, b) => a.troops > b.troops ? a : b);
        const bestTarget = this.findBestExpansionTarget(strongestPlanet, this.memory.expansionTargets);

        if (!bestTarget) {
            return null;
        }

        const attackForce = Math.min(Math.floor(strongestPlanet.troops * this.aggressionFactor), 999);

        if (attackForce > 10) {
            return {
                fromId: strongestPlanet.id,
                toId: bestTarget.id,
                troops: attackForce
            };
        }

        return null;
    }


    executeDefense(myPlanets) {
        const threatenedPlanet = this.findMostThreatenedPlanet(myPlanets);

        if (!threatenedPlanet) {
            return null;
        }

        const availableSupport = myPlanets.filter(p => p.id !== threatenedPlanet.id && p.troops > 10);

        if (availableSupport.length === 0) {
            return null;
        }

        const closestSupporter = this.api.findNearestPlanet(threatenedPlanet, availableSupport);
        const troopsToSend = Math.floor(closestSupporter.troops * 0.5);

        if (troopsToSend > 10) {
            return {
                fromId: closestSupporter.id,
                toId: threatenedPlanet.id,
                troops: troopsToSend
            };
        }

        return null;
    }


    findBestExpansionTarget(sourcePlanet, targets) {
        let bestTarget = null;
        let bestValue = -Infinity;

        for (const target of targets) {
            const distance = this.api.getDistance(sourcePlanet, target);
            const travelTime = this.api.getTravelTime(sourcePlanet, target);

            // Value based on planet size, production, centrality, and distance
            const value = (target.size + target.productionRate + this.api.getPlanetCentrality(target)) / (distance * (1+travelTime));

            if (value > bestValue) {
                bestValue = value;
                bestTarget = target;
            }
        }

        return bestTarget;
    }


    findMostThreatenedPlanet(myPlanets) {
        let mostThreatened = null;
        let highestThreat = 0;

        for (const planet of myPlanets) {
            const threat = this.calculateThreat(planet);

            if (threat > highestThreat) {
                highestThreat = threat;
                mostThreatened = planet;
            }
        }

        return mostThreatened;
    }

    calculateThreat(planet) {
        let threatScore = 0;
        const incomingAttacks = this.api.getIncomingAttacks(planet);

        for(const attack of incomingAttacks) {
            threatScore += attack.amount / (attack.duration + 0.1)  //closer attacks more threatening
        }
        //Add a threat for nearby enemy planets
        const enemyPlanets = this.api.getEnemyPlanets();
        for(const enemy of enemyPlanets){
           const dist = this.api.getDistance(planet, enemy)
           threatScore += (enemy.troops/ (dist*dist))
        }

        return threatScore;
    }
}