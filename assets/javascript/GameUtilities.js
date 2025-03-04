/*
 * GameUtilities.js
 * Comprehensive utility module for AI decision-making in Galcon-like strategy games
 * 
 * This module provides a rich set of functions to analyze game state, 
 * evaluate strategic opportunities, and support AI decision-making.
 */

class GameUtilities {
    /**
     * Calculates the Euclidean distance between two planets
     * @param {Object} planet1 - First planet object with x and y coordinates
     * @param {Object} planet2 - Second planet object with x and y coordinates
     * @returns {number} Distance between the two planets
     */
    static calculateDistance(planet1, planet2) {
        const dx = planet2.x - planet1.x;
        const dy = planet2.y - planet1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Retrieves all planets owned by a specific player
     * @param {Object} game - The current game state
     * @param {string} playerId - ID of the player
     * @returns {Array} Array of planets owned by the player
     */
    static getPlanetsOwnedBy(game, playerId) {
        return game.planets.filter(planet => planet.owner === playerId);
    }

    /**
     * Retrieves all enemy planets (excluding neutral planets)
     * @param {Object} game - The current game state
     * @param {string} playerId - ID of the player
     * @returns {Array} Array of enemy planets
     */
    static getEnemyPlanets(game, playerId) {
        return game.planets.filter(planet => 
            planet.owner !== playerId && planet.owner !== 'neutral'
        );
    }

    /**
     * Retrieves all neutral planets
     * @param {Object} game - The current game state
     * @returns {Array} Array of neutral planets
     */
    static getNeutralPlanets(game) {
        return game.planets.filter(planet => planet.owner === 'neutral');
    }

    /**
     * Calculates total troops for a player, including planets and troop movements
     * @param {Object} game - The current game state
     * @param {string} playerId - ID of the player
     * @returns {number} Total number of troops
     */
    static getTotalTroops(game, playerId) {
        const ownedPlanets = this.getPlanetsOwnedBy(game, playerId);
        const troopsInPlanets = ownedPlanets.reduce((total, planet) => total + planet.troops, 0);
        
        const troopsInMovement = game.troopMovements
            .filter(movement => movement.owner === playerId)
            .reduce((total, movement) => total + movement.amount, 0);
        
        return troopsInPlanets + troopsInMovement;
    }

    /**
     * Finds the closest enemy planet to a given planet
     * @param {Object} planet - Source planet
     * @param {Array} enemyPlanets - Array of enemy planets
     * @returns {Object|null} Closest enemy planet with distance, or null
     */
    static findClosestEnemyPlanet(planet, enemyPlanets) {
        return enemyPlanets.reduce((closest, enemyPlanet) => {
            const distance = this.calculateDistance(planet, enemyPlanet);
            return (!closest || distance < closest.distance) 
                ? { planet: enemyPlanet, distance } 
                : closest;
        }, null);
    }

    /**
     * Evaluates a planet's strategic value
     * @param {Object} planet - Planet to evaluate
     * @returns {Object} Detailed value breakdown
     */
    static evaluatePlanetValue(planet) {
        return {
            size: planet.size,
            productionRate: planet.productionRate,
            troops: planet.troops,
            totalValue: planet.size * 2 + planet.productionRate * 10 + planet.troops
        };
    }

    /**
     * Finds potential planets for expansion
     * @param {Object} game - The current game state
     * @param {string} playerId - ID of the player
     * @param {number} [maxDistance=500] - Maximum distance for expansion
     * @returns {Array} Potential expansion target planets
     */
    static findExpansionTargets(game, playerId, maxDistance = 500) {
        const ownedPlanets = this.getPlanetsOwnedBy(game, playerId);
        const neutralPlanets = this.getNeutralPlanets(game);
        
        return neutralPlanets.filter(neutralPlanet => {
            const closestOwnedPlanet = ownedPlanets.reduce((closest, ownedPlanet) => {
                const distance = this.calculateDistance(neutralPlanet, ownedPlanet);
                return (!closest || distance < closest.distance) 
                    ? { planet: ownedPlanet, distance } 
                    : closest;
            }, null);
            
            return closestOwnedPlanet && closestOwnedPlanet.distance < maxDistance;
        });
    }

    /**
     * Calculates the threat level of a planet
     * @param {Object} game - The current game state
     * @param {Object} planet - Planet to assess
     * @param {string} playerId - ID of the player
     * @param {number} [neighborhoodRadius=300] - Radius to consider for threat calculation
     * @returns {Object} Threat assessment
     */
    static calculatePlanetThreat(game, planet, playerId, neighborhoodRadius = 300) {
        const neighboringPlanets = game.planets.filter(p => 
            this.calculateDistance(p, planet) < neighborhoodRadius && p.owner !== playerId
        );
        
        const totalEnemyTroops = neighboringPlanets.reduce((total, p) => total + p.troops, 0);
        
        return {
            enemyPlanetCount: neighboringPlanets.length,
            totalEnemyTroops,
            threatLevel: totalEnemyTroops / (planet.troops || 1)
        };
    }

    /**
     * Recommends troops to send based on target planet's ownership and current troops
     * @param {Object} fromPlanet - Source planet
     * @param {Object} toPlanet - Target planet
     * @returns {number} Recommended number of troops to send
     */
    static recommendTroopSendAmount(fromPlanet, toPlanet) {
        const sendRatio = toPlanet.owner === 'neutral' ? 0.5 : 1.1;
        
        const troopsToSend = Math.min(
            fromPlanet.troops * 0.7, // Preserve some home defense
            toPlanet.troops * sendRatio + 1 // Ensure capture potential
        );
        
        return Math.floor(troopsToSend);
    }

    /**
     * Finds the weakest enemy planet
     * @param {Object} game - The current game state
     * @param {string} playerId - ID of the player
     * @returns {Object|null} Weakest enemy planet
     */
    static findWeakestEnemyPlanet(game, playerId) {
        const enemyPlanets = this.getEnemyPlanets(game, playerId);
        return enemyPlanets.reduce((weakest, planet) => 
            (!weakest || planet.troops < weakest.troops) ? planet : weakest
        , null);
    }

    /**
     * Calculates a strategic threat score for a planet
     * @param {Object} game - The current game state
     * @param {Object} planet - Planet to assess
     * @returns {number} Threat score
     */
    static getPlanetThreatScore(game, planet) {
        let threatScore = 0;

        // Proximity to enemy planets
        const enemyPlanets = game.planets.filter(p => 
            p.owner !== planet.owner && p.owner !== 'neutral'
        );

        for (const enemyPlanet of enemyPlanets) {
            const distance = this.calculateDistance(planet, enemyPlanet);
            threatScore += (100 / (distance + 1));
        }

        // Nearby enemy troop concentration
        for (const enemyPlanet of enemyPlanets) {
            const distance = this.calculateDistance(planet, enemyPlanet);
            if (distance < 200) {
                threatScore += enemyPlanet.troops / (distance / 50);
            }
        }

        return threatScore;
    }

    /**
     * Determines if a planet is defensible
     * @param {Object} game - The current game state
     * @param {Object} planet - Planet to check
     * @returns {boolean} Whether the planet is defensible
     */
    static isPlanetDefensible(game, planet) {
        // Minimum troop threshold for defense
        if (planet.troops < 20) return false;

        // Check for nearby friendly planets
        const friendlyPlanets = game.planets.filter(p => 
            p.owner === planet.owner && p !== planet
        );
        if (friendlyPlanets.length === 0) return false;

        // Check for incoming attacks
        const incomingAttacks = game.troopMovements.filter(movement => 
            movement.to === planet && movement.owner !== planet.owner
        );
        if (incomingAttacks.length > 0) return false;

        return true;
    }
}

export default GameUtilities;