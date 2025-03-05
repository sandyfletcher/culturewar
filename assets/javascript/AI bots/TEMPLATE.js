// template for a new AI file (e.g., aggresiveai.js)
export default class AggresiveAI {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.personality = {
            // Personality traits affect decision making
            aggressiveness: 0.9,     // 0.0 to 1.0 (higher means more likely to attack)
            expansion: 0.7,          // 0.0 to 1.0 (higher means more likely to prioritize neutral planets)
            consolidation: 0.3,      // 0.0 to 1.0 (higher means more likely to reinforce owned planets)
            riskTolerance: 0.8,      // 0.0 to 1.0 (higher means willing to send more troops)
            neighborAwareness: 0.6   // 0.0 to 1.0 (higher means more strategic about neighbor threats)
        };
    }

    makeDecision(gameState) {
        // Get owned planets
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        
        // If we have no planets, we can't do anything
        if (myPlanets.length === 0) return null;
        
        // Sort planets by troop count (highest first)
        const sortedMyPlanets = [...myPlanets].sort((a, b) => b.troops - a.troops);
        
        // Get source planet with the most troops
        const sourcePlanet = sortedMyPlanets[0];
        
        // If we have less than X troops, don't send any
        const minimumTroopsToSend = 5;
        if (sourcePlanet.troops < minimumTroopsToSend) return null;
        
        // Find all planets not owned by this player
        const targetablePlanets = gameState.planets.filter(planet => planet.owner !== this.playerId);
        
        // If there are no targetable planets, we can't do anything
        if (targetablePlanets.length === 0) return null;
        
        // Calculate distances to all targetable planets
        const planetsWithDistances = targetablePlanets.map(planet => {
            const dx = planet.x - sourcePlanet.x;
            const dy = planet.y - sourcePlanet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return { planet, distance };
        });
        
        // Sort by distance (closest first)
        planetsWithDistances.sort((a, b) => a.distance - b.distance);
        
        // Implement AI personality-based targeting
        
        // Aggressive AIs prefer enemy planets over neutral ones
        const enemyPlanets = planetsWithDistances.filter(p => p.planet.owner !== 'neutral');
        const neutralPlanets = planetsWithDistances.filter(p => p.planet.owner === 'neutral');
        
        // Choose target based on personality
        let targetPlanet;
        
        if (enemyPlanets.length > 0 && Math.random() < this.personality.aggressiveness) {
            // Target enemy planets - prioritize weakest enemies for an aggressive AI
            const sortedEnemies = [...enemyPlanets].sort((a, b) => 
                (a.planet.troops / a.distance) - (b.planet.troops / b.distance));
                
            targetPlanet = sortedEnemies[0].planet;
        } else if (neutralPlanets.length > 0 && Math.random() < this.personality.expansion) {
            // Target neutral planets - prioritize closest neutrals
            const sortedNeutrals = [...neutralPlanets].sort((a, b) => a.distance - b.distance);
            targetPlanet = sortedNeutrals[0].planet;
        } else if (myPlanets.length > 1 && Math.random() < this.personality.consolidation) {
            // Reinforce another owned planet (exclude source planet)
            const otherOwnedPlanets = myPlanets.filter(p => p !== sourcePlanet);
            const weakestOwned = otherOwnedPlanets.sort((a, b) => a.troops - b.troops)[0];
            targetPlanet = weakestOwned;
        } else if (planetsWithDistances.length > 0) {
            // Default: attack closest planet
            targetPlanet = planetsWithDistances[0].planet;
        } else {
            return null; // No valid targets
        }
        
        // Calculate troops to send based on personality and target
        let troopPercentage;
        
        if (targetPlanet.owner === 'neutral') {
            // For neutral planets, send enough to capture but not too many
            troopPercentage = 0.3 + (this.personality.riskTolerance * 0.2); // 30%-50% of troops
        } else if (targetPlanet.owner === this.playerId) {
            // For reinforcing owned planets, send a smaller percentage
            troopPercentage = 0.2 + (this.personality.consolidation * 0.3); // 20%-50% of troops
        } else {
            // For enemy planets, send based on aggressiveness
            troopPercentage = 0.5 + (this.personality.aggressiveness * 0.4); // 50%-90% of troops
        }
        
        // Calculate exact troops to send
        const troopsToSend = Math.floor(sourcePlanet.troops * troopPercentage);
        
        // Don't send if below minimum
        if (troopsToSend < minimumTroopsToSend) return null;
        
        // Return decision
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: troopsToSend
        };
    }
}