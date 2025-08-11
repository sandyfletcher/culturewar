// ===========================================
// root/javascript/GameAPI.js — provides a unified, read-only API for bots to interact with the game state
// ===========================================

import { config } from './config.js';

/**
 * Creates a factory for generating deep, read-only proxies.
 * By creating a factory, we can pass in the bot's ID to make debugging much easier.
 * @param {string} botId - The ID of the bot this proxy factory is for.
 * @returns {function(any): any} A function that takes an object and returns a read-only proxy.
 */
function createProxyFactory(botId) {
    // This is the function that will be returned by the factory.
    // It's a closure, so it will always have access to the `botId`.
    return function createReadOnlyProxy(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        return new Proxy(obj, {
            set(target, property, value) {
                console.warn(`[${botId}] attempted to modify read-only property '${String(property)}' on a game object. This is not allowed.`);
                return true; // Silently fail the write operation.
            },
            get(target, property, receiver) {
                const value = target[property];
                if (typeof value === 'function') {
                    return value.bind(target);
                }
                // Recursively call the same function to ensure deep readonly-ness.
                return createReadOnlyProxy(value);
            }
        });
    }
}


export default class GameAPI { 
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        // Create a proxy creation function specific to this bot instance.
        this.createReadOnlyProxy = createProxyFactory(this.playerId);
        this.canvas = this.createReadOnlyProxy(game.canvas); 
        this.troopMovementSpeed = config.troop.movementSpeed;
    }

    // --- GENERAL GAME STATE FUNCTIONS ---
    getAllPlanets() {
        return this.createReadOnlyProxy(this.game.planets);
    }

    getPlanetById(planetId) {
        const planet = this.game.planets.find(p => p.id === planetId);
        return planet ? this.createReadOnlyProxy(planet) : null;
    }

    getEnemyPlanets() {
        const planets = this.game.planets.filter(p => p.owner !== this.playerId && p.owner !== 'neutral');
        return this.createReadOnlyProxy(planets);
    }
    
    getNeutralPlanets() {
        const planets = this.game.planets.filter(p => p.owner === 'neutral');
        return this.createReadOnlyProxy(planets);
    }
    
    getAllTroopMovements() {
        return this.createReadOnlyProxy(this.game.troopMovements);
    }

    /**
     * NEW: Gets all active troop movements sent by a specific player.
     * @param {string} playerId
     * @returns {TroopMovement[]} A read-only array of the player's fleets.
     */
    getFleetsByOwner(playerId) {
        const movements = this.game.troopMovements.filter(m => m.owner === playerId);
        return this.createReadOnlyProxy(movements);
    }

    getAllPlayerIds() {
        return this.game.playersController.players.map(p => p.id);
    }
    
    getOpponentIds() {
        return this.game.playersController.players
            .map(p => p.id)
            .filter(id => id !== this.playerId);
    }
    
    getElapsedTime() {
        return this.game.gameState.elapsedGameTime;
    }
    
    getDecisionCooldown() {
        return config.ai.decisionCooldown;
    }
    
    getGameDuration() {
        return config.game.defaultDuration;
    }

    getMaxPlanetTroops() {
        return config.planet.maxTroops;
    }

    /**
     * NEW: Gets basic information about the map.
     * @returns {{width: number, height: number, center: {x: number, y: number}}}
     */
    getMapInfo() {
        const { width, height } = this.canvas;
        return this.createReadOnlyProxy({
            width,
            height,
            center: { x: width / 2, y: height / 2 }
        });
    }

    // --- DISTANCE & TRAVEL ---
    getDistance(planet1, planet2) {
        const dx = planet1.x - planet2.x;
        const dy = planet1.y - planet2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getTravelTime(planet1, planet2) {
        return this.getDistance(planet1, planet2) / this.troopMovementSpeed;
    }
    
    findNearestPlanet(sourcePlanet, targetPlanets) {
        if (!targetPlanets || targetPlanets.length === 0) {
            return null;
        }
        let nearest = null;
        let minDistance = Infinity;
        const potentialTargets = Array.from(targetPlanets);

        for (const target of potentialTargets) {
            if (sourcePlanet.id === target.id) continue;
            const distance = this.getDistance(sourcePlanet, target);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = target;
            }
        }
        return nearest ? this.createReadOnlyProxy(nearest) : null;
    }

    /**
     * NEW: Finds the nearest enemy-owned planet to a source planet.
     * A convenient shortcut for a common strategic query.
     * @param {Planet} sourcePlanet
     * @returns {Planet | null}
     */
    getNearestEnemyPlanet(sourcePlanet) {
        const enemyPlanets = this.getEnemyPlanets();
        return this.findNearestPlanet(sourcePlanet, enemyPlanets);
    }

    // --- STRATEGIC EVALUATION (RAW DATA & HELPERS) ---

    /**
     * NEW (was private): Exposes a planet's raw production rate.
     * @param {Planet} planet
     * @returns {number}
     */
    getPlanetProductionRate(planet) {
        // A planet's production is its size divided by the factor from the config.
        // A planet must have an owner to produce.
        if (planet.owner === 'neutral') {
            return 0;
        }
        return planet.size / config.planet.productionFactor;
    }

    /**
     * NEW (was private): Exposes a planet's raw centrality score.
     * @param {Planet} planet
     * @returns {number} A score from 0 to 1, where 1 is the exact center of the map.
     */
    getPlanetCentrality(planet) {
        const { center, width, height } = this.getMapInfo();
        const maxDist = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
        if (maxDist === 0) return 1; // Avoid division by zero on tiny maps
        const distFromCenter = this.getDistance(center, planet);
        return Math.max(0, 1 - distFromCenter / maxDist);
    }

    /**
     * Calculates a generic strategic value for a planet using default weights.
     * Good for simple bots or as a baseline. Advanced bots can build their own using raw data.
     * @param {Planet} planet
     * @returns {number} The strategic value score.
     */
    calculatePlanetValue(planet) {
        const sizeValue = planet.size * config.ai.scoring.sizeWeight;
        const productionValue = this.getPlanetProductionRate(planet) * config.ai.scoring.productionWeight;
        const positionValue = this.getPlanetCentrality(planet) * config.ai.scoring.centralityWeight;
        return sizeValue + productionValue + positionValue;
    }

    /**
     * Calculates a generic threat score for one of the AI's own planets using default weights.
     * Good for simple bots. Advanced bots can build their own.
     * @param {Planet} myPlanet - The planet to assess (must be owned by the AI).
     * @returns {number} The threat score.
     */
    calculateThreat(myPlanet) {
        if (myPlanet.owner !== this.playerId) return 0;
        let threat = 0;
        // Threat from nearby enemy planets (potential threat)
        const enemyPlanets = this.getEnemyPlanets();
        for (const enemy of enemyPlanets) {
            const distance = this.getDistance(myPlanet, enemy);
            if (distance < config.ai.threat.radius) {
                threat += enemy.troops / (distance + config.ai.threat.distanceDivisor);
            }
        }
        // Threat from incoming attacks (imminent threat)
        const incomingAttacks = this.getIncomingAttacks(myPlanet);
        threat += incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        return threat;
    }
    
    getIncomingAttacks(targetPlanet) {
        const movements = this.game.troopMovements.filter(m => 
            m.to.id === targetPlanet.id && m.owner !== targetPlanet.owner && m.owner !== 'neutral'
        );
        return this.createReadOnlyProxy(movements);
    }
    
    getIncomingReinforcements(targetPlanet) {
        const movements = this.game.troopMovements.filter(m => 
            m.to.id === targetPlanet.id && m.owner === targetPlanet.owner
        );
        return this.createReadOnlyProxy(movements);
    }
    
    predictPlanetState(planet, timeInFuture) {
        let predictedTroops = planet.troops;
        let predictedOwner = planet.owner;
        
        // Account for production using the new helper for consistency
        predictedTroops += this.getPlanetProductionRate(planet) * timeInFuture;
        predictedTroops = Math.min(this.getMaxPlanetTroops(), predictedTroops);
        // 2. Get all fleets arriving within the timeframe
        const arrivingFleets = this.game.troopMovements
            .filter(m => m.to.id === planet.id && m.duration <= timeInFuture)
            .sort((a, b) => a.duration - b.duration); // Process fleets in arrival order
        // 3. Simulate the battles chronologically
        for (const fleet of arrivingFleets) {
            if (fleet.owner === predictedOwner) {
                predictedTroops += fleet.amount;
            } else {
                predictedTroops -= fleet.amount;
                if (predictedTroops < 0) {
                    predictedOwner = fleet.owner;
                    predictedTroops = Math.abs(predictedTroops);
                }
            }
            predictedTroops = Math.min(this.getMaxPlanetTroops(), predictedTroops);
        }
        
        const result = { owner: predictedOwner, troops: Math.floor(predictedTroops) };
        return this.createReadOnlyProxy(result);
    }
    
    getGamePhase() {
        const elapsedTime = this.getElapsedTime();
        const duration = this.getGameDuration();
        if (elapsedTime < duration * 0.33) return 'EARLY';
        if (elapsedTime < duration * 0.66) return 'MID';
        return 'LATE';
    }

    // --- PLAYER DATA QUERY FUNCTIONS ---
    getMyPlanets() {
        const planets = this.game.planets.filter(p => p.owner === this.playerId);
        return this.createReadOnlyProxy(planets);
    }
    
    getMyTotalTroops() {
        return this.getPlayerTotalTroops(this.playerId);
    }
    
    getMyTotalProduction() {
        return this.getPlayerTotalProduction(this.playerId);
    }
    
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
    
    isPlayerActive(playerId) {
        return this.game.gameState.activePlayers.has(playerId);
    }
    
    getPlayerTotalTroops(playerId) {
        const planetTroops = this.game.planets
            .filter(p => p.owner === playerId)
            .reduce((sum, p) => sum + p.troops, 0);
        const movementTroops = this.game.troopMovements
            .filter(m => m.owner === playerId)
            .reduce((sum, m) => sum + m.amount, 0);
        return planetTroops + movementTroops;
    }
    
    getPlayerTotalProduction(playerId) {
        return this.game.planets
            .filter(p => p.owner === playerId)
            .reduce((sum, p) => sum + this.getPlanetProductionRate(p), 0);
    }

    /**
     * NEW: Gets a consolidated object of statistics for any given player.
     * This reduces the number of API calls needed to assess a player's state.
     * @param {string} playerId
     * @returns {{id: string, planetCount: number, totalTroops: number, totalProduction: number, isActive: boolean} | null}
     */
    getPlayerStats(playerId) {
        if (!this.getAllPlayerIds().includes(playerId)) {
            return null;
        }

        const stats = {
            id: playerId,
            planetCount: this.game.planets.filter(p => p.owner === playerId).length,
            totalTroops: this.getPlayerTotalTroops(playerId),
            totalProduction: this.getPlayerTotalProduction(playerId),
            isActive: this.isPlayerActive(playerId),
        };

        return this.createReadOnlyProxy(stats);
    }
}