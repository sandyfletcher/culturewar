// =============================================
// root/javascript/bots/glm45C.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * The "AdaptiveGalacticConqueror" bot employs a sophisticated multi-phase strategic approach:
 * 1. Early Game: Prioritizes rapid expansion to neutral planets while defending key positions
 * 2. Mid Game: Balances expansion with aggression, focusing on disrupting enemy production
 * 3. Late Game: Uses strength-based decision making - all-out attack when dominant, consolidation when threatened
 * 
 * Key strategic principles:
 * - Efficient resource utilization without wasting troops
 * - Adaptive behavior based on game phase and relative strength
 * - Superior threat assessment and defensive positioning
 * - Strategic targeting to maximize impact on the game state
 */

export default class glm45C extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            last_action_time: 0,
            target_planets: new Set(),
            defensive_planets: new Set(),
            production_targets: new Set(),
            last_reinforcement: {},
            combat_readiness: 1.0,
            enemy_strength_history: {}
        };
    }
    
    /**
     * Main decision-making function
     * @param {number} dt - Time elapsed since last decision
     * @returns {object|null} A decision object or null to take no action
     */
    makeDecision(dt) {
        // Performance optimization: skip processing if still in cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }
        
        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets.length) {
            return null; // No planets left, do nothing.
        }
        
        // Update game state analysis
        this.updateGameState(myPlanets);
        
        // Get game context
        const phase = this.api.getGamePhase();
        const myStrengthRatio = this.api.getMyStrengthRatio();
        
        // Strategy based on game phase
        switch(phase) {
            case 'EARLY':
                return this.earlyGameStrategy(dt, myPlanets);
            case 'MID':
                return this.midGameStrategy(dt, myPlanets);
            case 'LATE':
                return this.lateGameStrategy(dt, myPlanets, myStrengthRatio);
            default:
                return null;
        }
    }
    
    updateGameState(myPlanets) {
        // Track enemy strength patterns for adaptive strategy
        const currentTime = this.api.getElapsedTime();
        const opponentIds = this.api.getOpponentIds();
        
        for (const id of opponentIds) {
            if (!this.memory.enemy_strength_history[id]) {
                this.memory.enemy_strength_history[id] = [];
            }
            
            const playerStats = this.api.getPlayerStats(id);
            if (playerStats && playerStats.isActive) {
                this.memory.enemy_strength_history[id].push({
                    time: currentTime,
                    strength: playerStats.totalTroops,
                    planets: playerStats.planetCount,
                    production: playerStats.totalProduction
                });
                
                // Keep only recent history (last 30 seconds)
                this.memory.enemy_strength_history[id] = 
                    this.memory.enemy_strength_history[id].filter(entry => 
                        currentTime - entry.time < 30
                    );
            }
        }
        
        // Update combat readiness based on current situation
        const frontLinePlanets = this.getFrontLinePlanets(myPlanets);
        const avgProduction = myPlanets.reduce((sum, p) => sum + p.productionRate, 0) / myPlanets.length;
        
        this.memory.combat_readiness = Math.max(0.1, Math.min(
            this.api.getMyStrengthRatio() * 
            (1 + avgProduction * 0.1) * 
            (1 + frontLinePlanets.length * 0.05),
            2.0
        ));
    }
    
    getFrontLinePlanets(myPlanets) {
        return myPlanets.filter(planet => {
            // Check for enemy planets within moderate range
            const enemyPlanets = this.api.getEnemyPlanets();
            for (const enemy of enemyPlanets) {
                const distance = this.api.getDistance(planet, enemy);
                if (distance < 200) { 
                    return true;
                }
            }
            return false;
        });
    }
    
    earlyGameStrategy(dt, myPlanets) {
        // Sort planets by strategic priority
        const sortedPlanets = this.sortPlanetsByPriority(myPlanets, 'early');
        
        // Identify key defensive positions
        this.identifyKeyPlanets(myPlanets, 'early');
        
        // First priority: reinforce defensive planets if threatened
        for (const planet of sortedPlanets) {
            if (this.memory.defensive_planets.has(planet.id)) {
                const reinforcementNeeded = this.calculateReinforcementNeed(planet);
                if (reinforcementNeeded > 0) {
                    const source = this.findBestReinforcementSource(planet, sortedPlanets);
                    if (source) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        this.memory.last_reinforcement[planet.id] = this.api.getElapsedTime();
                        return {
                            fromId: source.id,
                            toId: planet.id,
                            troops: Math.min(reinforcementNeeded, Math.floor(source.troops * 0.5))
                        };
                    }
                }
            }
        }
        
        // Try to expand to valuable neutral planets
        const neutralPlanets = this.api.getNeutralPlanets();
        const valuableNeutrals = [...neutralPlanets].sort((a, b) => 
            this.calculatePlanetValue(b, 'early') - this.calculatePlanetValue(a, 'early')
        );
        
        for (const planet of sortedPlanets) {
            const availableTroops = this.memory.defensive_planets.has(planet.id) ? 
                Math.floor(planet.troops * 0.5) : Math.floor(planet.troops * 0.7);
                
            if (availableTroops < 10) continue;
            
            const target = this.findOptimalTarget(planet, valuableNeutrals, 'neutral', 'early');
            if (target) {
                const requiredTroops = this.calculateRequiredTroops(planet, target);
                
                if (requiredTroops <= availableTroops) {
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return {
                        fromId: planet.id,
                        toId: target.id,
                        troops: Math.min(requiredTroops + 5, availableTroops)
                    };
                }
            }
        }
        
        return null;
    }
    
    midGameStrategy(dt, myPlanets) {
        // Sort planets by strategic priority
        const sortedPlanets = this.sortPlanetsByPriority(myPlanets, 'mid');
        
        // Identify strategic production targets
        this.identifyProductionTargets();
        
        // First priority: reinforce threatened planets
        const threatenedPlanets = this.getThreatenedPlanets(myPlanets);
        for (const planet of sortedPlanets) {
            const target = threatenedPlanets.find(t => t.planet.id === planet.id);
            if (target && target.threatLevel > 0.3) { 
                const reinforcementNeeded = Math.floor(target.threatLevel * planet.troops);
                if (reinforcementNeeded > 10) {
                    const source = this.findBestReinforcementSource(planet, sortedPlanets);
                    if (source && source.id !== planet.id) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        this.memory.last_reinforcement[planet.id] = this.api.getElapsedTime();
                        return {
                            fromId: source.id,
                            toId: planet.id,
                            troops: Math.min(reinforcementNeeded, Math.floor(source.troops * 0.6))
                        };
                    }
                }
            }
        }
        
        // Second priority: expand production
        const productionTargets = [...this.memory.production_targets].filter(id => {
            const planet = this.api.getPlanetById(id);
            return planet && planet.owner !== this.playerId;
        });
        
        for (const planet of sortedPlanets) {
            if (planet.troops < 30) continue;
            
            const availableTroops = Math.floor(planet.troops * 0.75);
            if (availableTroops < 20) continue;
            
            const target = this.findOptimalTarget(planet, productionTargets, 'production', 'mid');
            if (target) {
                const requiredTroops = this.calculateRequiredTroops(planet, target, true);
                
                if (requiredTroops <= availableTroops) {
                    if (!this.memory.target_planets.has(target.id)) {
                        this.memory.target_planets.add(target.id);
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return {
                            fromId: planet.id,
                            toId: target.id,
                            troops: Math.min(requiredTroops + 10, availableTroops)
                        };
                    }
                }
            }
        }
        
        // Third priority: attack strategic enemy planets
        const enemyPlanets = this.api.getEnemyPlanets();
        const strategicEnemies = [...enemyPlanets].sort((a, b) => 
            this.calculateStrategicEnemyValue(b) - this.calculateStrategicEnemyValue(a)
        );
        
        for (const planet of sortedPlanets) {
            const availableTroops = Math.floor(planet.troops * 0.8);
            if (availableTroops < 30) continue;
            
            const target = this.findOptimalTarget(planet, strategicEnemies, 'enemy', 'mid');
            if (target) {
                const requiredTroops = this.calculateRequiredTroops(planet, target, true);
                
                if (requiredTroops <= availableTroops) {
                    if (!this.memory.target_planets.has(target.id)) {
                        this.memory.target_planets.add(target.id);
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        return {
                            fromId: planet.id,
                            toId: target.id,
                            troops: Math.min(requiredTroops + 15, availableTroops)
                        };
                    }
                }
            }
        }
        
        return null;
    }
    
    lateGameStrategy(dt, myPlanets, myStrengthRatio) {
        // Sort planets by strategic priority for late game
        const sortedPlanets = this.sortPlanetsByPriority(myPlanets, 'late');
        
        if (myStrengthRatio > 1.3 || this.memory.combat_readiness > 1.2) { 
            // Dominant position - go aggressive
            return this.aggressiveLateStrategy(dt, sortedPlanets);
        } else if (myStrengthRatio < 0.8 || this.memory.combat_readiness < 0.7) { 
            // Weak position - focus on defense
            return this.defensiveLateStrategy(dt, sortedPlanets);
        } else { 
            // Balanced position - adapt based on opponent strength
            return this.balancedLateStrategy(dt, sortedPlanets, myStrengthRatio);
        }
    }
    
    aggressiveLateStrategy(dt, myPlanets) {
        // Sort by troops to use planets with most troops first
        const troopSortedPlanets = [...myPlanets].sort((a, b) => b.troops - a.troops);
        
        const enemyPlanets = this.api.getEnemyPlanets();
        if (!enemyPlanets.length) {
            // If no enemies left, consolidate our strongest planets
            return this.consolidateLateStrategy(dt, myPlanets);
        }
        
        // Identify weak enemy planets for quick conquests
        const weakEnemies = enemyPlanets.filter(p => 
            this.calculatePlanetValue(p) < 15 || p.troops < 20
        );
        
        // If there are weak enemies, prioritize them
        const targets = weakEnemies.length > 0 ? weakEnemies : enemyPlanets;
        
        // Sort targets by strategic enemy value
        const sortedEnemies = [...targets].sort((a, b) => 
            this.calculateStrategicEnemyValue(b) - this.calculateStrategicEnemyValue(a)
        );
        
        // Determine if we should go all-in based on production capacity
        const totalProduction = myPlanets.reduce((sum, p) => sum + p.productionRate, 0);
        const isProductionDominant = totalProduction > 10;
        
        for (const planet of troopSortedPlanets) {
            // All-out attack means using almost all troops
            const attackRatio = isProductionDominant ? 0.95 : 0.9;
            const availableTroops = Math.floor(planet.troops * attackRatio);
            
            if (availableTroops < 40) continue;
            
            // Find best target based on combat readiness
            const target = this.findOptimalTarget(planet, sortedEnemies, 'enemy', 'late');
            if (target) {
                const requiredTroops = this.calculateRequiredTroops(planet, target, true, true);
                const requiredRatio = requiredTroops / planet.troops;
                
                // If the target requires a large portion of our troops, be more cautious
                const safetyBuffer = requiredRatio > 0.8 ? 30 : 15;
                
                if (requiredTroops + safetyBuffer <= availableTroops) {
                    this.memory.actionCooldown = this.api.getDecisionCooldown();
                    return {
                        fromId: planet.id,
                        toId: target.id,
                        troops: Math.min(requiredTroops + safetyBuffer, availableTroops)
                    };
                }
            }
        }
        
        return null;
    }
    
    defensiveLateStrategy(dt, myPlanets) {
        // Mark all planets as defensive
        this.memory.defensive_planets = new Set(myPlanets.map(p => p.id));
        
        // First priority: reinforce heavily threatened planets
        const threatenedPlanets = this.getThreatenedPlanets(myPlanets, true);
        
        if (threatenedPlanets.length > 0) {
            // Sort planets by troops available for sending
            const sortedPlanets = [...myPlanets].sort((a, b) => b.troops - a.troops);
            
            for (const planet of sortedPlanets) {
                // Keep minimal troops for planet defense
                const availableTroops = Math.floor(planet.troops * 0.3);
                
                if (availableTroops < 15) continue;
                
                // Find most threatened planet
                const target = threatenedPlanets.reduce((most, current) => 
                    current.threatLevel > most.threatLevel ? current : most
                );
                
                if (target.planet.id !== planet.id) {
                    const travelTime = this.api.getTravelTime(planet, target.planet);
                    
                    // Only send reinforcements if they can arrive in time
                    if (travelTime < 3.0) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        this.memory.last_reinforcement[target.planet.id] = this.api.getElapsedTime();
                        return {
                            fromId: planet.id,
                            toId: target.planet.id,
                            troops: Math.min(availableTroops, planet.troops - 30)
                        };
                    }
                }
            }
        }
        
        // Second priority: consolidate around strong production planets
        const strongProductionPlanets = myPlanets
            .filter(p => p.productionRate > 2.0)
            .sort((a, b) => b.productionRate - a.productionRate)
            .slice(0, 3); // Top 3 production planets
            
        for (const target of strongProductionPlanets) {
            if (target.troops > target.size * 3) { 
                continue;
            }
            
            const required = Math.floor(target.size * 3) - target.troops;
            if (required <= 0) continue;
            
            // Find nearest planet with surplus troops
            const sourcePlanets = [...myPlanets].sort((a, b) => {
                const aDist = this.api.getDistance(a, target);
                const bDist = this.api.getDistance(b, target);
                return aDist - bDist;
            });
            
            for (const planet of sourcePlanets) {
                if (planet.id === target.id || planet.troops < required * 1.5) {
                    continue;
                }
                
                const availableTroops = Math.floor(planet.troops * 0.25);
                
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                this.memory.last_reinforcement[target.id] = this.api.getElapsedTime();
                return {
                    fromId: planet.id,
                    toId: target.id,
                    troops: Math.min(availableTroops, planet.troops - 30)
                };
            }
        }
        
        return null;
    }
    
    balancedLateStrategy(dt, myPlanets, myStrengthRatio) {
        // Calculate which enemies to prioritize based on threat level
        const opponentStats = this.api.getOpponentIds().map(id => ({
            id,
            stats: this.api.getPlayerStats(id)
        })).filter(os => os.stats && os.stats.isActive);
        
        // Sort opponents by threat (troop count)
        const threats = opponentStats.sort((a, b) => b.stats.totalTroops - a.stats.totalTroops);
        
        // First priority: defend against the strongest opponent if we're weak
        if (myStrengthRatio < 1.0) {
            return this.defensiveLateStrategy(dt, myPlanets);
        }
        
        // Second priority: attack if we have an advantage over a particular opponent
        for (let i = 1; i < threats.length; i++) {
            const threat = threats[i];
            const advantage = myStrengthRatio / (threat.stats.totalTroops / threats[0].stats.totalTroops);
            
            // If we have a significant advantage over this opponent, attack them
            if (advantage > 1.5) {
                const enemyPlanets = this.api.getEnemyPlanets();
                
                for (const planet of myPlanets) {
                    if (planet.troops < 40) continue;
                    
                    const target = this.findOptimalTarget(planet, enemyPlanets, 'enemy', 'late');
                    if (target) {
                        const requiredTroops = this.calculateRequiredTroops(planet, target, true, true);
                        
                        if (requiredTroops + 15 <= planet.troops * 0.8) {
                            this.memory.actionCooldown = this.api.getDecisionCooldown();
                            return {
                                fromId: planet.id,
                                toId: target.id,
                                troops: Math.min(requiredTroops + 15, Math.floor(planet.troops * 0.8))
                            };
                        }
                    }
                }
            }
        }
        
        // Third priority: consolidate if no immediate attacks or defenses
        return this.consolidateLateStrategy(dt, myPlanets);
    }
    
    consolidateLateStrategy(dt, myPlanets) {
        // Find our planets with highest production
        const strongProductionPlanets = myPlanets
            .filter(p => p.productionRate > 1.5)
            .sort((a, b) => b.productionRate - a.productionRate);
        
        // Only consolidate if we have enough troops to make it worthwhile
        const totalTroops = myPlanets.reduce((sum, p) => sum + p.troops, 0);
        const avgTroops = totalTroops / myPlanets.length;
        
        // If we have less than 25 troops per planet on average, don't consolidate
        if (avgTroops < 25) return null;
        
        // Try to reinforce top production planets
        for (const target of strongProductionPlanets) {
            if (target.troops > target.size * 4) continue; // Already well-defended
            
            // Find planets near this target that can send reinforcements
            const nearbyPlanets = myPlanets
                .filter(p => p.id !== target.id)
                .sort((a, b) => {
                    const aDist = this.api.getDistance(a, target);
                    const bDist = this.api.getDistance(b, target);
                    return aDist - bDist;
                });
            
            for (const planet of nearbyPlanets) {
                // Calculate how many troops we need
                const required = Math.floor(target.size * 4) - target.troops;
                if (required <= 0) continue;
                
                // Calculate how many troops we can send
                const availableTroops = Math.floor(planet.troops * 0.3);
                if (availableTroops < required * 0.5) continue;
                
                // Send troops
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                this.memory.last_reinforcement[target.id] = this.api.getElapsedTime();
                return {
                    fromId: planet.id,
                    toId: target.id,
                    troops: Math.min(availableTroops, required)
                };
            }
        }
        
        return null;
    }
    
    identifyKeyPlanets(myPlanets, phase) {
        // Reset defensive planets
        this.memory.defensive_planets.clear();
        
        // Early game: identify planets with good production and centrality
        if (phase === 'early') {
            // Centrality-based defensive positions
            for (const planet of myPlanets) {
                const centrality = this.api.getPlanetCentrality(planet);
                if (centrality > 0.7 && planet.productionRate > 0.8) {
                    this.memory.defensive_planets.add(planet.id);
                }
            }
        }
        
        // Mid game: identify planets on the front line
        if (phase === 'mid') {
            const enemyPlanets = this.api.getEnemyPlanets();
            for (const planet of myPlanets) {
                for (const enemy of enemyPlanets) {
                    const distance = this.api.getDistance(planet, enemy);
                    if (distance < 150) { // Within combat range
                        this.memory.defensive_planets.add(planet.id);
                        break;
                    }
                }
            }
        }
    }
    
    identifyProductionTargets() {
        this.memory.production_targets.clear();
        
        // Find planets with high production that we don't control
        const allPlanets = this.api.getAllPlanets();
        const highProductionPlanets = allPlanets
            .filter(p => p.productionRate > 1.0 && p.owner !== this.playerId)
            .sort((a, b) => b.productionRate - a.productionRate);
        
        // Keep track of top 10 high-production planets
        for (const planet of highProductionPlanets.slice(0, 10)) {
            this.memory.production_targets.add(planet.id);
        }
    }
    
    sortPlanetsByPriority(myPlanets, phase) {
        return [...myPlanets].sort((a, b) => {
            let scoreA = this.calculatePlanetValue(a, phase);
            let scoreB = this.calculatePlanetValue(b, phase);
            
            // Early game: weigh production higher
            if (phase === 'early') {
                scoreA += a.productionRate * 3;
                scoreB += b.productionRate * 3;
            }
            
            // Late game: weigh current troops more heavily
            if (phase === 'late') {
                scoreA += a.troops * 0.3;
                scoreB += b.troops * 0.3;
            }
            
            // Always weigh defensive planets as lower priority for sending troops
            if (this.memory.defensive_planets.has(a.id)) scoreA *= 0.7;
            if (this.memory.defensive_planets.has(b.id)) scoreB *= 0.7;
            
            return scoreB - scoreA;
        });
    }
    
    calculatePlanetValue(planet, phase = 'mid') {
        // Calculate the strategic value of a planet
        let value = planet.size + planet.productionRate * (phase === 'early' ? 4 : phase === 'late' ? 2 : 3);
        
        // Centrality bonus - higher in early game
        const centralityWeight = phase === 'early' ? 8 : phase === 'late' ? 3 : 5;
        const centrality = this.api.getPlanetCentrality(planet);
        value += centrality * centralityWeight;
        
        // Distance penalty for planets too far from enemies
        const avgDistance = this.calculateAverageDistanceToEnemies(planet);
        if (avgDistance > 300) {
            value -= 5; // Too far from enemies reduces value
        }
        
        // If enemy planet, consider its current troops as threat factor
        if (planet.owner !== this.playerId && planet.owner !== 'neutral') {
            const threatMultiplier = phase === 'early' ? 0.05 : phase === 'late' ? 0.2 : 0.1;
            value -= planet.troops * threatMultiplier;
        }
        
        return value;
    }
    
    calculateAverageDistanceToEnemies(planet) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (!enemyPlanets.length) return 0;
        
        const totalDistance = enemyPlanets.reduce((sum, enemy) => {
            return sum + this.api.getDistance(planet, enemy);
        }, 0);
        
        return totalDistance / enemyPlanets.length;
    }
    
    calculateStrategicEnemyValue(planet) {
        // Value based on impact on enemy network
        let value = this.calculatePlanetValue(planet);
        
        // Add weight for production planets
        if (planet.productionRate > 1.0) {
            value += planet.productionRate * 5;
        }
        
        // Add weight for strategically positioned planets
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length > 2) {
            const avgEnemyDistance = enemyPlanets.reduce((sum, enemy) => {
                if (enemy.id === planet.id) return sum;
                return sum + this.api.getDistance(planet, enemy);
            }, 0) / (enemyPlanets.length - 1);
            
            // Central enemy planets are more valuable targets
            if (avgEnemyDistance < 200) {
                value += 10;
            }
        }
        
        // Weight based on current threat level
        const threatLevel = this.api.calculateThreat(planet);
        value += threatLevel * 0.5;
        
        return value;
    }
    
    calculateRequiredTroops(source, target, isEnemy = false, lateGame = false) {
        // Predict the state of the planet when our troops arrive
        const predictionTime = this.api.getTravelTime(source, target);
        const futureState = this.api.predictPlanetState(target, predictionTime);
        
        // Base troops needed: current troops at arrival
        let requiredTroops = futureState.troops;
        
        // Additional considerations
        if (futureState.owner === this.playerId) {
            // If it'll be ours when we arrive, just send enough to overcome current enemy attacks
            const incomingAttacks = this.api.getIncomingAttacks(target);
            const totalThreat = incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
            requiredTroops = Math.max(requiredTroops, totalThreat + 5);
        } else if (isEnemy) {
            // If it's an enemy planet, add a buffer based on game phase
            const buffer = lateGame ? 20 : 10;
            requiredTroops += buffer;
        } else {
            // If it's neutral, add a smaller buffer
            requiredTroops += lateGame ? 5 : 3;
        }
        
        // Cap at planet capacity (999)
        return Math.min(requiredTroops, 999);
    }
    
    getThreatenedPlanets(myPlanets, severeOnly = false) {
        return myPlanets.map(planet => {
            const threat = this.api.calculateThreat(planet);
            // Normalize threat to a 0-1 scale
            const maxThreat = planet.size * 2;
            const normalizedThreat = Math.min(threat / maxThreat, 1.0);
            
            // Consider time since last reinforcement
            const timeSinceReinforcement = 
                this.api.getElapsedTime() - (this.memory.last_reinforcement[planet.id] || 0);
            const decay = Math.min(timeSinceReinforcement / 10, 1.0);
            const adjustedThreat = normalizedThreat * (0.5 + decay * 0.5);
            
            return {
                planet,
                threatLevel: adjustedThreat
            };
        }).filter(t => !severeOnly || t.threatLevel > 0.4);
    }
    
    findBestReinforcementSource(targetPlanet, availablePlanets) {
        // Find the best planet to send reinforcements from
        return availablePlanets.reduce((best, current) => {
            if (current.id === targetPlanet.id) return best;
            
            // Prefer planets with more troops but closer distance
            const currentDistance = this.api.getDistance(current, targetPlanet);
            const bestDistance = best ? this.api.getDistance(best, targetPlanet) : Infinity;
            
            // Score based on troops and distance
            const currentScore = current.troops / (currentDistance + 1);
            const bestScore = best ? best.troops / (bestDistance + 1) : 0;
            
            return currentScore > bestScore ? current : best;
        }, null);
    }
    
    calculateReinforcementNeed(planet) {
        const threat = this.api.calculateThreat(planet);
        // Calculate how many troops we need to counter the threat
        // Leave some buffer (assume planet can handle threats up to its size)
        const needed = Math.max(0, threat - planet.size * 1.5);
        return Math.ceil(needed);
    }
    
    findOptimalTarget(sourcePlanet, targetIds, targetType, phase) {
        if (!targetIds || !targetIds.length) {
            return null;
        }
        
        const targetPlanets = targetIds.map(id => this.api.getPlanetById(id)).filter(Boolean);
        
        // Calculate scores for each target
        const scoredTargets = [];
        for (const target of targetPlanets) {
            // Skip if already being targeted by someone else
            if (this.memory.target_planets.has(target.id)) {
                continue;
            }
            
            // Calculate distance
            const distance = this.api.getDistance(sourcePlanet, target);
            if (distance === 0) {
                continue;
            }
            
            // Calculate value with phase-specific weights
            let value = this.calculatePlanetValue(target, phase);
            
            // Adjust priority based on target type
            switch(targetType) {
                case 'neutral':
                    value *= 1.0;
                    break;
                case 'enemy':
                    // For enemies, consider current troops and strategic value
                    value *= (1 + Math.log10(Math.max(1, target.troops / 10)));
                    value += this.calculateStrategicEnemyValue(target) * 0.3;
                    break;
                case 'production':
                    // For production targets, emphasize production rate
                    value += target.productionRate * 3;
                    break;
            }
            
            // Calculate value per distance
            const valuePerDistance = value / distance;
            
            scoredTargets.push({ target, valuePerDistance });
        }
        
        if (!scoredTargets.length) {
            return null;
        }
        
        // Return the target with best value-to-distance ratio
        return scoredTargets.reduce((best, current) => 
            current.valuePerDistance > best.valuePerDistance ? current : best
        ).target;
    }
}