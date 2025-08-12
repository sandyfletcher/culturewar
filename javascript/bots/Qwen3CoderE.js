// =============================================
// root/javascript/bots/Qwen3CoderE.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * Domination through adaptive expansion and calculated aggression.
 * This bot focuses on efficient frontier control, predictive conquest, and dynamic resource allocation.
 * It balances expansion with consolidation, identifying high-value targets while protecting its core.
 */

export default class Qwen3CoderE extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // Memory for stateful decision making
        this.memory.actionCooldown = 0;
        this.memory.missions = new Map(); // Tracks planets with active outgoing fleets
        this.memory.defenseAssignments = new Map(); // Tracks planets under defensive watch
    }

    /**
     * Main decision-making method called by the game engine.
     * @param {number} dt - Time elapsed since last turn, scaled by game speed.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        // Cooldown management
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets to command from
        }

        // --- Strategic Decision Making ---

        // 1. DEFENSE: Check for imminent threats
        const defenseMove = this._prioritizeDefense();
        if (defenseMove) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return defenseMove;
        }

        // 2. OFFENSE/EXPANSION: Plan conquests
        const offensiveMove = this._planOffensiveAction();
        if (offensiveMove) {
            // Track the mission to prevent overcommitment
            const missionKey = offensiveMove.fromId;
            if (!this.memory.missions.has(missionKey)) {
                this.memory.missions.set(missionKey, []);
            }
            this.memory.missions.get(missionKey).push(offensiveMove.toId);
            
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return offensiveMove;
        }

        // No action taken
        return null;
    }

    /**
     * Identifies and prioritizes defensive actions for endangered planets.
     * @returns {object|null} A defensive move or null if none is needed.
     */
    _prioritizeDefense() {
        const myPlanets = this.api.getMyPlanets();
        const allMovements = this.api.getAllTroopMovements();

        // Clear old defense assignments
        this.memory.defenseAssignments.clear();

        for (const planet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length === 0) continue;

            // Calculate total incoming enemy troops
            const totalEnemyTroops = incomingAttacks.reduce((sum, fleet) => sum + fleet.amount, 0);
            
            // Predict planet state at the time of first attack arrival
            const firstArrivalTime = Math.min(...incomingAttacks.map(f => f.duration));
            const predictedState = this.api.predictPlanetState(planet, firstArrivalTime);
            
            // If the planet is predicted to be lost, attempt reinforcement
            if (predictedState.owner !== this.playerId) {
                // Find a nearby friendly planet to send reinforcement from
                const friendlyPlanets = myPlanets.filter(p => p.id !== planet.id);
                const nearestReinforcer = this.api.findNearestPlanet(planet, friendlyPlanets);

                if (nearestReinforcer) {
                    const travelTime = this.api.getTravelTime(nearestReinforcer, planet);
                    const troopsNeeded = totalEnemyTroops - planet.troops + 10; // Small buffer

                    if (nearestReinforcer.troops > troopsNeeded && troopsNeeded > 0) {
                        // Check if this reinforcer is already committed to another mission
                        const missions = this.memory.missions.get(nearestReinforcer.id) || [];
                        if (!missions.includes(planet.id)) {
                            return {
                                fromId: nearestReinforcer.id,
                                toId: planet.id,
                                troops: Math.min(nearestReinforcer.troops - 1, troopsNeeded)
                            };
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * Plans and executes an offensive or expansion move.
     * @returns {object|null} An offensive move or null if none is viable.
     */
    _planOffensiveAction() {
        const myPlanets = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const gamePhase = this.api.getGamePhase();
        
        // Value targets based on potential and strategic importance
        const allTargets = [...neutralPlanets, ...enemyPlanets];
        const evaluatedTargets = allTargets.map(target => {
            const value = this._evaluateTarget(target);
            return { target, value };
        }).filter(item => item.value > 0);

        // Sort by value descending
        evaluatedTargets.sort((a, b) => b.value - a.value);

        // Find a suitable source and target pair
        for (const { target } of evaluatedTargets) {
            // Find the best source planet for this target
            const source = this._findBestSource(target, myPlanets);
            if (source) {
                // Calculate minimum troops needed for conquest
                const travelTime = this.api.getTravelTime(source, target);
                const predictedState = this.api.predictPlanetState(target, travelTime);
                
                let troopsRequired;
                if (predictedState.owner === this.playerId) {
                    // Reinforcing own planet
                    troopsRequired = 10; // Small reinforcement
                } else {
                    // Conquering enemy/neutral
                    troopsRequired = predictedState.troops + 15; // Add buffer
                }

                if (source.troops > troopsRequired) {
                    // Check if this source is already committed
                    const missions = this.memory.missions.get(source.id) || [];
                    if (!missions.includes(target.id)) {
                        return {
                            fromId: source.id,
                            toId: target.id,
                            troops: Math.min(source.troops - 5, troopsRequired)
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Evaluates a target planet's strategic value.
     * @param {object} planet - The planet to evaluate.
     * @returns {number} The calculated value.
     */
    _evaluateTarget(planet) {
        // Base value from built-in helper
        let value = this.api.calculatePlanetValue(planet);
        
        // Boost value for enemy planets in late game
        if (planet.owner !== 'neutral' && planet.owner !== this.playerId) {
            value *= 1.5;
        }
        
        // Reduce value for already heavily contested planets
        const incomingFleets = this.api.getAllTroopMovements().filter(
            m => m.to.id === planet.id
        );
        if (incomingFleets.length > 2) {
            value *= 0.7;
        }
        
        return value;
    }

    /**
     * Finds the most suitable source planet for attacking a target.
     * @param {object} target - The target planet.
     * @param {Array} sources - List of potential source planets.
     * @returns {object|null} The best source planet or null.
     */
    _findBestSource(target, sources) {
        // Filter sources with enough troops and not on cooldown
        const availableSources = sources.filter(planet => {
            const missions = this.memory.missions.get(planet.id) || [];
            return planet.troops > 20 && !missions.includes(target.id);
        });

        if (availableSources.length === 0) return null;

        // Prioritize sources based on proximity and surplus troops
        const evaluatedSources = availableSources.map(source => {
            const distance = this.api.getDistance(source, target);
            const surplusTroops = source.troops - 20; // Keep a buffer
            // Higher score for closer and stronger planets
            const score = (surplusTroops / distance);
            return { source, score };
        });

        evaluatedSources.sort((a, b) => b.score - a.score);
        return evaluatedSources[0].source;
    }
}