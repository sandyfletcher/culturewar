export default class Claude2 {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.decisionCooldown = 0; // Time between AI decisions
        this.expansionPhase = true; // Start in expansion phase
        this.threatAssessmentCooldown = 3; // Seconds between threat reassessments
        this.threatLevel = 0; // Current perceived threat level
        this.targetPriorities = []; // Array of target planets with priority scores
        
        // Configuration for AI behavior
        this.config = {
            minTroopsToLeave: 5, // Minimum troops to leave on a planet
            reservePercentage: 0.3, // Percentage of troops to keep in reserve
            expansionThreshold: 0.6, // When to switch from expansion to consolidation
            retreatThreshold: 0.2, // When to retreat and consolidate
            threatThreshold: 0.7, // Threat level that triggers defensive actions
            decisionInterval: 0.8, // Time between decisions in seconds
            maxAttackRatio: 0.7, // Maximum percentage of troops to send in a single attack
        };
    }
    
    makeDecision(gameState) {
        // Decrement cooldown
        this.decisionCooldown -= this.game.gameState.lastUpdate - this.game.gameState.startTime;
        this.threatAssessmentCooldown -= this.game.gameState.lastUpdate - this.game.gameState.startTime;
        
        // Only make decisions at certain intervals to prevent spam
        if (this.decisionCooldown > 0) {
            return null;
        }
        
        // Reset cooldown
        this.decisionCooldown = this.config.decisionInterval * 1000; // Convert to milliseconds
        
        // Reassess threat level periodically
        if (this.threatAssessmentCooldown <= 0) {
            this.assessThreatLevel(gameState);
            this.threatAssessmentCooldown = 3000; // Reset to 3 seconds
        }
        
        // Check if we should change phases based on game state
        this.updateStrategy(gameState);
        
        // Get own planets
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        
        // If no planets, no decisions to make
        if (myPlanets.length === 0) {
            return null;
        }
        
        // Update target priorities
        this.updateTargetPriorities(gameState);
        
        // Choose action based on current phase and threat level
        if (this.expansionPhase && this.threatLevel < this.config.threatThreshold) {
            return this.makeExpansionMove(gameState, myPlanets);
        } else {
            return this.makeDefensiveMove(gameState, myPlanets);
        }
    }
    
    assessThreatLevel(gameState) {
        // Calculate threat level based on enemy troops proximity and strength
        let maxThreat = 0;
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        const enemyPlanets = gameState.planets.filter(planet => 
            planet.owner !== this.playerId && planet.owner !== 'neutral');
            
        // Get enemy movements headed towards my planets
        const incomingAttacks = gameState.troopMovements.filter(move => 
            move.owner !== this.playerId && myPlanets.includes(move.to));
            
        // Sum my total troops
        const myTotalTroops = myPlanets.reduce((sum, planet) => sum + planet.troops, 0) +
            gameState.troopMovements
                .filter(move => move.owner === this.playerId)
                .reduce((sum, move) => sum + move.amount, 0);
                
        // Sum enemy total troops
        const enemyTotalTroops = enemyPlanets.reduce((sum, planet) => sum + planet.troops, 0) +
            gameState.troopMovements
                .filter(move => move.owner !== this.playerId && move.owner !== 'neutral')
                .reduce((sum, move) => sum + move.amount, 0);
                
        // Calculate threat level based on ratio of enemy to own troops
        if (myTotalTroops > 0) {
            const troopRatio = enemyTotalTroops / myTotalTroops;
            maxThreat = Math.min(1, troopRatio);
        }
        
        // Increase threat for incoming attacks
        if (incomingAttacks.length > 0) {
            const incomingTroops = incomingAttacks.reduce((sum, move) => sum + move.amount, 0);
            maxThreat = Math.max(maxThreat, Math.min(1, incomingTroops / (myTotalTroops * 0.5)));
        }
        
        // Factor in planet count
        if (myPlanets.length < enemyPlanets.length) {
            maxThreat += 0.2 * (enemyPlanets.length - myPlanets.length) / Math.max(1, enemyPlanets.length);
        }
        
        this.threatLevel = Math.min(1, maxThreat);
        return this.threatLevel;
    }
    
    updateStrategy(gameState) {
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        const totalPlanets = gameState.planets.length;
        
        // Calculate percentage of planets owned
        const planetRatio = myPlanets.length / totalPlanets;
        
        // Switch to consolidation if we own enough planets or threat level is high
        if (planetRatio >= this.config.expansionThreshold || this.threatLevel >= this.config.threatThreshold) {
            this.expansionPhase = false;
        }
        
        // Switch back to expansion if we're losing planets and threat is manageable
        if (planetRatio <= this.config.retreatThreshold && this.threatLevel < this.config.threatThreshold) {
            this.expansionPhase = true;
        }
    }
    
    updateTargetPriorities(gameState) {
        this.targetPriorities = [];
        const myPlanets = gameState.planets.filter(planet => planet.owner === this.playerId);
        
        // Score each potential target planet
        for (const planet of gameState.planets) {
            // Skip own planets
            if (planet.owner === this.playerId) continue;
            
            // Calculate base score based on planet properties
            let score = 0;
            
            // Neutral planets are less defended, so higher priority
            if (planet.owner === 'neutral') {
                score += 30;
            }
            
            // Larger planets are more valuable
            score += planet.size * 2;
            
            // Planets with fewer troops are easier to capture
            score += (100 - Math.min(100, planet.troops)) / 2;
            
            // Calculate minimum distance to any of our planets
            let minDistance = Infinity;
            let closestPlanet = null;
            
            for (const myPlanet of myPlanets) {
                const distance = this.calculateDistance(myPlanet, planet);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPlanet = myPlanet;
                }
            }
            
            // Closer planets are higher priority
            score += (1000 - Math.min(1000, minDistance)) / 10;
            
            // Adjust score based on threat level
            if (this.threatLevel > this.config.threatThreshold && planet.owner !== 'neutral') {
                // Reduce score for enemy planets when under threat
                score *= (1 - this.threatLevel);
            }
            
            // Add to target priorities with source planet
            this.targetPriorities.push({
                planet: planet,
                score: score,
                sourcePlanet: closestPlanet,
                distance: minDistance
            });
        }
        
        // Sort by score (highest first)
        this.targetPriorities.sort((a, b) => b.score - a.score);
    }
    
    makeExpansionMove(gameState, myPlanets) {
        // Get highest priority target with sufficient troops available
        for (const target of this.targetPriorities) {
            const sourcePlanet = target.sourcePlanet;
            if (!sourcePlanet) continue;
            
            // Check if we have enough troops to attack
            const availableTroops = Math.max(0, sourcePlanet.troops - this.config.minTroopsToLeave);
            const neededTroops = this.calculateRequiredTroops(target.planet, sourcePlanet);
            
            if (availableTroops >= neededTroops && neededTroops > 0) {
                // Limit attack size based on config
                const troopsToSend = Math.min(
                    availableTroops, 
                    neededTroops * 1.2, // Send 20% more than needed for safety
                    sourcePlanet.troops * this.config.maxAttackRatio
                );
                
                if (troopsToSend > 0) {
                    return {
                        from: sourcePlanet,
                        to: target.planet,
                        troops: Math.floor(troopsToSend)
                    };
                }
            }
        }
        
        // If we didn't find a good expansion target, try reinforcing frontline
        return this.reinforceFrontline(gameState, myPlanets);
    }
    
    makeDefensiveMove(gameState, myPlanets) {
        // First, check if we need to reinforce any planets under immediate threat
        const threatenedPlanet = this.findThreatenedPlanet(gameState, myPlanets);
        
        if (threatenedPlanet) {
            // Find best planet to send reinforcements from
            const reinforcement = this.findReinforcement(gameState, myPlanets, threatenedPlanet);
            
            if (reinforcement) {
                return {
                    from: reinforcement.planet,
                    to: threatenedPlanet,
                    troops: Math.floor(reinforcement.troops)
                };
            }
        }
        
        // If no immediate threats, reinforce the frontline
        return this.reinforceFrontline(gameState, myPlanets);
    }
    
    findThreatenedPlanet(gameState, myPlanets) {
        // Look for planets with incoming enemy troops
        for (const planet of myPlanets) {
            const incomingAttacks = gameState.troopMovements.filter(move => 
                move.owner !== this.playerId && move.to === planet);
                
            if (incomingAttacks.length > 0) {
                // Calculate total incoming troops
                const incomingTroops = incomingAttacks.reduce((sum, move) => sum + move.amount, 0);
                
                // If incoming troops outnumber current garrison, this planet is threatened
                if (incomingTroops > planet.troops) {
                    return planet;
                }
            }
        }
        
        return null;
    }
    
    findReinforcement(gameState, myPlanets, targetPlanet) {
        // Find planets that can spare troops to help the threatened planet
        const candidates = myPlanets.filter(planet => 
            planet !== targetPlanet && planet.troops > this.config.minTroopsToLeave * 2);
            
        if (candidates.length === 0) return null;
        
        // Sort by closest first
        candidates.sort((a, b) => 
            this.calculateDistance(a, targetPlanet) - this.calculateDistance(b, targetPlanet));
            
        // Pick the closest candidate and send appropriate troops
        const sourcePlanet = candidates[0];
        const availableTroops = Math.max(0, sourcePlanet.troops - this.config.minTroopsToLeave);
        
        // Send up to 70% of available troops
        const troopsToSend = Math.floor(availableTroops * 0.7);
        
        if (troopsToSend > 0) {
            return {
                planet: sourcePlanet,
                troops: troopsToSend
            };
        }
        
        return null;
    }
    
    reinforceFrontline(gameState, myPlanets) {
        // Identify frontline planets (closest to enemy)
        const frontlinePlanets = this.identifyFrontlinePlanets(gameState, myPlanets);
        
        if (frontlinePlanets.length === 0) return null;
        
        // Find backline planets with excess troops
        const backlinePlanets = myPlanets.filter(planet => 
            !frontlinePlanets.includes(planet) && 
            planet.troops > this.config.minTroopsToLeave * 3);
            
        if (backlinePlanets.length === 0) return null;
        
        // Sort frontline by lowest troop count
        frontlinePlanets.sort((a, b) => a.troops - b.troops);
        
        // Sort backline by highest troop count
        backlinePlanets.sort((a, b) => b.troops - a.troops);
        
        // Send troops from the strongest backline to the weakest frontline
        const sourcePlanet = backlinePlanets[0];
        const targetPlanet = frontlinePlanets[0];
        
        const availableTroops = Math.max(0, sourcePlanet.troops - this.config.minTroopsToLeave);
        const troopsToSend = Math.floor(availableTroops * 0.6); // Send 60% of available
        
        if (troopsToSend > 0) {
            return {
                from: sourcePlanet,
                to: targetPlanet,
                troops: troopsToSend
            };
        }
        
        return null;
    }
    
    identifyFrontlinePlanets(gameState, myPlanets) {
        const frontlinePlanets = [];
        const enemyPlanets = gameState.planets.filter(planet => 
            planet.owner !== this.playerId && planet.owner !== 'neutral');
            
        if (enemyPlanets.length === 0) {
            // If no enemy planets, then frontline is our planets closest to neutral planets
            const neutralPlanets = gameState.planets.filter(planet => planet.owner === 'neutral');
            
            if (neutralPlanets.length === 0) return myPlanets; // All planets are ours
            
            // For each of our planets, find distance to closest neutral
            const planetsWithDistances = myPlanets.map(planet => {
                let minDistance = Infinity;
                
                for (const neutralPlanet of neutralPlanets) {
                    const distance = this.calculateDistance(planet, neutralPlanet);
                    minDistance = Math.min(minDistance, distance);
                }
                
                return {
                    planet: planet,
                    distance: minDistance
                };
            });
            
            // Sort by closest to neutrals
            planetsWithDistances.sort((a, b) => a.distance - b.distance);
            
            // Take top 50% as frontline
            const frontlineCount = Math.max(1, Math.floor(myPlanets.length / 2));
            return planetsWithDistances.slice(0, frontlineCount).map(item => item.planet);
        }
        
        // For each of our planets, calculate minimum distance to any enemy planet
        for (const planet of myPlanets) {
            let minDistance = Infinity;
            
            for (const enemyPlanet of enemyPlanets) {
                const distance = this.calculateDistance(planet, enemyPlanet);
                minDistance = Math.min(minDistance, distance);
            }
            
            // Add distance info
            planet.distanceToEnemy = minDistance;
        }
        
        // Sort by distance to enemy (ascending)
        const sortedPlanets = [...myPlanets].sort((a, b) => a.distanceToEnemy - b.distanceToEnemy);
        
        // Take top 40% as frontline (at least 1)
        const frontlineCount = Math.max(1, Math.floor(myPlanets.length * 0.4));
        return sortedPlanets.slice(0, frontlineCount);
    }
    
    calculateRequiredTroops(targetPlanet, sourcePlanet) {
        // For neutral planets
        if (targetPlanet.owner === 'neutral') {
            return targetPlanet.troops * 1.2 + 1; // 20% buffer
        }
        
        // For enemy planets, account for production during travel time
        const distance = this.calculateDistance(sourcePlanet, targetPlanet);
        const travelTime = distance / 150; // Based on troop movement speed
        const extraTroops = Math.ceil(targetPlanet.productionRate * travelTime);
        
        return targetPlanet.troops + extraTroops + 5; // Extra buffer
    }
    
    calculateDistance(planet1, planet2) {
        const dx = planet1.x - planet2.x;
        const dy = planet1.y - planet2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}