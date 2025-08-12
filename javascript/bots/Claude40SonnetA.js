// =============================================
// root/javascript/bots/Claude40SonnetA.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * DominatorBot - A multi-phase strategic AI that adapts from aggressive expansion to tactical dominance.
 * 
 * Strategic Pillars:
 * 1. Early Game: Rapid expansion prioritizing high-value neutral planets
 * 2. Mid Game: Aggressive territory denial and strategic positioning
 * 3. Late Game: Concentrated attacks on weakest opponents while defending key positions
 * 4. Continuous threat assessment and adaptive resource allocation
 * 5. Predictive combat calculations to minimize troop waste
 */
export default class Claude40SonnetA extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        this.memory.missions = new Map(); // Track ongoing missions to avoid double-commitment
        this.memory.lastThreatAssessment = 0;
        this.memory.threatMap = new Map();
        this.memory.strategicTargets = [];
        this.memory.defenseMode = false;
    }

    makeDecision(dt) {
        // Cooldown management
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }

        // Update threat assessment periodically
        this.updateThreatAssessment();

        // Phase-based strategy
        const phase = this.api.getGamePhase();
        const strengthRatio = this.api.getMyStrengthRatio();

        let decision = null;

        switch (phase) {
            case 'EARLY':
                decision = this.executeEarlyGameStrategy();
                break;
            case 'MID':
                decision = this.executeMidGameStrategy(strengthRatio);
                break;
            case 'LATE':
                decision = this.executeLateGameStrategy(strengthRatio);
                break;
        }

        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            // Track the mission
            this.memory.missions.set(decision.fromId, {
                target: decision.toId,
                troops: decision.troops,
                timestamp: this.api.getElapsedTime()
            });
        }

        return decision;
    }

    updateThreatAssessment() {
        const currentTime = this.api.getElapsedTime();
        if (currentTime - this.memory.lastThreatAssessment < 2.0) {
            return; // Update every 2 seconds
        }

        this.memory.lastThreatAssessment = currentTime;
        this.memory.threatMap.clear();

        const myPlanets = this.api.getMyPlanets();
        
        for (const planet of myPlanets) {
            const threat = this.calculateAdvancedThreat(planet);
            this.memory.threatMap.set(planet.id, threat);
        }

        // Check if we should enter defense mode
        const highThreatPlanets = Array.from(this.memory.threatMap.values())
            .filter(threat => threat > 0.7);
        this.memory.defenseMode = highThreatPlanets.length > myPlanets.length * 0.4;
    }

    calculateAdvancedThreat(planet) {
        let threat = 0;
        const enemyPlanets = this.api.getEnemyPlanets();
        const incomingAttacks = this.api.getIncomingAttacks(planet);

        // Immediate incoming threat
        const incomingTroops = incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        const currentDefense = planet.troops + this.api.getIncomingReinforcements(planet)
            .reduce((sum, reinf) => sum + reinf.amount, 0);

        if (incomingTroops > currentDefense) {
            threat += 1.0; // Critical immediate threat
        } else if (incomingTroops > currentDefense * 0.7) {
            threat += 0.5; // Significant threat
        }

        // Proximity threat from enemy planets
        for (const enemyPlanet of enemyPlanets) {
            const distance = this.api.getDistance(planet, enemyPlanet);
            const travelTime = this.api.getTravelTime(planet, enemyPlanet);
            
            if (travelTime < 10) { // Within 10 seconds travel
                const enemyForce = enemyPlanet.troops;
                const proximityFactor = Math.max(0, 1 - (travelTime / 10));
                const forceFactor = Math.min(1, enemyForce / (planet.troops + 1));
                threat += proximityFactor * forceFactor * 0.3;
            }
        }

        return Math.min(1.0, threat);
    }

    executeEarlyGameStrategy() {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) {
            return this.executeMidGameStrategy(this.api.getMyStrengthRatio());
        }

        // Find best expansion opportunity
        const expansion = this.findBestExpansion();
        if (expansion) {
            return expansion;
        }

        // Reinforce weak positions if no good expansions
        return this.reinforceWeakPositions();
    }

    findBestExpansion() {
        const myPlanets = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        
        let bestOption = null;
        let bestScore = -1;

        for (const neutral of neutralPlanets) {
            // Skip if already targeted
            const alreadyTargeted = Array.from(this.memory.missions.values())
                .some(mission => mission.target === neutral.id);
            if (alreadyTargeted) continue;

            for (const myPlanet of myPlanets) {
                if (myPlanet.troops < neutral.troops + 5) continue; // Need buffer

                const travelTime = this.api.getTravelTime(myPlanet, neutral);
                const troopsNeeded = neutral.troops + 2; // Small buffer
                const troopsAvailable = myPlanet.troops - this.getMinimumDefense(myPlanet);

                if (troopsAvailable < troopsNeeded) continue;

                // Score based on value and efficiency
                const planetValue = this.calculatePlanetValue(neutral);
                const efficiency = troopsAvailable / (troopsNeeded + 1);
                const timeBonus = Math.max(0, 1 - (travelTime / 15)); // Prefer closer targets
                
                const score = planetValue * efficiency * timeBonus;

                if (score > bestScore) {
                    bestScore = score;
                    bestOption = {
                        fromId: myPlanet.id,
                        toId: neutral.id,
                        troops: troopsNeeded
                    };
                }
            }
        }

        return bestOption;
    }

    executeMidGameStrategy(strengthRatio) {
        // If we're strong, be aggressive; if weak, be defensive
        if (strengthRatio > 1.2) {
            return this.executeAggressiveStrategy();
        } else if (strengthRatio < 0.8) {
            return this.executeDefensiveStrategy();
        } else {
            // Balanced approach - expand or consolidate
            const expansion = this.findBestExpansion();
            if (expansion) return expansion;
            
            return this.consolidatePositions();
        }
    }

    executeAggressiveStrategy() {
        // Target weakest enemy planets first
        const enemyPlanets = this.api.getEnemyPlanets();
        const weakestEnemies = enemyPlanets
            .filter(planet => !this.isPlanetUnderAttack(planet))
            .sort((a, b) => {
                const futureA = this.api.predictPlanetState(a, 3);
                const futureB = this.api.predictPlanetState(b, 3);
                return futureA.troops - futureB.troops;
            });

        for (const target of weakestEnemies) {
            const attack = this.planOptimalAttack(target);
            if (attack) return attack;
        }

        return null;
    }

    planOptimalAttack(target) {
        const myPlanets = this.api.getMyPlanets();
        const travelTime = myPlanets.map(p => this.api.getTravelTime(p, target));
        const maxTravelTime = Math.max(...travelTime);

        // Predict target state when our slowest fleet arrives
        const futureTarget = this.api.predictPlanetState(target, maxTravelTime);
        const troopsNeeded = futureTarget.troops + 5; // Safety buffer

        // Find combination of planets that can provide enough troops
        const candidates = myPlanets
            .map(planet => ({
                planet,
                available: planet.troops - this.getMinimumDefense(planet),
                travelTime: this.api.getTravelTime(planet, target)
            }))
            .filter(c => c.available > 0)
            .sort((a, b) => b.available - a.available);

        let totalAvailable = 0;
        for (const candidate of candidates) {
            totalAvailable += candidate.available;
            if (totalAvailable >= troopsNeeded) {
                // Use the strongest planet for the attack
                return {
                    fromId: candidate.planet.id,
                    toId: target.id,
                    troops: Math.min(candidate.available, troopsNeeded)
                };
            }
        }

        return null; // Not enough troops available
    }

    executeDefensiveStrategy() {
        // Reinforce threatened planets
        const threatenedPlanet = this.findMostThreatenedPlanet();
        if (threatenedPlanet) {
            const reinforcement = this.planReinforcement(threatenedPlanet);
            if (reinforcement) return reinforcement;
        }

        // Consolidate weak positions
        return this.consolidatePositions();
    }

    findMostThreatenedPlanet() {
        let maxThreat = 0;
        let mostThreatened = null;

        for (const [planetId, threat] of this.memory.threatMap) {
            if (threat > maxThreat) {
                maxThreat = threat;
                mostThreatened = this.api.getPlanetById(planetId);
            }
        }

        return mostThreatened;
    }

    planReinforcement(threatenedPlanet) {
        const myPlanets = this.api.getMyPlanets();
        const incomingAttacks = this.api.getIncomingAttacks(threatenedPlanet);
        const totalIncomingTroops = incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        
        if (totalIncomingTroops === 0) return null;

        const shortestAttackTime = Math.min(...incomingAttacks.map(a => a.duration));
        const troopsNeeded = totalIncomingTroops - threatenedPlanet.troops + 10; // Buffer

        // Find nearest planet with sufficient troops
        const reinforcers = myPlanets
            .filter(p => p.id !== threatenedPlanet.id)
            .map(p => ({
                planet: p,
                available: p.troops - this.getMinimumDefense(p),
                travelTime: this.api.getTravelTime(p, threatenedPlanet)
            }))
            .filter(r => r.available > 0 && r.travelTime < shortestAttackTime)
            .sort((a, b) => a.travelTime - b.travelTime);

        for (const reinforcer of reinforcers) {
            if (reinforcer.available >= troopsNeeded) {
                return {
                    fromId: reinforcer.planet.id,
                    toId: threatenedPlanet.id,
                    troops: Math.min(reinforcer.available, troopsNeeded)
                };
            }
        }

        return null;
    }

    executeLateGameStrategy(strengthRatio) {
        const gameTime = this.api.getElapsedTime();
        const gameLength = this.api.getGameDuration();
        const timeRemaining = gameLength - gameTime;

        if (timeRemaining < 30) {
            // Final push - all or nothing
            return this.executeFinalPush();
        }

        if (strengthRatio > 1.5) {
            // We're dominant - finish them off
            return this.executeFinishingStrategy();
        } else {
            // Stay competitive
            return this.executeMidGameStrategy(strengthRatio);
        }
    }

    executeFinalPush() {
        // Find the weakest opponent and overwhelm them
        const opponents = this.api.getOpponentIds();
        let weakestOpponent = null;
        let minStrength = Infinity;

        for (const opponentId of opponents) {
            const stats = this.api.getPlayerStats(opponentId);
            if (stats.isActive && stats.totalTroops < minStrength) {
                minStrength = stats.totalTroops;
                weakestOpponent = opponentId;
            }
        }

        if (weakestOpponent) {
            const enemyPlanets = this.api.getEnemyPlanets()
                .filter(p => p.owner === weakestOpponent);
            
            if (enemyPlanets.length > 0) {
                // Attack their weakest planet with maximum force
                const target = enemyPlanets.sort((a, b) => a.troops - b.troops)[0];
                return this.planMaximalAttack(target);
            }
        }

        return null;
    }

    planMaximalAttack(target) {
        const myPlanets = this.api.getMyPlanets();
        let strongestPlanet = null;
        let maxAvailable = 0;

        for (const planet of myPlanets) {
            const available = planet.troops - 5; // Minimal defense
            if (available > maxAvailable) {
                maxAvailable = available;
                strongestPlanet = planet;
            }
        }

        if (strongestPlanet && maxAvailable > target.troops) {
            return {
                fromId: strongestPlanet.id,
                toId: target.id,
                troops: maxAvailable
            };
        }

        return null;
    }

    executeFinishingStrategy() {
        // Systematically eliminate remaining opponents
        return this.executeAggressiveStrategy();
    }

    consolidatePositions() {
        // Move troops from over-defended planets to under-defended ones
        const myPlanets = this.api.getMyPlanets();
        
        let sourceCandidate = null;
        let targetCandidate = null;
        let maxSurplus = 0;
        let maxDeficit = 0;

        for (const planet of myPlanets) {
            const minDefense = this.getMinimumDefense(planet);
            const surplus = planet.troops - minDefense;
            const threat = this.memory.threatMap.get(planet.id) || 0;

            if (surplus > maxSurplus && threat < 0.3) {
                maxSurplus = surplus;
                sourceCandidate = planet;
            }

            if (threat > 0.5 && planet.troops < minDefense) {
                const deficit = minDefense - planet.troops;
                if (deficit > maxDeficit) {
                    maxDeficit = deficit;
                    targetCandidate = planet;
                }
            }
        }

        if (sourceCandidate && targetCandidate && maxSurplus > maxDeficit) {
            const troopsToMove = Math.min(maxSurplus, maxDeficit + 5);
            return {
                fromId: sourceCandidate.id,
                toId: targetCandidate.id,
                troops: troopsToMove
            };
        }

        return null;
    }

    reinforceWeakPositions() {
        // Similar to consolidate but focuses on immediate threats
        const myPlanets = this.api.getMyPlanets();
        
        for (const planet of myPlanets) {
            const threat = this.memory.threatMap.get(planet.id) || 0;
            if (threat > 0.6) {
                const reinforcement = this.planReinforcement(planet);
                if (reinforcement) return reinforcement;
            }
        }

        return null;
    }

    calculatePlanetValue(planet) {
        const baseValue = this.api.calculatePlanetValue(planet);
        const centrality = this.api.getPlanetCentrality(planet);
        const productionRate = this.api.getPlanetProductionRate(planet);
        
        // Enhanced value calculation
        return baseValue + (centrality * 0.3) + (productionRate * 10);
    }

    getMinimumDefense(planet) {
        const threat = this.memory.threatMap.get(planet.id) || 0;
        const baseDefense = Math.max(10, planet.size * 0.5);
        return Math.floor(baseDefense * (1 + threat));
    }

    isPlanetUnderAttack(planet) {
        const attacks = this.api.getAllTroopMovements()
            .filter(fleet => fleet.to.id === planet.id && fleet.owner !== planet.owner);
        return attacks.length > 0;
    }
}