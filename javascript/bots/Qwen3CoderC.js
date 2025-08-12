// =============================================
// root/javascript/bots/Qwen3CoderC.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * PredatorBot: An adaptive RTS AI that dominates through strategic expansion, targeted eliminations, and resource efficiency.
 * Core strategy: Expand rapidly in early game, identify and eliminate weakest opponents in mid-game, then consolidate for final victory.
 * Strategic pillars:
 * 1. Priority-based targeting system weighing planet value, threat level, and strategic position
 * 2. Predictive modeling for precise troop deployment
 * 3. Adaptive gameplay based on game phase and relative strength
 * 4. Efficient resource management with capacity awareness
 */

export default class Qwen3CoderC extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        this.memory.missions = new Map(); // Track ongoing missions
        this.memory.targets = new Set();  // Track targeted planets
    }

    /**
     * Main decision-making method called by the game engine.
     * @param {number} dt - Time elapsed since last turn, scaled by game speed.
     * @returns {object|null} Decision object or null for no action.
     */
    makeDecision(dt) {
        // Handle cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }

        // Clean up completed missions
        this._cleanupMissions();

        // Get game state
        const gamePhase = this.api.getGamePhase();
        const myStrength = this.api.getMyStrengthRatio();
        const elapsedTime = this.api.getElapsedTime();

        // Prioritize actions based on game phase and situation
        let decision = null;
        
        if (gamePhase === 'EARLY') {
            decision = this._earlyGameStrategy();
        } else if (gamePhase === 'MID') {
            decision = myStrength > 1.2 ? 
                this._aggressiveMidGameStrategy() : 
                this._defensiveMidGameStrategy();
        } else { // LATE GAME
            decision = this._endGameStrategy();
        }

        // If we have a decision, set cooldown
        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            // Track the mission
            if (!this.memory.missions.has(decision.toId)) {
                this.memory.missions.set(decision.toId, {
                    source: decision.fromId,
                    target: decision.toId,
                    troops: decision.troops,
                    timeSent: elapsedTime
                });
            }
            this.memory.targets.add(decision.toId);
        }

        return decision;
    }

    /**
     * Early game strategy: Rapid expansion to secure valuable planets
     */
    _earlyGameStrategy() {
        const myPlanets = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();

        // Combine all targets and sort by value
        const allTargets = [...neutralPlanets, ...enemyPlanets]
            .map(planet => ({
                planet,
                value: this._calculatePlanetValue(planet),
                distance: Math.min(...myPlanets.map(p => this.api.getDistance(p, planet)))
            }))
            .sort((a, b) => {
                // Prioritize by value/distance ratio
                const ratioA = a.value / a.distance;
                const ratioB = b.value / b.distance;
                return ratioB - ratioA;
            });

        // Find the best source planet for each target
        for (const targetInfo of allTargets) {
            const target = targetInfo.planet;
            
            // Skip if already targeted
            if (this.memory.targets.has(target.id)) continue;

            // Find best source planet
            const source = this._findBestSource(target, myPlanets);
            if (!source) continue;

            // Calculate required troops
            const travelTime = this.api.getTravelTime(source, target);
            const requiredTroops = this._calculateTroopsNeeded(source, target, travelTime);
            
            if (requiredTroops > 0 && source.troops > requiredTroops) {
                return {
                    fromId: source.id,
                    toId: target.id,
                    troops: Math.min(requiredTroops + 5, Math.floor(source.troops * 0.8))
                };
            }
        }

        return null;
    }

    /**
     * Aggressive mid-game: Target weakest opponents
     */
    _aggressiveMidGameStrategy() {
        const myPlanets = this.api.getMyPlanets();
        const opponentIds = this.api.getOpponentIds();
        
        // Find the weakest active opponent
        let weakestOpponent = null;
        let minStrength = Infinity;
        
        for (const opponentId of opponentIds) {
            if (!this.api.isPlayerActive(opponentId)) continue;
            
            const stats = this.api.getPlayerStats(opponentId);
            const strength = stats.totalTroops + stats.totalProduction * 10;
            
            if (strength < minStrength) {
                minStrength = strength;
                weakestOpponent = opponentId;
            }
        }
        
        if (!weakestOpponent) return this._defensiveMidGameStrategy();
        
        const targetPlanets = this.api.getAllPlanets()
            .filter(planet => planet.owner === weakestOpponent);
            
        return this._executeAttackPlan(myPlanets, targetPlanets);
    }

    /**
     * Defensive mid-game: Protect own planets and consolidate
     */
    _defensiveMidGameStrategy() {
        const myPlanets = this.api.getMyPlanets();
        const threatenedPlanets = myPlanets
            .map(planet => ({
                planet,
                threat: this.api.calculateThreat(planet)
            }))
            .filter(item => item.threat > 0)
            .sort((a, b) => b.threat - a.threat);

        // Defend the most threatened planet
        if (threatenedPlanets.length > 0) {
            const target = threatenedPlanets[0].planet;
            const reinforcements = this.api.getIncomingReinforcements(target);
            const attacks = this.api.getIncomingAttacks(target);
            
            // Calculate how many troops needed for defense
            let totalAttack = 0;
            for (const attack of attacks) {
                totalAttack += attack.amount;
            }
            
            let totalReinforcements = 0;
            for (const rein of reinforcements) {
                totalReinforcements += rein.amount;
            }
            
            const deficit = totalAttack - target.troops - totalReinforcements;
            
            if (deficit > 0) {
                // Find nearest planet to send reinforcements
                const source = this._findBestReinforcementSource(target, myPlanets);
                if (source && source.id !== target.id && source.troops > deficit + 10) {
                    return {
                        fromId: source.id,
                        toId: target.id,
                        troops: deficit + 10
                    };
                }
            }
        }

        // If no immediate threats, expand
        return this._earlyGameStrategy();
    }

    /**
     * End game strategy: Eliminate remaining opponents
     */
    _endGameStrategy() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        if (enemyPlanets.length === 0) return null;
        
        // Sort enemies by proximity to our planets
        const targetPlanets = enemyPlanets
            .map(planet => ({
                planet,
                minDistance: Math.min(...myPlanets.map(p => this.api.getDistance(p, planet)))
            }))
            .sort((a, b) => a.minDistance - b.minDistance)
            .map(item => item.planet);
            
        return this._executeAttackPlan(myPlanets, targetPlanets);
    }

    /**
     * Execute an attack plan against target planets
     */
    _executeAttackPlan(sourcePlanets, targetPlanets) {
        // Sort targets by value
        const sortedTargets = targetPlanets
            .map(planet => ({
                planet,
                value: this._calculatePlanetValue(planet)
            }))
            .sort((a, b) => b.value - a.value)
            .map(item => item.planet);

        for (const target of sortedTargets) {
            // Skip if already targeted
            if (this.memory.targets.has(target.id)) continue;

            // Find best source
            const source = this._findBestSource(target, sourcePlanets);
            if (!source) continue;

            const travelTime = this.api.getTravelTime(source, target);
            const requiredTroops = this._calculateTroopsNeeded(source, target, travelTime);
            
            if (requiredTroops > 0 && source.troops > requiredTroops) {
                return {
                    fromId: source.id,
                    toId: target.id,
                    troops: Math.min(requiredTroops + 10, Math.floor(source.troops * 0.9))
                };
            }
        }

        return null;
    }

    /**
     * Find the best source planet for attacking a target
     */
    _findBestSource(target, sourcePlanets) {
        return sourcePlanets
            .filter(planet => planet.troops > 10 && planet.id !== target.id)
            .sort((a, b) => {
                const distanceA = this.api.getDistance(a, target);
                const distanceB = this.api.getDistance(b, target);
                // Prefer closer planets with more troops
                const scoreA = (a.troops * 0.7) / distanceA;
                const scoreB = (b.troops * 0.7) / distanceB;
                return scoreB - scoreA;
            })[0] || null;
    }

    /**
     * Find best reinforcement source for a threatened planet
     */
    _findBestReinforcementSource(target, sourcePlanets) {
        return sourcePlanets
            .filter(planet => planet.troops > 20 && planet.id !== target.id)
            .sort((a, b) => {
                const distanceA = this.api.getDistance(a, target);
                const distanceB = this.api.getDistance(b, target);
                // Prefer closer planets with more troops
                const scoreA = (a.troops * 0.8) / distanceA;
                const scoreB = (b.troops * 0.8) / distanceB;
                return scoreB - scoreA;
            })[0] || null;
    }

    /**
     * Calculate troops needed to conquer a planet
     */
    _calculateTroopsNeeded(source, target, travelTime) {
        const futureState = this.api.predictPlanetState(target, travelTime);
        
        // If we already own it, just reinforce
        if (futureState.owner === this.playerId) {
            // If it's under threat, reinforce it
            const attacks = this.api.getIncomingAttacks(target);
            if (attacks.length > 0) {
                let totalAttack = 0;
                for (const attack of attacks) {
                    totalAttack += attack.amount;
                }
                return Math.max(0, totalAttack - futureState.troops + 5);
            }
            return 0; // No need to send troops
        }
        
        // For enemy/neutral planets, calculate conquest cost
        return Math.ceil(futureState.troops) + 1;
    }

    /**
     * Calculate planet value based on production, size, and position
     */
    _calculatePlanetValue(planet) {
        const productionValue = planet.productionRate * 10;
        const sizeValue = planet.size * 0.5;
        const centralityValue = this.api.getPlanetCentrality(planet) * 15;
        return productionValue + sizeValue + centralityValue;
    }

    /**
     * Clean up completed missions
     */
    _cleanupMissions() {
        const currentTime = this.api.getElapsedTime();
        for (const [targetId, mission] of this.memory.missions.entries()) {
            // Assume missions take at most 30 seconds
            if (currentTime - mission.timeSent > 30) {
                this.memory.missions.delete(targetId);
                this.memory.targets.delete(targetId);
            }
        }
    }
}