// =============================================
// root/javascript/bots/Gemini20FlashD.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    This bot focuses on aggressive early-game expansion and overwhelming force.
    It prioritizes capturing neutral planets and then attacks the weakest enemy planets.
    It uses troop prediction to calculate optimal attack sizes and adapts its strategy based on the game phase.
*/

export default class Gemini20FlashD extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        this.memory.expansionTargets = []; // List of neutral planets to capture.
        this.memory.attackTargets = []; // List of enemy planets to attack.
        this.memory.optimalAttackTroops = {}; //Stores the optimal amount of troops to attack with per enemy planet id
        this.memory.maxTroopsToSpend = 300;

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

        // Update target lists based on game phase.
        if (gamePhase === 'EARLY') {
            this.updateExpansionTargets();
        } else {
            this.updateAttackTargets();
        }

        let bestMove = this.chooseBestMove(myPlanets);

        if (bestMove) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return bestMove;
        }

        return null;
    }

    updateExpansionTargets() {
        const neutralPlanets = this.api.getNeutralPlanets();
        // Sort neutral planets by size (larger planets are more valuable).
        this.memory.expansionTargets = neutralPlanets.sort((a, b) => b.size - a.size);
    }

    updateAttackTargets() {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) {
            this.memory.attackTargets = [];
            return;
        }
        // Sort enemy planets by weakest first (lowest troop count).
        this.memory.attackTargets = enemyPlanets.sort((a, b) => a.troops - b.troops);
        
        //Populate optimal attack troops
        for(let planet of this.memory.attackTargets)
        {
            let predictedState = this.api.predictPlanetState(planet, this.api.getTravelTime(this.api.getMyPlanets()[0], planet));

            this.memory.optimalAttackTroops[planet.id] = Math.ceil(planet.troops + 1);
            if(this.memory.optimalAttackTroops[planet.id] > this.memory.maxTroopsToSpend)
            {
                this.memory.optimalAttackTroops[planet.id] = this.memory.maxTroopsToSpend;
            }
        }
    }

    chooseBestMove(myPlanets) {
        // 1. Expand to neutral planets.
        if (this.memory.expansionTargets.length > 0) {
            const target = this.memory.expansionTargets[0];
            const source = this.findStrongestPlanet(myPlanets);
            if (source && source.troops > 20) {
                const troopsToSend = Math.floor(Math.min(source.troops * 0.75, this.memory.maxTroopsToSpend)); // Limit troops sent.

                return {
                    fromId: source.id,
                    toId: target.id,
                    troops: troopsToSend
                };
            }
        }

        // 2. Attack enemy planets.
        if (this.memory.attackTargets.length > 0) {
            const target = this.memory.attackTargets[0];

            //Determine how many troops we want to attack this planet with
            let troopsToSend = this.memory.optimalAttackTroops[target.id];
            const source = this.findStrongestPlanet(myPlanets);

            if (source && source.troops > 20) {

                if(source.troops > troopsToSend)
                {
                     return {
                        fromId: source.id,
                        toId: target.id,
                        troops: troopsToSend
                    };
                }
                else
                {
                    troopsToSend = Math.floor(source.troops * 0.75);
                    return {
                        fromId: source.id,
                        toId: target.id,
                        troops: troopsToSend
                    };

                }
            }
        }

        // 3. Reinforce vulnerable planets (optional, for more complex bots).
        return null;
    }

    findStrongestPlanet(planets) {
        let strongest = null;
        let maxTroops = 0;
        for (const planet of planets) {
            if (planet.troops > maxTroops) {
                maxTroops = planet.troops;
                strongest = planet;
            }
        }
        return strongest;
    }
}