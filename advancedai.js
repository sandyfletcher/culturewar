/**
 * AdvancedAI for the Planetary Conquest game
 * 
 * This AI uses strategic decision making to:
 * - Prioritize expansion in early game
 * - Defend vulnerable planets
 * - Attack strategically valuable targets
 * - Balance forces across its territory
 */
class AdvancedAI {
    constructor(game) {
        this.game = game;
        this.lastDecisionTime = Date.now();
        this.decisionInterval = 1000; // Make decisions every 1 second
        this.expansionPhase = true; // Start in expansion phase
        this.targetPriorities = {}; // Track planet target priorities
        this.threatAssessments = {}; // Track threat levels to planets
        
        // Strategy configuration
        this.config = {
            minReservePercentage: 0.3, // Minimum troops to keep as reserve (percentage)
            expansionThreshold: 4, // Number of planets to own before shifting from expansion
            neutralAttackThreshold: 0.6, // Attack neutrals when we have this much advantage
            enemyAttackThreshold: 1.5, // Attack enemy when we have this much advantage
            reinforcementThreshold: 0.7, // Reinforce planets below this percentage of max troops
            threatResponseThreshold: 20, // Distance threshold for responding to threats
            maxSimultaneousAttacks: 3, // Limit number of simultaneous attacks
        };
    }

    /**
     * Main decision function called by the game
     */
    makeDecision(gameState) {
        const now = Date.now();
        // Only make decisions at certain intervals to avoid too many movements at once
        if (now - this.lastDecisionTime < this.decisionInterval) {
            return null;
        }
        this.lastDecisionTime = now;

        const { planets, troopMovements } = gameState;
        
        // Get AI-owned planets
        const aiPlanets = planets.filter(planet => planet.owner === 'ai');
        
        // If we have no planets, can't make a decision
        if (aiPlanets.length === 0) {
            return null;
        }
        
        // Update our strategic phase based on planet ownership
        this.updateStrategicPhase(aiPlanets.length, planets);
        
        // Evaluate all planets and their strategic value
        this.evaluatePlanets(planets, troopMovements);
        
        // Identify current threats to our planets
        this.identifyThreats(planets, troopMovements);
        
        // Determine movements in progress to avoid double-sending
        const currentTargets = new Set();
        troopMovements.forEach(movement => {
            if (movement.owner === 'ai') {
                currentTargets.add(movement.to);
            }
        });
        
        // If we're already attacking the maximum number of planets, skip this turn
        if (currentTargets.size >= this.config.maxSimultaneousAttacks) {
            return null;
        }
        
        // Decide on the next move, with different priorities based on phase
        if (this.expansionPhase) {
            // During expansion, prioritize taking neutral planets
            return this.expansionStrategy(aiPlanets, planets, currentTargets, troopMovements);
        } else {
            // Determine if we need to respond to immediate threats
            const threatResponse = this.respondToThreats(aiPlanets, planets, currentTargets, troopMovements);
            if (threatResponse) {
                return threatResponse;
            }
            
            // Determine if we should balance/reinforce our planets
            const reinforcement = this.reinforcementStrategy(aiPlanets, currentTargets);
            if (reinforcement) {
                return reinforcement;
            }
            
            // Otherwise, look for conquest opportunities
            return this.conquestStrategy(aiPlanets, planets, currentTargets, troopMovements);
        }
    }
    
    /**
     * Update the AI's strategic phase based on game state
     */
    updateStrategicPhase(aiPlanetCount, planets) {
        // Transition from expansion to conquest phase when we have enough planets
        if (this.expansionPhase && aiPlanetCount >= this.config.expansionThreshold) {
            this.expansionPhase = false;
        }
        
        // If we lost planets, we might need to go back to expansion
        if (!this.expansionPhase && aiPlanetCount < this.config.expansionThreshold) {
            // Only go back to expansion if there are neutral planets to capture
            const neutralPlanets = planets.filter(planet => planet.owner === 'neutral');
            if (neutralPlanets.length > 0) {
                this.expansionPhase = true;
            }
        }
    }
    
    /**
     * Evaluate all planets for their strategic value
     */
    evaluatePlanets(planets, troopMovements) {
        // Reset priorities
        this.targetPriorities = {};
        
        planets.forEach(planet => {
            if (planet.owner === 'ai') {
                return; // Skip our own planets
            }
            
            let priority = 0;
            
            // Base value from production rate
            priority += planet.productionRate * 10;
            
            // Proximity value (closer planets are more valuable)
            const closestAiPlanet = this.findClosestPlanet(planet, planets.filter(p => p.owner === 'ai'));
            if (closestAiPlanet) {
                const distance = this.distanceBetween(planet, closestAiPlanet);
                // Closer planets get higher priority
                priority += 200 / Math.max(distance, 1);
            }
            
            // Enemy planets are more valuable than neutral
            if (planet.owner === 'player') {
                priority *= 1.5;
            }
            
            // Penalize targets that already have troops being sent to them
            troopMovements.forEach(movement => {
                if (movement.to === planet) {
                    priority *= 0.5; // Reduce priority of targets already being attacked
                }
            });
            
            this.targetPriorities[this.getPlanetId(planet)] = priority;
        });
    }
    
    /**
     * Identify threats to AI planets
     */
    identifyThreats(planets, troopMovements) {
        // Reset threat assessments
        this.threatAssessments = {};
        
        // Identify enemy planets as potential threats
        const enemyPlanets = planets.filter(planet => planet.owner === 'player');
        const aiPlanets = planets.filter(planet => planet.owner === 'ai');
        
        // Assess each AI planet's threat level
        aiPlanets.forEach(aiPlanet => {
            let threatLevel = 0;
            
            // Check for enemy troops heading toward this planet
            troopMovements.forEach(movement => {
                if (movement.to === aiPlanet && movement.owner === 'player') {
                    threatLevel += movement.amount * 2; // Immediate threat
                }
            });
            
            // Check for nearby enemy planets that could attack
            enemyPlanets.forEach(enemyPlanet => {
                const distance = this.distanceBetween(aiPlanet, enemyPlanet);
                // Only consider threats within reasonable distance
                if (distance < 300) {
                    // Threat is higher from closer planets with more troops
                    const proximityThreat = (enemyPlanet.troops / (distance * 0.1));
                    threatLevel += proximityThreat;
                }
            });
            
            this.threatAssessments[this.getPlanetId(aiPlanet)] = threatLevel;
        });
    }
    
    /**
     * Strategy for expanding by capturing neutral planets
     */
    expansionStrategy(aiPlanets, planets, currentTargets, troopMovements) {
        // Find all neutral planets
        const neutralPlanets = planets.filter(planet => planet.owner === 'neutral');
        
        // If no neutral planets, fall back to conquest
        if (neutralPlanets.length === 0) {
            this.expansionPhase = false;
            return this.conquestStrategy(aiPlanets, planets, currentTargets, troopMovements);
        }
        
        // Find the best source and target for expansion
        let bestSourcePlanet = null;
        let bestTargetPlanet = null;
        let bestScore = -Infinity;
        
        aiPlanets.forEach(sourcePlanet => {
            // Skip planets with too few troops to attack
            const availableTroops = sourcePlanet.troops * (1 - this.config.minReservePercentage);
            if (availableTroops < 10) return;
            
            neutralPlanets.forEach(targetPlanet => {
                // Skip targets that already have troops heading to them
                if (currentTargets.has(targetPlanet)) return;
                
                const distance = this.distanceBetween(sourcePlanet, targetPlanet);
                const targetPriority = this.targetPriorities[this.getPlanetId(targetPlanet)] || 0;
                
                // Calculate advantage - need more troops to capture planet
                const advantage = availableTroops / (targetPlanet.troops + 1);
                
                // Skip targets we don't have enough advantage over
                if (advantage < this.config.neutralAttackThreshold) return;
                
                // Higher score means better attack opportunity
                const score = (targetPriority / Math.max(distance, 1)) * advantage;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestSourcePlanet = sourcePlanet;
                    bestTargetPlanet = targetPlanet;
                }
            });
        });
        
        // If we found a good expansion opportunity, take it
        if (bestSourcePlanet && bestTargetPlanet) {
            const troopsToSend = Math.min(
                bestSourcePlanet.troops * (1 - this.config.minReservePercentage),
                bestTargetPlanet.troops + 10 // Send enough to capture plus a small buffer
            );
            
            if (troopsToSend >= 5) { // Don't send tiny forces
                return {
                    from: bestSourcePlanet,
                    to: bestTargetPlanet,
                    troops: Math.floor(troopsToSend)
                };
            }
        }
        
        return null;
    }
    
    /**
     * Strategy for conquering enemy planets
     */
    conquestStrategy(aiPlanets, planets, currentTargets, troopMovements) {
        // Find all enemy planets
        const enemyPlanets = planets.filter(planet => planet.owner === 'player');
        
        // If no enemy planets, fall back to expansion or reinforcement
        if (enemyPlanets.length === 0) {
            if (planets.some(planet => planet.owner === 'neutral')) {
                this.expansionPhase = true;
                return this.expansionStrategy(aiPlanets, planets, currentTargets, troopMovements);
            } else {
                return this.reinforcementStrategy(aiPlanets, currentTargets);
            }
        }
        
        // Find the best source and target for attack
        let bestSourcePlanet = null;
        let bestTargetPlanet = null;
        let bestScore = -Infinity;
        
        aiPlanets.forEach(sourcePlanet => {
            // Skip planets with too few troops to attack
            const availableTroops = sourcePlanet.troops * (1 - this.config.minReservePercentage);
            if (availableTroops < 15) return;
            
            // Consider both enemy and neutral planets as potential targets
            const potentialTargets = [...enemyPlanets];
            if (!this.expansionPhase) {
                potentialTargets.push(...planets.filter(p => p.owner === 'neutral'));
            }
            
            potentialTargets.forEach(targetPlanet => {
                // Skip targets that already have troops heading to them
                if (currentTargets.has(targetPlanet)) return;
                
                const distance = this.distanceBetween(sourcePlanet, targetPlanet);
                const targetPriority = this.targetPriorities[this.getPlanetId(targetPlanet)] || 0;
                
                // Calculate advantage (our troops vs their troops)
                const advantage = availableTroops / (targetPlanet.troops + 1);
                
                // Skip targets we don't have enough advantage over
                const minimumAdvantage = targetPlanet.owner === 'player' 
                    ? this.config.enemyAttackThreshold 
                    : this.config.neutralAttackThreshold;
                
                if (advantage < minimumAdvantage) return;
                
                // Higher score means better attack opportunity
                const score = (targetPriority / Math.max(distance, 1)) * advantage;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestSourcePlanet = sourcePlanet;
                    bestTargetPlanet = targetPlanet;
                }
            });
        });
        
        // If we found a good attack opportunity, take it
        if (bestSourcePlanet && bestTargetPlanet) {
            // For enemy planets, we need more troops to ensure capture
            const buffer = bestTargetPlanet.owner === 'player' ? 20 : 10;
            const troopsToSend = Math.min(
                bestSourcePlanet.troops * (1 - this.config.minReservePercentage),
                bestTargetPlanet.troops + buffer
            );
            
            if (troopsToSend >= 15) { // Ensure we're sending a meaningful force
                return {
                    from: bestSourcePlanet,
                    to: bestTargetPlanet,
                    troops: Math.floor(troopsToSend)
                };
            }
        }
        
        // If no good attack, try reinforcement instead
        return this.reinforcementStrategy(aiPlanets, currentTargets);
    }
    
    /**
     * Strategy for reinforcing vulnerable planets
     */
    reinforcementStrategy(aiPlanets, currentTargets) {
        // Find vulnerable planets and strong planets
        const vulnerablePlanets = [];
        const strongPlanets = [];
        
        aiPlanets.forEach(planet => {
            // Calculate theoretical maximum troops this planet should have
            const maxTroops = 30 + (planet.productionRate * 20);
            const ratio = planet.troops / maxTroops;
            
            // Skip planets already being reinforced
            if (currentTargets.has(planet)) return;
            
            if (ratio < this.config.reinforcementThreshold) {
                vulnerablePlanets.push({
                    planet,
                    ratio,
                    maxTroops
                });
            } else if (planet.troops > 50 && ratio > 0.8) {
                strongPlanets.push({
                    planet,
                    ratio,
                    maxTroops
                });
            }
        });
        
        // Sort vulnerable planets by ratio (most vulnerable first)
        vulnerablePlanets.sort((a, b) => a.ratio - b.ratio);
        
        // If we have vulnerable planets and strong planets, reinforce
        if (vulnerablePlanets.length > 0 && strongPlanets.length > 0) {
            const targetPlanet = vulnerablePlanets[0].planet;
            
            // Sort strong planets by distance to the vulnerable planet
            strongPlanets.sort((a, b) => {
                const distA = this.distanceBetween(a.planet, targetPlanet);
                const distB = this.distanceBetween(b.planet, targetPlanet);
                return distA - distB;
            });
            
            const sourcePlanet = strongPlanets[0].planet;
            
            // Calculate troops to send - enough to bring the target up to 70% but keeping enough in source
            const troopsNeeded = Math.floor((vulnerablePlanets[0].maxTroops * 0.7) - targetPlanet.troops);
            const troopsAvailable = Math.floor(sourcePlanet.troops - (strongPlanets[0].maxTroops * 0.6));
            const troopsToSend = Math.min(troopsNeeded, troopsAvailable);
            
            if (troopsToSend >= 10) {
                return {
                    from: sourcePlanet,
                    to: targetPlanet,
                    troops: troopsToSend
                };
            }
        }
        
        return null;
    }
    
    /**
     * Respond to threats against AI planets
     */
    respondToThreats(aiPlanets, planets, currentTargets, troopMovements) {
        // Find the most threatened planet
        let mostThreatenedPlanet = null;
        let highestThreatLevel = 0;
        
        aiPlanets.forEach(planet => {
            const threatLevel = this.threatAssessments[this.getPlanetId(planet)] || 0;
            // Only consider significant threats
            if (threatLevel > highestThreatLevel && threatLevel > planet.troops * 0.5) {
                highestThreatLevel = threatLevel;
                mostThreatenedPlanet = planet;
            }
        });
        
        // If we have a threatened planet, send reinforcements
        if (mostThreatenedPlanet) {
            // Look for planets that can send reinforcements
            const possibleReinforcements = aiPlanets.filter(planet => {
                // Skip the threatened planet itself
                if (planet === mostThreatenedPlanet) return false;
                
                // Check if it has troops to spare
                if (planet.troops < 30) return false;
                
                // Check if it's close enough to help
                const distance = this.distanceBetween(planet, mostThreatenedPlanet);
                return distance < this.config.threatResponseThreshold;
            });
            
            if (possibleReinforcements.length > 0) {
                // Sort by distance (closest first)
                possibleReinforcements.sort((a, b) => {
                    const distA = this.distanceBetween(a, mostThreatenedPlanet);
                    const distB = this.distanceBetween(b, mostThreatenedPlanet);
                    return distA - distB;
                });
                
                const sourcePlanet = possibleReinforcements[0];
                // Send 60% of troops as reinforcement
                const troopsToSend = Math.floor(sourcePlanet.troops * 0.6);
                
                if (troopsToSend >= 15) {
                    return {
                        from: sourcePlanet,
                        to: mostThreatenedPlanet,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        return null;
    }
    
    // Helper functions
    
    /**
     * Calculate distance between two planets
     */
    distanceBetween(planetA, planetB) {
        const dx = planetA.x - planetB.x;
        const dy = planetA.y - planetB.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Find the closest planet from a list to the given planet
     */
    findClosestPlanet(planet, planetList) {
        if (planetList.length === 0) return null;
        
        let closestPlanet = planetList[0];
        let closestDistance = this.distanceBetween(planet, closestPlanet);
        
        for (let i = 1; i < planetList.length; i++) {
            const distance = this.distanceBetween(planet, planetList[i]);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPlanet = planetList[i];
            }
        }
        
        return closestPlanet;
    }
    
    /**
     * Generate a unique ID for a planet to use as a key in maps
     */
    getPlanetId(planet) {
        return `${planet.x},${planet.y}`;
    }
}

export default AdvancedAI;