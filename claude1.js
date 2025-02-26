export default class Claude1 {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.decisionCooldown = Math.random() * 2000; // Random initial cooldown
        
        // Configuration for AI behavior
        this.config = {
            minTroopsToLeave: 3, // Minimum troops to leave on a planet
            decisionInterval: 2, // Time between decisions in seconds
            attackChance: 0.7, // Probability of choosing to attack vs. reinforce
        };
    }
    
    makeDecision(gameState) {
        // Decrement cooldown
        this.decisionCooldown -= this.game.gameState.lastUpdate - this.game.gameState.startTime;
        
        // Only make decisions at certain intervals
        if (this.decisionCooldown > 0) {
            return null;
        }
        
        // Reset cooldown with some randomness
        this.decisionCooldown = (this.config.decisionInterval + Math.random()) * 1000;
        
        // Get own planets
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        
        // If no planets, no decisions to make
        if (myPlanets.length === 0) {
            return null;
        }
        
        // Randomly decide whether to attack or reinforce
        if (Math.random() < this.config.attackChance) {
            return this.makeAttackMove(gameState, myPlanets);
        } else {
            return this.makeReinforceMove(gameState, myPlanets);
        }
    }
    
    makeAttackMove(gameState, myPlanets) {
        // Find planets that can attack (have enough troops)
        const attackablePlanets = myPlanets.filter(planet => 
            planet.troops > this.config.minTroopsToLeave * 2);
            
        if (attackablePlanets.length === 0) {
            return null;
        }
        
        // Choose a random source planet
        const sourcePlanet = attackablePlanets[Math.floor(Math.random() * attackablePlanets.length)];
        
        // Find potential target planets (not owned by this AI)
        const potentialTargets = gameState.planets.filter(planet => 
            planet.owner !== this.playerId);
            
        if (potentialTargets.length === 0) {
            return null;
        }
        
        // Calculate distances to each potential target
        const targetsWithDistance = potentialTargets.map(planet => ({
            planet: planet,
            distance: this.calculateDistance(sourcePlanet, planet)
        }));
        
        // Sort by distance (ascending)
        targetsWithDistance.sort((a, b) => a.distance - b.distance);
        
        // Prefer closer planets with a bit of randomness (pick from closest 3 if available)
        const targetRange = Math.min(3, targetsWithDistance.length);
        const selectedTarget = targetsWithDistance[Math.floor(Math.random() * targetRange)].planet;
        
        // Calculate troops to send (between 50% and 80% of available)
        const availableTroops = sourcePlanet.troops - this.config.minTroopsToLeave;
        const percentToSend = 0.5 + Math.random() * 0.3;
        const troopsToSend = Math.floor(availableTroops * percentToSend);
        
        if (troopsToSend <= 0) {
            return null;
        }
        
        return {
            from: sourcePlanet,
            to: selectedTarget,
            troops: troopsToSend
        };
    }
    
    makeReinforceMove(gameState, myPlanets) {
        if (myPlanets.length < 2) {
            return null; // Need at least 2 planets to reinforce
        }
        
        // Find planets that can send reinforcements (have enough troops)
        const sourcePlanets = myPlanets.filter(planet => 
            planet.troops > this.config.minTroopsToLeave * 3);
            
        if (sourcePlanets.length === 0) {
            return null;
        }
        
        // Choose a random source planet
        const sourcePlanet = sourcePlanets[Math.floor(Math.random() * sourcePlanets.length)];
        
        // Find potential targets (own planets that aren't the source)
        const potentialTargets = myPlanets.filter(planet => 
            planet !== sourcePlanet);
            
        // Choose target with lowest troops
        potentialTargets.sort((a, b) => a.troops - b.troops);
        const targetPlanet = potentialTargets[0];
        
        // Calculate troops to send (between 30% and 50% of available)
        const availableTroops = sourcePlanet.troops - this.config.minTroopsToLeave;
        const percentToSend = 0.3 + Math.random() * 0.2;
        const troopsToSend = Math.floor(availableTroops * percentToSend);
        
        if (troopsToSend <= 0) {
            return null;
        }
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: troopsToSend
        };
    }
    
    calculateDistance(planet1, planet2) {
        const dx = planet1.x - planet2.x;
        const dy = planet1.y - planet2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}