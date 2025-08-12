// =============================================
// root/javascript/bots/Qwen3CoderD.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * PredatorBot: An adaptive RTS AI that dominates through tactical timing, strategic aggression, and intelligent resource allocation.
 * Core strategy: Aggressive expansion with smart prediction, focusing on key planets and exploiting weaknesses.
 * Strategic pillars:
 *   1. Adaptive phase-based behavior (Early: Expand, Mid: Weaken Key Opponents, Late: Crush).
 *   2. Smart fleet dispatch using threat evaluation and state prediction.
 *   3. Mission tracking to prevent over-commitment and manage resources.
 *   4. Efficient use of cooldowns by prioritizing high-impact actions.
 */

export default class Qwen3CoderD extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // Memory for persistent state and mission tracking
        this.memory.missions = {}; // Tracks {targetId: fromId} to avoid multiple attacks on same target
        this.memory.actionCooldown = 0;
    }

    /**
     * Main decision-making function called every turn when available.
     * @param {number} dt - Time elapsed since last turn, scaled by game speed.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        // Handle internal cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets to act from, end game.
        }

        // Select a high-value target based on current game situation
        const target = this.selectBestTarget();
        if (!target) {
            return null; // No viable targets found
        }

        // Find the best source planet to attack from (closest with enough troops)
        const source = this.findBestSource(target);
        if (!source || source.troops <= 10) {
            return null; // Not enough troops or no valid source
        }

        // Calculate the minimum troops needed to capture the target
        const troopsRequired = this.calculateTroopNeed(target);
        if (source.troops < troopsRequired + 10) { // Add small buffer
            return null; // Not enough troops even with safety margin
        }

        // Commit to this action and set cooldown
        this.memory.missions[target.id] = source.id;
        this.memory.actionCooldown = this.api.getDecisionCooldown();

        // Return the properly formatted decision
        return {
            fromId: source.id,
            toId: target.id,
            troops: troopsRequired
        };
    }

    /**
     * Selects the most strategic target based on game phase and value.
     * @returns {Planet|null} The best target planet.
     */
    selectBestTarget() {
        const allTargets = [
            ...this.api.getEnemyPlanets(),
            ...this.api.getNeutralPlanets()
        ];

        // Filter out targets already being attacked (unless it's a critical late-game push)
        const availableTargets = allTargets.filter(planet =>
            !this.memory.missions[planet.id] || this.api.getGamePhase() === 'LATE'
        );

        if (availableTargets.length === 0) return null;

        // Prioritize based on game phase
        const phase = this.api.getGamePhase();
        let sortedTargets;

        if (phase === 'EARLY') {
            // Early game: Expand quickly to neutrals and weak enemies
            sortedTargets = availableTargets.sort((a, b) => {
                const aValue = this.api.calculatePlanetValue(a);
                const bValue = this.api.calculatePlanetValue(b);
                const aPredicted = this.api.predictPlanetState(a, this.api.getTravelTime(this.getClosestMyPlanet(a), a));
                const bPredicted = this.api.predictPlanetState(b, this.api.getTravelTime(this.getClosestMyPlanet(b), b));
                // Prefer planets that will be easier/sooner to capture
                return (aValue / (aPredicted.troops + 1)) - (bValue / (bPredicted.troops + 1));
            });
        } else {
            // Mid/Late game: Target high-value or vulnerable planets
            sortedTargets = availableTargets.sort((a, b) => {
                // Evaluate target value based on our custom formula
                const aScore = this.evaluateTarget(a);
                const bScore = this.evaluateTarget(b);
                return bScore - aScore; // Descending order
            });
        }

        return sortedTargets[0] || null;
    }

    /**
     * Custom target evaluation function combining value, vulnerability, and strategic impact.
     * @param {Planet} target - The target planet.
     * @returns {number} The score representing the target's attractiveness.
     */
    evaluateTarget(target) {
        const value = this.api.calculatePlanetValue(target);
        const distanceFactor = 1 / (this.getClosestMyPlanet(target)?.distance || 1);
        
        // Get predicted state at time of arrival to assess vulnerability
        const myClosest = this.getClosestMyPlanet(target);
        if (!myClosest) return 0;

        const travelTime = this.api.getTravelTime(myClosest.planet, target);
        const predictedState = this.api.predictPlanetState(target, travelTime);
        
        // If we predict we can take it, it's a good target
        let vulnerability = 1 / (predictedState.troops + 1); // Lower enemy troops = higher vulnerability

        // Boost score for high-value targets like large productive planets
        const sizeBoost = target.size > 30 ? 2 : 1;
        const productionBoost = target.productionRate > 2 ? 2 : 1;

        return value * vulnerability * distanceFactor * sizeBoost * productionBoost;
    }

    /**
     * Finds the best source planet to launch an attack from.
     * @param {Planet} target - The target planet.
     * @returns {Planet|null} The best source planet.
     */
    findBestSource(target) {
        const myPlanets = this.api.getMyPlanets().filter(p => p.troops > 10);
        if (myPlanets.length === 0) return null;

        // Sort by proximity and available troops
        const sortedSources = myPlanets.sort((a, b) => {
            const timeA = this.api.getTravelTime(a, target);
            const timeB = this.api.getTravelTime(b, target);
            // Prefer closer planets with more troops
            return (timeA / a.troops) - (timeB / b.troops);
        });

        return sortedSources[0];
    }

    /**
     * Calculates the precise number of troops needed to conquer a planet.
     * @param {Planet} target - The target planet.
     * @returns {number} The number of troops to send.
     */
    calculateTroopNeed(target) {
        const closestMine = this.getClosestMyPlanet(target)?.planet;
        if (!closestMine) return 100; // Fallback

        const travelTime = this.api.getTravelTime(closestMine, target);
        const predictedState = this.api.predictPlanetState(target, travelTime);
        
        // Add a safety margin to ensure conquest
        const safetyMargin = 5 + Math.floor(predictedState.troops * 0.1);
        return Math.min(999, Math.floor(predictedState.troops + safetyMargin));
    }

    /**
     * Helper to find the closest owned planet to a given target.
     * @param {Planet} target - The target planet.
     * @returns {{planet: Planet, distance: number}|null} The closest planet and distance.
     */
    getClosestMyPlanet(target) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        let closest = null;
        let minDistance = Infinity;

        for (const planet of myPlanets) {
            const distance = this.api.getDistance(planet, target);
            if (distance < minDistance) {
                minDistance = distance;
                closest = { planet, distance };
            }
        }

        return closest;
    }
}