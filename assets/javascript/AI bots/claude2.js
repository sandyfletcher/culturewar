// claude1.js - Basic AI implementation for easy difficulty
export default class Claude1 {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.decisionCooldown = 0;
        this.minDecisionTime = 1.5; // Minimum seconds between decisions
        this.maxDecisionTime = 3.0; // Maximum seconds between decisions
    }
    
    makeDecision(gameState) {
        // Reduce cooldown
        this.decisionCooldown -= 1/60; // Assuming 60 FPS
        
        // Only make a decision when cooldown expires
        if (this.decisionCooldown > 0) {
            return null;
        }
        
        // Set a new random cooldown
        this.decisionCooldown = this.minDecisionTime + 
            Math.random() * (this.maxDecisionTime - this.minDecisionTime);
        
        // Get all planets owned by this AI
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        
        // If no planets, can't make a move
        if (myPlanets.length === 0) {
            return null;
        }
        
        // Find source planet with most troops
        const sourcePlanet = this.findSourcePlanet(myPlanets);
        if (!sourcePlanet || sourcePlanet.troops < 10) {
            return null; // Not enough troops to send
        }
        
        // Find target planet
        const targetPlanet = this.findTargetPlanet(gameState.planets, sourcePlanet);
        if (!targetPlanet) {
            return null; // No suitable target found
        }
        
        // Calculate troops to send (50% of available troops)
        const troopsToSend = Math.floor(sourcePlanet.troops / 2);
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: troopsToSend
        };
    }
    
    findSourcePlanet(myPlanets) {
        // Sort planets by troop count (descending)
        const sortedPlanets = [...myPlanets]
            .filter(planet => planet.troops >= 10) // Only consider planets with enough troops
            .sort((a, b) => b.troops - a.troops);
        
        // Return planet with most troops, or null if none have sufficient troops
        return sortedPlanets.length > 0 ? sortedPlanets[0] : null;
    }
    
    findTargetPlanet(allPlanets, sourcePlanet) {
        // First priority: Nearby neutral planets
        const neutralPlanets = allPlanets.filter(planet => 
            planet.owner === 'neutral' && planet !== sourcePlanet);
        
        // Find closest neutral planet
        if (neutralPlanets.length > 0) {
            return this.findClosestPlanet(neutralPlanets, sourcePlanet);
        }
        
        // Second priority: Enemy planets with fewer troops than we can send
        const vulnerableEnemyPlanets = allPlanets.filter(planet => 
            planet.owner !== this.playerId && 
            planet.owner !== 'neutral' && 
            planet.troops < sourcePlanet.troops / 2);
        
        if (vulnerableEnemyPlanets.length > 0) {
            return this.findClosestPlanet(vulnerableEnemyPlanets, sourcePlanet);
        }
        
        // Last resort: Enemy planets (even if they have more troops)
        const enemyPlanets = allPlanets.filter(planet => 
            planet.owner !== this.playerId && 
            planet.owner !== 'neutral');
        
        if (enemyPlanets.length > 0) {
            return this.findClosestPlanet(enemyPlanets, sourcePlanet);
        }
        
        // No suitable target found
        return null;
    }
    
    findClosestPlanet(planets, sourcePlanet) {
        let closestPlanet = null;
        let shortestDistance = Infinity;
        
        for (const planet of planets) {
            const dx = planet.x - sourcePlanet.x;
            const dy = planet.y - sourcePlanet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < shortestDistance) {
                shortestDistance = distance;
                closestPlanet = planet;
            }
        }
        
        return closestPlanet;
    }
}