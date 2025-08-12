// =============================================
// root/javascript/bots/Claude40SonnetB.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * DominatorBot - A multi-phase strategic AI that adapts its tactics based on game state and opponent analysis.
 * 
 * Core Strategy: Dynamic phase-based approach combining aggressive expansion, strategic positioning, 
 * and precise resource allocation. Uses predictive analysis to maximize efficiency and minimize waste.
 * Key features: Multi-target evaluation, threat assessment, defensive coordination, and endgame optimization.
 */
export default class Claude40SonnetB extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        
        // Strategic memory initialization
        this.memory = {
            actionCooldown: 0,
            missions: new Map(), // Track active missions: planetId -> {type, target, priority}
            threatLevel: 0,      // Overall threat assessment
            lastPhase: 'EARLY',  // Track phase transitions
            targetPriorities: new Map(), // Target evaluation cache
            defensiveMode: false,
            emergencyDefense: false,
            lastStrengthRatio: 1.0,
            consecutiveDefensiveDecisions: 0
        };
    }

    makeDecision(dt) {
        // Respect action cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // Game over
        }

        // Update strategic state
        this.updateStrategicState();
        
        // Get current game phase and adapt strategy
        const phase = this.api.getGamePhase();
        const decision = this.executePhaseStrategy(phase);
        
        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return decision;
        }

        return null;
    }

    updateStrategicState() {
        const currentStrength = this.api.getMyStrengthRatio();
        const phase = this.api.getGamePhase();
        
        // Update threat assessment
        this.memory.threatLevel = this.calculateOverallThreat();
        
        // Detect strength changes
        const strengthDelta = currentStrength - this.memory.lastStrengthRatio;
        this.memory.lastStrengthRatio = currentStrength;
        
        // Adaptive mode switching
        this.memory.defensiveMode = currentStrength < 0.7 || this.memory.threatLevel > 0.8;
        this.memory.emergencyDefense = currentStrength < 0.4 || this.memory.threatLevel > 1.2;
        
        // Clear completed missions
        this.cleanupMissions();
        
        // Phase transition handling
        if (phase !== this.memory.lastPhase) {
            this.onPhaseTransition(this.memory.lastPhase, phase);
            this.memory.lastPhase = phase;
        }
    }

    calculateOverallThreat() {
        const myPlanets = this.api.getMyPlanets();
        let totalThreat = 0;
        let maxThreat = 0;

        for (const planet of myPlanets) {
            const threat = this.api.calculateThreat(planet);
            totalThreat += threat;
            maxThreat = Math.max(maxThreat, threat);
        }

        // Normalize threat (0 = safe, 1 = high threat, >1 = critical)
        const avgThreat = myPlanets.length > 0 ? totalThreat / myPlanets.length : 0;
        return Math.max(avgThreat, maxThreat * 0.5);
    }

    executePhaseStrategy(phase) {
        if (this.memory.emergencyDefense) {
            return this.executeEmergencyDefense();
        }

        switch (phase) {
            case 'EARLY':
                return this.executeEarlyGameStrategy();
            case 'MID':
                return this.executeMidGameStrategy();
            case 'LATE':
                return this.executeEndGameStrategy();
            default:
                return this.executeMidGameStrategy();
        }
    }

    executeEarlyGameStrategy() {
        // Priority: Rapid expansion with calculated risks
        
        // First, handle immediate threats
        const defensiveAction = this.handleImmediateThreats();
        if (defensiveAction) return defensiveAction;
        
        // Find best expansion opportunities
        const expansionAction = this.findBestExpansion();
        if (expansionAction) return expansionAction;
        
        // Secondary: Opportunistic attacks
        return this.findOpportunisticAttack();
    }

    executeMidGameStrategy() {
        // Priority: Strategic positioning and calculated aggression
        
        if (this.memory.defensiveMode) {
            const defensiveAction = this.executeDefensiveStrategy();
            if (defensiveAction) return defensiveAction;
        }
        
        // Strategic attacks on key targets
        const strategicAction = this.findStrategicAttack();
        if (strategicAction) return strategicAction;
        
        // Expansion if safe
        const expansionAction = this.findBestExpansion();
        if (expansionAction) return expansionAction;
        
        // Reinforcement of key positions
        return this.reinforceKeyPositions();
    }

    executeEndGameStrategy() {
        // Priority: Decisive actions and position consolidation
        
        const timeRemaining = this.api.getGameDuration() - this.api.getElapsedTime();
        
        if (timeRemaining < 60) {
            // Final minute: Secure victory or prevent loss
            return this.executeFinalMinuteStrategy();
        }
        
        // Standard endgame: Decisive attacks or defensive consolidation
        if (this.api.getMyStrengthRatio() > 1.2) {
            return this.executeDecisiveAttack();
        } else {
            return this.executeDefensiveConsolidation();
        }
    }

    handleImmediateThreats() {
        const myPlanets = this.api.getMyPlanets();
        let highestThreat = null;
        let maxThreatLevel = 0;

        for (const planet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length === 0) continue;

            const totalIncoming = incomingAttacks.reduce((sum, fleet) => sum + fleet.amount, 0);
            const reinforcements = this.api.getIncomingReinforcements(planet)
                .reduce((sum, fleet) => sum + fleet.amount, 0);
            
            const effectiveThreat = totalIncoming - planet.troops - reinforcements;
            
            if (effectiveThreat > maxThreatLevel && effectiveThreat > 0) {
                maxThreatLevel = effectiveThreat;
                highestThreat = {
                    planet,
                    needed: Math.ceil(effectiveThreat * 1.2), // 20% safety margin
                    incomingAttacks
                };
            }
        }

        if (highestThreat) {
            return this.sendReinforcements(highestThreat.planet, highestThreat.needed);
        }

        return null;
    }

    findBestExpansion() {
        const myPlanets = this.api.getMyPlanets();
        const neutrals = this.api.getNeutralPlanets();
        
        if (neutrals.length === 0) return null;

        let bestTarget = null;
        let bestScore = -1;

        for (const neutral of neutrals) {
            // Skip if already targeted
            if (this.memory.missions.has(neutral.id)) continue;

            const score = this.evaluateExpansionTarget(neutral, myPlanets);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = neutral;
            }
        }

        if (bestTarget && bestScore > 0.3) {
            const source = this.findBestSourceForAttack(bestTarget, myPlanets);
            if (source) {
                const troopsNeeded = Math.ceil(bestTarget.troops * 1.1) + 5; // Small buffer
                if (source.troops > troopsNeeded + 10) { // Keep reserve
                    this.memory.missions.set(bestTarget.id, {
                        type: 'expansion',
                        target: bestTarget.id,
                        priority: bestScore
                    });
                    
                    return {
                        fromId: source.id,
                        toId: bestTarget.id,
                        troops: troopsNeeded
                    };
                }
            }
        }

        return null;
    }

    evaluateExpansionTarget(neutral, myPlanets) {
        let score = 0;

        // Base value from planet characteristics
        score += this.api.calculatePlanetValue(neutral) * 2;
        
        // Proximity bonus (closer is better for expansion)
        const nearestMy = this.api.findNearestPlanet(neutral, myPlanets);
        if (nearestMy) {
            const distance = this.api.getDistance(neutral, nearestMy);
            const maxDistance = Math.sqrt(Math.pow(this.api.getMapInfo().width, 2) + 
                                        Math.pow(this.api.getMapInfo().height, 2));
            score += (1 - distance / maxDistance) * 0.5;
        }

        // Safety factor (avoid contested areas)
        const nearestEnemy = this.api.getNearestEnemyPlanet(neutral);
        if (nearestEnemy) {
            const enemyDistance = this.api.getDistance(neutral, nearestEnemy);
            const myDistance = nearestMy ? this.api.getDistance(neutral, nearestMy) : Infinity;
            
            if (enemyDistance < myDistance) {
                score *= 0.5; // Reduce score for contested territories
            }
        }

        // Cost factor (easier captures are better)
        const defenseCost = neutral.troops + 5;
        score *= Math.max(0.1, 1 - defenseCost / 100);

        return score;
    }

    findStrategicAttack() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        let bestTarget = null;
        let bestScore = -1;

        for (const enemy of enemyPlanets) {
            if (this.memory.missions.has(enemy.id)) continue;

            const score = this.evaluateAttackTarget(enemy, myPlanets);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        }

        if (bestTarget && bestScore > 0.4) {
            const attack = this.planAttack(bestTarget, myPlanets);
            if (attack) {
                this.memory.missions.set(bestTarget.id, {
                    type: 'strategic_attack',
                    target: bestTarget.id,
                    priority: bestScore
                });
                return attack;
            }
        }

        return null;
    }

    evaluateAttackTarget(enemy, myPlanets) {
        let score = 0;

        // Strategic value
        score += this.api.calculatePlanetValue(enemy) * 1.5;
        
        // Production denial (higher production = higher priority)
        score += enemy.productionRate * 0.3;
        
        // Accessibility (can we actually attack it?)
        const source = this.findBestSourceForAttack(enemy, myPlanets);
        if (!source) return 0;

        const distance = this.api.getDistance(enemy, source);
        const travelTime = this.api.getTravelTime(enemy, source);
        
        // Predict enemy strength at arrival
        const futureState = this.api.predictPlanetState(enemy, travelTime);
        const troopsNeeded = futureState.troops + 10;
        const availableTroops = source.troops - 15; // Keep reserve

        if (availableTroops < troopsNeeded) return 0;

        // Efficiency score (lower cost = higher score)
        const efficiency = Math.max(0, 1 - troopsNeeded / availableTroops);
        score *= efficiency;

        // Disruption bonus (attack planets that threaten us)
        const threat = this.calculateEnemyThreat(enemy, myPlanets);
        score += threat * 0.4;

        // Network effect (isolated planets are easier targets)
        const enemySupport = this.calculateEnemySupport(enemy);
        score *= Math.max(0.3, 1 - enemySupport);

        return score;
    }

    calculateEnemyThreat(enemyPlanet, myPlanets) {
        let threat = 0;
        const threatRange = 200; // Adjust based on map size

        for (const myPlanet of myPlanets) {
            const distance = this.api.getDistance(enemyPlanet, myPlanet);
            if (distance < threatRange) {
                const proximityFactor = 1 - (distance / threatRange);
                threat += enemyPlanet.troops * enemyPlanet.productionRate * proximityFactor;
            }
        }

        return Math.min(1, threat / 100); // Normalize
    }

    calculateEnemySupport(enemyPlanet) {
        const enemyPlanets = this.api.getEnemyPlanets().filter(p => p.owner === enemyPlanet.owner);
        let support = 0;
        const supportRange = 150;

        for (const ally of enemyPlanets) {
            if (ally.id === enemyPlanet.id) continue;
            
            const distance = this.api.getDistance(enemyPlanet, ally);
            if (distance < supportRange) {
                const proximityFactor = 1 - (distance / supportRange);
                support += ally.troops * proximityFactor * 0.1;
            }
        }

        return Math.min(1, support / 50); // Normalize
    }

    planAttack(target, myPlanets) {
        const source = this.findBestSourceForAttack(target, myPlanets);
        if (!source) return null;

        const travelTime = this.api.getTravelTime(source, target);
        const futureState = this.api.predictPlanetState(target, travelTime);
        
        // Calculate troops needed with safety margin
        const baseNeeded = futureState.troops + 5;
        const safetyMargin = Math.ceil(baseNeeded * 0.15);
        const troopsToSend = baseNeeded + safetyMargin;

        // Ensure we have enough troops and keep a reserve
        const minReserve = Math.max(10, source.productionRate * 20);
        if (source.troops > troopsToSend + minReserve) {
            return {
                fromId: source.id,
                toId: target.id,
                troops: troopsToSend
            };
        }

        return null;
    }

    findBestSourceForAttack(target, myPlanets) {
        let bestSource = null;
        let bestScore = -1;

        for (const planet of myPlanets) {
            if (planet.troops < 20) continue; // Need minimum troops

            const distance = this.api.getDistance(planet, target);
            const travelTime = this.api.getTravelTime(planet, target);
            
            // Score based on available troops and distance
            const availableTroops = planet.troops - 10; // Reserve
            const distanceScore = 1 / (1 + distance * 0.01);
            const troopScore = Math.min(1, availableTroops / 100);
            const score = distanceScore * troopScore;

            if (score > bestScore) {
                bestScore = score;
                bestSource = planet;
            }
        }

        return bestSource;
    }

    sendReinforcements(targetPlanet, troopsNeeded) {
        const myPlanets = this.api.getMyPlanets().filter(p => p.id !== targetPlanet.id);
        
        // Sort by proximity and available troops
        myPlanets.sort((a, b) => {
            const distA = this.api.getDistance(a, targetPlanet);
            const distB = this.api.getDistance(b, targetPlanet);
            const scoreA = (a.troops - 10) / (1 + distA * 0.01);
            const scoreB = (b.troops - 10) / (1 + distB * 0.01);
            return scoreB - scoreA;
        });

        for (const source of myPlanets) {
            const availableTroops = source.troops - 15; // Keep larger reserve for defense
            if (availableTroops <= 0) continue;

            const troopsToSend = Math.min(availableTroops, troopsNeeded);
            if (troopsToSend >= 5) { // Minimum viable reinforcement
                return {
                    fromId: source.id,
                    toId: targetPlanet.id,
                    troops: troopsToSend
                };
            }
        }

        return null;
    }

    executeEmergencyDefense() {
        // In emergency, consolidate forces to most defensible positions
        const myPlanets = this.api.getMyPlanets();
        
        // Find the most valuable/defensible planet
        let bestFortress = null;
        let bestScore = -1;

        for (const planet of myPlanets) {
            const value = this.api.calculatePlanetValue(planet);
            const centrality = this.api.getPlanetCentrality(planet);
            const production = planet.productionRate;
            
            const score = value + centrality * 0.5 + production * 2;
            if (score > bestScore) {
                bestScore = score;
                bestFortress = planet;
            }
        }

        if (bestFortress) {
            // Send reinforcements from least valuable planets
            const otherPlanets = myPlanets.filter(p => p.id !== bestFortress.id);
            otherPlanets.sort((a, b) => {
                const valueA = this.api.calculatePlanetValue(a);
                const valueB = this.api.calculatePlanetValue(b);
                return valueA - valueB; // Ascending (least valuable first)
            });

            for (const source of otherPlanets) {
                if (source.troops > 20) {
                    const troopsToSend = Math.floor(source.troops * 0.8);
                    return {
                        fromId: source.id,
                        toId: bestFortress.id,
                        troops: troopsToSend
                    };
                }
            }
        }

        return null;
    }

    executeFinalMinuteStrategy() {
        const myStats = this.api.getPlayerStats(this.playerId);
        const opponents = this.api.getOpponentIds().map(id => this.api.getPlayerStats(id));
        const strongestOpponent = opponents.reduce((prev, curr) => 
            curr.planetCount > prev.planetCount ? curr : prev, opponents[0]);

        if (myStats.planetCount > strongestOpponent.planetCount) {
            // We're winning, play defensively
            return this.executeDefensiveConsolidation();
        } else if (myStats.planetCount < strongestOpponent.planetCount) {
            // We're losing, desperate attack
            return this.executeDesperateAttack();
        } else {
            // Tied, attack for the lead
            return this.executeDecisiveAttack();
        }
    }

    executeDesperateAttack() {
        // All-in attack with all available forces
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        if (enemyPlanets.length === 0) return null;

        // Target the weakest enemy planet we can reach
        let bestTarget = null;
        let lowestCost = Infinity;

        for (const enemy of enemyPlanets) {
            const source = this.findBestSourceForAttack(enemy, myPlanets);
            if (source) {
                const travelTime = this.api.getTravelTime(source, enemy);
                const futureState = this.api.predictPlanetState(enemy, travelTime);
                const cost = futureState.troops;
                
                if (cost < lowestCost) {
                    lowestCost = cost;
                    bestTarget = { enemy, source, cost };
                }
            }
        }

        if (bestTarget && bestTarget.source.troops > bestTarget.cost + 5) {
            return {
                fromId: bestTarget.source.id,
                toId: bestTarget.enemy.id,
                troops: Math.floor(bestTarget.source.troops * 0.9)
            };
        }

        return null;
    }

    executeDecisiveAttack() {
        // Coordinated assault on the strongest opponent
        const strongestOpponent = this.findStrongestOpponent();
        if (!strongestOpponent) return this.findStrategicAttack();

        const targetPlanets = this.api.getEnemyPlanets()
            .filter(p => p.owner === strongestOpponent.id);
        
        return this.findStrategicAttack(); // Use existing strategic attack logic
    }

    executeDefensiveConsolidation() {
        // Strengthen our most valuable planets
        return this.reinforceKeyPositions();
    }

    findStrongestOpponent() {
        const opponents = this.api.getOpponentIds().map(id => this.api.getPlayerStats(id));
        return opponents.reduce((prev, curr) => {
            const prevStrength = prev.totalTroops + prev.totalProduction * 50;
            const currStrength = curr.totalTroops + curr.totalProduction * 50;
            return currStrength > prevStrength ? curr : prev;
        }, opponents[0]);
    }

    reinforceKeyPositions() {
        const myPlanets = this.api.getMyPlanets();
        
        // Find planets that need reinforcement (high value, low troops)
        let bestTarget = null;
        let bestPriority = -1;

        for (const planet of myPlanets) {
            if (planet.troops > 50) continue; // Already well-defended
            
            const value = this.api.calculatePlanetValue(planet);
            const threat = this.api.calculateThreat(planet);
            const priority = value + threat * 2;

            if (priority > bestPriority) {
                bestPriority = priority;
                bestTarget = planet;
            }
        }

        if (bestTarget) {
            return this.sendReinforcements(bestTarget, 30);
        }

        return null;
    }

    findOpportunisticAttack() {
        // Look for weak enemy planets we can easily capture
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        let bestOpportunity = null;
        let bestRatio = 0;

        for (const enemy of enemyPlanets) {
            const source = this.findBestSourceForAttack(enemy, myPlanets);
            if (!source) continue;

            const travelTime = this.api.getTravelTime(source, enemy);
            const futureState = this.api.predictPlanetState(enemy, travelTime);
            const needed = futureState.troops + 10;
            const available = source.troops - 20; // Keep reserve

            if (available > needed) {
                const efficiency = available / needed;
                const value = this.api.calculatePlanetValue(enemy);
                const score = efficiency * value;

                if (score > bestRatio) {
                    bestRatio = score;
                    bestOpportunity = { enemy, source, needed };
                }
            }
        }

        if (bestOpportunity && bestRatio > 2) { // Only take very favorable opportunities
            return {
                fromId: bestOpportunity.source.id,
                toId: bestOpportunity.enemy.id,
                troops: bestOpportunity.needed
            };
        }

        return null;
    }

    executeDefensiveStrategy() {
        // Prioritize threats and reinforce accordingly
        this.memory.consecutiveDefensiveDecisions++;
        
        const defensiveAction = this.handleImmediateThreats();
        if (defensiveAction) return defensiveAction;

        // If we've been defensive too long, try a calculated counter-attack
        if (this.memory.consecutiveDefensiveDecisions > 5) {
            this.memory.consecutiveDefensiveDecisions = 0;
            return this.findOpportunisticAttack();
        }

        return this.reinforceKeyPositions();
    }

    cleanupMissions() {
        // Remove completed or invalid missions
        for (const [planetId, mission] of this.memory.missions.entries()) {
            const planet = this.api.getPlanetById(planetId);
            if (!planet || planet.owner === this.playerId || 
                this.api.getElapsedTime() > mission.startTime + 30) {
                this.memory.missions.delete(planetId);
            }
        }
    }

    onPhaseTransition(oldPhase, newPhase) {
        // Clear mission cache when phases change
        this.memory.missions.clear();
        this.memory.targetPriorities.clear();
        
        // Reset defensive counter
        this.memory.consecutiveDefensiveDecisions = 0;
        
        // Adjust strategy parameters based on new phase
        if (newPhase === 'LATE') {
            // More aggressive in late game
            this.memory.defensiveMode = false;
        }
    }
}