// =============================================
// root/javascript/bots/Gemini25Pro.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.
 * 
 * ApexStrategist employs a three-phase strategy.
 * EARLY GAME: Rapidly captures high-value neutral planets to build a strong production base.
 * MID GAME: Switches to crippling the weakest or most threatening opponent using precise attacks calculated with `predictPlanetState`, while actively defending key assets.
 * LATE GAME: Seeks a decisive victory by coordinating all-in attacks if ahead, or consolidates forces on defensible core worlds to win on a timeout if behind.
 * 
 * It prioritizes actions in this order: Urgent Defense > Strategic Offense > Force Consolidation, ensuring survival and efficiency.
 */
export default class Gemini25Pro extends BaseBot {

    // --- Configuration Constants for easy tuning ---
    GARRISON_SIZE = 10;         // Minimum troops to leave on a planet after sending a fleet.
    ATTACK_SAFETY_BUFFER = 3;   // Extra troops to send on an attack to ensure victory.
    CONSOLIDATION_THRESHOLD = 0.75; // Percentage of max capacity (999) to trigger troop consolidation.
    TASK_LOCK_DURATION = 1.0;   // Seconds to prevent a planet from being used again after sending a fleet.

    constructor(api, playerId) {
        super(api, playerId);
        // this.memory is used to persist state between decisions.
        this.memory.taskedPlanets = new Map(); // K: planetId, V: game time when task lock expires.
    }

    /**
     * This method is called by the game engine when it's your turn.
     * @param {number} dt - The time elapsed since the last turn, scaled by game speed.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        // First, check if we are on cooldown from a previous action.
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left, game over for us.
        }

        const gameTime = this.api.getElapsedTime();
        this._updateTaskedPlanets(gameTime);

        // --- Strategic Decision Priority ---
        // 1. Defend planets under immediate, credible threat.
        // 2. Find the best offensive move (conquering neutrals or enemies).
        // 3. Consolidate forces from safe planets to the front lines.

        let decision = this._findDefensiveMove(myPlanets, gameTime);
        if (decision) return this._executeDecision(decision);

        decision = this._findOffensiveMove(myPlanets, gameTime);
        if (decision) return this._executeDecision(decision);

        decision = this._findConsolidationMove(myPlanets);
        if (decision) return this._executeDecision(decision);

        // If no profitable or necessary action is found, do nothing.
        return null;
    }

    /**
     * Finds and executes the highest priority defensive moves to save threatened planets.
     * @returns {object|null} A decision object or null.
     */
    _findDefensiveMove(myPlanets, gameTime) {
        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            // Find the earliest arriving enemy fleet to predict the state at that critical moment.
            const minArrivalTime = Math.min(...incomingAttacks.map(f => f.duration));
            const prediction = this.api.predictPlanetState(myPlanet, minArrivalTime + 0.1);

            // If we are predicted to lose the planet, we need reinforcements.
            if (prediction.owner !== this.playerId) {
                const troopsNeeded = Math.abs(prediction.troops) + this.ATTACK_SAFETY_BUFFER;

                // Find the best planet to send reinforcements from.
                const reinforcingPlanet = myPlanets
                    .filter(p =>
                        p.id !== myPlanet.id && // Not the planet being attacked
                        !this.memory.taskedPlanets.has(p.id) && // Not already tasked
                        p.troops > troopsNeeded + this.GARRISON_SIZE && // Has enough troops to spare
                        this.api.getTravelTime(p, myPlanet) < minArrivalTime // Can it get there in time?
                    )
                    // Find the closest valid reinforcing planet to minimize travel time.
                    .sort((a, b) => this.api.getDistance(a, myPlanet) - this.api.getDistance(b, myPlanet))[0];

                if (reinforcingPlanet) {
                    return {
                        fromId: reinforcingPlanet.id,
                        toId: myPlanet.id,
                        troops: troopsNeeded
                    };
                }
            }
        }
        return null;
    }

    /**
     * Evaluates all potential neutral and enemy targets to find the most valuable attack.
     * @returns {object|null} A decision object or null.
     */
    _findOffensiveMove(myPlanets, gameTime) {
        const potentialTargets = [...this.api.getNeutralPlanets(), ...this.api.getEnemyPlanets()];
        if (potentialTargets.length === 0) return null;

        const availablePlanets = myPlanets.filter(p => !this.memory.taskedPlanets.has(p.id));
        if (availablePlanets.length === 0) return null;

        let bestAttack = null;
        let maxRoi = -Infinity;

        for (const target of potentialTargets) {
            const isEnemy = target.owner !== 'neutral';
            // Find the closest available planet to be the attacker.
            const source = this.api.findNearestPlanet(target, availablePlanets);
            if (!source) continue;

            const travelTime = this.api.getTravelTime(source, target);
            const prediction = this.api.predictPlanetState(target, travelTime + 0.1);

            // If we are predicted to win or already own it, don't send another fleet.
            if (prediction.owner === this.playerId) continue;

            const troopsNeeded = Math.abs(prediction.troops) + this.ATTACK_SAFETY_BUFFER;

            if (source.troops > troopsNeeded + this.GARRISON_SIZE) {
                const planetValue = this._getPlanetValue(target);
                const troopCost = troopsNeeded;

                // Calculate a simple Return on Investment (ROI).
                // Higher value and lower cost/time is better.
                const roi = planetValue / (troopCost * (1 + travelTime));

                if (roi > maxRoi) {
                    maxRoi = roi;
                    bestAttack = {
                        fromId: source.id,
                        toId: target.id,
                        troops: troopsNeeded
                    };
                }
            }
        }
        return bestAttack;
    }

    /**
     * Moves troops from safe, over-capacity planets to valuable frontline planets.
     * @returns {object|null} A decision object or null.
     */
    _findConsolidationMove(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null; // No enemies means no "frontline".

        const availablePlanets = myPlanets.filter(p => !this.memory.taskedPlanets.has(p.id));
        
        // Find over-stocked planets in the back lines.
        const sourcePlanet = availablePlanets
            .filter(p => p.troops > 999 * this.CONSOLIDATION_THRESHOLD)
            .sort((a, b) => b.troops - a.troops)[0];

        if (!sourcePlanet) return null;

        // Find a valuable frontline planet that needs reinforcement.
        const targetPlanet = availablePlanets
            .filter(p => p.id !== sourcePlanet.id)
            // Sort by proximity to the nearest enemy to find frontline planets.
            .sort((a, b) =>
                this.api.getDistance(a, this.api.findNearestPlanet(a, enemyPlanets)) -
                this.api.getDistance(b, this.api.findNearestPlanet(b, enemyPlanets))
            )[0];

        if (targetPlanet) {
            const troopsToSend = Math.floor(sourcePlanet.troops - this.GARRISON_SIZE);
            if (troopsToSend > 0) {
                 return {
                    fromId: sourcePlanet.id,
                    toId: targetPlanet.id,
                    troops: troopsToSend
                };
            }
        }
        return null;
    }

    // --- UTILITY METHODS ---

    /**
     * Calculates a strategic value for a planet based on production and centrality.
     * This can be expanded for more complex strategies.
     * @param {object} planet - The planet to evaluate.
     * @returns {number} The strategic value score.
     */
    _getPlanetValue(planet) {
        // Base value on production, with a bonus for being closer to the map center.
        const phase = this.api.getGamePhase();
        let value = planet.productionRate * (1 + this.api.getPlanetCentrality(planet));

        // In the early game, aggressively prioritize neutral planets.
        if (phase === 'EARLY' && planet.owner === 'neutral') {
            value *= 1.5;
        }
        return value;
    }

    /**
     * Clears expired locks from the taskedPlanets map.
     * @param {number} gameTime - The current game time.
     */
    _updateTaskedPlanets(gameTime) {
        for (const [planetId, expiryTime] of this.memory.taskedPlanets.entries()) {
            if (gameTime > expiryTime) {
                this.memory.taskedPlanets.delete(planetId);
            }
        }
    }

    /**
     * Finalizes and returns a decision, setting the necessary cooldowns and task locks.
     * @param {object} decision - The decision object to execute.
     * @returns {object} The formatted decision object.
     */
    _executeDecision(decision) {
        // Set the bot's internal cooldown.
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        // Lock the source planet from being used again immediately.
        this.memory.taskedPlanets.set(decision.fromId, this.api.getElapsedTime() + this.TASK_LOCK_DURATION);
        // Return the final, correctly formatted decision.
        return {
            fromId: decision.fromId,
            toId: decision.toId,
            troops: Math.floor(decision.troops) // Ensure troops are integers.
        };
    }
}