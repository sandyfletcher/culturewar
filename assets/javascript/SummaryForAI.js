// SummaryForAI.js

/**
 * This file provides a collection of functions and utilities for AI agents
 * to access and analyze the game state in Galcon. It aims to abstract away
 * the complexities of the game engine and provide a clean, efficient interface
 * for AI decision-making.
 */

class SummaryForAI {
    constructor(game) {
        this.game = game;
    }

    /**
     * Gets all planets in the game.
     * @returns {Planet[]} An array of all planets.
     */
    getAllPlanets() {
        return this.game.planets;
    }

    /**
     * Gets all troop movements in the game.
     * @returns {TroopMovement[]} An array of all troop movements.
     */
    getAllTroopMovements() {
        return this.game.troopMovements;
    }

    /**
     * Gets all players in the game.
     * @returns {Player[]} An array of all players.
     */
    getAllPlayers() {
        return this.game.playersController.players;
    }

    /**
     * Gets the current game time remaining.
     * @returns {number} The time remaining in the game (in seconds).
     */
    getTimeRemaining() {
        return this.game.gameState.timeRemaining;
    }

    /**
     * Gets the current game time remaining.
     * @returns {boolean} The game over state.
     */
    getGameOver() {
        return this.game.gameOver;
    }

    /**
     * Gets the player object by ID.
     * @param {string} playerId - The ID of the player.
     * @returns {Player | undefined} The player object, or undefined if not found.
     */
    getPlayer(playerId) {
        return this.game.playersController.players.find(player => player.id === playerId);
    }

    /**
     * Gets all planets owned by a specific player.
     * @param {string} playerId - The ID of the player.
     * @returns {Planet[]} An array of planets owned by the player.
     */
    getPlanetsOwnedBy(playerId) {
        return this.game.planets.filter(planet => planet.owner === playerId);
    }

    /**
     * Gets all AI players in the game
     * @returns {Player[]} An array of AI Players.
     */
    getAIPlayers() {
        return this.game.playersController.getAIPlayers();
    }

        /**
     * Gets all human players in the game
     * @returns {Player[]} An array of Human Players.
     */
    getHumanPlayers() {
        return this.game.playersController.getHumanPlayers();
    }

    /**
     * Gets the total number of troops owned by a player across all their planets.
     * @param {string} playerId - The ID of the player.
     * @returns {number} The total number of troops.
     */
    getTotalTroopsOwnedBy(playerId) {
        return this.getPlanetsOwnedBy(playerId).reduce((total, planet) => total + planet.troops, 0);
    }

    /**
     * Gets the total troop production rate for a player across all their planets.
     * @param {string} playerId - The ID of the player.
     * @returns {number} The total production rate.
     */
    getTotalProductionRate(playerId) {
        return this.getPlanetsOwnedBy(playerId).reduce((total, planet) => total + planet.productionRate, 0);
    }

    /**
     * Calculates the distance between two planets.
     * @param {Planet} planet1 - The first planet.
     * @param {Planet} planet2 - The second planet.
     * @returns {number} The distance between the planets.
     */
    getDistanceBetweenPlanets(planet1, planet2) {
        const dx = planet1.x - planet2.x;
        const dy = planet1.y - planet2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Finds the nearest planet to a given planet, optionally filtered by a condition.
     * @param {Planet} sourcePlanet - The planet to find the nearest to.
     * @param {function(Planet): boolean} [filterFunction] - An optional filter function.
     * @returns {Planet | null} The nearest planet, or null if none is found.
     */
    getNearestPlanet(sourcePlanet, filterFunction) {
        let nearestPlanet = null;
        let nearestDistance = Infinity;

        for (const planet of this.game.planets) {
            if (planet === sourcePlanet) continue; // Skip the source planet itself
            if (filterFunction && !filterFunction(planet)) continue; // Skip filtered planets

            const distance = this.getDistanceBetweenPlanets(sourcePlanet, planet);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPlanet = planet;
            }
        }

        return nearestPlanet;
    }

    /**
     * Gets the strongest planet based on troop count, optionally filtered.
     * @param {function(Planet): boolean} [filterFunction] - An optional filter function.
     * @returns {Planet | null} The strongest planet, or null if none is found.
     */
    getStrongestPlanet(filterFunction) {
        let strongestPlanet = null;
        let maxTroops = -1;

        for (const planet of this.game.planets) {
            if (filterFunction && !filterFunction(planet)) continue;
            if (planet.troops > maxTroops) {
                maxTroops = planet.troops;
                strongestPlanet = planet;
            }
        }

        return strongestPlanet;
    }

    /**
     * Gets the weakest planet based on troop count, optionally filtered.
     * @param {function(Planet): boolean} [filterFunction] - An optional filter function.
     * @returns {Planet | null} The weakest planet, or null if none is found.
     */
    getWeakestPlanet(filterFunction) {
        let weakestPlanet = null;
        let minTroops = Infinity;

        for (const planet of this.game.planets) {
            if (filterFunction && !filterFunction(planet)) continue;
            if (planet.troops < minTroops) {
                minTroops = planet.troops;
                weakestPlanet = planet;
            }
        }

        return weakestPlanet;
    }

    /**
     * Gets the planet with the highest troop production rate, optionally filtered.
     * @param {function(Planet): boolean} [filterFunction] - An optional filter function.
     * @returns {Planet | null} The most productive planet, or null if none is found.
     */
    getMostProductivePlanet(filterFunction) {
        let mostProductivePlanet = null;
        let maxProductionRate = -1;

        for (const planet of this.game.planets) {
            if (filterFunction && !filterFunction(planet)) continue;
            if (planet.productionRate > maxProductionRate) {
                maxProductionRate = planet.productionRate;
                mostProductivePlanet = planet;
            }
        }

        return mostProductivePlanet;
    }

    /**
     * Calculates a threat score for a given planet based on proximity to enemy planets,
     * troop count, and growth rate.  A higher score indicates a greater threat.
     * @param {Planet} planet - The planet to assess.
     * @returns {number} The threat score.
     */
    getPlanetThreatScore(planet) {
        let threatScore = 0;

        // Increase threat based on proximity to enemy planets
        const enemyPlanets = this.game.planets.filter(p => p.owner !== planet.owner && p.owner !== 'neutral');
        for (const enemyPlanet of enemyPlanets) {
            const distance = this.getDistanceBetweenPlanets(planet, enemyPlanet);
            // Adjust the divisor to change the impact of distance
            threatScore += (100 / (distance + 1));
        }

        // Increase threat based on enemy troop count in nearby planets
        for (const enemyPlanet of enemyPlanets) {
            const distance = this.getDistanceBetweenPlanets(planet, enemyPlanet);
            if (distance < 200) {
                threatScore += enemyPlanet.troops / (distance / 50);
            }
        }

        return threatScore;
    }

    /**
     * Determines whether a planet is defensible, considering factors like troop count,
     * distance to friendly planets, and incoming attacks.
     * @param {Planet} planet - The planet to check.
     * @returns {boolean} True if the planet is defensible, false otherwise.
     */
    isPlanetDefensible(planet) {
        //Check if planet has a decent amount of troops to defend
        if (planet.troops < 20) {
            return false;
        }

        //Check if there are nearby friendly planets to send backup
        const friendlyPlanets = this.game.planets.filter(p => p.owner === planet.owner && p !== planet);
        if (friendlyPlanets.length === 0) {
            return false;
        }

        // Check if there are incoming attacks on the planet
        const incomingAttacks = this.game.troopMovements.filter(movement => movement.to === planet && movement.owner !== planet.owner);
        if (incomingAttacks.length > 0) {
            return false;
        }

        return true;
    }

    /**
     * Calculates the number of troops needed to conquer a target planet,
     * factoring in its current troops, growth rate, and any incoming reinforcements.
     * @param {Planet} targetPlanet - The planet to attack.
     * @returns {number} The estimated attack force needed.
     */
    calculateAttackForce(targetPlanet) {
        // Base attack force needed is 1.25 times the target planet's current troops
        let attackForce = targetPlanet.troops * 1.25;

        // Add extra troops based on the target planet's production rate.
        attackForce += targetPlanet.productionRate * 10;

        // Check for any incoming troop movements to reinforce the target planet.
        const incomingReinforcements = this.game.troopMovements.filter(movement => movement.to === targetPlanet && movement.owner === targetPlanet.owner);

        // If there are reinforcements, increase the required attack force.
        for (const reinforcement of incomingReinforcements) {
            attackForce += reinforcement.amount * 1.5;
        }

        return attackForce;
    }

    /**
     * Estimates the number of troops needed to defend a planet, considering nearby enemy planets
     * and potential attack forces.
     * @param {Planet} planet - The planet to defend.
     * @returns {number} The estimated reinforcement need.
     */
    calculateReinforcementNeed(planet) {
        let reinforcementNeed = 10;

         // Increase reinforcement need based on the planet's current troop count.
         reinforcementNeed += planet.troops * 0.5;

        // Get nearby enemy planets
        const enemyPlanets = this.game.planets.filter(p => p.owner !== planet.owner && p.owner !== 'neutral');

        // Increase reinforcement need based on proximity to enemy planets
        for (const enemyPlanet of enemyPlanets) {
            const distance = this.getDistanceBetweenPlanets(planet, enemyPlanet);
            if (distance < 150) {
                reinforcementNeed += 25;
            }
        }

        // Check for incoming enemy troop movements towards the planet.
        const incomingAttacks = this.game.troopMovements.filter(movement => movement.to === planet && movement.owner !== planet.owner);

        // If there are incoming attacks, increase the reinforcement need.
        for (const attack of incomingAttacks) {
            reinforcementNeed += attack.amount * 2;
        }

        return reinforcementNeed;
    }

    /**
     * Analyzes all potential targets and returns the planet that represents the best
     * strategic opportunity for attack.
     * @returns {Planet | null} The best attack target, or null if no suitable target is found.
     */
    findBestAttackTarget() {
        let bestTarget = null;
        let bestScore = -Infinity;

        // Get AI players
        const aiPlayers = this.game.playersController.getAIPlayers();

        for (const aiPlayer of aiPlayers) {
            const planets = this.getPlanetsOwnedBy(aiPlayer.id);
        }

        // Loop through all planets and evaluate their potential as attack targets
        for (const planet of this.game.planets) {
            // Skip planets owned by the AI
            if (planet.owner === aiPlayers) continue;

            // Skip neutral planets
            if (planet.owner === 'neutral') continue;

            // Calculate a score for the planet based on various factors.
            let attackScore = 0;

            // Reduce score based on the planet's troop count.
            attackScore -= planet.troops * 0.25;

            // Increase score based on the planet's production rate.
            attackScore += planet.productionRate * 0.5;

            // Reduce score based on distance to the nearest friendly planet.
            const nearestFriendlyPlanet = this.getNearestPlanet(planet, p => p.owner === aiPlayers);

            if (nearestFriendlyPlanet) {
                const distance = this.getDistanceBetweenPlanets(planet, nearestFriendlyPlanet);
                attackScore -= distance * 0.1;
            }

            // If the current planet has a better score than the current best target, update the best target.
            if (attackScore > bestScore) {
                bestScore = attackScore;
                bestTarget = planet;
            }
        }

        return bestTarget;
    }

    /**
     * Analyzes all planets to determine which would be the best to send troops from to defend a planet
     * @param {Planet} planetUnderAttack - the planet being attacked
     * @returns {Planet | null} the best planet to send reinforcements from
     */
    findBestDefenseSource(planetUnderAttack) {
        let bestSource = null;
        let bestScore = -Infinity;

        // Get AI players
        const aiPlayers = this.game.playersController.getAIPlayers();

        for (const aiPlayer of aiPlayers) {
            const planets = this.getPlanetsOwnedBy(aiPlayer.id);
        }

        // Loop through all planets and evaluate their potential as a defense source
        for (const planet of this.game.planets) {
            // Skip the planet under attack
            if (planet === planetUnderAttack) continue;

            // Skip planets that are not owned by the AI
            if (planet.owner !== aiPlayers) continue;

            // Calculate a score for the planet based on various factors.
            let defenseScore = 0;

            // Increase score based on the planet's troop count.
            defenseScore += planet.troops * 0.5;

            // Reduce score based on distance to the planet under attack.
            const distance = this.getDistanceBetweenPlanets(planet, planetUnderAttack);
            defenseScore -= distance * 0.1;

            // Increase score if the planet is not under attack.
            if (this.isPlanetDefensible(planet)) {
                defenseScore += 50;
            }

            // If the current planet has a better score than the current best source, update the best source.
            if (defenseScore > bestScore) {
                bestScore = defenseScore;
                bestSource = planet;
            }
        }

        return bestSource;
    }

    /**
     * Returns the number of troops a planet has above a certain threshold,
     * which could be considered "safe" for defense.
     * @param {Planet} planet - The planet to check.
     * @param {number} threshold - The minimum number of troops to consider safe.
     * @returns {number} The number of excess troops.
     */
    getExcessTroops(planet, threshold) {
        return Math.max(0, planet.troops - threshold);
    }

    /**
     * Gets the number of troops a planet has available to send to attack (after considering defense).
     * @param {Planet} planet - The planet to check.
     * @returns {number} The number of available troops.
     */
    getAvailableTroopsForAttack(planet) {
        //Get the reinforcement need of the planet
        let reinforcementNeed = this.calculateReinforcementNeed(planet);

        //If there are more troops on the planet than reinforcement need, return excess troops
        if(planet.troops > reinforcementNeed) {
            return this.getExcessTroops(planet, reinforcementNeed);
        }

        return 0;
    }

    /**
     * Calculates a score representing how much of the map a player controls, based on
     * planet ownership and troop distribution.
     * @param {string} playerId - The ID of the player.
     * @returns {number} The map control score.
     */
    getMapControlScore(playerId) {
        let score = 0;
        const planets = this.game.planets;

        for (const planet of planets) {
            if (planet.owner === playerId) {
                // Award points for owning a planet
                score += 10;

                // Award points based on the number of troops on the planet.
                score += planet.troops * 0.5;

                // Award more points if the planet is productive.
                score += planet.productionRate * 2;
            }
        }

        return score;
    }

    /**
     * Calculates the advantage the player has in the current game.
     * @param {string} playerId - The ID of the player.
     * @returns {number} The strategic advantage.
     */
    getStrategicAdvantage(playerId) {
        // Get AI players
        const aiPlayers = this.game.playersController.getAIPlayers();

        const numberOfAIPlayers = aiPlayers.length;

        // Get the map control score for the player.
        let mapControlScore = this.getMapControlScore(playerId);

        // Calculate the average map control score of all AI players.
        let averageAIControlScore = 0;

        for(const aiPlayer of aiPlayers) {
            averageAIControlScore += this.getMapControlScore(aiPlayer.id)
        }

        averageAIControlScore = averageAIControlScore / numberOfAIPlayers;

        // Calculate the strategic advantage as the difference between the player's map control score and the average AI control score.
        let strategicAdvantage = mapControlScore - averageAIControlScore;

        return strategicAdvantage;
    }
}

export default SummaryForAI;