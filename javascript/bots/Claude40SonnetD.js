// =============================================
// root/javascript/bots/Claude40SonnetD.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * DominatorBot: A multi-phase adaptive strategy bot designed to dominate through superior tactical analysis.
 * 
 * Core Strategy:
 * - EARLY: Aggressive expansion with intelligent target prioritization
 * - MID: Strategic consolidation and enemy disruption through coordinated strikes
 * - LATE: All-out assault or defensive positioning based on strength analysis
 * 
 * Key Features:
 * - Dynamic threat assessment and response
 * - Precise troop calculations to minimize waste
 * - Multi-target coordination to prevent enemy recovery
 * - Adaptive strategy based on game phase and relative strength
 */
export default class Claude40SonnetD extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        
        // Strategic memory initialization
        this.memory.actionCooldown = 0;
        this.memory.targetAssignments = new Map(); // planetId -> {target, troops, priority}
        this.memory.lastStrengthCheck = 0;
        this.memory.dominationMode = false; // Activated when significantly stronger
        this.memory.defensiveMode = false; // Activated when under heavy threat
        this.memory.priorityTargets = new Set(); // High-value enemy planets
        this.memory.lastPhase = 'EARLY';
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

        // Phase-based decision making
        const gamePhase = this.api.getGamePhase();
        let decision = null;

        switch (gamePhase) {
            case 'EARLY':
                decision = this.makeEarlyGameDecision();
                break;
            case 'MID':
                decision = this.makeMidGameDecision();
                break;
            case 'LATE':
                decision = this.makeLateGameDecision();
                break;
        }

        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
        }

        return decision;
    }

    updateStrategicState() {
        const myStrength = this.api.getMyStrengthRatio();
        const gamePhase = this.api.getGamePhase();
        
        // Update operational modes
        this.memory.dominationMode = myStrength > 1.5;
        this.memory.defensiveMode = myStrength < 0.7;
        
        // Clear outdated target assignments if phase changed
        if (this.memory.lastPhase !== gamePhase) {
            this.memory.targetAssignments.clear();
            this.memory.lastPhase = gamePhase;
        }

        // Update priority targets (large enemy planets or production centers)
        this.updatePriorityTargets();
    }

    updatePriorityTargets() {
        this.memory.priorityTargets.clear();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        // Identify high-value targets
        enemyPlanets.forEach(planet => {
            const value = this.calculatePlanetValue(planet);
            const threat = this.calculateOffensiveThreat(planet);
            
            if (value > 50 || threat > 0.3) {
                this.memory.priorityTargets.add(planet.id);
            }
        });
    }

    makeEarlyGameDecision() {
        // Early game: Rapid expansion with smart targeting
        const bestExpansion = this.findBestExpansionTarget();
        if (bestExpansion) {
            return bestExpansion;
        }

        // If no good expansion, consider early pressure on weak enemies
        const earlyStrike = this.findEarlyStrikeOpportunity();
        return earlyStrike;
    }

    makeMidGameDecision() {
        // Mid game: Balance between defense and strategic attacks
        
        // Priority 1: Handle critical threats
        const defensiveAction = this.handleCriticalThreats();
        if (defensiveAction) {
            return defensiveAction;
        }

        // Priority 2: Execute coordinated strikes on priority targets
        const coordinatedStrike = this.executeCoordinatedStrike();
        if (coordinatedStrike) {
            return coordinatedStrike;
        }

        // Priority 3: Continue strategic expansion
        const strategicExpansion = this.findStrategicExpansion();
        return strategicExpansion;
    }

    makeLateGameDecision() {
        // Late game: All-out aggression or defensive consolidation
        
        if (this.memory.dominationMode) {
            // We're strong - press the advantage
            return this.executeFinishingMove();
        } else if (this.memory.defensiveMode) {
            // We're weak - consolidate and defend
            return this.executeDefensiveConsolidation();
        } else {
            // Balanced - look for decisive opportunities
            return this.findDecisiveOpportunity();
        }
    }

    findBestExpansionTarget() {
        const myPlanets = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        
        if (neutralPlanets.length === 0) return null;

        let bestOption = null;
        let bestScore = -1;

        for (const source of myPlanets) {
            if (source.troops < 15) continue; // Need minimum troops to expand
            
            for (const target of neutralPlanets) {
                const distance = this.api.getDistance(source, target);
                if (distance > 200) continue; // Too far for early expansion
                
                const requiredTroops = target.troops + 5; // Safety buffer
                if (source.troops <= requiredTroops) continue;
                
                // Calculate expansion value
                const value = this.calculatePlanetValue(target);
                const efficiency = value / (distance + requiredTroops);
                
                if (efficiency > bestScore) {
                    bestScore = efficiency;
                    bestOption = {
                        fromId: source.id,
                        toId: target.id,
                        troops: Math.min(requiredTroops + 2, Math.floor(source.troops * 0.8))
                    };
                }
            }
        }

        return bestOption;
    }

    findEarlyStrikeOpportunity() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        for (const source of myPlanets) {
            if (source.troops < 25) continue;
            
            for (const target of enemyPlanets) {
                const travelTime = this.api.getTravelTime(source, target);
                const predictedState = this.api.predictPlanetState(target, travelTime);
                
                // Look for vulnerable targets
                if (predictedState.troops < 20 && source.troops > predictedState.troops + 15) {
                    const troopsNeeded = Math.ceil(predictedState.troops + 8);
                    
                    return {
                        fromId: source.id,
                        toId: target.id,
                        troops: Math.min(troopsNeeded, Math.floor(source.troops * 0.7))
                    };
                }
            }
        }
        
        return null;
    }

    handleCriticalThreats() {
        const myPlanets = this.api.getMyPlanets();
        
        for (const planet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length === 0) continue;
            
            const totalThreat = incomingAttacks.reduce((sum, fleet) => sum + fleet.amount, 0);
            const incomingReinforcements = this.api.getIncomingReinforcements(planet);
            const totalReinforcements = incomingReinforcements.reduce((sum, fleet) => sum + fleet.amount, 0);
            
            // Calculate if we need emergency reinforcement
            const expectedDefense = planet.troops + totalReinforcements;
            const shortfall = totalThreat - expectedDefense + 10; // Safety buffer
            
            if (shortfall > 0) {
                // Find nearest planet that can help
                const reinforcement = this.findEmergencyReinforcement(planet, shortfall);
                if (reinforcement) {
                    return reinforcement;
                }
            }
        }
        
        return null;
    }

    findEmergencyReinforcement(threatenedPlanet, neededTroops) {
        const myPlanets = this.api.getMyPlanets();
        
        let bestOption = null;
        let shortestTime = Infinity;
        
        for (const source of myPlanets) {
            if (source.id === threatenedPlanet.id) continue;
            if (source.troops < neededTroops + 5) continue; // Must have enough + buffer
            
            const travelTime = this.api.getTravelTime(source, threatenedPlanet);
            if (travelTime < shortestTime) {
                shortestTime = travelTime;
                bestOption = {
                    fromId: source.id,
                    toId: threatenedPlanet.id,
                    troops: Math.min(neededTroops + 5, Math.floor(source.troops * 0.8))
                };
            }
        }
        
        return bestOption;
    }

    executeCoordinatedStrike() {
        // Look for opportunities to overwhelm priority targets
        const priorityTargets = Array.from(this.memory.priorityTargets)
            .map(id => this.api.getPlanetById(id))
            .filter(planet => planet && planet.owner !== this.playerId);
        
        for (const target of priorityTargets) {
            const strike = this.calculateOverwhelmingStrike(target);
            if (strike) {
                return strike;
            }
        }
        
        return null;
    }

    calculateOverwhelmingStrike(target) {
        const myPlanets = this.api.getMyPlanets();
        const contributors = [];
        
        // Find planets that can contribute to the strike
        for (const source of myPlanets) {
            if (source.troops < 20) continue;
            
            const travelTime = this.api.getTravelTime(source, target);
            if (travelTime > 8) continue; // Too slow for coordination
            
            const predictedTarget = this.api.predictPlanetState(target, travelTime);
            contributors.push({
                planet: source,
                travelTime: travelTime,
                availableTroops: Math.floor(source.troops * 0.6),
                targetState: predictedTarget
            });
        }
        
        if (contributors.length === 0) return null;
        
        // Sort by travel time to coordinate arrival
        contributors.sort((a, b) => a.travelTime - b.travelTime);
        
        // Use the fastest contributor as primary striker
        const primary = contributors[0];
        const requiredTroops = primary.targetState.troops + 15; // Overwhelming force
        
        if (primary.availableTroops >= requiredTroops) {
            return {
                fromId: primary.planet.id,
                toId: target.id,
                troops: Math.min(requiredTroops + 10, primary.availableTroops)
            };
        }
        
        return null;
    }

    findStrategicExpansion() {
        // Look for neutral planets that provide strategic value
        const neutrals = this.api.getNeutralPlanets();
        const myPlanets = this.api.getMyPlanets();
        
        let bestOption = null;
        let bestValue = -1;
        
        for (const target of neutrals) {
            const strategic_value = this.calculateStrategicValue(target);
            
            for (const source of myPlanets) {
                if (source.troops < target.troops + 10) continue;
                
                const efficiency = strategic_value / this.api.getDistance(source, target);
                
                if (efficiency > bestValue) {
                    bestValue = efficiency;
                    bestOption = {
                        fromId: source.id,
                        toId: target.id,
                        troops: Math.min(target.troops + 8, Math.floor(source.troops * 0.7))
                    };
                }
            }
        }
        
        return bestOption;
    }

    executeFinishingMove() {
        // Domination mode - find the weakest enemy and crush them
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;
        
        // Target the weakest planet first
        let weakestTarget = null;
        let lowestDefense = Infinity;
        
        for (const enemy of enemyPlanets) {
            if (enemy.troops < lowestDefense) {
                lowestDefense = enemy.troops;
                weakestTarget = enemy;
            }
        }
        
        if (weakestTarget) {
            const myPlanets = this.api.getMyPlanets();
            for (const source of myPlanets) {
                if (source.troops > weakestTarget.troops + 20) {
                    return {
                        fromId: source.id,
                        toId: weakestTarget.id,
                        troops: Math.floor(source.troops * 0.8)
                    };
                }
            }
        }
        
        return null;
    }

    executeDefensiveConsolidation() {
        // Consolidate forces to strongest planets
        const myPlanets = this.api.getMyPlanets().sort((a, b) => b.troops - a.troops);
        
        for (let i = 1; i < myPlanets.length; i++) {
            const weak = myPlanets[i];
            const strong = myPlanets[0];
            
            if (weak.troops > 10 && this.api.getDistance(weak, strong) < 150) {
                return {
                    fromId: weak.id,
                    toId: strong.id,
                    troops: Math.floor(weak.troops * 0.8)
                };
            }
        }
        
        return null;
    }

    findDecisiveOpportunity() {
        // Look for game-changing moves
        const enemies = this.api.getEnemyPlanets();
        const myPlanets = this.api.getMyPlanets();
        
        for (const target of enemies) {
            // Look for enemy production centers we can capture
            if (target.size > 20) { // Large production planet
                for (const source of myPlanets) {
                    const travelTime = this.api.getTravelTime(source, target);
                    const predictedTarget = this.api.predictPlanetState(target, travelTime);
                    
                    if (source.troops > predictedTarget.troops + 25) {
                        return {
                            fromId: source.id,
                            toId: target.id,
                            troops: Math.floor(source.troops * 0.9) // Go all-in
                        };
                    }
                }
            }
        }
        
        return null;
    }

    calculatePlanetValue(planet) {
        const baseValue = planet.size * 2; // Production potential
        const centrality = this.api.getPlanetCentrality(planet) * 30; // Strategic position
        const currentTroops = planet.owner === 'neutral' ? 0 : planet.troops * 0.1;
        
        return baseValue + centrality + currentTroops;
    }

    calculateStrategicValue(planet) {
        const productionValue = this.api.getPlanetProductionRate(planet) * 50;
        const positionValue = this.api.getPlanetCentrality(planet) * 40;
        const enemyDistance = this.findNearestEnemyDistance(planet) * 0.1; // Prefer safer expansions
        
        return productionValue + positionValue + enemyDistance;
    }

    calculateOffensiveThreat(enemyPlanet) {
        const myPlanets = this.api.getMyPlanets();
        let maxThreat = 0;
        
        for (const myPlanet of myPlanets) {
            const distance = this.api.getDistance(myPlanet, enemyPlanet);
            const threat = myPlanet.troops / (distance + 50); // Distance-adjusted threat
            maxThreat = Math.max(maxThreat, threat);
        }
        
        return maxThreat;
    }

    findNearestEnemyDistance(planet) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return 1000; // No enemies, very safe
        
        let minDistance = Infinity;
        for (const enemy of enemyPlanets) {
            const distance = this.api.getDistance(planet, enemy);
            minDistance = Math.min(minDistance, distance);
        }
        
        return minDistance;
    }
}