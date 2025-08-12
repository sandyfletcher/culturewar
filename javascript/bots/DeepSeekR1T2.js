// =============================================
// root/javascript/bots/DeepSeekR1T2.js — TNG: DeepSeek R1T2 Chimera
// =============================================

import BaseBot from './BaseBot.js';

/**
    DominusAI: Adaptive strategic dominator using phased warfare and predictive analytics.
    Core strategy evolves through game phases: rapid expansion (EARLY), targeted suppression (MID), 
    and lethal elimination (LATE). Uses threat-weighted reinforcement and precision attacks.
*/

export default class DeepSeekR1T2 extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            actionCooldown: 0,
            missions: [],
            lastActionType: null,
            strategicState: 'EXPAND'
        };
    }

    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        // Phase detection logic
        const phase = this.determineGamePhase();
        const enemyPlanets = this.api.getEnemyPlanets();

        // Update strategic state based on game conditions
        this.updateStrategicState(phase, enemyPlanets.length);

        let decision = null;

        // Defensive checks always get highest priority
        decision = this.handleCriticalDefense();
        if (!decision) decision = this.executeStrategicPlan(phase);

        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            this.recordMission(decision);
        }

        return decision;
    }

    determineGamePhase() {
        const elapsed = this.api.getElapsedTime();
        const totalTime = this.api.getGameDuration();
        if (elapsed < totalTime * 0.3) return 'EARLY';
        if (elapsed < totalTime * 0.7) return 'MID';
        return 'LATE';
    }

    updateStrategicState(phase, enemyCount) {
        if (phase === 'EARLY') {
            this.memory.strategicState = 'EXPAND';
        } else if (this.api.getMyStrengthRatio() > 1.5 && enemyCount > 3) {
            this.memory.strategicState = 'DOMINATE';
        } else if (this.api.getMyStrengthRatio() < 0.8) {
            this.memory.strategicState = 'SURVIVE';
        } else {
            this.memory.strategicState = 'CONSOLIDATE';
        }
    }

    handleCriticalDefense() {
        const criticalPlanets = this.api.getMyPlanets()
            .filter(p => this.api.getIncomingAttacks(p).length > 0)
            .sort((a, b) => this.calculatePlanetThreatLevel(b) - this.calculatePlanetThreatLevel(a));

        for (const planet of criticalPlanets) {
            const defenseNeeded = this.calculateDefenseRequirement(planet);
            if (defenseNeeded <= 0) continue;

            const source = this.findBestReinforcementSource(planet, defenseNeeded);
            if (source) {
                return {
                    fromId: source.id,
                    toId: planet.id,
                    troops: Math.min(source.troops - 10, defenseNeeded) // Leave minimal garrison
                };
            }
        }
        return null;
    }

    calculateDefenseRequirement(planet) {
        const incomingAttacks = this.api.getIncomingAttacks(planet);
        if (incomingAttacks.length === 0) return 0;

        const attackTimes = incomingAttacks.map(f => f.duration);
        const firstImpactTime = Math.min(...attackTimes);
        const futureState = this.api.predictPlanetState(planet, firstImpactTime);
        
        return futureState.troops < 0 ? Math.abs(futureState.troops) + 5 : 0;
    }

    executeStrategicPlan(phase) {
        switch (this.memory.strategicState) {
            case 'EXPAND':
                return this.executeExpansionStrategy();
            case 'DOMINATE':
                return this.executeDominationStrategy();
            case 'CONSOLIDATE':
                return this.executeConsolidationStrategy();
            case 'SURVIVE':
                return this.executeSurvivalStrategy();
            default:
                return this.executeDefaultStrategy();
        }
    }

    executeExpansionStrategy() {
        const bestTarget = this.findHighestValueNeutral();
        if (!bestTarget) return null;

        const nearestOwned = this.api.findNearestPlanet(bestTarget, this.api.getMyPlanets());
        if (!nearestOwned || nearestOwned.troops < 15) return null;

        const travelTime = this.api.getTravelTime(nearestOwned, bestTarget);
        const futureState = this.api.predictPlanetState(bestTarget, travelTime);
        const requiredTroops = Math.ceil(futureState.troops) + 3; // Safety buffer

        if (nearestOwned.troops > requiredTroops + 10) {
            return {
                fromId: nearestOwned.id,
                toId: bestTarget.id,
                troops: requiredTroops
            };
        }
        return null;
    }

    executeDominationStrategy() {
        const weakness = this.findWeakestEnemy();
        if (!weakness) return this.executeExpansionStrategy();

        const planet = weakness.planet;
        const myPlanets = this.api.getMyPlanets()
            .filter(p => p.troops > planet.troops * 1.2)
            .sort((a, b) => this.api.getDistance(a, planet) - this.api.getDistance(b, planet));

        if (myPlanets.length === 0) return null;

        const source = myPlanets[0];
        const requiredTroops = Math.ceil(planet.troops * 1.1);
        
        return {
            fromId: source.id,
            toId: planet.id,
            troops: Math.min(source.troops - 10, requiredTroops)
        };
    }

    calculatePlanetThreatLevel(planet) {
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return 0;

        const closestEnemy = this.api.findNearestPlanet(planet, enemies);
        const distance = this.api.getDistance(planet, closestEnemy);
        const proximityScore = 1 - Math.min(distance / 500, 1);
        return (planet.size + planet.productionRate) * proximityScore;
    }

    findHighestValueNeutral() {
        return this.api.getNeutralPlanets()
            .map(p => ({
                planet: p,
                value: this.calculatePlanetValue(p) / (
                    this.api.findNearestPlanet(p, this.api.getMyPlanets())
                    ? this.api.getDistance(p, this.api.findNearestPlanet(p, this.api.getMyPlanets()))
                    : 1000
                )
            }))
            .sort((a, b) => b.value - a.value)[0]?.planet;
    }

    findWeakestEnemy() {
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;

        return enemies
            .map(planet => ({
                planet,
                vulnerability: planet.troops / (this.api.calculatePlanetValue(planet) || 1)
            }))
            .sort((a, b) => a.vulnerability - b.vulnerability)[0];
    }

    findBestReinforcementSource(target, minTroops) {
        return this.api.getMyPlanets()
            .filter(p => 
                p.id !== target.id && 
                p.troops > minTroops + 10 &&
                this.api.getIncomingAttacks(p).length === 0
            )
            .sort((a, b) => (
                this.api.getDistance(a, target) * 0.7 + 
                (999 - b.troops) * 0.3 // Prioritize nearly-full planets
            ))[0];
    }

    recordMission(decision) {
        const source = this.api.getPlanetById(decision.fromId);
        const target = this.api.getPlanetById(decision.toId);
        const eta = this.api.getTravelTime(source, target);

        // Cleanup expired missions
        this.memory.missions = this.memory.missions.filter(m => m.eta > 0);
        
        this.memory.missions.push({
            type: target.owner === 'neutral' ? 'expansion' : 'attack',
            sourceId: decision.fromId,
            targetId: decision.toId,
            troops: decision.troops,
            eta: eta,
            value: this.api.calculatePlanetValue(target)
        });
    }

    // Fallback strategies
    executeConsolidationStrategy() {
        const overloadedPlanet = this.api.getMyPlanets()
            .filter(p => p.troops > 800)
            .sort((a, b) => b.troops - a.troops)[0];
        
        if (overloadedPlanet) {
            const mostValuableAlly = this.api.getMyPlanets()
                .filter(p => p.id !== overloadedPlanet.id)
                .sort((a, b) => this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a))[0];
            
            if (mostValuableAlly) {
                const surplus = Math.min(overloadedPlanet.troops - 100, 300);
                return {
                    fromId: overloadedPlanet.id,
                    toId: mostValuableAlly.id,
                    troops: surplus
                };
            }
        }
        return this.executeDominationStrategy();
    }

    executeSurvivalStrategy() {
        const strongestPlanet = this.api.getMyPlanets()
            .sort((a, b) => b.troops - a.troops)[0];
        
        if (!strongestPlanet || strongestPlanet.troops < 50) return null;

        const weakestPlanet = this.api.getMyPlanets()
            .filter(p => this.api.getIncomingAttacks(p).length > 0)
            .sort((a, b) => a.troops - b.troops)[0];
        
        if (weakestPlanet) {
            const defenseNeed = this.calculateDefenseRequirement(weakestPlanet);
            if (defenseNeed > 0) {
                return {
                    fromId: strongestPlanet.id,
                    toId: weakestPlanet.id,
                    troops: Math.min(strongestPlanet.troops - 20, defenseNeed + 15)
                };
            }
        }
        return null;
    }

    calculatePlanetValue(planet) {
        return planet.size * 2 + 
               planet.productionRate * 5 + 
               (1 - this.api.getPlanetCentrality(planet)) * 3;
    }
}