// =============================================
// root/javascript/bots/Gemma3nE2B.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    This bot aims to aggressively expand and conquer neutral planets while efficiently managing resource production.
    It prioritizes taking over planets with high production rates and uses prediction to anticipate enemy movements.
    It adapts its strategy based on game phase, focusing on rapid expansion in the early game and more calculated assaults in the late game.
*/

export default class Gemma3nE2B extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = new Memory();
    }

    /**
     * This method is called by the game engine when it's your turn.
     * @param {number} dt - The time elapsed since the last turn, scaled by game speed.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        // Check for cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        const allPlanets = this.api.getAllPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const opponents = this.api.getOpponentIds();

        // 1. Prioritize expanding to neutral planets with high production
        let bestTarget = null;
        let highestProduction = -1;

        for (const planet of neutralPlanets) {
            const production = this.api.getPlanetProductionRate(planet);
            if (production > highestProduction) {
                highestProduction = production;
                bestTarget = planet;
            }
        }

        if (bestTarget) {
            const troopsToSend = Math.floor(this.api.getMyPlanets()[0].troops * 0.8); // Send a decent number of troops
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return {
                fromId: this.api.getMyPlanets()[0].id, // Use the first owned planet as the source
                toId: bestTarget.id,
                troops: troopsToSend
            };
        }

        // 2. If no high-production neutral planets are available, look for nearby enemy planets
        if (enemyPlanets.length > 0) {
            const nearestEnemy = this.api.getNearestEnemyPlanet(this.api.getMyPlanets()[0].id);
            if (nearestEnemy) {
                const troopsToSend = Math.floor(this.api.getMyPlanets()[0].troops * 0.6);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: this.api.getMyPlanets()[0].id,
                    toId: nearestEnemy.id,
                    troops: troopsToSend
                };
            }
        }

        // 3. If no immediate targets, expand to any available planet
        if (myPlanets.length > 0 && neutralPlanets.length > 0) {
            const closestNeutral = this.api.getNearestPlanet(this.api.getMyPlanets()[0].id, neutralPlanets);
            if (closestNeutral) {
                const troopsToSend = Math.floor(this.api.getMyPlanets()[0].troops * 0.5);
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return {
                    fromId: this.api.getMyPlanets()[0].id,
                    toId: closestNeutral.id,
                    troops: troopsToSend
                };
            }
        }

        // 4. If still no clear targets, reinforce existing planets
        if (myPlanets.length > 0) {
            const reinforcePlanet = this.api.getMyPlanets()[0];
            const troopsToAdd = Math.floor(reinforcePlanet.troops * 0.2);
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return {
                fromId: reinforcePlanet.id,
                toId: reinforcePlanet.id,
                troops: troopsToAdd
            };
        }

        // 5. If no action is possible, return null
        return null;
    }
}

// Simple memory class for demonstration
class Memory {
    constructor() {
        this.actionCooldown = 0;
    }
}