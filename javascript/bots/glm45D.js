// =============================================
// root/javascript/bots/glm45D.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * Galactic Commander: An adaptive AI bot that dynamically adjusts its strategy based on game phase and battlefield conditions.
 * The bot prioritizes high-value targets, maintains balanced expansion and defense, and calculates precise troop allocations
 * to minimize waste while maximizing strategic impact.
 */

export default class glm45D extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        
        // Memory for tracking strategic goals and enemy behavior
        this.memory = {
            // Track recent planet ownership changes to identify contested areas
            contestedPlanets: new Set(),
            
            // Cache for planet value calculations to avoid repeated calculations
            planetValueCache: new Map(),
            
            // Track which planets are already targeted by our attacks
            targetedPlanets: new Set(),
            
            // Strategy state based on game phase
            strategy: 'EXPAND', // EXPAND, CONSOLIDATE, ASSAULT
            
            // Track enemy movement patterns
            enemyMovementPatterns: new Map(),
            
            // Last decision timestamp to avoid redundant calculations
            lastDecisionTime: 0,
            
            // Track pending multi-planet operations
            coordinatedAttacks: new Map(),
            
            // Minimum troops to keep as reserve on defensive planets
            defensiveReserve: 30,
            
            // Aggression level (0.5 to 1.5)
            aggressionLevel: 1.0,
            
            // Last time we adjusted aggression
            lastAggressionAdjustment: 0
        };
        
        // Game phase thresholds
        this.PHASE_TRANSITIONS = {
            EARLY_TO_MID: 90,  // 1:30 minutes
            MID_TO_LATE: 210   // 3:30 minutes
        };
    }
    
    /**
     * Main decision method called by the game engine
     * @param {number} dt - Time elapsed since last decision
     * @returns {object|null} Decision object or null if no action
     */
    makeDecision(dt) {
        // Optional cooldown optimization
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }
        
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left
        }
        
        // Update game phase and strategy
        this.updateStrategy();
        
        // Update planet value cache
        this.updatePlanetValueCache();
        
        // Adjust aggression based on game state
        this.adjustAggression();
        
        // Execute phase-specific strategy
        switch (this.memory.strategy) {
            case 'EXPAND':
                return this.executeExpansionStrategy(dt);
            case 'CONSOLIDATE':
                return this.executeConsolidationStrategy(dt);
            case 'ASSAULT':
                return this.executeAssaultStrategy(dt);
            default:
                return this.executeExpansionStrategy(dt);
        }
    }
    
    /**
     * Update the bot's strategy based on game phase and battlefield conditions
     */
    updateStrategy() {
        const elapsed = this.api.getElapsedTime();
        const gamePhase = this.api.getGamePhase();
        const myStats = this.api.getPlayerStats(this.playerId);
        const opponentStats = this.api.getOpponentIds()
            .map(id => this.api.getPlayerStats(id))
            .filter(stats => stats.isActive);
        
        // Early game: Expand rapidly
        if (gamePhase === 'EARLY') {
            this.memory.strategy = 'EXPAND';
            return;
        }
        
        // Mid game: Consolidate forces and prepare for assaults
        if (gamePhase === 'MID') {
            // If we're significantly behind, continue expanding
            if (opponentStats.length > 0 && 
                myStats.planetCount < opponentStats[0].planetCount * 0.7) {
                this.memory.strategy = 'EXPAND';
            } else {
                this.memory.strategy = 'CONSOLIDATE';
            }
            return;
        }
        
        // Late game: All-out assault
        if (gamePhase === 'LATE') {
            this.memory.strategy = 'ASSAULT';
            return;
        }
    }
    
    /**
     * Adjust aggression level based on game state
     */
    adjustAggression() {
        const elapsed = this.api.getElapsedTime();
        
        // Only adjust aggression every 15 seconds to avoid flapping
        if (elapsed - this.memory.lastAggressionAdjustment < 15) {
            return;
        }
        
        const myStats = this.api.getPlayerStats(this.playerId);
        const opponentStats = this.api.getOpponentIds()
            .map(id => this.api.getPlayerStats(id))
            .filter(stats => stats.isActive);
        
        if (opponentStats.length === 0) return;
        
        // Calculate strength ratio relative to strongest opponent
        const strongestOpponent = opponentStats.reduce((prev, current) => 
            (prev.totalTroops + prev.totalProduction) > (current.totalTroops + current.totalProduction) ? prev : current
        );
        
        const myStrength = myStats.totalTroops + myStats.totalProduction;
        const opponentStrength = strongestOpponent.totalTroops + strongestOpponent.totalProduction;
        const strengthRatio = myStrength / opponentStrength;
        
        // Adjust aggression based on relative strength
        if (strengthRatio > 1.2) {
            // We're significantly stronger, be more aggressive
            this.memory.aggressionLevel = Math.min(1.5, this.memory.aggressionLevel + 0.1);
        } else if (strengthRatio < 0.8) {
            // We're weaker, be more defensive
            this.memory.aggressionLevel = Math.max(0.5, this.memory.aggressionLevel - 0.1);
        }
        
        this.memory.lastAggressionAdjustment = elapsed;
    }
    
    /**
     * Update cached planet values to avoid repeated calculations
     */
    updatePlanetValueCache() {
        const allPlanets = this.api.getAllPlanets();
        
        for (const planet of allPlanets) {
            // Skip if already cached and planet hasn't changed significantly
            if (this.memory.planetValueCache.has(planet.id)) {
                const cached = this.memory.planetValueCache.get(planet.id);
                if (cached.lastUpdated > this.api.getElapsedTime() - 10 && 
                    cached.troops === planet.troops && 
                    cached.owner === planet.owner) {
                    continue;
                }
            }
            
            // Calculate dynamic planet value based on multiple factors
            const value = this.calculatePlanetValue(planet);
            
            this.memory.planetValueCache.set(planet.id, {
                value: value,
                troops: planet.troops,
                owner: planet.owner,
                lastUpdated: this.api.getElapsedTime()
            });
        }
    }
    
    /**
     * Calculate a planet's strategic value considering multiple factors
     * @param {object} planet - Planet object
     * @returns {number} Calculated value score
     */
    calculatePlanetValue(planet) {
        // Base value from production rate and size
        let value = planet.productionRate * 10 + planet.size * 2;
        
        // Adjust based on game phase and strategy
        const gamePhase = this.api.getGamePhase();
        switch (this.memory.strategy) {
            case 'EXPAND':
                // In expansion phase, prioritize neutral planets and enemy borders
                if (planet.owner === 'neutral') {
                    value *= 1.2;
                } else if (this.isEnemyPlanet(planet)) {
                    // Check if this planet is on the border
                    const myPlanets = this.api.getMyPlanets();
                    const isBorderPlanet = myPlanets.some(myPlanet => 
                        this.api.getDistance(myPlanet, planet) < 150
                    );
                    if (isBorderPlanet) {
                        value *= 1.1;
                    }
                }
                break;
                
            case 'CONSOLIDATE':
                // In consolidation, prioritize high-production planets
                value *= (1 + planet.productionRate * 0.1);
                break;
                
            case 'ASSAULT':
                // In assault phase, prioritize enemy planets with high production
                if (this.isEnemyPlanet(planet)) {
                    value *= (1.5 + planet.productionRate * 0.2);
                }
                break;
        }
        
        // Reduce value if planet is already targeted
        if (this.memory.targetedPlanets.has(planet.id)) {
            value *= 0.7;
        }
        
        // Adjust based on aggression level
        value *= this.memory.aggressionLevel;
        
        return Math.round(value * 100) / 100;
    }
    
    /**
     * Execute expansion strategy - focus on capturing neutral planets and weak enemy positions
     * @param {number} dt - Time elapsed
     * @returns {object|null} Decision object
     */
    executeExpansionStrategy(dt) {
        const myPlanets = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        // Find our best production planets
        const myProductionPlanets = myPlanets
            .filter(p => p.troops > this.memory.defensiveReserve)
            .sort((a, b) => b.productionRate - a.productionRate);
        
        if (myProductionPlanets.length === 0) {
            return null; // No planets with available troops
        }
        
        // Phase 1: Capture neutral planets
        if (neutralPlanets.length > 0) {
            // Find the most valuable neutral planet
            const bestNeutral = neutralPlanets.reduce((best, current) => 
                this.memory.planetValueCache.get(current.id).value > 
                this.memory.planetValueCache.get(best.id).value ? current : best
            );
            
            // Find the closest planet with enough troops
            const sourcePlanet = this.findBestSourcePlanet(bestNeutral, myProductionPlanets);
            
            if (sourcePlanet) {
                const troopsNeeded = this.calculateRequiredTroops(bestNeutral, sourcePlanet);
                const troopsToSend = Math.min(
                    Math.floor(sourcePlanet.troops * 0.7), // Use 70% of available troops
                    troopsNeeded + 10 // Add a small buffer
                );
                
                if (troopsToSend >= 5) { // Minimum troops to send
                    this.memory.targetedPlanets.add(bestNeutral.id);
                    this.setCooldown();
                    return {
                        fromId: sourcePlanet.id,
                        toId: bestNeutral.id,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        // Phase 2: Target weak enemy planets
        const weakEnemyPlanets = enemyPlanets.filter(p => {
            // Predict planet state in near future
            const futureState = this.api.predictPlanetState(p, 5);
            return futureState.owner !== this.playerId && futureState.troops < 30;
        });
        
        if (weakEnemyPlanets.length > 0) {
            const bestTarget = weakEnemyPlanets.reduce((best, current) => 
                this.memory.planetValueCache.get(current.id).value > 
                this.memory.planetValueCache.get(best.id).value ? current : best
            );
            
            const sourcePlanet = this.findBestSourcePlanet(bestTarget, myProductionPlanets);
            
            if (sourcePlanet) {
                const troopsToSend = Math.min(
                    Math.floor(sourcePlanet.troops * 0.5),
                    Math.floor(bestTarget.troops) + 15
                );
                
                if (troopsToSend >= 10) {
                    this.memory.targetedPlanets.add(bestTarget.id);
                    this.setCooldown();
                    return {
                        fromId: sourcePlanet.id,
                        toId: bestTarget.id,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Execute consolidation strategy - strengthen key positions and prepare for assault
     * @param {number} dt - Time elapsed
     * @returns {object|null} Decision object
     */
    executeConsolidationStrategy(dt) {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        // Identify high-production planets to reinforce
        const keyPlanets = myPlanets
            .filter(p => p.productionRate > 1.0)
            .sort((a, b) => b.productionRate - a.productionRate);
        
        // Identify planets under threat
        const threatenedPlanets = myPlanets.filter(p => {
            const threats = this.api.calculateThreat(p);
            return threats > 0;
        });
        
        // Phase 1: Reinforce threatened planets
        if (threatenedPlanets.length > 0) {
            // Find the most threatened planet
            const mostThreatened = threatenedPlanets.reduce((max, planet) => {
                const threat = this.api.calculateThreat(planet);
                return threat > this.api.calculateThreat(max) ? planet : max;
            });
            
            // Find closest planet with available troops
            const sourcePlanet = this.findBestSourcePlanet(mostThreatened, myPlanets);
            
            if (sourcePlanet && sourcePlanet.id !== mostThreatened.id) {
                const threatLevel = this.api.calculateThreat(mostThreatened);
                const troopsToSend = Math.min(
                    Math.floor(sourcePlanet.troops * 0.6),
                    Math.floor(threatLevel * 1.2) + 10
                );
                
                if (troopsToSend >= 10) {
                    this.setCooldown();
                    return {
                        fromId: sourcePlanet.id,
                        toId: mostThreatened.id,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        // Phase 2: Consolidate forces on high-value planets
        if (keyPlanets.length > 1) {
            // Find the weakest high-production planet
            const weakestKey = keyPlanets.reduce((weakest, planet) => 
                planet.troops < weakest.troops ? planet : weakest
            );
            
            // Find strongest high-production planet to reinforce from
            const strongestKey = keyPlanets.reduce((strongest, planet) => 
                planet.troops > strongest.troops ? planet : strongest
            );
            
            if (weakestKey.id !== strongestKey.id && weakestKey.troops < strongestKey.troops * 0.5) {
                const troopsToSend = Math.min(
                    Math.floor(strongestKey.troops * 0.4),
                    Math.floor((999 - weakestKey.troops) * 0.8)
                );
                
                if (troopsToSend >= 20) {
                    this.setCooldown();
                    return {
                        fromId: strongestKey.id,
                        toId: weakestKey.id,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        // Phase 3: Target enemy planets near our strongholds
        const nearbyEnemyPlanets = enemyPlanets.filter(enemy => {
            return myPlanets.some(my => 
                this.api.getDistance(my, enemy) < 120
            );
        });
        
        if (nearbyEnemyPlanets.length > 0) {
            const bestTarget = nearbyEnemyPlanets.reduce((best, current) => 
                this.memory.planetValueCache.get(current.id).value > 
                this.memory.planetValueCache.get(best.id).value ? current : best
            );
            
            const sourcePlanet = this.findBestSourcePlanet(bestTarget, keyPlanets);
            
            if (sourcePlanet) {
                const troopsNeeded = this.calculateRequiredTroops(bestTarget, sourcePlanet);
                const troopsToSend = Math.min(
                    Math.floor(sourcePlanet.troops * 0.6),
                    troopsNeeded + 15
                );
                
                if (troopsToSend >= 15) {
                    this.memory.targetedPlanets.add(bestTarget.id);
                    this.setCooldown();
                    return {
                        fromId: sourcePlanet.id,
                        toId: bestTarget.id,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Execute assault strategy - focused attacks on high-value enemy targets
     * @param {number} dt - Time elapsed
     * @returns {object|null} Decision object
     */
    executeAssaultStrategy(dt) {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        // Find our strongest planets
        const strongPlanets = myPlanets
            .filter(p => p.troops > 100)
            .sort((a, b) => b.troops - a.troops);
        
        if (strongPlanets.length === 0) {
            return null; // No strong planets available
        }
        
        // Phase 1: Target enemy high-production planets
        const highValueEnemyPlanets = enemyPlanets
            .filter(p => p.productionRate > 1.5)
            .sort((a, b) => b.productionRate - a.productionRate);
        
        if (highValueEnemyPlanets.length > 0) {
            const bestTarget = highValueEnemyPlanets[0];
            const sourcePlanet = this.findBestSourcePlanet(bestTarget, strongPlanets);
            
            if (sourcePlanet) {
                const troopsNeeded = this.calculateRequiredTroops(bestTarget, sourcePlanet);
                const troopsToSend = Math.min(
                    Math.floor(sourcePlanet.troops * 0.8), // Use more troops in assault phase
                    troopsNeeded + 20
                );
                
                if (troopsToSend >= 30) {
                    this.memory.targetedPlanets.add(bestTarget.id);
                    this.setCooldown();
                    return {
                        fromId: sourcePlanet.id,
                        toId: bestTarget.id,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        // Phase 2: Coordinated attacks on enemy planets
        const enemyPlanetGroups = this.groupNearbyPlanets(enemyPlanets, 100);
        
        for (const group of enemyPlanetGroups) {
            if (group.length > 1) {
                // Calculate total enemy strength in this group
                const totalEnemyTroops = group.reduce((sum, p) => sum + p.troops, 0);
                
                // Find planets that can contribute to this attack
                const participatingPlanets = strongPlanets.filter(p => {
                    return group.some(enemy => 
                        this.api.getDistance(p, enemy) < 150
                    );
                }).slice(0, 3); // Limit to 3 planets to avoid overcommitment
                
                if (participatingPlanets.length >= 2) {
                    // Each planet contributes proportional to its strength
                    const totalOurTroops = participatingPlanets.reduce((sum, p) => sum + p.troops, 0);
                    
                    for (const source of participatingPlanets) {
                        // Calculate each planet's contribution
                        const contributionRatio = source.troops / totalOurTroops;
                        const troopsToSend = Math.min(
                            Math.floor(source.troops * 0.7),
                            Math.floor(totalEnemyTroops * contributionRatio) + 15
                        );
                        
                        // Find the nearest enemy planet in the group
                        const nearestEnemy = group.reduce((nearest, enemy) => {
                            const dist = this.api.getDistance(source, enemy);
                            return dist < this.api.getDistance(source, nearest) ? enemy : nearest;
                        });
                        
                        if (troopsToSend >= 20) {
                            this.memory.targetedPlanets.add(nearestEnemy.id);
                            this.setCooldown();
                            return {
                                fromId: source.id,
                                toId: nearestEnemy.id,
                                troops: troopsToSend
                            };
                        }
                    }
                }
            }
        }
        
        // Phase 3: Attack remaining enemy planets
        if (enemyPlanets.length > 0) {
            const bestTarget = enemyPlanets.reduce((best, current) => 
                this.memory.planetValueCache.get(current.id).value > 
                this.memory.planetValueCache.get(best.id).value ? current : best
            );
            
            const sourcePlanet = this.findBestSourcePlanet(bestTarget, strongPlanets);
            
            if (sourcePlanet) {
                const troopsToSend = Math.min(
                    Math.floor(sourcePlanet.troops * 0.6),
                    Math.floor(bestTarget.troops) + 20
                );
                
                if (troopsToSend >= 25) {
                    this.memory.targetedPlanets.add(bestTarget.id);
                    this.setCooldown();
                    return {
                        fromId: sourcePlanet.id,
                        toId: bestTarget.id,
                        troops: troopsToSend
                    };
                }
            }
        }
        
        return null;
    }
    
    /**
     * Find the best source planet for an attack
     * @param {object} target - Target planet
     * @param {array} candidates - Potential source planets
     * @returns {object|null} Best source planet or null
     */
    findBestSourcePlanet(target, candidates) {
        // Filter out planets that don't have enough troops
        const validCandidates = candidates.filter(p => 
            p.troops > this.memory.defensiveReserve
        );
        
        if (validCandidates.length === 0) return null;
        
        // Sort by priority: closest with enough troops, higher production is better
        return validCandidates.sort((a, b) => {
            const distA = this.api.getDistance(a, target);
            const distB = this.api.getDistance(b, target);
            
            // Prioritize closer planets with more troops
            const scoreA = (1000 / distA) + (a.troops / 10) + (a.productionRate * 2);
            const scoreB = (1000 / distB) + (b.troops / 10) + (b.productionRate * 2);
            
            return scoreB - scoreA;
        })[0];
    }
    
    /**
     * Calculate required troops to conquer a planet
     * @param {object} target - Target planet
     * @param {object} source - Source planet
     * @returns {number} Required troop count
     */
    calculateRequiredTroops(target, source) {
        // Get travel time
        const travelTime = this.api.getTravelTime(source, target);
        
        // Predict planet state when our troops arrive
        const futureState = this.api.predictPlanetState(target, travelTime);
        
        // Calculate required troops
        let required = Math.ceil(futureState.troops);
        
        // Add buffer based on distance and enemy production
        const buffer = Math.ceil(
            (travelTime * target.productionRate * 0.5) + 
            (this.api.getDistance(source, target) * 0.05)
        );
        
        return Math.min(required + buffer, 999);
    }
    
    /**
     * Check if a planet is owned by an enemy
     * @param {object} planet - Planet to check
     * @returns {boolean} True if enemy planet
     */
    isEnemyPlanet(planet) {
        return planet.owner !== this.playerId && planet.owner !== 'neutral';
    }
    
    /**
     * Group nearby planets for coordinated attacks
     * @param {array} planets - Planets to group
     * @param {number} maxDistance - Maximum distance between planets in a group
     * @returns {array} Array of planet groups
     */
    groupNearbyPlanets(planets, maxDistance) {
        if (planets.length === 0) return [];
        
        const groups = [];
        const used = new Set();
        
        for (const planet of planets) {
            if (used.has(planet.id)) continue;
            
            const group = [planet];
            used.add(planet.id);
            
            // Find all planets within maxDistance
            for (const other of planets) {
                if (used.has(other.id)) continue;
                
                const withinGroup = group.some(p => 
                    this.api.getDistance(p, other) <= maxDistance
                );
                
                if (withinGroup) {
                    group.push(other);
                    used.add(other.id);
                }
            }
            
            groups.push(group);
        }
        
        return groups;
    }
    
    /**
     * Set action cooldown
     */
    setCooldown() {
        this.memory.actionCooldown = this.api.getDecisionCooldown();
    }
    
    /**
     * Clean up targeted planets that have been conquered or are no longer relevant
     */
    cleanupTargetedPlanets() {
        const allPlanets = this.api.getAllPlanets();
        
        // Remove planets that are no longer in the game
        for (const planetId of this.memory.targetedPlanets) {
            if (!allPlanets.some(p => p.id === planetId)) {
                this.memory.targetedPlanets.delete(planetId);
            }
        }
        
        // Remove planets that we now own
        for (const planet of allPlanets) {
            if (planet.owner === this.playerId && this.memory.targetedPlanets.has(planet.id)) {
                this.memory.targetedPlanets.delete(planet.id);
            }
        }
    }
}