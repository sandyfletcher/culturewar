export default class DylanSpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        
        // Decision timers (seconds)
        this.decisionCooldown = 1.0;
        this.minDecisionTime = 0.8;  // Minimum time between decisions
        this.maxDecisionTime = 1.5;  // Maximum time between decisions
        
        // Analysis cooldowns
        this.threatAssessmentCooldown = 0.5;
        this.strategyUpdateCooldown = 3.0;
        
        // Strategy state
        this.currentStrategy = 'balanced';
        this.threats = [];
        this.opportunities = [];
        this.strongholds = [];
        
        // Game phase tracking
        this.gamePhase = 'early'; // early, mid, late
        this.gameStartTime = Date.now();
        
        // Memory of recent actions to prevent thrashing
        this.recentTargets = new Map();
        this.recentSources = new Map();
        
        // Configuration
        this.config = {
            // General settings
            reserveTroopPercentage: 0.3,  // Keep this percentage of troops in reserve
            minTroopsForAttack: 15,       // Minimum troops needed to consider attacking
            opportunityThreshold: 1.2,    // Attack if our strength is X times target
            
            // Planet evaluation weights
            sizeWeight: 1.5,              // Importance of planet size
            troopWeight: 1.0,             // Importance of troop count
            positionWeight: 0.7,          // Importance of strategic position
            
            // Strategy weights
            expansionWeight: 1.2,         // Priority for capturing neutral planets
            defenseWeight: 1.0,           // Priority for defending own planets
            attackWeight: 0.9,            // Priority for attacking enemy planets
            
            // Phase-specific adjustments
            earlyGameExpansionBonus: 1.5, // Extra weight for expansion in early game
            midGameAttackBonus: 1.3,      // Extra weight for attacks in mid game
            lateGameAttackBonus: 1.8,     // Extra weight for attacks in late game
            
            // Cooldown for recently targeted planets (seconds)
            targetMemoryTime: 5
        };
    }

    // Main decision method called by the game
    makeDecision(gameState) {
        // Update cooldowns
        this.decisionCooldown -= 1/60;
        this.threatAssessmentCooldown -= 1/60;
        this.strategyUpdateCooldown -= 1/60;
        
        // Clean up expired recent target memory
        this.cleanupRecentMemory();
        
        // Update game phase
        this.updateGamePhase(gameState);
        
        // Assess threats when cooldown expires
        if (this.threatAssessmentCooldown <= 0) {
            this.assessThreats(gameState);
            this.threatAssessmentCooldown = 0.5; // Reassess every half second
        }
        
        // Update overall strategy periodically
        if (this.strategyUpdateCooldown <= 0) {
            this.updateStrategy(gameState);
            this.strategyUpdateCooldown = 3.0; // Update every 3 seconds
        }
        
        // Only make a move when decision cooldown expires
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
        
        // Get a decision based on current strategy
        let decision = null;
        
        // First check for critical defense needs
        decision = this.makeDefensiveDecision(gameState, myPlanets);
        if (decision) return decision;
        
        // Then make normal strategic decisions
        switch (this.currentStrategy) {
            case 'expansion':
                decision = this.makeExpansionDecision(gameState, myPlanets);
                break;
            case 'attack':
                decision = this.makeAttackDecision(gameState, myPlanets);
                if (!decision) {
                    decision = this.makeExpansionDecision(gameState, myPlanets);
                }
                break;
            case 'defense':
                decision = this.makeDefensiveDecision(gameState, myPlanets);
                if (!decision) {
                    decision = this.makeExpansionDecision(gameState, myPlanets);
                }
                break;
            case 'balanced':
            default:
                // Evaluate all potential moves and choose the best one
                decision = this.makeBalancedDecision(gameState, myPlanets);
                break;
        }
        
        // If no strategic decision was made, make an opportunistic move
        if (!decision) {
            decision = this.makeOpportunisticDecision(gameState, myPlanets);
        }
        
        // If we're making a decision, remember the source and target
        if (decision) {
            this.recordAction(decision.from, decision.to);
        }
        
        return decision;
    }
    
    // Clean up expired entries in recent targets/sources
    cleanupRecentMemory() {
        const now = Date.now();
        for (const [id, timestamp] of this.recentTargets.entries()) {
            if (now - timestamp > this.config.targetMemoryTime * 1000) {
                this.recentTargets.delete(id);
            }
        }
        
        for (const [id, timestamp] of this.recentSources.entries()) {
            if (now - timestamp > this.config.targetMemoryTime * 1000) {
                this.recentSources.delete(id);
            }
        }
    }
    
    // Record an action to avoid repeating too soon
    recordAction(sourcePlanet, targetPlanet) {
        const now = Date.now();
        const sourceId = `${sourcePlanet.x},${sourcePlanet.y}`;
        const targetId = `${targetPlanet.x},${targetPlanet.y}`;
        
        this.recentSources.set(sourceId, now);
        this.recentTargets.set(targetId, now);
    }
    
    // Check if a planet was recently used as source or target
    wasRecentlyUsed(planet, asSource = true) {
        const id = `${planet.x},${planet.y}`;
        const collection = asSource ? this.recentSources : this.recentTargets;
        return collection.has(id);
    }
    
    // Update the game phase based on time and planet ownership
    updateGamePhase(gameState) {
        const gameTime = (Date.now() - this.gameStartTime) / 1000;
        const totalPlanets = gameState.planets.length;
        const occupiedPlanets = gameState.planets.filter(p => p.owner !== 'neutral').length;
        const occupationPercentage = occupiedPlanets / totalPlanets;
        
        // Determine game phase based on time and map control
        if (gameTime < 60 && occupationPercentage < 0.5) {
            this.gamePhase = 'early';
        } else if (gameTime < 180 || occupationPercentage < 0.8) {
            this.gamePhase = 'mid';
        } else {
            this.gamePhase = 'late';
        }
    }
    
    // Determine the overall strategy based on game state
    updateStrategy(gameState) {
        const myPlanets = gameState.planets.filter(p => p.owner === this.playerId);
        const enemyPlanets = gameState.planets.filter(p => p.owner !== this.playerId && p.owner !== 'neutral');
        const neutralPlanets = gameState.planets.filter(p => p.owner === 'neutral');
        
        // Calculate total troops and production for each player
        const myTroops = this.calculateTotalTroops(myPlanets);
        const myProduction = this.calculateTotalProduction(myPlanets);
        
        // Get total enemy strength info
        const enemies = new Set(enemyPlanets.map(p => p.owner));
        const enemyStrength = {};
        let strongestEnemy = null;
        let strongestEnemyTroops = 0;
        
        for (const enemyId of enemies) {
            const enemyPlanetList = enemyPlanets.filter(p => p.owner === enemyId);
            const enemyTroops = this.calculateTotalTroops(enemyPlanetList);
            const enemyProduction = this.calculateTotalProduction(enemyPlanetList);
            
            enemyStrength[enemyId] = {
                troops: enemyTroops,
                production: enemyProduction,
                planets: enemyPlanetList.length
            };
            
            if (enemyTroops > strongestEnemyTroops) {
                strongestEnemy = enemyId;
                strongestEnemyTroops = enemyTroops;
            }
        }
        
        // Adjust weights based on game phase
        let expansionValue = this.config.expansionWeight;
        let attackValue = this.config.attackWeight;
        let defenseValue = this.config.defenseWeight;
        
        if (this.gamePhase === 'early') {
            expansionValue *= this.config.earlyGameExpansionBonus;
        } else if (this.gamePhase === 'mid') {
            attackValue *= this.config.midGameAttackBonus;
        } else if (this.gamePhase === 'late') {
            attackValue *= this.config.lateGameAttackBonus;
            // If winning, be more aggressive
            if (myTroops > strongestEnemyTroops * 1.5) {
                attackValue *= 1.5;
            }
        }
        
        // If under significant threat, prioritize defense
        if (this.threats.length > 0) {
            defenseValue *= 1.5;
        }
        
        // If many neutral planets available, prioritize expansion
        if (neutralPlanets.length > 3) {
            expansionValue *= 1.2;
        }
        
        // Choose strategy based on weighted values
        const strategies = [
            { name: 'expansion', value: expansionValue },
            { name: 'attack', value: attackValue },
            { name: 'defense', value: defenseValue },
            { name: 'balanced', value: (expansionValue + attackValue + defenseValue) / 3 }
        ];
        
        strategies.sort((a, b) => b.value - a.value);
        this.currentStrategy = strategies[0].name;
    }
    
    // Assess potential threats to owned planets
    assessThreats(gameState) {
        // Clear previous threats
        this.threats = [];
        this.opportunities = [];
        this.strongholds = [];
        
        const myPlanets = gameState.planets.filter(p => p.owner === this.playerId);
        const enemyPlanets = gameState.planets.filter(p => p.owner !== this.playerId && p.owner !== 'neutral');
        const neutralPlanets = gameState.planets.filter(p => p.owner === 'neutral');
        
        // Assess incoming threats from troop movements
        const incomingThreats = gameState.troopMovements.filter(movement => 
            movement.owner !== this.playerId && 
            movement.to.owner === this.playerId
        );
        
        // Add incoming attack threats
        for (const threat of incomingThreats) {
            this.threats.push({
                type: 'incoming',
                targetPlanet: threat.to,
                sourcePlanet: null,
                enemyId: threat.owner,
                troopCount: threat.amount,
                eta: 1 - threat.progress, // Rough ETA in seconds
                priority: 0.8 + (threat.amount / threat.to.troops) // Higher priority if threat can take over
            });
        }
        
        // Assess potential threats from nearby enemy planets
        for (const myPlanet of myPlanets) {
            // Find enemy planets within threatening distance
            const nearbyEnemies = enemyPlanets.filter(enemy => 
                this.calculateDistance(myPlanet, enemy) < 300 && 
                enemy.troops > myPlanet.troops * 0.7
            );
            
            // Add potential threats
            for (const enemy of nearbyEnemies) {
                this.threats.push({
                    type: 'nearby',
                    targetPlanet: myPlanet,
                    sourcePlanet: enemy,
                    enemyId: enemy.owner,
                    troopCount: enemy.troops,
                    distance: this.calculateDistance(myPlanet, enemy),
                    priority: 0.5 + (enemy.troops / myPlanet.troops * 0.5) // Higher priority for stronger enemies
                });
            }
            
            // Identify our strongholds (well-defended planets)
            if (myPlanet.size >= 25 || myPlanet.troops > 50) {
                this.strongholds.push({
                    planet: myPlanet,
                    strength: myPlanet.troops + myPlanet.size * 2
                });
            }
        }
        
        // Sort threats by priority
        this.threats.sort((a, b) => b.priority - a.priority);
        
        // Find opportunities - enemies or neutrals we can easily take
        for (const target of [...enemyPlanets, ...neutralPlanets]) {
            // Find my planets that could attack this target
            const potentialAttackers = myPlanets.filter(p => 
                this.calculateDistance(p, target) < 300 && 
                p.troops > target.troops * 1.2
            );
            
            if (potentialAttackers.length > 0) {
                // Get the best attacker
                potentialAttackers.sort((a, b) => 
                    (b.troops - target.troops) - (a.troops - target.troops)
                );
                
                const bestAttacker = potentialAttackers[0];
                
                this.opportunities.push({
                    targetPlanet: target,
                    sourcePlanet: bestAttacker,
                    troopsNeeded: Math.ceil(target.troops * 1.2),
                    priority: this.calculatePlanetValue(target) / this.calculateDistance(bestAttacker, target) * 100
                });
            }
        }
        
        // Sort opportunities by priority
        this.opportunities.sort((a, b) => b.priority - a.priority);
    }
    
    // Make a balanced decision considering all factors
    makeBalancedDecision(gameState, myPlanets) {
        // Create a list of all possible moves with scores
        const possibleMoves = [];
        
        // Check defensive moves
        const defensiveMove = this.makeDefensiveDecision(gameState, myPlanets);
        if (defensiveMove) {
            return defensiveMove; // Prioritize critical defense
        }
        
        // Check expansion opportunities
        for (const source of myPlanets) {
            if (source.troops < this.config.minTroopsForAttack) continue;
            if (this.wasRecentlyUsed(source, true)) continue;
            
            // Get neutral targets
            const neutralTargets = gameState.planets.filter(p => 
                p.owner === 'neutral' && 
                !this.wasRecentlyUsed(p, false)
            );
            
            for (const target of neutralTargets) {
                const distance = this.calculateDistance(source, target);
                if (distance > 300) continue; // Skip targets that are too far
                
                const troopsNeeded = Math.ceil(target.troops * 1.2);
                
                // Only consider if we have enough troops
                if (source.troops > troopsNeeded + this.getReserveTroops(source)) {
                    const score = this.calculateMoveScore({
                        source,
                        target,
                        distance,
                        troopsNeeded,
                        gamePhase: this.gamePhase,
                        moveType: 'expansion'
                    });
                    
                    possibleMoves.push({
                        from: source,
                        to: target,
                        troops: troopsNeeded,
                        score: score
                    });
                }
            }
            
            // Get enemy targets
            const enemyTargets = gameState.planets.filter(p => 
                p.owner !== this.playerId && 
                p.owner !== 'neutral' && 
                !this.wasRecentlyUsed(p, false)
            );
            
            for (const target of enemyTargets) {
                const distance = this.calculateDistance(source, target);
                if (distance > 300) continue; // Skip targets that are too far
                
                const troopsNeeded = Math.ceil(target.troops * 1.5);
                
                // Only consider if we have enough troops
                if (source.troops > troopsNeeded + this.getReserveTroops(source)) {
                    const score = this.calculateMoveScore({
                        source,
                        target,
                        distance,
                        troopsNeeded,
                        gamePhase: this.gamePhase,
                        moveType: 'attack'
                    });
                    
                    possibleMoves.push({
                        from: source,
                        to: target,
                        troops: troopsNeeded,
                        score: score
                    });
                }
            }
            
            // Get reinforcement targets (our weak planets)
            const reinforcementTargets = myPlanets.filter(p => 
                p !== source && 
                p.troops < source.troops * 0.5 && 
                !this.wasRecentlyUsed(p, false)
            );
            
            for (const target of reinforcementTargets) {
                const distance = this.calculateDistance(source, target);
                if (distance > 300) continue; // Skip targets that are too far
                
                const troopsAvailable = source.troops - this.getReserveTroops(source);
                const troopsToSend = Math.floor(troopsAvailable * 0.6);
                
                if (troopsToSend > 10) {
                    const score = this.calculateMoveScore({
                        source,
                        target,
                        distance,
                        troopsNeeded: troopsToSend,
                        gamePhase: this.gamePhase,
                        moveType: 'reinforce'
                    });
                    
                    possibleMoves.push({
                        from: source,
                        to: target,
                        troops: troopsToSend,
                        score: score
                    });
                }
            }
        }
        
        // If we have possible moves, select the highest scored one
        if (possibleMoves.length > 0) {
            possibleMoves.sort((a, b) => b.score - a.score);
            return possibleMoves[0];
        }
        
        return null;
    }
    
    // Calculate a score for a potential move
    calculateMoveScore({ source, target, distance, troopsNeeded, gamePhase, moveType }) {
        let score = 0;
        
        // Base score components
        const planetValue = this.calculatePlanetValue(target);
        const distancePenalty = 100 / (distance + 50); // Closer is better
        const troopEfficiency = target.troops > 0 ? target.troops / troopsNeeded : 0.1;
        
        // Start with the base planet value
        score = planetValue * distancePenalty;
        
        // Adjust based on move type
        switch (moveType) {
            case 'expansion':
                score *= this.config.expansionWeight;
                // Early game bonus for expansion
                if (gamePhase === 'early') {
                    score *= this.config.earlyGameExpansionBonus;
                }
                break;
                
            case 'attack':
                score *= this.config.attackWeight * troopEfficiency;
                // Mid/Late game bonus for attacks
                if (gamePhase === 'mid') {
                    score *= this.config.midGameAttackBonus;
                } else if (gamePhase === 'late') {
                    score *= this.config.lateGameAttackBonus;
                }
                break;
                
            case 'reinforce':
                score *= this.config.defenseWeight;
                // Adjust based on target's vulnerability
                const nearbyEnemies = this.getNearbyEnemies(target, 200);
                score *= (1 + nearbyEnemies.length * 0.3);
                break;
        }
        
        // Strategic adjustments
        
        // If source planet is near enemies, reduce willingness to send troops away
        const sourceNearbyEnemies = this.getNearbyEnemies(source, 150);
        if (sourceNearbyEnemies.length > 0) {
            score *= 0.7;
        }
        
        // Bonus for capturing planets that control central positions
        const centralityBonus = 1 + this.calculateCentrality(target) * 0.3;
        score *= centralityBonus;
        
        // Bonus for taking high production planets
        score *= (1 + target.productionRate * 0.5);
        
        return score;
    }
    
    // Make a defensive decision based on threats
    makeDefensiveDecision(gameState, myPlanets) {
        if (this.threats.length === 0) return null;
        
        // Handle the highest priority threat
        const threat = this.threats[0];
        
        // If it's an incoming attack, reinforce the target
        if (threat.type === 'incoming') {
            const targetPlanet = threat.targetPlanet;
            
            // Find planets that can send reinforcements
            const possibleReinforcements = myPlanets.filter(planet => 
                planet !== targetPlanet && 
                planet.troops > 15 &&
                !this.wasRecentlyUsed(planet, true)
            );
            
            if (possibleReinforcements.length > 0) {
                // Sort by distance (closest first)
                possibleReinforcements.sort((a, b) => 
                    this.calculateDistance(a, targetPlanet) - this.calculateDistance(b, targetPlanet)
                );
                
                const closestReinforcement = possibleReinforcements[0];
                
                // Send enough troops to counter the threat plus a small buffer
                const troopsToSend = Math.min(
                    Math.ceil(threat.troopCount * 1.2),
                    closestReinforcement.troops - this.getReserveTroops(closestReinforcement)
                );
                
                if (troopsToSend > 10) {
                    return {
                        from: closestReinforcement,
                        to: targetPlanet,
                        troops: troopsToSend
                    };
                }
            }
        }
        // If it's a nearby enemy threat, consider preemptive attack
        else if (threat.type === 'nearby') {
            const enemyPlanet = threat.sourcePlanet;
            const myVulnerablePlanet = threat.targetPlanet;
            
            // Find planets that can launch a preemptive attack
            const possibleAttackers = myPlanets.filter(planet => 
                planet.troops > enemyPlanet.troops * 1.3 &&
                !this.wasRecentlyUsed(planet, true)
            );
            
            if (possibleAttackers.length > 0) {
                // Sort by available troops (most first)
                possibleAttackers.sort((a, b) => b.troops - a.troops);
                
                const bestAttacker = possibleAttackers[0];
                
                // Send enough troops to capture the planet
                const troopsToSend = Math.min(
                    Math.ceil(enemyPlanet.troops * 1.5),
                    bestAttacker.troops - this.getReserveTroops(bestAttacker)
                );
                
                if (troopsToSend > enemyPlanet.troops) {
                    return {
                        from: bestAttacker,
                        to: enemyPlanet,
                        troops: troopsToSend
                    };
                }
            }
            
            // If we can't attack, consider reinforcing the vulnerable planet
            if (myVulnerablePlanet.troops < enemyPlanet.troops) {
                const otherPlanets = myPlanets.filter(planet => 
                    planet !== myVulnerablePlanet && 
                    planet.troops > 20 &&
                    !this.wasRecentlyUsed(planet, true)
                );
                
                if (otherPlanets.length > 0) {
                    // Sort by distance to vulnerable planet
                    otherPlanets.sort((a, b) => 
                        this.calculateDistance(a, myVulnerablePlanet) - this.calculateDistance(b, myVulnerablePlanet)
                    );
                    
                    const reinforcer = otherPlanets[0];
                    
                    // Send enough troops to make the planet strong enough
                    const deficit = enemyPlanet.troops - myVulnerablePlanet.troops + 10;
                    const troopsToSend = Math.min(
                        deficit,
                        reinforcer.troops - this.getReserveTroops(reinforcer)
                    );
                    
                    if (troopsToSend > 10) {
                        return {
                            from: reinforcer,
                            to: myVulnerablePlanet,
                            troops: troopsToSend
                        };
                    }
                }
            }
        }
        
        return null;
    }
    
    // Make an expansion decision (capturing neutral planets)
    makeExpansionDecision(gameState, myPlanets) {
        // Find best neutral target
        const neutralPlanets = gameState.planets.filter(p => p.owner === 'neutral');
        
        if (neutralPlanets.length === 0) return null;
        
        // Score all neutral planets for value
        const neutralTargets = [];
        
        for (const neutralPlanet of neutralPlanets) {
            if (this.wasRecentlyUsed(neutralPlanet, false)) continue;
            
            const planetValue = this.calculatePlanetValue(neutralPlanet);
            
            // Find closest planet that can capture it
            const viableSources = myPlanets.filter(p => 
                p.troops > neutralPlanet.troops * 1.2 + this.getReserveTroops(p) &&
                !this.wasRecentlyUsed(p, true)
            );
            
            if (viableSources.length > 0) {
                // Find closest source
                viableSources.sort((a, b) => 
                    this.calculateDistance(a, neutralPlanet) - this.calculateDistance(b, neutralPlanet)
                );
                
                const source = viableSources[0];
                const distance = this.calculateDistance(source, neutralPlanet);
                
                // Calculate position value (prefer central planets)
                const centrality = this.calculateCentrality(neutralPlanet);
                
                // Calculate final score
                const score = (planetValue + centrality * 20) / (distance / 100);
                
                neutralTargets.push({
                    planet: neutralPlanet,
                    source: source,
                    score: score,
                    distance: distance,
                    troopsNeeded: Math.ceil(neutralPlanet.troops * 1.2)
                });
            }
        }
        
        // If no viable targets, return null
        if (neutralTargets.length === 0) return null;
        
        // Sort by score and pick the best
        neutralTargets.sort((a, b) => b.score - a.score);
        const bestTarget = neutralTargets[0];
        
        return {
            from: bestTarget.source,
            to: bestTarget.planet,
            troops: bestTarget.troopsNeeded
        };
    }
    
    // Make an attack decision (capturing enemy planets)
    makeAttackDecision(gameState, myPlanets) {
        // If we have opportunity targets, use those first
        if (this.opportunities.length > 0) {
            const opportunity = this.opportunities[0];
            const source = opportunity.sourcePlanet;
            const target = opportunity.targetPlanet;
            
            // Make sure the opportunity is still valid
            if (source.troops > opportunity.troopsNeeded + this.getReserveTroops(source) &&
                !this.wasRecentlyUsed(source, true) && 
                !this.wasRecentlyUsed(target, false)) {
                
                return {
                    from: source,
                    to: target,
                    troops: opportunity.troopsNeeded
                };
            }
        }
        
        // Otherwise evaluate all potential enemy targets
        const enemyPlanets = gameState.planets.filter(p => 
            p.owner !== this.playerId && p.owner !== 'neutral'
        );
        
        if (enemyPlanets.length === 0) return null;
        
        // Score enemy planets as targets
        const attackTargets = [];
        
        for (const enemyPlanet of enemyPlanets) {
            if (this.wasRecentlyUsed(enemyPlanet, false)) continue;
            
            const planetValue = this.calculatePlanetValue(enemyPlanet);
            
            // Find my planets that could attack it
            const viableSources = myPlanets.filter(p => 
                p.troops > enemyPlanet.troops * 1.5 + this.getReserveTroops(p) &&
                !this.wasRecentlyUsed(p, true)
            );
            
            if (viableSources.length > 0) {
                // Sort by troop count (most first)
                viableSources.sort((a, b) => b.troops - a.troops);
                
                const source = viableSources[0];
                const distance = this.calculateDistance(source, enemyPlanet);
                
                // Calculate strength ratio
                const strengthRatio = source.troops / (enemyPlanet.troops + 1);
                
                // Calculate final score considering planet value and our strength advantage
                const score = (planetValue * strengthRatio) / (distance / 50);
                
                attackTargets.push({
                    planet: enemyPlanet,
                    source: source,
                    score: score,
                    distance: distance,
                    troopsNeeded: Math.ceil(enemyPlanet.troops * 1.5)
                });
            }
        }
        
        // If no viable targets, return null
        if (attackTargets.length === 0) return null;
        
        // Sort by score and pick the best
        attackTargets.sort((a, b) => b.score - a.score);
        const bestTarget = attackTargets[0];
        
        return {
            from: bestTarget.source,
            to: bestTarget.planet,
            troops: bestTarget.troopsNeeded
        };
    }
    
    // Make an opportunistic decision when no strategic choice is available
    makeOpportunisticDecision(gameState, myPlanets) {
        // Find planets with excess troops
        const planetsWithExcess = myPlanets.filter(p => 
            p.troops > 30 && !this.wasRecentlyUsed(p, true)
        );
        
        if (planetsWithExcess.length === 0) return null;
        
        // Sort by troop count (most first)
        planetsWithExcess.sort((a, b) => b.troops - a.troops);
        
        // Use the planet with most troops
        const sourcePlanet = planetsWithExcess[0];
        
        // Find any target we can take
        const allPossibleTargets = gameState.planets.filter(p => 
            p.owner !== this.playerId && !this.wasRecentlyUsed(p, false)
        );
        
        // Score all possible targets
        const scoredTargets = allPossibleTargets.map(target => {
            const distance = this.calculateDistance(sourcePlanet, target);
            let troopsNeeded = 0;
            
            if (target.owner === 'neutral') {
                troopsNeeded = Math.ceil(target.troops * 1.2);
            } else {
                troopsNeeded = Math.ceil(target.troops * 1.5);
            }
            
            // Only consider if we have enough troops
            if (sourcePlanet.troops <= troopsNeeded + this.getReserveTroops(sourcePlanet)) {
                return { target, score: -1 }; // Not viable
            }
            
            // Calculate score based on planet value and distance
            const score = this.calculatePlanetValue(target) / (distance / 100);
            
            return {
                target,
                score,
                distance,
                troopsNeeded
            };
        }).filter(entry => entry.score > 0);
        
        // If no viable targets, return null
        if (scoredTargets.length === 0) return null;
        
        // Sort by score and pick the best
        scoredTargets.sort((a, b) => b.score - a.score);
        const bestOption = scoredTargets[0];
        
        return {
            from: sourcePlanet,
            to: bestOption.target,
            troops: bestOption.troopsNeeded
        };
    }
    
    // Get reserve troops for a planet (troops we want to keep back for defense)
    getReserveTroops(planet) {
        // More troops held in reserve for larger and more central planets
        const baseReserve = this.config.reserveTroopPercentage * planet.troops;
        const sizeBonus = planet.size * 0.5;
        const centralityBonus = this.calculateCentrality(planet) * 5;
        
        return Math.ceil(baseReserve + sizeBonus + centralityBonus);
    }
    
    // Calculate distance between two planets
    calculateDistance(planetA, planetB) {
        const dx = planetA.x - planetB.x;
        const dy = planetA.y - planetB.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Calculate the total value of a planet based on various factors
    calculatePlanetValue(planet) {
        // Base value from size
        const sizeValue = planet.size * this.config.sizeWeight;
        
        // Value from production rate (if available)
        const productionValue = planet.productionRate ? planet.productionRate * 10 : planet.size * 0.5;
        
        // Value from position (centrality)
        const positionValue = this.calculateCentrality(planet) * this.config.positionWeight * 20;
        
        return sizeValue + productionValue + positionValue;
    }
    
    // Calculate centrality of a planet (how central it is on the map)
    calculateCentrality(planet) {
        // Get map bounds from game if available
        const mapWidth = this.game.mapWidth || 800;
        const mapHeight = this.game.mapHeight || 600;
        
        // Calculate distance from center
        const centerX = mapWidth / 2;
        const centerY = mapHeight / 2;
        
        const dx = planet.x - centerX;
        const dy = planet.y - centerY;
        const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize to 0-1 range where 1 is most central
        const maxPossibleDistance = Math.sqrt(centerX * centerX + centerY * centerY);
        const centrality = 1 - (distanceFromCenter / maxPossibleDistance);
        
        return centrality;
    }
    
    // Get nearby enemy planets within a certain range
    getNearbyEnemies(planet, range) {
        return this.game.planets.filter(p => 
            p.owner !== this.playerId && 
            p.owner !== 'neutral' &&
            this.calculateDistance(planet, p) <= range
        );
    }
    
    // Calculate total troop count for a list of planets
    calculateTotalTroops(planets) {
        return planets.reduce((sum, planet) => sum + planet.troops, 0);
    }
    
    // Calculate total production rate for a list of planets
    calculateTotalProduction(planets) {
        return planets.reduce((sum, planet) => {
            // Use productionRate property if available, otherwise estimate from size
            const rate = planet.productionRate !== undefined ? 
                planet.productionRate : 
                planet.size * 0.1;
            return sum + rate;
        }, 0);
    }
}