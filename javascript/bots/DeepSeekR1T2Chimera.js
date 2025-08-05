// =============================================
// root/javascript/bots/DeepSeekR1T2Chimera.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * A strategic AI bot that dynamically balances expansion, defense, and attacks
 * based on game phase, maintaining optimal troop efficiency and threat awareness.
 * 
 * Strategic Pillars:
 * 1. Phase-Adaptive Strategy - EARLY expansion, MID consolidation, LATE aggression
 * 2. Threat-Based Defense - Protects key assets using predictive analytics
 * 3. Value-Optimized Offense - Targets high-value planets with calculated precision
 * 4. Economic Efficiency - Maintains troop production while minimizing waste
 */
export default class ChimeraDominator extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.memory.strategicTargets = new Set();  // High-value planets to capture
        this.memory.lastScanTime = 0;              // Time of last strategic scan
        this.memory.criticalPlanets = new Map();   // Planets requiring protection
    }

    makeDecision(dt) {
        // Handle global decision cooldown
        if (!this.handleCooldown(dt)) return null;

        // Update mission tracking and refresh critical planets list
        this.updateMissionStatus();
        this.identifyCriticalPlanets();

        // Primary decision flow
        const defenseDecision = this.evaluateDefenseNeeds();
        if (defenseDecision) return defenseDecision;

        const gamePhase = this.api.getGamePhase();
        switch (gamePhase) {
            case 'EARLY': return this.executeEarlyGameStrategy();
            case 'MID': return this.executeMidGameStrategy();
            case 'LATE': return this.executeLateGameStrategy();
            default: return this.executeFallbackStrategy();
        }
    }

    handleCooldown(dt) {
        const currentTime = this.api.getElapsedTime();
        const timeSinceLastAction = currentTime - this.memory.lastActionTime;
        
        // Global cooldown enforcement
        if (timeSinceLastAction < this.api.getDecisionCooldown()) {
            return false;
        }
        
        // Update timers
        this.memory.lastActionTime = currentTime;
        return true;
    }

    updateMissionStatus() {
        const activeMissions = new Map();
        
        // Validate existing missions
        for (const [missionId, mission] of this.memory.missions) {
            const planet = this.api.getPlanetById(mission.targetId);
            if (planet && planet.owner !== this.playerId) {
                activeMissions.set(missionId, mission);
            }
        }
        
        this.memory.missions = activeMissions;
    }

    identifyCriticalPlanets() {
        this.memory.criticalPlanets.clear();
        const productionThreshold = this.api.getMyTotalProduction() * 0.15;
        
        // Select planets contributing >15% of total production
        this.api.getMyPlanets().forEach(planet => {
            if (planet.productionRate > productionThreshold) {
                const threatLevel = this.api.calculateThreat(planet);
                this.memory.criticalPlanets.set(planet.id, {
                    planet,
                    threatLevel,
                    defendersNeeded: threatLevel * 2
                });
            }
        });
    }

    evaluateDefenseNeeds() {
        const criticalEntries = Array.from(this.memory.criticalPlanets.values())
            .sort((a, b) => b.threatLevel - a.threatLevel);
            
        for (const { planet, defendersNeeded } of criticalEntries) {
            if (planet.troops < defendersNeeded) {
                const reinforcement = this.requestReinforcements(planet, defendersNeeded - planet.troops);
                if (reinforcement) return reinforcement;
            }
        }
        return null;
    }

    requestReinforcements(target, troopsNeeded) {
        const candidatePlanets = this.api.getMyPlanets()
            .filter(p => 
                p.id !== target.id && 
                p.troops > 10 && 
                !this.api.getIncomingReinforcements(p).length
            )
            .sort((a, b) => 
                this.api.getDistance(a, target) - this.api.getDistance(b, target)
            );
            
        for (const source of candidatePlanets) {
            const availTroops = source.troops * 0.5;
            if (availTroops > troopsNeeded) {
                return {
                    from: source,
                    to: target,
                    troops: troopsNeeded
                };
            }
        }
        return null;
    }

    executeEarlyGameStrategy() {
        // Capture strategic neutral targets
        if (this.api.getElapsedTime() < 30) {
            const highValueTargets = this.api.getNeutralPlanets()
                .filter(p => this.api.calculatePlanetValue(p) > 0.7)
                .sort((a, b) => b.productionRate - a.productionRate);
                
            for (const target of highValueTargets) {
                const source = this.findOptimalSource(target, 1.1);
                if (source) return this.launchAttack(source, target);
            }
        }
        
        // Fallback: Expand to nearest neutral
        return this.expandToNearestViable();
    }

    executeMidGameStrategy() {
        // Attack undervalued enemy planets
        const vulnerableEnemies = this.api.getEnemyPlanets()
            .filter(p => {
                const predicted = this.api.predictPlanetState(p, 5);
                return predicted.troops < p.troops * 0.75;  // Production/depletion vulnerability
            })
            .sort((a, b) => this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a));
            
        for (const target of vulnerableEnemies) {
            const requiredTroops = this.calculateRequiredTroops(target);
            const source = this.findOptimalSource(target, requiredTroops * 1.25);
            if (source) return this.launchAttack(source, target, requiredTroops);
        }
        
        // Fallback: Fortify position
        return this.fortifyWeakestPlanet();
    }

    executeLateGameStrategy() {
        // Focus fire on weakest opponent
        const opponents = this.api.getOpponentIds()
            .map(id => ({
                id,
                strength: this.api.getPlayerTotalTroops(id),
                production: this.api.getPlayerTotalProduction(id)
            }))
            .sort((a, b) => a.strength - b.strength);
            
        if (opponents.length === 0) return null;
        
        const primaryTarget = opponents[0];
        const enemyPlanets = this.api.getEnemyPlanets()
            .filter(p => p.owner === primaryTarget.id)
            .sort((a, b) => this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a));
            
        for (const target of enemyPlanets) {
            const requiredTroops = this.calculateRequiredTroops(target);
            const sources = this.findMultiSourceAttack(target, requiredTroops);
            if (sources.length > 0) {
                return this.launchMultiFrontAttack(sources, target);
            }
        }
        return null;
    }

    calculateRequiredTroops(target) {
        const currentTime = this.api.getElapsedTime();
        const travelTime = (source) => this.api.getTravelTime(source, target);
        
        // Predict target state at average arrival time
        let avgTravelTime = 5;  // Default estimate
        const sources = this.api.getMyPlanets()
            .filter(p => p.troops > 10 && !this.api.getIncomingAttacks(p).length);
        if (sources.length > 0) {
            avgTravelTime = sources.reduce((sum, src) => sum + travelTime(src), 0) / sources.length;
        }
        
        const predicted = this.api.predictPlanetState(target, avgTravelTime);
        return Math.ceil(predicted.troops * 1.2);  // Safety margin
    }

    findOptimalSource(target, requiredTroops) {
        return this.api.getMyPlanets()
            .filter(p => 
                p.troops > requiredTroops &&
                !this.api.getIncomingAttacks(p).length
            )
            .sort((a, b) => {
                const aValue = this.api.calculateCentrality(a) * (a.troops / requiredTroops);
                const bValue = this.api.calculateCentrality(b) * (b.troops / requiredTroops);
                return bValue - aValue;
            })[0];
    }

    launchAttack(source, target, troops = Math.floor(source.troops * 0.7)) {
        if (!source || !target || source.troops < 5) return null;
        if (troops > source.troops * 0.9) troops = source.troops * 0.9;
        
        this.memory.missions.set(`${source.id}-${target.id}`, {
            sourceId: source.id,
            targetId: target.id,
            troopsCommitted: troops,
            launchTime: this.api.getElapsedTime()
        });
        
        return {
            from: source,
            to: target,
            troops: Math.floor(troops)
        };
    }

    expandToNearestViable() {
        const myPlanets = this.api.getMyPlanets();
        const viableTargets = this.api.getNeutralPlanets()
            .filter(p => p.troops < 15 && p.productionRate > 0.5);
            
        for (const target of viableTargets) {
            const nearestSource = this.api.findNearestPlanet(target, myPlanets);
            if (nearestSource && nearestSource.troops > target.troops * 1.5) {
                return this.launchAttack(nearestSource, target, target.troops * 1.1);
            }
        }
        return null;
    }

    fortifyWeakestPlanet() {
        const weakPlanets = this.api.getMyPlanets()
            .filter(p => p.troops < 10)
            .sort((a, b) => a.troops - b.troops);
            
        if (weakPlanets.length === 0) return null;
        
        const weakest = weakPlanets[0];
        const supporters = this.api.getMyPlanets()
            .filter(p => 
                p.troops > 20 && 
                p.id !== weakest.id &&
                this.api.getDistance(p, weakest) < 30
            )
            .sort((a, b) => b.troops - a.troops);
            
        if (supporters.length > 0) {
            return {
                from: supporters[0],
                to: weakest,
                troops: supporters[0].troops * 0.4
            };
        }
        return null;
    }

    executeFallbackStrategy() {
        // Consolidate forces when winning, aggressive push when losing
        const strengthRatio = this.api.getMyStrengthRatio();
        
        if (strengthRatio > 1.5) {
            // Winning: Protect lead
            return this.fortifyWeakestPlanet();
        } else {
            // Losing: High-risk offensive
            const valuableTargets = this.api.getAllPlanets()
                .filter(p => 
                    p.owner !== this.playerId && 
                    this.api.calculatePlanetValue(p) > 0.8
                )
                .sort((a, b) => b.productionRate - a.productionRate);
                
            for (const target of valuableTargets) {
                const sources = this.api.getMyPlanets()
                    .filter(p => p.troops > 15)
                    .sort((a, b) => b.troops - a.troops);
                    
                if (sources.length > 0) {
                    return this.launchAttack(
                        sources[0], 
                        target, 
                        Math.min(sources[0].troops * 0.8, this.calculateRequiredTroops(target))
                    );
                }
            }
        }
        return null;
    }
}