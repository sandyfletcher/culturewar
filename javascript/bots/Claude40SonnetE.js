// =============================================
// root/javascript/bots/Claude40SonnetE.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * StrategicDominator - A champion AI bot that adapts tactics based on game phase and uses predictive analysis.
 * 
 * Core Strategy: Dynamic phase-based tactics with predictive conquest optimization.
 * - Early: Aggressive neutral expansion with efficiency focus
 * - Mid: Strategic enemy disruption and value-based targeting  
 * - Late: Calculated dominance plays and defensive consolidation
 * 
 * Key Features:
 * - Predictive planet state analysis for precise troop calculations
 * - Multi-factor planet valuation (production, position, threat level)
 * - Dynamic threat assessment and defensive prioritization
 * - Efficiency-optimized attacks with safety margins
 * - Mission tracking to prevent resource over-allocation
 */
export default class Claude40SonnetE extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        
        // Strategic memory initialization
        this.memory.actionCooldown = 0;
        this.memory.missions = new Map(); // Track ongoing missions to prevent over-commitment
        this.memory.lastStrengthCheck = 0;
        this.memory.dominanceMode = false;
        this.memory.threatThreshold = 0.3;
        
        // Strategic constants
        this.SAFETY_MARGIN = 1.15; // 15% extra troops for conquests
        this.EXPANSION_THRESHOLD = 10; // Minimum troops before expansion
        this.DEFENSE_RATIO = 0.4; // Proportion of troops to keep for defense
        this.THREAT_RESPONSE_MULTIPLIER = 1.5;
    }

    makeDecision(dt) {
        // Respect action cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }

        // Update strategic assessment
        this.updateStrategicSituation();
        
        // Clean up completed missions
        this.cleanupMissions();

        // Execute phase-based strategy
        const gamePhase = this.api.getGamePhase();
        let decision = null;

        switch (gamePhase) {
            case 'EARLY':
                decision = this.executeEarlyGameStrategy();
                break;
            case 'MID':
                decision = this.executeMidGameStrategy();
                break;
            case 'LATE':
                decision = this.executeLateGameStrategy();
                break;
        }

        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            // Track this mission
            this.memory.missions.set(`${decision.fromId}-${decision.toId}`, {
                startTime: this.api.getElapsedTime(),
                troops: decision.troops,
                targetId: decision.toId
            });
        }

        return decision;
    }

    updateStrategicSituation() {
        const currentTime = this.api.getElapsedTime();
        
        // Update dominance assessment every 2 seconds
        if (currentTime - this.memory.lastStrengthCheck > 2.0) {
            this.memory.lastStrengthCheck = currentTime;
            const strengthRatio = this.api.getMyStrengthRatio();
            this.memory.dominanceMode = strengthRatio > 1.3;
            
            // Adjust threat threshold based on our strength
            this.memory.threatThreshold = strengthRatio > 1.5 ? 0.2 : 0.4;
        }
    }

    cleanupMissions() {
        const currentTime = this.api.getElapsedTime();
        for (const [key, mission] of this.memory.missions) {
            // Remove missions older than 30 seconds (fleets should have arrived)
            if (currentTime - mission.startTime > 30) {
                this.memory.missions.delete(key);
            }
        }
    }

    executeEarlyGameStrategy() {
        // Early game: Focus on rapid neutral expansion
        const neutralTargets = this.api.getNeutralPlanets()
            .filter(p => !this.isMissionTarget(p.id))
            .sort((a, b) => this.calculateExpansionValue(b) - this.calculateExpansionValue(a));

        if (neutralTargets.length > 0) {
            const bestAttack = this.findBestAttack(neutralTargets);
            if (bestAttack) {
                return bestAttack;
            }
        }

        // If no good neutral targets, consider weak enemy planets
        return this.considerEnemyTargets(0.8); // Lower threshold in early game
    }

    executeMidGameStrategy() {
        // Mid game: Balance expansion with strategic enemy disruption
        
        // First priority: Defend against immediate threats
        const defensiveAction = this.handleDefensiveNeeds();
        if (defensiveAction) {
            return defensiveAction;
        }

        // Second priority: High-value enemy targets
        const enemyAction = this.considerEnemyTargets(1.0);
        if (enemyAction) {
            return enemyAction;
        }

        // Third priority: Remaining neutrals
        const neutralTargets = this.api.getNeutralPlanets()
            .filter(p => !this.isMissionTarget(p.id));
        
        if (neutralTargets.length > 0) {
            const bestAttack = this.findBestAttack(neutralTargets);
            if (bestAttack) {
                return bestAttack;
            }
        }

        return null;
    }

    executeLateGameStrategy() {
        // Late game: Calculated dominance or desperate survival
        
        // Critical defense first
        const defensiveAction = this.handleDefensiveNeeds();
        if (defensiveAction) {
            return defensiveAction;
        }

        if (this.memory.dominanceMode) {
            // We're strong - press the advantage
            return this.executeDominanceStrategy();
        } else {
            // We're weak - focus on survival and efficient trades
            return this.executeSurvivalStrategy();
        }
    }

    handleDefensiveNeeds() {
        const myPlanets = this.api.getMyPlanets();
        
        for (const planet of myPlanets) {
            const threatScore = this.api.calculateThreat(planet);
            
            if (threatScore > this.memory.threatThreshold) {
                // Find the best planet to send reinforcements from
                const reinforcer = this.findBestReinforcer(planet);
                if (reinforcer) {
                    const troopsNeeded = Math.ceil(threatScore * this.THREAT_RESPONSE_MULTIPLIER * 100);
                    const availableTroops = Math.floor(reinforcer.troops * (1 - this.DEFENSE_RATIO));
                    const troopsToSend = Math.min(troopsNeeded, availableTroops);
                    
                    if (troopsToSend > 5) {
                        return {
                            fromId: reinforcer.id,
                            toId: planet.id,
                            troops: troopsToSend
                        };
                    }
                }
            }
        }
        
        return null;
    }

    findBestReinforcer(targetPlanet) {
        const myPlanets = this.api.getMyPlanets()
            .filter(p => p.id !== targetPlanet.id && p.troops > 10)
            .sort((a, b) => {
                const distA = this.api.getDistance(a, targetPlanet);
                const distB = this.api.getDistance(b, targetPlanet);
                const scoreA = a.troops / (distA + 1);
                const scoreB = b.troops / (distB + 1);
                return scoreB - scoreA;
            });

        return myPlanets.length > 0 ? myPlanets[0] : null;
    }

    considerEnemyTargets(difficultyThreshold) {
        const enemyPlanets = this.api.getEnemyPlanets()
            .filter(p => !this.isMissionTarget(p.id));

        const viableTargets = [];
        
        for (const target of enemyPlanets) {
            const attackValue = this.calculateAttackValue(target);
            const difficulty = this.calculateAttackDifficulty(target);
            
            if (difficulty <= difficultyThreshold && attackValue > 0) {
                viableTargets.push({
                    planet: target,
                    value: attackValue,
                    difficulty: difficulty,
                    efficiency: attackValue / difficulty
                });
            }
        }

        if (viableTargets.length > 0) {
            // Sort by efficiency (value per difficulty)
            viableTargets.sort((a, b) => b.efficiency - a.efficiency);
            const bestTarget = viableTargets[0];
            
            const attack = this.planAttack(bestTarget.planet);
            if (attack) {
                return attack;
            }
        }

        return null;
    }

    executeDominanceStrategy() {
        // When dominant, focus on finishing off weakest opponents
        const opponentIds = this.api.getOpponentIds();
        let weakestOpponent = null;
        let minStrength = Infinity;

        for (const opponentId of opponentIds) {
            const stats = this.api.getPlayerStats(opponentId);
            if (stats.isActive && stats.totalTroops < minStrength) {
                minStrength = stats.totalTroops;
                weakestOpponent = opponentId;
            }
        }

        if (weakestOpponent) {
            const enemyPlanets = this.api.getEnemyPlanets()
                .filter(p => p.owner === weakestOpponent && !this.isMissionTarget(p.id));
            
            if (enemyPlanets.length > 0) {
                const target = enemyPlanets.sort((a, b) => a.troops - b.troops)[0];
                const attack = this.planAttack(target);
                if (attack) {
                    return attack;
                }
            }
        }

        return this.considerEnemyTargets(1.2); // More aggressive when dominant
    }

    executeSurvivalStrategy() {
        // When weak, focus on efficient trades and defensive positioning
        return this.considerEnemyTargets(0.6); // Only attack very weak targets
    }

    findBestAttack(targets) {
        let bestAttack = null;
        let bestValue = 0;

        for (const target of targets) {
            const attack = this.planAttack(target);
            if (attack) {
                const value = this.calculatePlanetTotalValue(target);
                const efficiency = value / attack.troops;
                
                if (efficiency > bestValue) {
                    bestValue = efficiency;
                    bestAttack = attack;
                }
            }
        }

        return bestAttack;
    }

    planAttack(target) {
        const myPlanets = this.api.getMyPlanets()
            .filter(p => p.troops > this.EXPANSION_THRESHOLD)
            .sort((a, b) => {
                const distA = this.api.getDistance(a, target);
                const distB = this.api.getDistance(b, target);
                return distA - distB;
            });

        for (const sourcePlanet of myPlanets) {
            const travelTime = this.api.getTravelTime(sourcePlanet, target);
            const futureState = this.api.predictPlanetState(target, travelTime);
            
            const requiredTroops = Math.ceil(futureState.troops * this.SAFETY_MARGIN);
            const availableTroops = Math.floor(sourcePlanet.troops * (1 - this.DEFENSE_RATIO));
            
            if (availableTroops >= requiredTroops && availableTroops >= 5) {
                return {
                    fromId: sourcePlanet.id,
                    toId: target.id,
                    troops: requiredTroops
                };
            }
        }

        return null;
    }

    calculateExpansionValue(planet) {
        const baseValue = this.api.calculatePlanetValue(planet);
        const centrality = this.api.getPlanetCentrality(planet);
        const production = this.api.getPlanetProductionRate(planet);
        
        // Favor planets that are central, productive, and not too heavily defended
        return baseValue * (1 + centrality) * (1 + production) / (planet.troops + 1);
    }

    calculateAttackValue(planet) {
        const baseValue = this.api.calculatePlanetValue(planet);
        const production = this.api.getPlanetProductionRate(planet);
        const strategicValue = this.calculateStrategicValue(planet);
        
        return baseValue + (production * 20) + strategicValue;
    }

    calculateAttackDifficulty(target) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return Infinity;

        const nearestMyPlanet = this.api.findNearestPlanet(target, myPlanets);
        const travelTime = this.api.getTravelTime(nearestMyPlanet, target);
        const futureState = this.api.predictPlanetState(target, travelTime);
        
        const requiredTroops = futureState.troops * this.SAFETY_MARGIN;
        const availableTroops = Math.floor(nearestMyPlanet.troops * (1 - this.DEFENSE_RATIO));
        
        return requiredTroops / (availableTroops + 1);
    }

    calculateStrategicValue(planet) {
        // Bonus for planets that would cut off enemy expansion or production
        let strategicBonus = 0;
        const enemyPlanets = this.api.getEnemyPlanets().filter(p => p.owner === planet.owner);
        
        // Value planets that are production hubs for enemies
        if (planet.productionRate > 2.0) {
            strategicBonus += 50;
        }
        
        // Value planets that are central to enemy territory
        const centrality = this.api.getPlanetCentrality(planet);
        strategicBonus += centrality * 30;
        
        return strategicBonus;
    }

    calculatePlanetTotalValue(planet) {
        return this.api.calculatePlanetValue(planet) + 
               (this.api.getPlanetProductionRate(planet) * 15) + 
               (this.api.getPlanetCentrality(planet) * 25);
    }

    isMissionTarget(planetId) {
        for (const mission of this.memory.missions.values()) {
            if (mission.targetId === planetId) {
                return true;
            }
        }
        return false;
    }
}