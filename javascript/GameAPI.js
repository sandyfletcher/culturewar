// ===========================================
// root/javascript/GameAPI.js — provides a unified, read-only API for bots to interact with the game state
// ===========================================

import { config } from './config.js';

/**
 * Creates a deep, read-only proxy for a given object or array.
 * This is the security layer that prevents bots from cheating by modifying
 * game state objects passed to them through the API.
 * @param {any} obj - The object, array, or primitive to make read-only.
 * @returns {any} A read-only version of the input.
 */
function createReadOnlyProxy(obj) {
    // Primitives are inherently read-only in this context, so return them directly.
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    // A single, unified handler works for both arrays and objects.
    return new Proxy(obj, {
        set(target, property, value) {
            console.error(`Bot attempted to modify read-only property '${String(property)}' on a game object. This is not allowed.`);
            return true; // Silently fail the write operation.
        },

        get(target, property, receiver) {
            // Get the value from the original object.
            const value = target[property];

            // If the retrieved value is a function, we must bind it to the original
            // target to ensure the correct 'this' context when the function is called.
            // This prevents "Illegal invocation" errors on native methods (e.g., canvas.getContext, array.map).
            if (typeof value === 'function') {
                return value.bind(target);
            }

            // For all other properties (nested objects, arrays, primitives),
            // we recursively wrap them in a new proxy to ensure deep readonly-ness.
            return createReadOnlyProxy(value);
        }
    });
}


export default class GameAPI { 
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        // The canvas object has native getters (width, height) that need the correct 'this' context.
        // The proxy handles this correctly now.
        this.canvas = createReadOnlyProxy(game.canvas); 
        this.troopMovementSpeed = config.troop.movementSpeed;
    }

    // --- GENERAL GAME STATE FUNCTIONS ---
    /**
     * Gets all planets in the game.
     * @returns {Planet[]} A read-only array of read-only Planet objects.
     */
    getAllPlanets() {
        return createReadOnlyProxy(this.game.planets);
    }

    /**
     * Gets a specific planet by its unique ID.
     * @param {string} planetId
     * @returns {Planet | null} A read-only Planet object or null.
     */
    getPlanetById(planetId) {
        const planet = this.game.planets.find(p => p.id === planetId);
        return planet ? createReadOnlyProxy(planet) : null;
    }

    /**
     * Gets all enemy planets (owned by other players, excluding neutral).
     * @returns {Planet[]} A read-only array of read-only Planet objects.
     */
    getEnemyPlanets() {
        const planets = this.game.planets.filter(p => p.owner !== this.playerId && p.owner !== 'neutral');
        return createReadOnlyProxy(planets);
    }

    /**
     * Gets all neutral planets.
     * @returns {Planet[]} A read-only array of read-only Planet objects.
     */
    getNeutralPlanets() {
        const planets = this.game.planets.filter(p => p.owner === 'neutral');
        return createReadOnlyProxy(planets);
    }

    /**
     * Gets all active troop movements.
     * @returns {TroopMovement[]} A read-only array of read-only TroopMovement objects.
     */
    getAllTroopMovements() {
        return createReadOnlyProxy(this.game.troopMovements);
    }

    /**
     * Gets an array of all player IDs currently in the game, including the current AI.
     * @returns {string[]}
     */
    getAllPlayerIds() {
        return this.game.playersController.players.map(p => p.id);
    }

    /**
     * Gets an array of all opponent player IDs currently in the game.
     * @returns {string[]}
     */
    getOpponentIds() {
        return this.game.playersController.players
            .map(p => p.id)
            .filter(id => id !== this.playerId);
    }

    /**
     * Gets the elapsed time in seconds since the game started.
     * @returns {number}
     */
    getElapsedTime() {
        return this.game.gameState.elapsedGameTime;
    }

    /**
     * Gets the global minimum time in seconds between any two AI actions.
     * A bot can use this to schedule its own internal cooldowns effectively.
     * @returns {number}
     */
    getDecisionCooldown() {
        return config.ai.decisionCooldown;
    }

    /**
     * Gets the total configured duration of the game in seconds.
     * @returns {number}
     */
    getGameDuration() {
        return config.game.defaultDuration;
    }

    /**
     * Gets the maximum number of troops a planet can hold.
     * @returns {number}
     */
    getMaxPlanetTroops() {
        // This is a fixed value from the global config, not a per-game setting.
        return config.planet.maxTroops;
    }

    /**
     * Calculates the Euclidean distance between two planets.
     * @param {Planet} planet1
     * @param {Planet} planet2
     * @returns {number}
     */
    getDistance(planet1, planet2) {
        const dx = planet1.x - planet2.x;
        const dy = planet1.y - planet2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculates the travel time in seconds for a fleet between two planets.
     * @param {Planet} planet1
     * @param {Planet} planet2
     * @returns {number}
     */
    getTravelTime(planet1, planet2) {
        return this.getDistance(planet1, planet2) / this.troopMovementSpeed;
    }

    /**
     * Finds the nearest planet from a given list of planets to a source planet.
     * @param {Planet} sourcePlanet - The planet to measure from.
     * @param {Planet[]} targetPlanets - An array of planets to search through.
     * @returns {Planet | null} The closest read-only planet, or null if targetPlanets is empty.
     */
    findNearestPlanet(sourcePlanet, targetPlanets) {
        if (!targetPlanets || targetPlanets.length === 0) {
            return null;
        }
        let nearest = null;
        let minDistance = Infinity;
        // We must iterate over the original (proxied) array to access its elements.
        const potentialTargets = Array.from(targetPlanets);

        for (const target of potentialTargets) {
            if (sourcePlanet.id === target.id) continue; // Compare by ID for safety with proxies
            const distance = this.getDistance(sourcePlanet, target);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = target;
            }
        }
        return nearest ? createReadOnlyProxy(nearest) : null;
    }

    /**
     * Calculates a strategic value for a planet. Higher is better.
     * Factors in size, production, and centrality using weights from the config.
     * @param {Planet} planet
     * @returns {number} The strategic value score.
     */
    calculatePlanetValue(planet) {
        const sizeValue = planet.size * config.ai.scoring.sizeWeight;
        const productionValue = planet.productionRate * config.ai.scoring.productionWeight;
        const positionValue = this.calculateCentrality(planet) * config.ai.scoring.centralityWeight;
        return sizeValue + productionValue + positionValue;
    }

    /**
     * Calculates a threat score for one of the AI's own planets. Higher is more threatened.
     * Factors in nearby enemy troops and incoming attacks, using parameters from the config.
     * @param {Planet} myPlanet - The planet to assess (must be owned by the AI).
     * @returns {number} The threat score.
     */
    calculateThreat(myPlanet) {
        if (myPlanet.owner !== this.playerId) return 0;
        let threat = 0;
        const enemyPlanets = this.game.planets.filter(p => p.owner !== this.playerId && p.owner !== 'neutral');
        
        // Threat from nearby enemy planets
        for (const enemy of enemyPlanets) {
            const distance = this.getDistance(myPlanet, enemy);
            if (distance < config.ai.threat.radius) {
                threat += enemy.troops / (distance + config.ai.threat.distanceDivisor);
            }
        }
        // Threat from incoming attacks
        const incomingAttacks = this.getIncomingAttacks(myPlanet); // This already returns a proxy
        threat += incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        return threat;
    }

    /**
     * Gets all incoming enemy troop movements targeting a specific planet.
     * @param {Planet} targetPlanet
     * @returns {TroopMovement[]} A read-only array of read-only TroopMovement objects.
     */
    getIncomingAttacks(targetPlanet) {
        const movements = this.game.troopMovements.filter(m => 
            m.to.id === targetPlanet.id && m.owner !== targetPlanet.owner && m.owner !== 'neutral'
        );
        return createReadOnlyProxy(movements);
    }

    /**
     * Gets all incoming friendly troop movements (reinforcements) targeting a specific planet.
     * @param {Planet} targetPlanet
     * @returns {TroopMovement[]} A read-only array of read-only TroopMovement objects.
     */
    getIncomingReinforcements(targetPlanet) {
        const movements = this.game.troopMovements.filter(m => 
            m.to.id === targetPlanet.id && m.owner === targetPlanet.owner
        );
        return createReadOnlyProxy(movements);
    }

    /**
     * Predicts the state of a planet (owner and troop count) at a specific time in the future.
     * This is a powerful strategic tool that accounts for production and all incoming fleets.
     * @param {Planet} planet - The planet to predict.
     * @param {number} timeInFuture - How many seconds into the future to predict.
     * @returns {{owner: string, troops: number}} A read-only object with the predicted state.
     */
    predictPlanetState(planet, timeInFuture) {
        let predictedTroops = planet.troops;
        let predictedOwner = planet.owner;
        // 1. Account for production gains
        if (predictedOwner !== 'neutral') {
            predictedTroops += planet.productionRate * timeInFuture;
        }
        predictedTroops = Math.min(this.getMaxPlanetTroops(), predictedTroops);
        // 2. Get all fleets arriving within the timeframe
        const arrivingFleets = this.game.troopMovements
            .filter(m => m.to.id === planet.id && m.duration <= timeInFuture)
            .sort((a, b) => a.duration - b.duration); // Process fleets in arrival order
        // 3. Simulate the battles chronologically
        for (const fleet of arrivingFleets) {
            if (fleet.owner === predictedOwner) {
                // It's a reinforcement
                predictedTroops += fleet.amount;
            } else {
                // It's an attack
                predictedTroops -= fleet.amount;
                if (predictedTroops < 0) {
                    // The planet has been conquered!
                    predictedOwner = fleet.owner;
                    predictedTroops = Math.abs(predictedTroops);
                }
            }
            predictedTroops = Math.min(this.getMaxPlanetTroops(), predictedTroops);
        }
        const result = { owner: predictedOwner, troops: Math.floor(predictedTroops) };
        return createReadOnlyProxy(result);
    }

    /**
     * Calculates the centrality of a planet (0 to 1, where 1 is the exact center of the map).
     * @param {Planet} planet
     * @returns {number}
     */
    calculateCentrality(planet) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        const distFromCenter = this.getDistance({x: centerX, y: centerY}, planet);
        return Math.max(0, 1 - distFromCenter / maxDist);
    }

    /**
     * Gets the current phase of the game ('EARLY', 'MID', 'LATE') based on elapsed time.
     * @returns {string} The current game phase.
     */
    getGamePhase() {
        const elapsedTime = this.getElapsedTime();
        const duration = this.getGameDuration();
        if (elapsedTime < duration * 0.33) return 'EARLY';
        if (elapsedTime < duration * 0.66) return 'MID';
        return 'LATE';
    }

    // --- PLAYER DATA QUERY FUNCTIONS ---
    /**
     * Gets all planets you own.
     * @returns {Planet[]} A read-only array of read-only Planet objects.
     */
    getMyPlanets() {
        const planets = this.game.planets.filter(p => p.owner === this.playerId);
        return createReadOnlyProxy(planets);
    }

    /**
     * Gets your total number of troops, including those on planets and in transit.
     * @returns {number}
     */
    getMyTotalTroops() {
        return this.getPlayerTotalTroops(this.playerId);
    }

    /**
     * Gets your total production rate from all owned planets.
     * @returns {number}
     */
    getMyTotalProduction() {
        return this.getPlayerTotalProduction(this.playerId);
    }

    /**
     * Calculates your overall strength (troops + production) relative to the strongest opponent.
     * A value > 1.0 means you are likely stronger.
     * A value < 1.0 means you are likely weaker.
     * @returns {number} The strength ratio. Returns a large number if no opponents are left.
     */
    getMyStrengthRatio() {
        const myTotalTroops = this.getMyTotalTroops();
        const myTotalProduction = this.getMyTotalProduction() * 10; // Production is valuable
        const myStrength = myTotalTroops + myTotalProduction;
        let maxOpponentStrength = 0;
        this.getOpponentIds().forEach(id => {
            if (this.isPlayerActive(id)) {
                const opponentTroops = this.getPlayerTotalTroops(id);
                const opponentProduction = this.getPlayerTotalProduction(id) * 10;
                const opponentStrength = opponentTroops + opponentProduction;
                if (opponentStrength > maxOpponentStrength) {
                    maxOpponentStrength = opponentStrength;
                }
            }
        });
        if (maxOpponentStrength === 0) return 999; // No opponents left
        return myStrength / maxOpponentStrength;
    }

    /**
     * Checks if a player is still active in the game (has planets or troops).
     * @param {string} playerId
     * @returns {boolean}
     */
    isPlayerActive(playerId) {
        return this.game.gameState.activePlayers.has(playerId);
    }

    /**
     * Gets the total troops for any specified player.
     * @param {string} playerId - The ID of the player to query.
     * @returns {number}
     */
    getPlayerTotalTroops(playerId) {
        const planetTroops = this.game.planets
            .filter(p => p.owner === playerId)
            .reduce((sum, p) => sum + p.troops, 0);
        const movementTroops = this.game.troopMovements
            .filter(m => m.owner === playerId)
            .reduce((sum, m) => sum + m.amount, 0);
        return planetTroops + movementTroops;
    }

    /**
     * Gets the total production for any specified player.
     * @param {string} playerId - The ID of the player to query.
     * @returns {number}
     */
    getPlayerTotalProduction(playerId) {
        return this.game.planets
            .filter(p => p.owner === playerId)
            .reduce((sum, p) => sum + p.productionRate, 0);
    }
}