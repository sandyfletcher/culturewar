// ===========================================
// root/javascript/GameAPI.js — provides a unified, read-only API for bots to interact with the game state
// ===========================================

import { config } from './config.js';

function createProxyFactory(botId) { // creates a factory for generating deep, read-only proxies
    return function createReadOnlyProxy(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        return new Proxy(obj, {
            set(target, property, value) {
                console.warn(`[${botId}] attempted to modify read-only property '${String(property)}' on a game object. This is not allowed.`);
                return true; // silently fail write operation
            },
            get(target, property, receiver) {
                const value = target[property];
                if (typeof value === 'function') {
                    return value.bind(target);
                }
                return createReadOnlyProxy(value); // recursively call same function to ensure deep readonly-ness
            }
        });
    }
}
export default class GameAPI { 
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.createReadOnlyProxy = createProxyFactory(this.playerId); // create a proxy creation function specific to this bot instance
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
    getFleetsByOwner(playerId) { // gets all active troop movements sent by a specific player
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
    getMapInfo() { // gets basic information about the map
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
    getNearestEnemyPlanet(sourcePlanet) { // finds nearest enemy-owned planet to a source planet
        const enemyPlanets = this.getEnemyPlanets();
        return this.findNearestPlanet(sourcePlanet, enemyPlanets);
    }
    getPlanetProductionRate(planet) { // exposes a planet's raw production rate 
        if (planet.owner === 'neutral') {
            return 0;
        }
        return planet.size / config.planet.productionFactor;
    }
    getPlanetCentrality(planet) { // exposes a planet's raw centrality score from 0 to 1, where 1 is the exact center of the map
        const { center, width, height } = this.getMapInfo();
        const maxDist = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
        if (maxDist === 0) return 1; // avoid division by zero on tiny maps
        const distFromCenter = this.getDistance(center, planet);
        return Math.max(0, 1 - distFromCenter / maxDist);
    }
    calculatePlanetValue(planet) { // calculate default strategic value for a planet as a baseline — advanced bots can build their own using raw data
        const sizeValue = planet.size * config.ai.scoring.sizeWeight;
        const productionValue = this.getPlanetProductionRate(planet) * config.ai.scoring.productionWeight;
        const positionValue = this.getPlanetCentrality(planet) * config.ai.scoring.centralityWeight;
        return sizeValue + productionValue + positionValue;
    }
    calculateThreat(myPlanet) { // calculate default threat score for one of AI's own planets
        if (myPlanet.owner !== this.playerId) return 0;
        let threat = 0;
        const enemyPlanets = this.getEnemyPlanets(); // Threat from nearby enemy planets (potential threat)
        for (const enemy of enemyPlanets) {
            const distance = this.getDistance(myPlanet, enemy);
            if (distance < config.ai.threat.radius) {
                threat += enemy.troops / (distance + config.ai.threat.distanceDivisor);
            }
        }
        const incomingAttacks = this.getIncomingAttacks(myPlanet); // Threat from incoming attacks (imminent threat)
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
    getPlayerStats(playerId) { // gets a consolidated object of statistics for any given player
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