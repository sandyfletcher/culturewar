// =============================================
// root/javascript/bots/glm45B.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * The AdaptiveStrategist bot implements a multi-phase strategy that evolves throughout the game.
 * It prioritizes efficient expansion, strategic combat, and adaptive defense mechanisms.
 * The bot has three distinct phases:
 * 1. Early Game: Rapid expansion into high-value neutral planets
 * 2. Mid Game: Targeted attacks on opponents with efficient force allocation
 * 3. Late Game: All-out assaults while maintaining defensive integrity
 */

export default class glm45B extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        
        // Initialize memory for tracking strategic state
        this.memory = {
            lastActionTime: 0,
            phase: 'EARLY',
            expansionTargets: {},
            attackPlanets: new Set(),
            defensivePlanets: new Set(),
            enemyThreatLevels: {},
            resourceAllocation: {
                attack: 0.6,
                defense: 0.2,
                expansion: 0.2
            }
        };
    }

    /**
     * Main decision-making method called by the game engine
     * @param {number} dt - Time elapsed since last decision
     * @returns {object|null} Decision object or null to take no action
     */
    makeDecision(dt) {
        if (this.memory.lastActionTime > 0) {
            this.memory.lastActionTime -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        // Update game phase and strategy adjustments
        this.updateGamePhase();
        this.analyzeEnemyThreats();
        this.adjustResourceAllocation();

        // Make strategic decision based on current phase and game state
        let decision = null;
        
        switch (this.memory.phase) {
            case 'EARLY':
                decision = this.makeEarlyGameDecision(myPlanets);
                break;
            case 'MID':
                decision = this.makeMidGameDecision(myPlanets);
                break;
            case 'LATE':
                decision = this.makeLateGameDecision(myPlanets);
                break;
        }

        // Set cooldown if a decision was made
        if (decision) {
            this.memory.lastActionTime = this.api.getDecisionCooldown();
        }

        return decision;
    }

    /**
     * Determine the current game phase based on elapsed time and game state
     */
    updateGamePhase() {
        const elapsed = this.api.getElapsedTime();
        const duration = this.api.getGameDuration();
        
        // Base phase on time with adjustments based on game state
        if (elapsed < duration * 0.3) {
            this.memory.phase = 'EARLY';
        } else if (elapsed < duration * 0.7) {
            this.memory.phase = 'MID';
        } else {
            this.memory.phase = 'LATE';
        }
        
        // Adjust phase based on our relative strength
        const strengthRatio = this.api.getMyStrengthRatio();
        if (this.memory.phase === 'MID' && strengthRatio < 0.8) {
            this.memory.phase = 'EARLY';
        } else if (this.memory.phase === 'LATE' && strengthRatio > 1.5) {
            this.memory.phase = 'MID';
        }
    }

    /**
     * Analyze enemy threats to adjust defensive posture
     */
    analyzeEnemyThreats() {
        const myPlanets = this.api.getMyPlanets();
        const enemyIds = this.api.getOpponentIds();
        
        // Reset threat levels
        this.memory.enemyThreatLevels = {};
        
        // For each enemy, calculate overall threat level
        enemyIds.forEach(enemyId => {
            const enemyStats = this.api.getPlayerStats(enemyId);
            if (!this.api.isPlayerActive(enemyId) || !enemyStats) return;
            
            const threat = {
                overall: enemyStats.totalTroops,
                production: enemyStats.totalProduction,
                planets: enemyStats.planetCount,
                aggressiveness: 0
            };
            
            // Calculate aggressiveness based on incoming attacks
            const myIncomingAttacks = this.api.getMyPlanets().map(planet => 
                this.api.getIncomingAttacks(planet)
            ).flat().filter(attack => attack.owner === enemyId);
            
            threat.aggressiveness = myIncomingAttacks.reduce((sum, attack) => 
                sum + attack.amount, 0
            );
            
            this.memory.enemyThreatLevels[enemyId] = threat;
        });
    }

    /**
     * Adjust resource allocation based on game state and threats
     */
    adjustResourceAllocation() {
        const threats = Object.values(this.memory.enemyThreatLevels);
        const maxThreat = threats.length > 0 ? Math.max(...threats.map(t => t.overall)) : 0;
        const myTroops = this.api.getMyTotalTroops();
        
        // Increase defense if we're under threat
        if (maxThreat > myTroops * 0.6) {
            this.memory.resourceAllocation = {
                attack: 0.4,
                defense: 0.4,
                expansion: 0.2
            };
        } 
        // Go aggressive if we're significantly stronger
        else if (this.api.getMyStrengthRatio() > 1.5) {
            this.memory.resourceAllocation = {
                attack: 0.8,
                defense: 0.1,
                expansion: 0.1
            };
        }
        // Balanced approach in standard situations
        else {
            this.memory.resourceAllocation = {
                attack: 0.6,
                defense: 0.2,
                expansion: 0.2
            };
        }
    }

    /**
     * Early game strategy focused on efficient expansion
     * @param {Array} myPlanets - Array of planets owned by the bot
     * @returns {object|null} Decision object or null
     */
    makeEarlyGameDecision(myPlanets) {
        // Prioritize expansion into high-value neutral planets
        const neutralPlanets = this.api.getNeutralPlanets();
        
        // Find the most promising neutral planet
        let bestTarget = null;
        let bestScore = -Infinity;
        
        neutralPlanets.forEach(planet => {
            // Avoid targets that are already attacked by others
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length > 2) return;
            
            // Calculate target score based on production, size, and distance
            const nearestPlanet = this.api.findNearestPlanet(planet, myPlanets);
            const distance = this.api.getDistance(nearestPlanet, planet);
            const travelTime = this.api.getTravelTime(nearestPlanet, planet);
            
            // Prioritize planets with high production and low travel time
            const score = planet.productionRate / (distance * 0.1 + travelTime * 0.5) * planet.size;
            
            if (score > bestScore) {
                bestScore = score;
                bestTarget = planet;
            }
        });
        
        if (!bestTarget) return null;
        
        // Find the best planet to attack from
        let bestSource = null;
        let bestSourceScore = -Infinity;
        
        myPlanets.forEach(planet => {
            if (planet.troops < 20) return; // Don't attack from weak planets
            
            const distance = this.api.getDistance(bestTarget, planet);
            const travelTime = this.api.getTravelTime(bestTarget, planet);
            
            // Prefer planets with lots of troops and short travel time
            const score = planet.troops / (travelTime + 0.1);
            
            if (score > bestSourceScore) {
                bestSourceScore = score;
                bestSource = planet;
            }
        });
        
        if (!bestSource) return null;
        
        // Calculate appropriate troop count
        const troopsToSend = Math.max(
            10, 
            Math.min(
                bestSource.troops * this.memory.resourceAllocation.expansion,
                bestTarget.troops + 10 + Math.floor(bestTarget.size * 2)
            )
        );
        
        return {
            fromId: bestSource.id,
            toId: bestTarget.id,
            troops: Math.floor(troopsToSend)
        };
    }

    /**
     * Mid game strategy with targeted attacks and defense
     * @param {Array} myPlanets - Array of planets owned by the bot
     * @returns {object|null} Decision object or null
     */
    makeMidGameDecision(myPlanets) {
        // First, check for defensive opportunities
        const defensiveDecision = this.makeDefensiveDecision(myPlanets);
        if (defensiveDecision) return defensiveDecision;
        
        // Find high-value enemy targets
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;
        
        // Sort enemy planets by value (production, size, troops)
        const enemyTargets = enemyPlanets.map(planet => {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            const enemyId = planet.owner;
            const enemyThreat = this.memory.enemyThreatLevels[enemyId] || { overall: 0 };
            
            // Predict planet state in near future
            const futureState = this.api.predictPlanetState(planet, 3);
            
            // Calculate target value considering defense and future state
            const value = planet.productionRate * planet.size * 10 / 
                         (futureState.troops + 1);
            
            return { planet, value, futureState, incomingAttacks };
        }).sort((a, b) => b.value - a.value);
        
        // Find the most promising attack
        for (const targetInfo of enemyTargets) {
            const { planet, futureState } = targetInfo;
            
            // Skip planets that will be well-defended
            if (futureState.owner !== planet.owner) continue;
            if (futureState.troops > planet.troops * 1.5) continue;
            
            // Find the best source planet for this attack
            let bestSource = null;
            let bestSourceScore = -Infinity;
            
            myPlanets.forEach(source => {
                if (this.memory.attackPlanets.has(source.id)) return;
                
                const distance = this.api.getDistance(planet, source);
                const travelTime = this.api.getTravelTime(planet, source);
                
                // Consider distance, troop count, and enemy weakness
                const sourceTroopsAfterAttack = source.troops * (1 - this.memory.resourceAllocation.attack);
                const enemyWeakness = Math.max(0, futureState.troops * 0.8);
                
                const score = (source.troops - sourceTroopsAfterAttack) / (travelTime + 0.1) * 
                             (enemyWeakness + 1);
                
                if (score > bestSourceScore) {
                    bestSourceScore = score;
                    bestSource = source;
                }
            });
            
            if (!bestSource) continue;
            
            // Calculate troop requirements with buffer
            const requiredTroops = futureState.troops + 
                                  Math.max(10, Math.floor(planet.size * 2)) + 
                                  Math.floor(this.memory.resourceAllocation.attack * bestSource.troops);
            
            if (bestSource.troops < requiredTroops) continue;
            
            // Mark this planet as part of an attack plan
            this.memory.attackPlanets.add(bestSource.id);
            
            return {
                fromId: bestSource.id,
                toId: planet.id,
                troops: Math.min(999, requiredTroops)
            };
        }
        
        return null;
    }

    /**
     * Late game strategy for all-out assaults and final conquests
     * @param {Array} myPlanets - Array of planets owned by the bot
     * @returns {object|null} Decision object or null
     */
    makeLateGameDecision(myPlanets) {
        // First, check for defensive opportunities
        const defensiveDecision = this.makeDefensiveDecision(myPlanets);
        if (defensiveDecision) return defensiveDecision;
        
        // Identify the strongest opponent
        let strongestEnemy = null;
        let maxTroops = 0;
        
        const enemyStats = this.api.getOpponentIds()
            .map(id => this.api.getPlayerStats(id))
            .filter(stats => stats && this.api.isPlayerActive(stats.id));
        
        if (enemyStats.length === 0) return null;
        
        const primaryTarget = enemyStats.reduce((strongest, current) => 
            current.totalTroops > strongest.totalTroops ? current : strongest
        );
        
        // Find the best planets to attack from
        const readyPlanets = myPlanets.filter(planet => {
            return planet.troops > 50 && 
                   !this.memory.attackPlanets.has(planet.id) &&
                   !this.memory.defensivePlanets.has(planet.id);
        }).sort((a, b) => b.troops - a.troops);
        
        if (readyPlanets.length === 0) return null;
        
        // Target the strongest opponent's most valuable planets
        const enemyPlanets = this.api.getEnemyPlanets()
            .filter(planet => planet.owner === primaryTarget.id);
            
        if (enemyPlanets.length === 0) return null;
        
        // Sort enemy planets by strategic value
        const sortedTargets = enemyPlanets.map(planet => {
            // Predict future state considering more time
            const futureState = this.api.predictPlanetState(planet, 5);
            
            // Prioritize high-production planets that can be taken
            if (futureState.troops > 999) return null;
            
            const value = planet.productionRate * planet.size / 
                         (this.api.getDistance(planet, this.api.getMapInfo().center) + 1);
            
            return { planet, futureState, value };
        }).filter(Boolean).sort((a, b) => b.value - a.value);
        
        // Make most powerful attacks first
        for (const targetInfo of sortedTargets) {
            const { planet, futureState } = targetInfo;
            
            // Find the best source based on distance and troops
            let bestSource = null;
            let bestTravelTime = Infinity;
            
            for (const source of readyPlanets) {
                const travelTime = this.api.getTravelTime(planet, source);
                
                // Prioritize closer planets with more troops
                if (travelTime < bestTravelTime) {
                    bestTravelTime = travelTime;
                    bestSource = source;
                }
            }
            
            if (!bestSource) continue;
            
            // Calculate required troops with buffering
            const requiredTroops = futureState.troops + 
                                  Math.max(20, Math.floor(planet.size * 3));
            
            // Send significant portion but leave reasonable defense
            const availableTroops = bestSource.troops * 0.8;
            const troopsToSend = Math.min(availableTroops, requiredTroops, 999);
            
            if (troopsToSend < 20) continue;
            
            // Mark as used for this turn
            this.memory.attackPlanets.add(bestSource.id);
            
            return {
                fromId: bestSource.id,
                toId: planet.id,
                troops: Math.floor(troopsToSend)
            };
        }
        
        return null;
    }

    /**
     * Make defensive decisions to protect key assets
     * @param {Array} myPlanets - Array of planets owned by the bot
     * @returns {object|null} Decision object or null
     */
    makeDefensiveDecision(myPlanets) {
        // Check for planets under threat
        for (const planet of myPlanets) {
            // Skip planets that are already marked for other actions
            if (this.memory.attackPlanets.has(planet.id) || 
                this.memory.defensivePlanets.has(planet.id)) {
                continue;
            }
            
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length === 0) continue;
            
            // Calculate total threat
            const totalThreat = incomingAttacks.reduce((sum, attack) => 
                sum + attack.amount, 0
            );
            
            // Only reinforce if threat is significant
            if (totalThreat < planet.troops * 0.5) continue;
            
            // Find the best planets to reinforce from
            const reinforcementCandidates = myPlanets.filter(source => {
                return !this.memory.attackPlanets.has(source.id) && 
                       !this.memory.defensivePlanets.has(source.id) &&
                       source.id !== planet.id;
            }).sort((a, b) => {
                // Prioritize planets with more troops and shorter distance
                const distA = this.api.getDistance(planet, a);
                const distB = this.api.getDistance(planet, b);
                return (b.troops / distB) - (a.troops / distA);
            });
            
            if (reinforcementCandidates.length === 0) continue;
            
            // Calculate reinforcement needed
            const neededReinforcements = Math.max(
                0,
                totalThreat - planet.troops + Math.floor(planet.size * 2)
            );
            
            if (neededReinforcements <= 0) continue;
            
            // Send troops from the best candidate
            const bestSource = reinforcementCandidates[0];
            const troopsToSend = Math.min(
                neededReinforcements,
                bestSource.troops * this.memory.resourceAllocation.defense,
                999
            );
            
            if (troopsToSend < 10) continue;
            
            // Mark defensive action
            this.memory.defensivePlanets.add(bestSource.id);
            
            return {
                fromId: bestSource.id,
                toId: planet.id,
                troops: Math.floor(troopsToSend)
            };
        }
        
        return null;
    }
}