
export default class DermotSpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.decisionCooldown = 0;
        this.targetPlanetIds = new Set(); // Track planets we're already targeting
        this.threatAssessmentCooldown = 0;
        this.threatMap = {}; // Map of planet ID to threat level
        this.lastGameState = {
            myPlanets: 0,
            enemyPlanets: 0,
            neutralPlanets: 0,
            myTroops: 0
        };
        this.strategy = "balanced"; // "aggressive", "defensive", "balanced"
        this.randomFactor = 0.1; // Add slight randomness to decisions
    }

    makeDecision(gameData) {
        // Implement cooldown to avoid making decisions every frame
        this.decisionCooldown -= 0.05;
        if (this.decisionCooldown > 0) return null;
        
        // Reset cooldown (randomize slightly for less predictable behavior)
        this.decisionCooldown = 0.5 + Math.random() * 0.5;
        
        // Only keep valid targets (planets that still exist and targets we are actively sending troops to)
        this.cleanupTargetList(gameData.planets);
        
        // Update threat assessment periodically
        this.threatAssessmentCooldown -= 0.05;
        if (this.threatAssessmentCooldown <= 0) {
            this.updateThreatMap(gameData);
            this.threatAssessmentCooldown = 3; // Reassess every 3 seconds
            this.updateStrategy(gameData);
        }
        
        // Get my planets
        const myPlanets = gameData.planets.filter(planet => planet.owner === this.playerId);
        if (myPlanets.length === 0) return null;
        
        // Decide what to do based on the current strategy
        switch (this.strategy) {
            case "aggressive":
                return this.aggressiveStrategy(myPlanets, gameData);
            case "defensive":
                return this.defensiveStrategy(myPlanets, gameData);
            case "balanced":
            default:
                return this.balancedStrategy(myPlanets, gameData);
        }
    }
    
    updateStrategy(gameData) {
        // Count planets by owner
        const planetCounts = this.countPlanetsByOwner(gameData.planets);
        const myTroopCount = this.countTotalTroops(gameData.planets, gameData.troopMovements);
        
        // Update game state tracking
        const currentState = {
            myPlanets: planetCounts[this.playerId] || 0,
            enemyPlanets: planetCounts.enemy || 0,
            neutralPlanets: planetCounts.neutral || 0,
            myTroops: myTroopCount
        };
        
        // Determine if we're winning or losing
        const totalPlanets = gameData.planets.length;
        const myPlanetPercentage = currentState.myPlanets / totalPlanets;
        
        // Update strategy based on game state
        if (myPlanetPercentage > 0.6) {
            // If we control most planets, be aggressive
            this.strategy = "aggressive";
        } else if (currentState.myPlanets < this.lastGameState.myPlanets || this.isUnderHeavyAttack(gameData)) {
            // If we're losing planets or under heavy attack, be defensive
            this.strategy = "defensive";
        } else {
            // Otherwise, balanced approach
            this.strategy = "balanced";
        }
        
        // Store current state for next comparison
        this.lastGameState = currentState;
    }
    
    isUnderHeavyAttack(gameData) {
        // Count incoming enemy troop movements to our planets
        const incomingAttacks = gameData.troopMovements.filter(
            movement => movement.owner !== this.playerId && 
                       movement.to.owner === this.playerId
        );
        
        // Calculate total incoming troops
        const totalIncomingTroops = incomingAttacks.reduce(
            (sum, movement) => sum + movement.amount, 0
        );
        
        // If more than 30% of our total troops are incoming as attacks, we're under heavy attack
        const myTotalTroops = this.countTotalTroops(gameData.planets, gameData.troopMovements);
        return totalIncomingTroops > myTotalTroops * 0.3;
    }
    
    aggressiveStrategy(myPlanets, gameData) {
        // Prioritize expanding to neutral planets and attacking enemy planets
        const targetPlanet = this.findBestTargetPlanet(myPlanets, gameData, true);
        if (!targetPlanet) return null;
        
        // Choose source planet with highest available troops
        const sourcePlanet = this.findBestSourcePlanet(myPlanets, targetPlanet, gameData, 0.7);
        if (!sourcePlanet) return null;
        
        // Send more troops in aggressive mode
        const troopsToSend = this.calculateTroopsToSend(sourcePlanet, targetPlanet, 0.7, gameData);
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: Math.floor(troopsToSend)
        };
    }
    
    defensiveStrategy(myPlanets, gameData) {
        // First check if any of our planets need reinforcement
        const planetNeedingReinforcement = this.findPlanetNeedingReinforcement(myPlanets, gameData);
        
        if (planetNeedingReinforcement) {
            // Find planet with excess troops to send reinforcements
            const sourcePlanet = this.findBestSourcePlanet(
                myPlanets.filter(p => p !== planetNeedingReinforcement),
                planetNeedingReinforcement,
                gameData,
                0.4
            );
            
            if (sourcePlanet) {
                const troopsToSend = this.calculateTroopsToSend(sourcePlanet, planetNeedingReinforcement, 0.5, gameData);
                return {
                    from: sourcePlanet,
                    to: planetNeedingReinforcement,
                    troops: Math.floor(troopsToSend)
                };
            }
        }
        
        // If no reinforcement needed or possible, take low-risk expansions
        // Focus on neutral planets or weak enemy planets
        const targetPlanet = this.findBestTargetPlanet(myPlanets, gameData, false);
        if (!targetPlanet) return null;
        
        const sourcePlanet = this.findBestSourcePlanet(myPlanets, targetPlanet, gameData, 0.5);
        if (!sourcePlanet) return null;
        
        // Send fewer troops in defensive mode
        const troopsToSend = this.calculateTroopsToSend(sourcePlanet, targetPlanet, 0.5, gameData);
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: Math.floor(troopsToSend)
        };
    }
    
    balancedStrategy(myPlanets, gameData) {
        // Sometimes reinforce, sometimes attack based on situation
        if (Math.random() < 0.3) {
            // 30% chance to check if reinforcements are needed
            const planetNeedingReinforcement = this.findPlanetNeedingReinforcement(myPlanets, gameData);
            
            if (planetNeedingReinforcement) {
                const sourcePlanet = this.findBestSourcePlanet(
                    myPlanets.filter(p => p !== planetNeedingReinforcement),
                    planetNeedingReinforcement,
                    gameData,
                    0.5
                );
                
                if (sourcePlanet) {
                    const troopsToSend = this.calculateTroopsToSend(sourcePlanet, planetNeedingReinforcement, 0.5, gameData);
                    return {
                        from: sourcePlanet,
                        to: planetNeedingReinforcement,
                        troops: Math.floor(troopsToSend)
                    };
                }
            }
        }
        
        // Otherwise focus on expansion in a balanced way
        const targetPlanet = this.findBestTargetPlanet(myPlanets, gameData, false);
        if (!targetPlanet) return null;
        
        const sourcePlanet = this.findBestSourcePlanet(myPlanets, targetPlanet, gameData, 0.6);
        if (!sourcePlanet) return null;
        
        const troopsToSend = this.calculateTroopsToSend(sourcePlanet, targetPlanet, 0.6, gameData);
        
        return {
            from: sourcePlanet,
            to: targetPlanet,
            troops: Math.floor(troopsToSend)
        };
    }
    
    findPlanetNeedingReinforcement(myPlanets, gameData) {
        // First check for planets under attack
        for (const planet of myPlanets) {
            const incomingAttacks = this.getIncomingAttacks(planet, gameData.troopMovements);
            
            if (incomingAttacks.length > 0) {
                const totalIncomingTroops = incomingAttacks.reduce(
                    (sum, attack) => sum + attack.amount, 0
                );
                
                // If planet can't defend itself, it needs reinforcement
                if (totalIncomingTroops > planet.troops) {
                    return planet;
                }
            }
        }
        
        // Then check for frontier planets (those close to enemy planets)
        const frontierPlanets = myPlanets.filter(planet => {
            return this.threatMap[this.getPlanetId(planet)] > 0.6;
        });
        
        if (frontierPlanets.length > 0) {
            // Find the frontier planet with the lowest troops-to-threat ratio
            return frontierPlanets.reduce((weakest, planet) => {
                const threatLevel = this.threatMap[this.getPlanetId(planet)];
                const currentRatio = planet.troops / threatLevel;
                const weakestRatio = weakest.troops / this.threatMap[this.getPlanetId(weakest)];
                
                return currentRatio < weakestRatio ? planet : weakest;
            }, frontierPlanets[0]);
        }
        
        return null;
    }
    
    findBestTargetPlanet(myPlanets, gameData, preferAggressive) {
        // Get all potential target planets
        const nonOwnedPlanets = gameData.planets.filter(
            planet => planet.owner !== this.playerId
        );
        
        if (nonOwnedPlanets.length === 0) return null;
        
        // Score each potential target
        const scoredTargets = nonOwnedPlanets.map(planet => {
            // Skip if we're already targeting this planet with another attack
            if (this.targetPlanetIds.has(this.getPlanetId(planet))) {
                return { planet, score: -Infinity };
            }
            
            // Calculate base scores
            let score = 0;
            
            // Strategic value of planet (bigger planets are more valuable)
            score += planet.size * 3;
            
            // Production value (planet's production rate)
            score += planet.productionRate * 20;
            
            // Distance penalty (closer planets are better targets)
            const closestDistance = Math.min(
                ...myPlanets.map(myPlanet => this.calculateDistance(myPlanet, planet))
            );
            score -= closestDistance * 0.5;
            
            // Neutral planets are easier to conquer
            if (planet.owner === 'neutral') {
                score += 20;
            } else {
                // Enemy planets need to factor in troops and reinforcement likelihood
                score -= planet.troops * 0.5;
                
                if (preferAggressive) {
                    // In aggressive mode, bonus for attacking enemy planets
                    score += 30;
                } else {
                    // In non-aggressive modes, higher penalty for enemy planets
                    score -= 20;
                }
            }
            
            // Check for incoming friendly troops to avoid redundant attacks
            const incomingFriendlyTroops = this.getIncomingFriendlyTroops(planet, gameData.troopMovements);
            if (incomingFriendlyTroops > 0) {
                score -= 50; // Heavily penalize planets already being attacked by us
            }
            
            // Check for incoming enemy reinforcements
            const incomingEnemyTroops = this.getIncomingEnemyReinforcements(planet, gameData.troopMovements);
            score -= incomingEnemyTroops * 0.2;
            
            // Add slight randomness
            score += (Math.random() * 2 - 1) * this.randomFactor * 20;
            
            return { planet, score };
        });
        
        // Sort by score (descending)
        scoredTargets.sort((a, b) => b.score - a.score);
        
        // Return the highest scoring planet if it has a positive score
        return scoredTargets.length > 0 && scoredTargets[0].score > 0 
               ? scoredTargets[0].planet 
               : null;
    }
    
    findBestSourcePlanet(myPlanets, targetPlanet, gameData, maxTroopPercentage) {
        // Score each of my planets as a potential source
        const scoredSources = myPlanets.map(planet => {
            // Skip planets with too few troops
            if (planet.troops < 10) return { planet, score: -Infinity };
            
            let score = 0;
            
            // Distance to target (closer is better)
            const distance = this.calculateDistance(planet, targetPlanet);
            score -= distance * 0.5;
            
            // Available troops (more is better, but keep some for defense)
            const availableTroops = planet.troops * maxTroopPercentage;
            score += availableTroops * 0.3;
            
            // Strategic importance of source planet
            const threatLevel = this.threatMap[this.getPlanetId(planet)] || 0;
            score -= threatLevel * 100; // High threat planets should keep troops for defense
            
            // Production rate (higher production planets can spare more troops)
            score += planet.productionRate * 10;
            
            // Check for incoming attacks to this source planet
            const incomingAttacks = this.getIncomingAttacks(planet, gameData.troopMovements);
            const totalIncomingAttackTroops = incomingAttacks.reduce(
                (sum, attack) => sum + attack.amount, 0
            );
            
            // If this planet is under attack, it's a bad source
            if (totalIncomingAttackTroops > 0) {
                score -= totalIncomingAttackTroops * 2;
            }
            
            // Add slight randomness
            score += (Math.random() * 2 - 1) * this.randomFactor * 10;
            
            return { planet, score };
        });
        
        // Sort by score (descending)
        scoredSources.sort((a, b) => b.score - a.score);
        
        // Return the best source planet if it has enough troops and a positive score
        if (scoredSources.length > 0 && scoredSources[0].score > 0) {
            const bestSource = scoredSources[0].planet;
            
            // Make sure we have enough troops to send
            if (bestSource.troops >= 10) {
                return bestSource;
            }
        }
        
        return null;
    }
    
    calculateTroopsToSend(sourcePlanet, targetPlanet, maxPercentage, gameData) {
        let troopsNeeded = 0;
        
        // If attacking an enemy planet, we need more troops than they have
        if (targetPlanet.owner !== 'neutral' && targetPlanet.owner !== this.playerId) {
            troopsNeeded = targetPlanet.troops + 5;
            
            // Factor in incoming friendly troops that might be attacking this planet
            const incomingFriendlyTroops = this.getIncomingFriendlyTroops(targetPlanet, gameData.troopMovements);
            troopsNeeded -= incomingFriendlyTroops;
            
            // Factor in enemy reinforcements
            const incomingEnemyTroops = this.getIncomingEnemyReinforcements(targetPlanet, gameData.troopMovements);
            troopsNeeded += incomingEnemyTroops;
            
            // Add 10% buffer for safety
            troopsNeeded = Math.ceil(troopsNeeded * 1.1);
        } 
        // If attacking a neutral planet, we need just enough to capture it
        else if (targetPlanet.owner === 'neutral') {
            troopsNeeded = targetPlanet.troops + 5;
        } 
        // If reinforcing our own planet, send troops based on threat level
        else {
            const threatLevel = this.threatMap[this.getPlanetId(targetPlanet)] || 0;
            troopsNeeded = Math.ceil(threatLevel * 50);
        }
        
        // Calculate available troops to send
        const maxTroops = Math.floor(sourcePlanet.troops * maxPercentage);
        
        // For source planets at the front lines (high threat), keep more troops for defense
        const sourceThreatLevel = this.threatMap[this.getPlanetId(sourcePlanet)] || 0;
        const defenseReduction = Math.floor(sourceThreatLevel * 20);
        
        // Calculate how many troops to send (minimum of available and needed)
        return Math.max(10, Math.min(maxTroops - defenseReduction, troopsNeeded));
    }
    
    updateThreatMap(gameData) {
        const planets = gameData.planets;
        this.threatMap = {};
        
        // Reset threat map
        for (const planet of planets) {
            this.threatMap[this.getPlanetId(planet)] = 0;
        }
        
        // Calculate base threat level for each planet
        for (const planet of planets) {
            const planetId = this.getPlanetId(planet);
            
            if (planet.owner === this.playerId) {
                // For our planets, threat comes from nearby enemy planets
                const enemyPlanets = planets.filter(p => 
                    p.owner !== this.playerId && p.owner !== 'neutral'
                );
                
                // Calculate threat based on proximity to enemy planets and their strength
                let threatLevel = 0;
                for (const enemyPlanet of enemyPlanets) {
                    const distance = this.calculateDistance(planet, enemyPlanet);
                    const enemyStrength = enemyPlanet.troops * enemyPlanet.productionRate;
                    
                    // Higher threat from stronger, closer enemies
                    const enemyThreat = (enemyStrength / (distance * distance + 1)) * 0.01;
                    threatLevel += enemyThreat;
                }
                
                // Normalize threat level to 0-1 range (1 being highest threat)
                this.threatMap[planetId] = Math.min(1, threatLevel);
            } else {
                // For non-owned planets, threat represents difficulty to capture
                let captureDifficulty = 0;
                
                // Neutral planets are easier than enemy planets
                if (planet.owner !== 'neutral') {
                    captureDifficulty += 0.5;
                }
                
                // More troops means harder to capture
                captureDifficulty += Math.min(0.5, planet.troops / 200);
                
                this.threatMap[planetId] = captureDifficulty;
            }
        }
        
        // Factor in incoming attacks to our planets
        for (const movement of gameData.troopMovements) {
            if (movement.to.owner === this.playerId && movement.owner !== this.playerId) {
                const targetId = this.getPlanetId(movement.to);
                // Increase threat level based on incoming troop amount
                this.threatMap[targetId] += movement.amount / 100;
                // Cap at 1
                this.threatMap[targetId] = Math.min(1, this.threatMap[targetId]);
            }
        }
    }
    
    // Helper functions
    
    getPlanetId(planet) {
        // Create a unique ID for a planet based on its coordinates
        return `${planet.x},${planet.y}`;
    }
    
    cleanupTargetList(planets) {
        // Remove targets that no longer exist
        const existingPlanetIds = new Set(planets.map(p => this.getPlanetId(p)));
        for (const targetId of this.targetPlanetIds) {
            if (!existingPlanetIds.has(targetId)) {
                this.targetPlanetIds.delete(targetId);
            }
        }
    }
    
    calculateDistance(planet1, planet2) {
        const dx = planet1.x - planet2.x;
        const dy = planet1.y - planet2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getIncomingAttacks(planet, troopMovements) {
        return troopMovements.filter(
            movement => movement.to === planet && movement.owner !== this.playerId
        );
    }
    
    getIncomingFriendlyTroops(planet, troopMovements) {
        return troopMovements
            .filter(movement => movement.to === planet && movement.owner === this.playerId)
            .reduce((sum, movement) => sum + movement.amount, 0);
    }
    
    getIncomingEnemyReinforcements(planet, troopMovements) {
        // If planet is neutral, any incoming troops are a threat
        if (planet.owner === 'neutral') {
            return troopMovements
                .filter(movement => movement.to === planet && movement.owner !== this.playerId)
                .reduce((sum, movement) => sum + movement.amount, 0);
        }
        
        // If planet is enemy-owned, count only friendly owner's troops
        return troopMovements
            .filter(movement => movement.to === planet && movement.owner === planet.owner)
            .reduce((sum, movement) => sum + movement.amount, 0);
    }
    
    countPlanetsByOwner(planets) {
        const counts = { neutral: 0 };
        
        for (const planet of planets) {
            if (planet.owner === this.playerId) {
                counts[this.playerId] = (counts[this.playerId] || 0) + 1;
            } else if (planet.owner === 'neutral') {
                counts.neutral++;
            } else {
                counts.enemy = (counts.enemy || 0) + 1;
            }
        }
        
        return counts;
    }
    
    countTotalTroops(planets, troopMovements) {
        // Count troops on planets
        const planetTroops = planets
            .filter(planet => planet.owner === this.playerId)
            .reduce((sum, planet) => sum + planet.troops, 0);
        
        // Count troops in movements
        const movementTroops = troopMovements
            .filter(movement => movement.owner === this.playerId)
            .reduce((sum, movement) => sum + movement.amount, 0);
        
        return planetTroops + movementTroops;
    }
}