// =============================================
// root/javascript/bots/Claude40SonnetC.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * DominatorBot - A multi-phase adaptive strategy that prioritizes rapid expansion, intelligent targeting, and dynamic threat response.
 * 
 * Core Strategy Pillars:
 * 1. EARLY: Aggressive expansion to secure production advantage
 * 2. MID: Strategic elimination of weakest opponents while defending key positions  
 * 3. LATE: Calculated all-in attacks or defensive consolidation based on position
 * 4. Advanced threat assessment and resource allocation
 * 5. Predictive combat calculations for maximum efficiency
 */
export default class Claude40SonnetC extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        
        // Strategic memory initialization
        this.memory.actionCooldown = 0;
        this.memory.targetLocks = new Map(); // Track committed attacks
        this.memory.defensivePlanets = new Set(); // Mark planets as defensive
        this.memory.lastStrengthRatio = 0;
        this.memory.aggressionLevel = 1.0; // Dynamic aggression modifier
        this.memory.priorityTargets = new Set(); // High-value target tracking
    }

    /**
     * Main decision engine - called every game tick
     * @param {number} dt - Time delta scaled by game speed
     * @returns {object|null} Decision object or null
     */
    makeDecision(dt) {
        // Respect cooldown period
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // Game state analysis
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        const gamePhase = this.api.getGamePhase();
        const strengthRatio = this.api.getMyStrengthRatio();
        
        // Update strategic context
        this.updateStrategicContext(strengthRatio);

        // Phase-based decision making
        let decision = null;
        switch (gamePhase) {
            case 'EARLY':
                decision = this.executeEarlyGameStrategy(myPlanets);
                break;
            case 'MID':
                decision = this.executeMidGameStrategy(myPlanets, strengthRatio);
                break;
            case 'LATE':
                decision = this.executeLateGameStrategy(myPlanets, strengthRatio);
                break;
        }

        // Set cooldown if we made a decision
        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
        }

        return decision;
    }

    /**
     * Update strategic context and aggression levels
     */
    updateStrategicContext(strengthRatio) {
        // Adjust aggression based on relative strength
        if (strengthRatio > 1.2) {
            this.memory.aggressionLevel = 1.3; // Be more aggressive when ahead
        } else if (strengthRatio < 0.8) {
            this.memory.aggressionLevel = 0.7; // Be more conservative when behind
        } else {
            this.memory.aggressionLevel = 1.0; // Balanced approach
        }

        // Clean up old target locks
        this.cleanupTargetLocks();
        
        this.memory.lastStrengthRatio = strengthRatio;
    }

    /**
     * Early game strategy: Rapid expansion and neutral conquest
     */
    executeEarlyGameStrategy(myPlanets) {
        // Priority 1: Emergency defense
        const emergencyDefense = this.handleEmergencyDefense(myPlanets);
        if (emergencyDefense) return emergencyDefense;

        // Priority 2: Expand to neutrals
        const neutralExpansion = this.expandToNeutrals(myPlanets);
        if (neutralExpansion) return neutralExpansion;

        // Priority 3: Opportunistic attacks on weak enemies
        return this.opportunisticAttack(myPlanets, 0.6);
    }

    /**
     * Mid game strategy: Strategic elimination and position consolidation
     */
    executeMidGameStrategy(myPlanets, strengthRatio) {
        // Priority 1: Critical defense
        const emergencyDefense = this.handleEmergencyDefense(myPlanets);
        if (emergencyDefense) return emergencyDefense;

        // Priority 2: Target weakest opponent for elimination
        const elimination = this.targetWeakestOpponent(myPlanets);
        if (elimination) return elimination;

        // Priority 3: Expand to remaining neutrals
        const neutralExpansion = this.expandToNeutrals(myPlanets);
        if (neutralExpansion) return neutralExpansion;

        // Priority 4: Reinforce key positions
        return this.reinforceStrategicPositions(myPlanets);
    }

    /**
     * Late game strategy: All-in attacks or defensive consolidation
     */
    executeLateGameStrategy(myPlanets, strengthRatio) {
        // Priority 1: Emergency defense
        const emergencyDefense = this.handleEmergencyDefense(myPlanets);
        if (emergencyDefense) return emergencyDefense;

        if (strengthRatio > 1.1) {
            // We're ahead - aggressive finishing moves
            const finishingMove = this.executeFinishingMove(myPlanets);
            if (finishingMove) return finishingMove;
        } else if (strengthRatio < 0.9) {
            // We're behind - desperate counterattack
            const desperateAttack = this.executeDesperateCounterattack(myPlanets);
            if (desperateAttack) return desperateAttack;
        }

        // Default: Opportunistic attacks
        return this.opportunisticAttack(myPlanets, 0.8);
    }

    /**
     * Handle critical defensive situations
     */
    handleEmergencyDefense(myPlanets) {
        for (const planet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length === 0) continue;

            const totalIncomingTroops = incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
            const incomingReinforcements = this.api.getIncomingReinforcements(planet);
            const totalReinforcements = incomingReinforcements.reduce((sum, fleet) => sum + fleet.amount, 0);

            // Predict if we'll lose this planet
            const earliestAttack = Math.min(...incomingAttacks.map(attack => attack.duration));
            const futureTroops = this.api.predictPlanetState(planet, earliestAttack).troops + totalReinforcements;

            if (futureTroops < totalIncomingTroops * 1.1) {
                // We need reinforcements!
                const reinforcement = this.findBestReinforcement(planet, totalIncomingTroops - futureTroops + 10);
                if (reinforcement) return reinforcement;
            }
        }
        return null;
    }

    /**
     * Find the best planet to send reinforcements from
     */
    findBestReinforcement(targetPlanet, neededTroops) {
        const myPlanets = this.api.getMyPlanets();
        let bestSource = null;
        let bestScore = -1;

        for (const source of myPlanets) {
            if (source.id === targetPlanet.id) continue;
            if (source.troops < neededTroops + 5) continue; // Keep minimum garrison

            const distance = this.api.getDistance(source, targetPlanet);
            const travelTime = this.api.getTravelTime(source, targetPlanet);
            const score = (source.troops - neededTroops) / (distance + travelTime);

            if (score > bestScore) {
                bestScore = score;
                bestSource = source;
            }
        }

        if (bestSource) {
            return {
                fromId: bestSource.id,
                toId: targetPlanet.id,
                troops: Math.min(neededTroops, Math.floor(bestSource.troops * 0.8))
            };
        }

        return null;
    }

    /**
     * Expand to neutral planets with intelligent prioritization
     */
    expandToNeutrals(myPlanets) {
        const neutrals = this.api.getNeutralPlanets();
        if (neutrals.length === 0) return null;

        let bestMove = null;
        let bestScore = -1;

        for (const source of myPlanets) {
            if (source.troops < 15) continue; // Minimum attacking force

            for (const neutral of neutrals) {
                if (this.memory.targetLocks.has(neutral.id)) continue;

                const distance = this.api.getDistance(source, neutral);
                const travelTime = this.api.getTravelTime(source, neutral);
                const requiredTroops = neutral.troops + 3; // Small buffer

                if (source.troops < requiredTroops + 5) continue; // Keep garrison

                // Calculate value score
                const valueScore = this.calculatePlanetValue(neutral);
                const efficiency = valueScore / (distance + travelTime + requiredTroops);
                
                if (efficiency > bestScore) {
                    bestScore = efficiency;
                    bestMove = {
                        fromId: source.id,
                        toId: neutral.id,
                        troops: requiredTroops
                    };
                }
            }
        }

        if (bestMove) {
            this.memory.targetLocks.set(bestMove.toId, Date.now() + 5000); // Lock target for 5 seconds
        }

        return bestMove;
    }

    /**
     * Execute opportunistic attacks on enemy planets
     */
    opportunisticAttack(myPlanets, confidenceThreshold = 0.7) {
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;

        let bestMove = null;
        let bestScore = -1;

        for (const source of myPlanets) {
            const availableTroops = Math.floor(source.troops * this.memory.aggressionLevel * 0.75);
            if (availableTroops < 10) continue;

            for (const enemy of enemies) {
                if (this.memory.targetLocks.has(enemy.id)) continue;

                const travelTime = this.api.getTravelTime(source, enemy);
                const futureState = this.api.predictPlanetState(enemy, travelTime);
                const requiredTroops = Math.ceil(futureState.troops * 1.2); // 20% buffer

                if (availableTroops < requiredTroops) continue;

                const successProbability = Math.min(availableTroops / requiredTroops, 1.5);
                if (successProbability < confidenceThreshold) continue;

                const valueScore = this.calculatePlanetValue(enemy);
                const distance = this.api.getDistance(source, enemy);
                const efficiency = (valueScore * successProbability) / (distance + requiredTroops);

                if (efficiency > bestScore) {
                    bestScore = efficiency;
                    bestMove = {
                        fromId: source.id,
                        toId: enemy.id,
                        troops: requiredTroops
                    };
                }
            }
        }

        if (bestMove) {
            this.memory.targetLocks.set(bestMove.toId, Date.now() + 10000); // Lock target for 10 seconds
        }

        return bestMove;
    }

    /**
     * Target the weakest opponent for elimination
     */
    targetWeakestOpponent(myPlanets) {
        const opponents = this.api.getOpponentIds();
        let weakestOpponent = null;
        let weakestStrength = Infinity;

        // Find weakest opponent
        for (const opponentId of opponents) {
            const stats = this.api.getPlayerStats(opponentId);
            if (!stats.isActive) continue;

            const strength = stats.totalTroops + stats.totalProduction * 20; // Weight production
            if (strength < weakestStrength) {
                weakestStrength = strength;
                weakestOpponent = opponentId;
            }
        }

        if (!weakestOpponent) return null;

        // Find their planets and attack the most valuable one
        const enemyPlanets = this.api.getEnemyPlanets().filter(p => p.owner === weakestOpponent);
        if (enemyPlanets.length === 0) return null;

        // Sort by value and target the best one we can take
        enemyPlanets.sort((a, b) => this.calculatePlanetValue(b) - this.calculatePlanetValue(a));

        for (const target of enemyPlanets) {
            const attack = this.calculateBestAttack(myPlanets, target, 1.3); // Higher confidence for elimination
            if (attack) {
                this.memory.targetLocks.set(target.id, Date.now() + 15000); // Lock for 15 seconds
                return attack;
            }
        }

        return null;
    }

    /**
     * Execute finishing moves when ahead
     */
    executeFinishingMove(myPlanets) {
        // Focus on eliminating remaining opponents quickly
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;

        // Sort enemies by elimination priority (weakest first)
        enemies.sort((a, b) => {
            const aStats = this.api.getPlayerStats(a.owner);
            const bStats = this.api.getPlayerStats(b.owner);
            return aStats.totalTroops - bStats.totalTroops;
        });

        for (const target of enemies) {
            const attack = this.calculateBestAttack(myPlanets, target, 1.5); // High confidence
            if (attack) {
                this.memory.targetLocks.set(target.id, Date.now() + 10000);
                return attack;
            }
        }

        return null;
    }

    /**
     * Execute desperate counterattack when behind
     */
    executeDesperateCounterattack(myPlanets) {
        // All-in on the strongest enemy planet we can take
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;

        enemies.sort((a, b) => this.calculatePlanetValue(b) - this.calculatePlanetValue(a));

        for (const target of enemies) {
            const attack = this.calculateBestAttack(myPlanets, target, 0.9); // Lower confidence - desperate
            if (attack) {
                this.memory.targetLocks.set(target.id, Date.now() + 5000);
                return attack;
            }
        }

        return null;
    }

    /**
     * Calculate the best possible attack on a target
     */
    calculateBestAttack(myPlanets, target, confidenceThreshold) {
        let bestAttack = null;
        let bestEfficiency = -1;

        for (const source of myPlanets) {
            const availableTroops = Math.floor(source.troops * 0.8);
            if (availableTroops < 5) continue;

            const travelTime = this.api.getTravelTime(source, target);
            const futureState = this.api.predictPlanetState(target, travelTime);
            const requiredTroops = Math.ceil(futureState.troops * 1.1);

            if (availableTroops < requiredTroops) continue;

            const successProbability = Math.min(availableTroops / requiredTroops, 2.0);
            if (successProbability < confidenceThreshold) continue;

            const distance = this.api.getDistance(source, target);
            const efficiency = successProbability / (distance + travelTime);

            if (efficiency > bestEfficiency) {
                bestEfficiency = efficiency;
                bestAttack = {
                    fromId: source.id,
                    toId: target.id,
                    troops: requiredTroops
                };
            }
        }

        return bestAttack;
    }

    /**
     * Reinforce strategic positions
     */
    reinforceStrategicPositions(myPlanets) {
        // Find planets that need reinforcement
        const centralPlanets = myPlanets.filter(p => this.api.getPlanetCentrality(p) > 0.6);
        
        for (const planet of centralPlanets) {
            if (planet.troops > 100) continue; // Already well defended

            const nearbyEnemies = this.api.getEnemyPlanets().filter(e => 
                this.api.getDistance(planet, e) < 100
            );

            if (nearbyEnemies.length > 0) {
                const reinforcement = this.findBestReinforcement(planet, 50);
                if (reinforcement) return reinforcement;
            }
        }

        return null;
    }

    /**
     * Enhanced planet value calculation
     */
    calculatePlanetValue(planet) {
        const baseValue = this.api.calculatePlanetValue(planet);
        const centrality = this.api.getPlanetCentrality(planet);
        const production = this.api.getPlanetProductionRate(planet);
        
        // Weight production higher in early game
        const gamePhase = this.api.getGamePhase();
        const productionMultiplier = gamePhase === 'EARLY' ? 2.0 : 1.5;
        
        return baseValue + (centrality * 20) + (production * productionMultiplier);
    }

    /**
     * Clean up expired target locks
     */
    cleanupTargetLocks() {
        const now = Date.now();
        for (const [targetId, expiry] of this.memory.targetLocks.entries()) {
            if (now > expiry) {
                this.memory.targetLocks.delete(targetId);
            }
        }
    }
}