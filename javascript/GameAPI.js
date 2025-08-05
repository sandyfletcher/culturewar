// ===========================================
// root/javascript/GameAPI.js — provides a unified, read-only API for bots to interact with the game state
// ===========================================

import { config } from './config.js';

export default class GameAPI { 
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.canvas = game.canvas;
        this.troopMovementSpeed = config.troop.movementSpeed;
    }
    // --- GENERAL GAME STATE FUNCTIONS ---
    /**
     * Gets all planets in the game.
     * @returns {Planet[]}
     */
    getAllPlanets() {
        return this.game.planets;
    }
    /**
     * Gets a specific planet by its unique ID.
     * @param {string} planetId
     * @returns {Planet | null}
     */
    getPlanetById(planetId) {
        return this.game.planets.find(p => p.id === planetId);
    }
    /**
     * Gets all enemy planets (owned by other players, excluding neutral).
     * @returns {Planet[]}
     */
    getEnemyPlanets() {
        return this.game.planets.filter(p => p.owner !== this.playerId && p.owner !== 'neutral');
    }
    /**
     * Gets all neutral planets.
     * @returns {Planet[]}
     */
    getNeutralPlanets() {
        return this.game.planets.filter(p => p.owner === 'neutral');
    }
    /**
     * Gets all active troop movements.
     * @returns {TroopMovement[]}
     */
    getAllTroopMovements() {
        return this.game.troopMovements;
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
     * @returns {Planet | null} The closest planet, or null if targetPlanets is empty.
     */
    findNearestPlanet(sourcePlanet, targetPlanets) {
        if (!targetPlanets || targetPlanets.length === 0) {
            return null;
        }
        let nearest = null;
        let minDistance = Infinity;
        for (const target of targetPlanets) {
            if (sourcePlanet === target) continue; // Don't target self
            const distance = this.getDistance(sourcePlanet, target);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = target;
            }
        }
        return nearest;
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
        // Threat from nearby enemy planets
        for (const enemy of this.getEnemyPlanets()) {
            const distance = this.getDistance(myPlanet, enemy);
            if (distance < config.ai.threat.radius) {
                threat += enemy.troops / (distance + config.ai.threat.distanceDivisor);
            }
        }
        // Threat from incoming attacks
        const incomingAttacks = this.getIncomingAttacks(myPlanet);
        threat += incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        return threat;
    }
    /**
     * Gets all incoming enemy troop movements targeting a specific planet.
     * @param {Planet} targetPlanet
     * @returns {TroopMovement[]}
     */
    getIncomingAttacks(targetPlanet) {
        return this.game.troopMovements.filter(m => 
            m.to === targetPlanet && m.owner !== targetPlanet.owner && m.owner !== 'neutral'
        );
    }
    /**
     * Gets all incoming friendly troop movements (reinforcements) targeting a specific planet.
     * @param {Planet} targetPlanet
     * @returns {TroopMovement[]}
     */
    getIncomingReinforcements(targetPlanet) {
        return this.game.troopMovements.filter(m => 
            m.to === targetPlanet && m.owner === targetPlanet.owner
        );
    }
    /**
     * Predicts the state of a planet (owner and troop count) at a specific time in the future.
     * This is a powerful strategic tool that accounts for production and all incoming fleets.
     * @param {Planet} planet - The planet to predict.
     * @param {number} timeInFuture - How many seconds into the future to predict.
     * @returns {{owner: string, troops: number}} The predicted state of the planet.
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
            .filter(m => m.to === planet && m.duration <= timeInFuture)
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
        return { owner: predictedOwner, troops: Math.floor(predictedTroops) };
    }
    /**
     * Estimates the number of troops a planet will have upon arrival of a fleet from a source planet.  This function is being deprecated and should not be used when designing your bot.
     * @param {Planet} sourcePlanet
     * @param {Planet} targetPlanet
     * @returns {number} Estimated troop count.
     */
    estimateTroopsAtArrival(sourcePlanet, targetPlanet) {
        const travelTime = this.getTravelTime(sourcePlanet, targetPlanet);
        const productionGains = targetPlanet.owner !== 'neutral' ? targetPlanet.productionRate * travelTime : 0;
        return targetPlanet.troops + productionGains;
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
    // --- PLAYER DATA QUERY FUNCTIONS ---
    /**
     * Gets all planets you own.
     * @returns {Planet[]}
     */
    getMyPlanets() {
        return this.game.planets.filter(p => p.owner === this.playerId);
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