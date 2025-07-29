// assets/javascript/GameAPI.js —  * Provides a unified, read-only API for AI agents to interact with the game state. An instance of this class is provided to each AI, scoped to its specific player ID.

export default class GameAPI {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.canvas = game.canvas;
        this.troopMovementSpeed = 150; // pixels per second
    }
    getMyPlanets() { // Gets all planets owned by the AI
        return this.game.planets.filter(p => p.owner === this.playerId);
    }
    getMyTotalTroops() { // Gets the AI's total number of troops, including those on planets and in transit
        return this.getPlayerTotalTroops(this.playerId);
    }
    getMyTotalProduction() {  // Gets the AI's total production rate from all owned planets
        return this.getPlayerTotalProduction(this.playerId);
    }
    getAllPlanets() { // Gets all planets in the game
        return this.game.planets;
    }
    getEnemyPlanets() { // Gets all enemy planets (owned by other players, excluding neutral)
        return this.game.planets.filter(p => p.owner !== this.playerId && p.owner !== 'neutral');
    }
    getNeutralPlanets() { // Gets all neutral planets
        return this.game.planets.filter(p => p.owner === 'neutral');
    }
    getAllTroopMovements() { // Gets all active troop movements
        return this.game.troopMovements;
    }
    getOpponentIds() { // Gets an array of all player IDs currently in the game, excluding the current AI
        return this.game.playersController.players
            .map(p => p.id)
            .filter(id => id !== this.playerId);
    }
    getPlayerTotalTroops(playerId) { // Gets the total troops for any specified player
        const planetTroops = this.game.planets
            .filter(p => p.owner === playerId)
            .reduce((sum, p) => sum + p.troops, 0);
        const movementTroops = this.game.troopMovements
            .filter(m => m.owner === playerId)
            .reduce((sum, m) => sum + m.amount, 0);
        return planetTroops + movementTroops;
    }
    getPlayerTotalProduction(playerId) { // Gets the total production for any specified player
        return this.game.planets
            .filter(p => p.owner === playerId)
            .reduce((sum, p) => sum + p.productionRate, 0);
    }
    getDistance(planet1, planet2) { // Calculates the Euclidean distance between two planets
        const dx = planet1.x - planet2.x;
        const dy = planet1.y - planet2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    findNearestPlanet(sourcePlanet, targetPlanets) { // Finds the nearest planet from a given list of planets to a source planet
        if (!targetPlanets || targetPlanets.length === 0) {
            return null;
        }
        let nearest = null;
        let minDistance = Infinity;
        for (const target of targetPlanets) {
            const distance = this.getDistance(sourcePlanet, target);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = target;
            }
        }
        return nearest;
    }
    calculatePlanetValue(planet) { // Calculates a strategic value for a planet. Higher is better
        const sizeValue = planet.size * 1.5;
        const productionValue = planet.productionRate * 20;
        const positionValue = this.calculateCentrality(planet) * 25;
        return sizeValue + productionValue + positionValue;
    }
    calculateThreat(myPlanet) { // Calculates a threat score for one of the AI's own planets. Higher is more threatened. Factors in nearby enemy troops and incoming attacks
        if (myPlanet.owner !== this.playerId) return 0;
        let threat = 0;
        for (const enemy of this.getEnemyPlanets()) { // Threat from nearby enemy planets
            const distance = this.getDistance(myPlanet, enemy);
            if (distance < 300) { // Consider enemies within a 300px radius
                threat += enemy.troops / (distance + 10); // Closer, stronger enemies are a bigger threat
            }
        }
        const incomingAttacks = this.getIncomingAttacks(myPlanet); // Threat from incoming attacks
        threat += incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        return threat;
    }
    getIncomingAttacks(targetPlanet) { // Gets all incoming enemy troop movements targeting a specific planet
        return this.game.troopMovements.filter(m => 
            m.to === targetPlanet && m.owner !== this.playerId
        );
    }
    estimateTroopsAtArrival(sourcePlanet, targetPlanet) { // Estimates the number of troops a planet will have upon arrival of a fleet from a source planet
        const travelTime = this.getDistance(sourcePlanet, targetPlanet) / this.troopMovementSpeed;
        const productionGains = targetPlanet.owner !== 'neutral' ? targetPlanet.productionRate * travelTime : 0;
        return targetPlanet.troops + productionGains;
    }
    calculateCentrality(planet) { // calculates the centrality of a planet (0 to 1, where 1 is the exact center of the map)
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        const distFromCenter = this.getDistance({x: centerX, y: centerY}, planet);
        return Math.max(0, 1 - distFromCenter / maxDist);
    }
}