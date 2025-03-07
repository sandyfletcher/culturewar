// claude2.js - Advanced AI implementation for hard difficulty
export default class TaylorSpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.decisionCooldown = 0;
        this.minDecisionTime = 0.5; // Faster decisions than Claude1
        this.maxDecisionTime = 1.2;
        this.targetedPlanets = new Map(); // Track which planets are being targeted
        this.threatAssessmentCooldown = 0; // For periodic threat assessments
    }
    
    makeDecision(gameState) {
        // Reduce cooldowns
        this.decisionCooldown -= 1/60;
        this.threatAssessmentCooldown -= 1/60;
        
        // Assess threats periodically (every 5 seconds)
        if (this.threatAssessmentCooldown <= 0) {
            this.assessThreats(gameState);
            this.threatAssessmentCooldown = 5;
        }
        
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
        
        // Analyze game state to determine strategy
        const gameStrategy = this.analyzeGameState(gameState, myPlanets);
        
        // Execute strategy
        switch (gameStrategy) {
            case 'defend':
                return this.executeDefensiveMove(gameState, myPlanets);
            case 'expand':
                return this.executeExpansionMove(gameState, myPlanets);
            case 'attack':
                return this.executeAttackMove(gameState, myPlanets);
            default:
                return this.executeOpportunisticMove(gameState, myPlanets);
        }
    }
    
    assessThreats(gameState) {
        // Clear targeted planets
        this.targetedPlanets.clear();
        
        // Identify planets that need reinforcement or are under threat
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        
        // Analyze incoming enemy troop movements
        const incomingAttacks = gameState.troopMovements.filter(
            move => move.owner !== this.playerId && 
                   move.to.owner === this.playerId
        );
        
        // Mark targeted planets
        for (const attack of incomingAttacks) {
            const targetPlanet = attack.to;
            if (this.targetedPlanets.has(targetPlanet)) {
                // Update the threat level
                const currentThreat = this.targetedPlanets.get(targetPlanet);
                this.targetedPlanets.set(targetPlanet, currentThreat + attack.amount);
            } else {
                this.targetedPlanets.set(targetPlanet, attack.amount);
            }
        }
        
        // Also identify vulnerable enemy planets with few troops
        const vulnerableEnemies = gameState.planets.filter(
            planet => planet.owner !== this.playerId && 
                     planet.owner !== 'neutral' &&
                     planet.troops < 15
        );
        
        for (const planet of vulnerableEnemies) {
            this.targetedPlanets.set(planet, -planet.troops); // Negative indicates opportunity
        }
    }
    
    analyzeGameState(gameState, myPlanets) {
        // Count planets by owner
        const planetCounts = {};
        for (const planet of gameState.planets) {
            planetCounts[planet.owner] = (planetCounts[planet.owner] || 0) + 1;
        }
        
        // Calculate total troops by owner
        const troopCounts = {};
        for (const planet of gameState.planets) {
            troopCounts[planet.owner] = (troopCounts[planet.owner] || 0) + planet.troops;
        }
        
        // Add troops in movement
        for (const movement of gameState.troopMovements) {
            troopCounts[movement.owner] = (troopCounts[movement.owner] || 0) + movement.amount;
        }
        
        // Check if any planets are under threat
        const underThreat = Array.from(this.targetedPlanets.entries())
            .filter(([planet, threat]) => threat > 0 && planet.owner === this.playerId)
            .length > 0;
        
        // Determine the strategy based on game state
        if (underThreat) {
            return 'defend';
        } else if (myPlanets.length < 3) {
            return 'expand';
        } else if (planetCounts['neutral'] > 0 && planetCounts[this.playerId] < 5) {
            return 'expand';
        } else {
            return 'attack';
        }
    }
    
    executeDefensiveMove(gameState, myPlanets) {
        // Find the most threatened planet
        let mostThreatenedPlanet = null;
        let highestThreat = 0;
        
        for (const [planet, threat] of this.targetedPlanets.entries()) {
            if (threat > highestThreat && planet.owner === this.playerId) {
                highestThreat = threat;
                mostThreatenedPlanet = planet;
            }
        }
        
        if (!mostThreatenedPlanet) {
            return this.executeOpportunisticMove(gameState, myPlanets);
        }
        
        // Find planets that can send reinforcements
        const reinforcementSources = myPlanets.filter(planet => 
            planet !== mostThreatenedPlanet && 
            planet.troops > 10
        );
        
        if (reinforcementSources.length === 0) {
            return this.executeOpportunisticMove(gameState, myPlanets);
        }
        
        // Find the closest planet with troops to spare
        const closestReinforcement = this.findClosestPlanet(reinforcementSources, mostThreatenedPlanet);
        
        // Calculate troops to send - more aggressive with reinforcements
        const troopsToSend = Math.floor(closestReinforcement.troops * 0.7);
        
        if (troopsToSend < 5) {
            return this.executeOpportunisticMove(gameState, myPlanets);
        }
        
        return {
            from: closestReinforcement,
            to: mostThreatenedPlanet,
            troops: troopsToSend
        };
    }
    
    executeExpansionMove(gameState, myPlanets) {
        // Target neutral planets first
        const neutralPlanets = gameState.planets.filter(planet => 
            planet.owner === 'neutral'
        );
        
        if (neutralPlanets.length === 0) {
            return this.executeAttackMove(gameState, myPlanets);
        }
        
        // Find planet with most troops to use as source
        const sourcePlanet = this.findBestSourcePlanet(myPlanets);
        if (!sourcePlanet || sourcePlanet.troops < 15) {
            return null;
        }
        
        // Target closest neutral planet that we can capture
        const capturablePlanets = neutralPlanets.filter(planet => 
            planet.troops < sourcePlanet.troops * 0.6
        );
        
        if (capturablePlanets.length === 0) {
            // If no easily capturable planets, just target closest neutral
            const targetPlanet = this.findClosestPlanet(neutralPlanets, sourcePlanet);
            const troopsToSend = Math.floor(sourcePlanet.troops * 0.7);
            
            return {
                from: sourcePlanet,
                to: targetPlanet,
                troops: troopsToSend
            };
        }
        
        // Target closest neutral we can capture
        const targetPlanet = this.findClosestPlanet(capturablePlanets, sourcePlanet);
        
        // Calculate required troops with a buffer
        const requiredTroops = targetPlanet.troops * 1.5;
        const troopsToSend = Math.min(
            Math.floor(sourcePlanet.troops * 0.7), 
            Math.ceil(requiredTroops)
        );
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: troopsToSend
        };
    }
    
    executeAttackMove(gameState, myPlanets) {
        // Find all enemy planets
        const enemyPlanets = gameState.planets.filter(planet => 
            planet.owner !== this.playerId && 
            planet.owner !== 'neutral'
        );
        
        if (enemyPlanets.length === 0) {
            return this.executeOpportunisticMove(gameState, myPlanets);
        }
        
        // Find best source planet
        const sourcePlanet = this.findBestSourcePlanet(myPlanets);
        if (!sourcePlanet || sourcePlanet.troops < 20) {
            return null;
        }
        
        // Look for vulnerable enemies
        const vulnerableEnemies = enemyPlanets.filter(planet => 
            planet.troops < sourcePlanet.troops * 0.7
        );
        
        let targetPlanet;
        if (vulnerableEnemies.length > 0) {
            // Target closest vulnerable enemy
            targetPlanet = this.findClosestPlanet(vulnerableEnemies, sourcePlanet);
        } else {
            // Target smallest enemy planet
            targetPlanet = enemyPlanets.sort((a, b) => a.troops - b.troops)[0];
        }
        
        // Calculate troops to send - aggressive attack
        let troopsToSend;
        if (targetPlanet.troops < sourcePlanet.troops * 0.5) {
            // If we have overwhelming advantage, be more conservative
            troopsToSend = Math.floor(targetPlanet.troops * 1.5);
        } else {
            // Otherwise send a larger force
            troopsToSend = Math.floor(sourcePlanet.troops * 0.8);
        }
        
        // Ensure minimum forces
        troopsToSend = Math.max(troopsToSend, 20);
        
        // Don't send more troops than we have
        if (troopsToSend >= sourcePlanet.troops) {
            troopsToSend = Math.floor(sourcePlanet.troops * 0.7);
        }
        
        if (troopsToSend < 10) {
            return null;
        }
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: troopsToSend
        };
    }
    
    executeOpportunisticMove(gameState, myPlanets) {
        // Look for any good attack opportunities
        const sourcePlanet = this.findBestSourcePlanet(myPlanets);
        if (!sourcePlanet || sourcePlanet.troops < 15) {
            return null;
        }
        
        // Find opportunities marked in our threat assessment
        const opportunities = Array.from(this.targetedPlanets.entries())
            .filter(([planet, threat]) => threat < 0) // Negative threat means opportunity
            .sort((a, b) => a[1] - b[1]); // Sort by lowest threat (biggest opportunity)
        
        if (opportunities.length > 0) {
            const [targetPlanet, threatLevel] = opportunities[0];
            const troopsToSend = Math.floor(Math.max(sourcePlanet.troops * 0.6, Math.abs(threatLevel) * 1.5));
            
            if (troopsToSend < sourcePlanet.troops) {
                return {
                    from: sourcePlanet,
                    to: targetPlanet,
                    troops: troopsToSend
                };
            }
        }
        
        // If no special opportunities, execute a balanced strategy
        // Target a mixture of neutral and enemy planets
        const allTargets = gameState.planets.filter(planet => 
            planet.owner !== this.playerId
        );
        
        if (allTargets.length === 0) {
            return null;
        }
        
        // Calculate a score for each potential target
        const targetScores = allTargets.map(planet => {
            // Calculate distance
            const dx = planet.x - sourcePlanet.x;
            const dy = planet.y - sourcePlanet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate troop ratio
            const troopRatio = planet.troops / Math.max(sourcePlanet.troops, 1);
            
            // Calculate size value - larger planets are more valuable
            const sizeValue = planet.size / 30;
            
            // Calculate owner value - neutral planets are easier to capture
            const ownerValue = planet.owner === 'neutral' ? 1.5 : 1;
            
            // Calculate final score - lower is better
            const score = (distance / 100) * troopRatio / (sizeValue * ownerValue);
            
            return {
                planet,
                score
            };
        }).sort((a, b) => a.score - b.score);
        
        // Select best target
        const targetPlanet = targetScores[0].planet;
        
        // Calculate troops to send based on target
        let troopRatio;
        if (targetPlanet.owner === 'neutral') {
            troopRatio = 0.6; // Be more conservative with neutral targets
        } else {
            troopRatio = 0.7; // More aggressive with enemy targets
        }
        
        const troopsToSend = Math.max(
            Math.floor(sourcePlanet.troops * troopRatio),
            Math.floor(targetPlanet.troops * 1.5)
        );
        
        // Ensure we don't send more troops than we have
        if (troopsToSend >= sourcePlanet.troops) {
            return null;
        }
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: troopsToSend
        };
    }
    
    findBestSourcePlanet(myPlanets) {
        // Sort planets by available troops
        const sortedPlanets = [...myPlanets]
            .filter(planet => !this.targetedPlanets.has(planet) || this.targetedPlanets.get(planet) < planet.troops * 0.5)
            .sort((a, b) => b.troops - a.troops);
        
        return sortedPlanets.length > 0 ? sortedPlanets[0] : null;
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