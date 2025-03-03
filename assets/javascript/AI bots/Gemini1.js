// (Gemini1.js):
// Gemini's first run

import { calculateDistance, getPlanetsOwnedBy } from './AIUtilities.js';

class Gemini1 {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.lastDecisionTime = 0;
        this.decisionInterval = 250; // Make decisions every 1/4 second (adjust as needed)
    }

    makeDecision(gameState) {
        const now = Date.now();
        if (now - this.lastDecisionTime < this.decisionInterval) {
            return null; // Don't make a decision yet
        }
        this.lastDecisionTime = now;

        // Get our planets
        const myPlanets = getPlanetsOwnedBy(this.game, this.playerId);

        if (myPlanets.length === 0) {
            return null; // No planets, no decisions to make
        }

        // 1. Defend threatened planets
        const defenseDecision = this.defendThreatenedPlanets(myPlanets);
        if (defenseDecision) {
            return defenseDecision;
        }

        // 2. Attack weak planets
        const attackDecision = this.attackWeakestTarget(myPlanets);
        if (attackDecision) {
            return attackDecision;
        }

        return null; // No action this turn
    }

    defendThreatenedPlanets(myPlanets) {
        // Find planets under attack (incoming enemy fleets)
        const threatenedPlanets = myPlanets.filter(planet => {
            return this.game.troopMovements.some(movement => {
                return movement.to === planet && movement.owner !== this.playerId;
            });
        });

        if (threatenedPlanets.length === 0) {
            return null; // No planets to defend
        }

        // Prioritize defense: Defend the planet with the most incoming troops
        threatenedPlanets.sort((a, b) => {
            const incomingA = this.game.troopMovements.filter(movement => movement.to === a && movement.owner !== this.playerId).reduce((sum, movement) => sum + movement.amount, 0);
            const incomingB = this.game.troopMovements.filter(movement => movement.to === b && movement.owner !== this.playerId).reduce((sum, movement) => sum + movement.amount, 0);
            return incomingB - incomingA;
        });

        const targetPlanet = threatenedPlanets[0];

        // Find closest planet to send reinforcements from
        let bestSourcePlanet = null;
        let shortestDistance = Infinity;

        myPlanets.forEach(planet => {
            if (planet === targetPlanet) return; // Don't send from the planet being attacked
            const distance = calculateDistance(planet, targetPlanet);
            if (distance < shortestDistance) {
                shortestDistance = distance;
                bestSourcePlanet = planet;
            }
        });

        if (!bestSourcePlanet) {
            return null; // No source planet available
        }

        // Send enough troops to defend (a bit more than incoming)
        const incomingTroops = this.game.troopMovements.filter(movement => movement.to === targetPlanet && movement.owner !== this.playerId).reduce((sum, movement) => sum + movement.amount, 0);
        const troopsToSend = Math.ceil(incomingTroops + 5); // Send 5 more than incoming
        const availableTroops = Math.floor(bestSourcePlanet.troops * 0.75); // Only send up to 75% of source troops
        const troopsActuallySent = Math.min(troopsToSend, availableTroops);

        if (troopsActuallySent <= 0) {
            return null; // Not enough troops to send
        }

        return {
            from: bestSourcePlanet,
            to: targetPlanet,
            troops: troopsActuallySent
        };
    }

    attackWeakestTarget(myPlanets) {
        // Find the weakest enemy or neutral planet
        const weakestTarget = this.game.planets
            .filter(planet => planet.owner !== this.playerId)
            .sort((a, b) => a.troops - b.troops)[0]; // Sort by troop count ascending

        if (!weakestTarget) {
            return null; // No target available
        }

        // Find closest planet to attack from
        let bestSourcePlanet = null;
        let shortestDistance = Infinity;

        myPlanets.forEach(planet => {
            const distance = calculateDistance(planet, weakestTarget);
            if (distance < shortestDistance) {
                shortestDistance = distance;
                bestSourcePlanet = planet;
            }
        });

        if (!bestSourcePlanet) {
            return null; // No source planet available
        }

        // Send enough troops to conquer (a bit more than the target has)
        const troopsToSend = Math.ceil(weakestTarget.troops + 5);
        const availableTroops = Math.floor(bestSourcePlanet.troops * 0.75); // Only send up to 75% of source troops
        const troopsActuallySent = Math.min(troopsToSend, availableTroops);

        if (troopsActuallySent <= 0) {
            return null; // Not enough troops to send
        }

        return {
            from: bestSourcePlanet,
            to: weakestTarget,
            troops: troopsActuallySent
        };
    }
}

export default Gemini1;