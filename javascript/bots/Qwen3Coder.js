// =============================================
// root/javascript/bots/Qwen3Coder.js - A high-performance AI for Galcon-like RTS
// =============================================

import BaseBot from './BaseBot.js';

/**
 * Strategos: A strategic, adaptive AI that excels through:
 * 1. Game phase awareness (Early, Mid, Late)
 * 2. Threat evaluation and defensive reinforcement
 * 3. Proactive expansion with value-based targeting
 * 4. Fleet management and mission tracking
 * 5. Adaptive playstyle based on relative strength
 */
export default class Qwen3Coder extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
    }
    /**
     * Core decision-making process. Called every turn.
     * @param {number} dt - Delta time.
     * @returns {object|null} Decision object or null.
     */
    makeDecision(dt) {
        this.updateMemory(); // Step 1: Update our internal state and perceptions.
        // Step 2: Defensive Imperative - React to immediate threats.
        const defensiveMove = this.evaluateDefensiveNeeds();
        if (defensiveMove) {
            return defensiveMove;
        }
        // Step 3: Offensive/Expansion Imperative - Plan attacks and expansions.
        const offensiveMove = this.evaluateOffensiveNeeds();
        if (offensiveMove) {
            return offensiveMove;
        }
        // Step 4: Optimization - Use surplus troops for consolidation.
        const optimizationMove = this.evaluateOptimization();
        if (optimizationMove) {
            return optimizationMove;
        }
        // No valid move found this turn.
        return null;
    }
    /**
     * Updates the bot's internal memory with current game state.
     * This includes the game phase, active threats, and ongoing missions.
     */
    updateMemory() {
        const currentPhase = this.api.getGamePhase();
        if (this.memory.phase !== currentPhase) {
            this.memory.phase = currentPhase;
        }
        // --- Update Threats ---
        // Clear old threat data.
        this.memory.threats = {};
        const myPlanets = this.api.getMyPlanets();
        for (const planet of myPlanets) {
            const threatScore = this.api.calculateThreat(planet);
            if (threatScore > planet.troops * 0.5) { // Threat is significant if it's >50% of our troops
                const incomingAttacks = this.api.getIncomingAttacks(planet);
                let totalThreatAmount = 0;
                let earliestETA = Infinity;
                for (const attack of incomingAttacks) {
                    totalThreatAmount += attack.amount;
                    if (attack.duration < earliestETA) {
                        earliestETA = attack.duration;
                    }
                }
                this.memory.threats[planet.id] = {
                    planet: planet,
                    score: threatScore,
                    totalAmount: totalThreatAmount,
                    eta: earliestETA
                };
            }
        }
        // --- Update Missions ---
        // Remove missions for completed or lost targets.
        for (const [targetId, mission] of this.memory.missions) {
            const targetPlanet = this.api.getPlanetById(targetId);
            if (!targetPlanet || targetPlanet.owner === this.playerId || mission.troopsCommitted <= 0) {
                this.memory.missions.delete(targetId);
            }
        }
    }
    /**
     * Evaluates if any of our planets are under significant threat and need reinforcement.
     * Prioritizes saving planets based on their strategic value and the urgency of the threat.
     * @returns {object|null} A defensive move object or null.
     */
    evaluateDefensiveNeeds() {
        const threatenedPlanets = Object.values(this.memory.threats);
        if (threatenedPlanets.length === 0) return null;
        
        threatenedPlanets.sort((a, b) => {
            // Prioritize by threat score, then by strategic value (save valuable planets first).
            if (b.score !== a.score) return b.score - a.score;
            return this.api.calculatePlanetValue(b.planet) - this.api.calculatePlanetValue(a.planet);
        });
        const criticalThreat = threatenedPlanets[0];
        const myPlanetToSave = criticalThreat.planet;
        
        let helperPlanet = null;
        let bestHelperScore = -Infinity;
        const myPlanets = this.api.getMyPlanets();
        for (const planet of myPlanets) {
            // Don't send help from the planet that's under threat!
            if (planet.id === myPlanetToSave.id) continue;
            const isThreatened = this.memory.threats[planet.id];
            // Don't send help from another threatened planet.
            if (isThreatened && isThreatened.score > planet.troops * 0.3) continue;
            
            const timeToArrive = this.api.getTravelTime(planet, myPlanetToSave);
            // We must arrive before or at the same time as the attack to be effective.
            if (timeToArrive > criticalThreat.eta + 0.1) continue;
            
            const helperValue = (planet.troops / this.api.getDistance(planet, myPlanetToSave));
            if (helperValue > bestHelperScore) {
                bestHelperScore = helperValue;
                helperPlanet = planet;
            }
        }
        if (helperPlanet) {
            // Send enough troops to not just defend, but to have a healthy surplus.
            // We aim to have 120% of the incoming threat after defense.
            const predictedState = this.api.predictPlanetState(myPlanetToSave, criticalThreat.eta);
            const neededTroops = Math.min(
                helperPlanet.troops - 1,
                Math.max(0, Math.ceil(criticalThreat.totalAmount * 1.2 - predictedState.troops))
            );
            if (neededTroops > 0) {
                this.log(`DEFENDING: Sending ${neededTroops} troops from ${helperPlanet.id} to threatened planet ${myPlanetToSave.id}.`);
                return { from: helperPlanet, to: myPlanetToSave, troops: neededTroops };
            }
        }
        return null;
    }
    /**
     * Evaluates offensive opportunities and expansion targets.
     * It prioritizes high-value targets, vulnerable enemies, and strategic chokepoints.
     * @returns {object|null} An offensive move object or null.
     */
    evaluateOffensiveNeeds() {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        // --- Target Selection ---
        
        let potentialTargets = [];
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        // In EARLY game, prioritize valuable, accessible neutrals for a strong start.
        if (this.memory.phase === 'EARLY') {
            potentialTargets = [...neutralPlanets, ...enemyPlanets];
        } else {
            // In MID/LATE game, prioritize enemies, then valuable neutrals.
            potentialTargets = [...enemyPlanets, ...neutralPlanets.filter(p => this.api.calculatePlanetValue(p) > 50)];
        }
        if (potentialTargets.length === 0) return null;
        // Score each target based on value, vulnerability, and our ability to take it.
        const scoredTargets = potentialTargets.map(target => {
            let value = this.api.calculatePlanetValue(target);
            let vulnerability = (target.owner !== 'neutral') ? Math.max(0, (target.troops / 2) - this.api.calculateThreat(target)) : target.troops;
            let minDistanceFromUs = Infinity;
            myPlanets.forEach(myPlanet => {
                minDistanceFromUs = Math.min(minDistanceFromUs, this.api.getDistance(myPlanet, target));
            });
            const frontierBonus = 1 / (minDistanceFromUs / 100);
            const totalScore = (value * 0.5) + (vulnerability * 0.3) + (frontierBonus * 0.2);
            return { planet: target, score: totalScore };
        });
        scoredTargets.sort((a, b) => b.score - a.score);

        // --- Simplified Launch Logic ---
        let bestMove = null;
        let bestEffectiveness = -Infinity;

        for (const { planet: target } of scoredTargets) {
            if (this.memory.missions.has(target.id)) continue;

            for (const source of myPlanets) {
                const isSourceThreatened = this.memory.threats[source.id];
                if (isSourceThreatened && isSourceThreatened.score > source.troops * 0.2) continue;

                const travelTime = this.api.getTravelTime(source, target);
                const predictedState = this.api.predictPlanetState(target, travelTime);

                if (predictedState.owner === this.playerId) continue;

                const strengthRatio = this.api.getMyStrengthRatio();
                let buffer = 1.1; // Default buffer
                if (this.memory.phase === 'LATE') buffer = 1.05;
                if (strengthRatio < 0.8) buffer = 1.3;

                const requiredTroops = Math.ceil(predictedState.troops * buffer) + 1;
                
                if (source.troops > requiredTroops) {
                    const effectiveness = requiredTroops / travelTime;
                    if (effectiveness > bestEffectiveness) {
                        bestEffectiveness = effectiveness;
                        bestMove = { from: source, to: target, troops: requiredTroops };
                    }
                }
            }
        }
        
        if (bestMove) {
            this.memory.missions.set(bestMove.to.id, {
                type: bestMove.to.owner === 'neutral' ? 'expand' : 'attack',
                troopsCommitted: bestMove.troops
            });
            this.log(`ATTACKING: Sending ${bestMove.troops} troops from ${bestMove.from.id} to ${bestMove.to.id}.`);
            return bestMove;
        }

        return null;
    }
    /**
     * Evaluates opportunities for optimizing troop distribution.
     * This includes reinforcing freshly taken planets, consolidating forces, or pushing to the front.
     * @returns {object|null} An optimization move object or null.
     */
    evaluateOptimization() {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length < 2) return null;
        
        const safePlanetsWithSurplus = myPlanets.filter(planet => {
            const isThreatened = this.memory.threats[planet.id];
            return !isThreatened && planet.troops > planet.size * 2;
        });

        for (const source of safePlanetsWithSurplus) {
            const otherMyPlanets = myPlanets.filter(p => p.id !== source.id);
            let bestTarget = null;
            let bestScore = -Infinity;
            for (const target of otherMyPlanets) {
                const isTargetThreatened = this.memory.threats[target.id];
                let score = target.troops;
                if (isTargetThreatened) score *= 2;
                score /= this.api.getDistance(source, target);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                }
            }

            if (bestTarget) {
                const amountToSend = Math.floor(source.troops * 0.3);
                if (amountToSend > 0) {
                    this.log(`OPTIMIZING: Reinforcing planet ${bestTarget.id} with ${amountToSend} troops from surplus on ${source.id}.`);
                    return { from: source, to: bestTarget, troops: amountToSend };
                }
            }
        }
        return null;
    }
}