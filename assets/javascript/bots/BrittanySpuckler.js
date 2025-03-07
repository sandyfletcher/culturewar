export default class BrittanySpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.personality = {
            aggressiveness: 0.2,     // Low - rarely attacks enemy planets
            expansion: 0.4,          // Medium-low - some neutral planet expansion
            consolidation: 0.9,      // High - focuses on reinforcing owned planets
            riskTolerance: 0.3,      // Low - conservative with troops
            neighborAwareness: 0.8   // High - very aware of threats
        };
        this.turnCounter = 0;        // Track turns for periodic actions
    }

    makeDecision(gameState) {
        this.turnCounter++;
        
        // Get owned planets
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        
        // If we have no planets, we can't do anything
        if (myPlanets.length === 0) return null;
        
        // Find most threatened planet (closest to enemy with lowest troop count)
        const threatenedPlanet = this.findMostThreatenedPlanet(myPlanets, gameState.planets);
        
        // Find strongest planet (highest troop count)
        const strongestPlanet = [...myPlanets].sort((a, b) => b.troops - a.troops)[0];
        
        // Find all non-owned planets
        const otherPlanets = gameState.planets.filter(planet => planet.owner !== this.playerId);
        
        // Defensive AIs only expand every few turns
        const shouldExpand = this.turnCounter % 5 === 0 && Math.random() < this.personality.expansion;
        
        // Defensive AIs occasionally attack if they have a significant advantage
        const shouldAttack = this.turnCounter % 7 === 0 && Math.random() < this.personality.aggressiveness;
        
        let sourcePlanet, targetPlanet, troopsToSend;
        
        // 1. If a planet is threatened and not the strongest, reinforce it
        if (threatenedPlanet && threatenedPlanet !== strongestPlanet && 
            strongestPlanet.troops > 20) {
            
            sourcePlanet = strongestPlanet;
            targetPlanet = threatenedPlanet;
            troopsToSend = Math.floor(strongestPlanet.troops * 0.4);
        }
        // 2. If it's time to expand and we have enough troops
        else if (shouldExpand && strongestPlanet.troops > 30) {
            // Find closest neutral planet
            const neutralPlanets = otherPlanets.filter(p => p.owner === 'neutral');
            
            if (neutralPlanets.length > 0) {
                // Find closest neutral
                const closestNeutral = this.findClosestPlanet(strongestPlanet, neutralPlanets);
                
                sourcePlanet = strongestPlanet;
                targetPlanet = closestNeutral;
                troopsToSend = Math.floor(strongestPlanet.troops * 0.5);
            }
        }
        // 3. If it's time to attack and we have a significant advantage
        else if (shouldAttack && strongestPlanet.troops > 50) {
            // Find weakest nearby enemy planet
            const enemyPlanets = otherPlanets.filter(p => p.owner !== 'neutral');
            
            if (enemyPlanets.length > 0) {
                // Sort by troop count (lowest first)
                const sortedEnemies = [...enemyPlanets].sort((a, b) => a.troops - b.troops);
                
                if (sortedEnemies[0].troops < strongestPlanet.troops * 0.5) {
                    sourcePlanet = strongestPlanet;
                    targetPlanet = sortedEnemies[0];
                    troopsToSend = Math.floor(strongestPlanet.troops * 0.6);
                }
            }
        }
        // 4. Otherwise, consolidate forces on the strongest planet from the second strongest
        else {
            if (myPlanets.length > 1) {
                const secondStrongest = [...myPlanets]
                    .sort((a, b) => b.troops - a.troops)
                    .filter(p => p !== strongestPlanet)[0];
                
                if (secondStrongest && secondStrongest.troops > 15) {
                    sourcePlanet = secondStrongest;
                    targetPlanet = strongestPlanet;
                    troopsToSend = Math.floor(secondStrongest.troops * 0.7);
                }
            }
        }
        
        // Return decision if we have a valid move
        if (sourcePlanet && targetPlanet && troopsToSend > 5) {
            return {
                from: sourcePlanet,
                to: targetPlanet,
                troops: troopsToSend
            };
        }
        
        return null; // No valid move
    }
    
    // Helper method: Find the closest planet to a source planet
    findClosestPlanet(sourcePlanet, planets) {
        let closestPlanet = null;
        let minDistance = Infinity;
        
        for (const planet of planets) {
            const dx = planet.x - sourcePlanet.x;
            const dy = planet.y - sourcePlanet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPlanet = planet;
            }
        }
        
        return closestPlanet;
    }
    
    // Helper method: Find the most threatened planet
    findMostThreatenedPlanet(myPlanets, allPlanets) {
        // For each owned planet, calculate a threat score
        const planetsWithThreatScores = myPlanets.map(planet => {
            let threatScore = 0;
            
            // Find enemy planets
            const enemyPlanets = allPlanets.filter(p => 
                p.owner !== this.playerId && p.owner !== 'neutral');
            
            // Calculate threat based on enemy proximity and strength
            for (const enemy of enemyPlanets) {
                const dx = enemy.x - planet.x;
                const dy = enemy.y - planet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Higher threat score for strong enemies that are close
                // Formula: enemy troops / (distance * your troops)
                const individualThreat = enemy.troops / (distance * Math.max(1, planet.troops));
                threatScore += individualThreat;
            }
            
            return { planet, threatScore };
        });
        
        // Sort by threat score (highest first)
        planetsWithThreatScores.sort((a, b) => b.threatScore - a.threatScore);
        
        // Return the planet with the highest threat score
        return planetsWithThreatScores[0]?.planet || null;
    }
}