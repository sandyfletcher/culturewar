class DummyAI {
    constructor(gameState) {
        this.color = '#ff0000'; // AI color is red
        this.lastDecisionTime = 0;
        this.decisionDelay = 1000; // Make decisions every 1 second
    }

    // Calculate total troops for any player
    calculateTotalTroops(planets, owner) {
        return planets
            .filter(planet => planet.owner === owner)
            .reduce((total, planet) => total + planet.troops, 0);
    }

    // Calculate production rate for any player
    calculateTotalProduction(planets, owner) {
        return planets
            .filter(planet => planet.owner === owner)
            .reduce((total, planet) => total + planet.productionRate, 0);
    }

    // Find the best planet to attack
    findBestTarget(myPlanets, otherPlanets, totalTroops) {
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const target of otherPlanets) {
            // Find closest planet we own to this target
            let closestPlanet = null;
            let shortestDistance = Infinity;

            for (const myPlanet of myPlanets) {
                const distance = Math.sqrt(
                    Math.pow(myPlanet.x - target.x, 2) + 
                    Math.pow(myPlanet.y - target.y, 2)
                );
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    closestPlanet = myPlanet;
                }
            }

            if (!closestPlanet) continue;

            // Calculate a score for this target
            // High score for:
            // - Higher production rate
            // - Lower defense (troops)
            // - Closer distance
            // - Not depleting our forces too much
            const score = (
                (target.productionRate * 50) - // Value production
                (target.troops * 0.5) - // Lower value for well-defended planets
                (shortestDistance * 0.1) + // Prefer closer targets
                (closestPlanet.troops > target.troops ? 20 : -20) // Bonus for winnable battles
            );

            // Don't attack if it would deplete our forces too much
            const troopsNeeded = target.troops + 10;
            if (troopsNeeded > closestPlanet.troops || 
                troopsNeeded > totalTroops * 0.4) { // Don't use more than 40% of total troops
                continue;
            }

            if (score > bestScore) {
                bestScore = score;
                bestTarget = {
                    from: closestPlanet,
                    to: target,
                    troops: Math.min(
                        Math.floor(closestPlanet.troops * 0.7), // Don't send more than 70% from one planet
                        target.troops + 10 // Send enough to win plus a small buffer
                    )
                };
            }
        }

        return bestTarget;
    }

    // Main decision-making function
    makeDecision(gameState) {
        const now = Date.now();
        if (now - this.lastDecisionTime < this.decisionDelay) {
            return null; // Don't make a decision yet
        }
        this.lastDecisionTime = now;

        const myPlanets = gameState.planets.filter(p => p.owner === 'ai');
        const otherPlanets = gameState.planets.filter(p => p.owner !== 'ai');
        
        if (myPlanets.length === 0) return null;

        const myTotalTroops = this.calculateTotalTroops(gameState.planets, 'ai');
        const playerTotalTroops = this.calculateTotalTroops(gameState.planets, 'player');

        // If we're significantly behind in troops, play more defensively
        if (myTotalTroops < playerTotalTroops * 0.7) {
            this.decisionDelay = 2000; // Wait longer between attacks
            return null;
        }

        // Reset decision delay if we're doing well
        this.decisionDelay = 1000;

        // Find and execute best move
        const bestMove = this.findBestTarget(myPlanets, otherPlanets, myTotalTroops);
        
        if (bestMove) {
            return bestMove;
        }

        return null;
    }
}

export default DummyAI;