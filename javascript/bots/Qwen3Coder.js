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
        // Find the most critical threat to address first.
        threatenedPlanets.sort((a, b) => {
            // Prioritize by threat score, then by strategic value (save valuable planets first).
            if (b.score !== a.score) return b.score - a.score;
            return this.api.calculatePlanetValue(b.planet) - this.api.calculatePlanetValue(a.planet);
        });
        const criticalThreat = threatenedPlanets[0];
        const myPlanetToSave = criticalThreat.planet;
        // Find our strongest, safest planet to send help from.
        const myPlanets = this.api.getMyPlanets();
        let helperPlanet = null;
        let bestHelperScore = -Infinity;
        for (const planet of myPlanets) {
            // Don't send help from the planet that's under threat!
            if (planet.id === myPlanetToSave.id) continue;
            const isThreatened = this.memory.threats[planet.id];
            // Don't send help from another threatened planet.
            if (isThreatened && isThreatened.score > planet.troops * 0.3) continue;
            const distance = this.api.getDistance(planet, myPlanetToSave);
            const timeToArrive = this.api.getTravelTime(planet, myPlanetToSave);
            // We must arrive before or at the same time as the attack to be effective.
            if (timeToArrive > criticalThreat.eta + 0.1) continue;
            // Score potential helper planets. Proximity and troop count are key.
            const helperValue = (planet.troops / distance);
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
                helperPlanet.troops - 1, // Leave 1 troop behind
                Math.max(0, criticalThreat.totalAmount * 1.2 - predictedState.troops)
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
        const strengthRatio = this.api.getMyStrengthRatio();
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
            // --- Vulnerability Modifier ---
            let vulnerability = 0;
            if (target.owner !== 'neutral') {
                // Enemy planets are more valuable if they are weak or undefended.
                vulnerability = Math.max(0, (target.troops / 2) - this.api.calculateThreat(target));
            } else {
                // Neutral planets are vulnerable by definition.
                vulnerability = target.troops;
            }
            // --- Distance/Frontier Modifier ---
            // Prefer targets closer to our existing territory.
            let minDistanceFromUs = Infinity;
            for (const myPlanet of myPlanets) {
                const dist = this.api.getDistance(myPlanet, target);
                if (dist < minDistanceFromUs) {
                    minDistanceFromUs = dist;
                }
            }
            const frontierBonus = 1 / (minDistanceFromUs / 100); // Higher score for closer planets.
            const totalScore = (value * 0.5) + (vulnerability * 0.3) + (frontierBonus * 0.2);
            return { planet: target, score: totalScore, distance: minDistanceFromUs };
        });
        scoredTargets.sort((a, b) => b.score - a.score);
        // --- Launch Attacks ---
        for (const { planet: target, distance: targetDistance } of scoredTargets) {
            // Check if we are already committed to taking this planet.
            if (this.memory.missions.has(target.id)) continue;
            // Find the best source planet for this target.
            let bestSource = null;
            let maxEffectiveTroops = 0;
            for (const source of myPlanets) {
                // Don't launch from a threatened planet unless it's an emergency.
                const isSourceThreatened = this.memory.threats[source.id];
                if (isSourceThreatened && isSourceThreatened.score > source.troops * 0.2) continue;
                const dist = this.api.getDistance(source, target);
                const travelTime = this.api.getTravelTime(source, target);
                // Predict the target's state when our fleet would arrive.
                const predictedState = this.api.predictPlanetState(target, travelTime);
                // We can only attack enemy/neutral planets.
                if (predictedState.owner !== 'neutral' && predictedState.owner !== this.playerId) {
                    // --- Attack Logic ---
                    // Send enough troops to overwhelm the predicted defense.
                    // Add a buffer based on our confidence (game phase and strength).
                    let buffer = 1.1;
                    if (this.memory.phase === 'LATE') buffer = 1.05; // Be more efficient in late game.
                    if (strengthRatio < 0.8) buffer = 1.3; // Be more cautious if we're losing.
                    const requiredTroops = Math.min(
                        source.troops - 1, // Leave 1 troop behind
                        Math.floor(predictedState.troops * buffer)
                    );
                    if (requiredTroops > 0 && requiredTroops < source.troops) {
                        // Evaluate the "effectiveness" of this source-target pair.
                        const effectiveness = requiredTroops / travelTime;
                        if (effectiveness > maxEffectiveTroops) {
                            maxEffectiveTroops = effectiveness;
                            bestSource = source;
                        }
                    }
                }
                else if (predictedState.owner === 'neutral') {
                    // --- Expansion Logic ---
                    const requiredTroops = Math.min(
                        source.troops - 1,
                        Math.floor(predictedState.troops * 1.1)
                    );
                    if (requiredTroops > 0 && requiredTroops < source.troops) {
                        const effectiveness = requiredTroops / travelTime;
                        if (effectiveness > maxEffectiveTroops) {
                            maxEffectiveTroops = effectiveness;
                            bestSource = source;
                        }
                    }
                }
            }
            if (bestSource) {
                const travelTime = this.api.getTravelTime(bestSource, target);
                const predictedState = this.api.predictPlanetState(target, travelTime);
                let finalTroopAmount;
                if (target.owner !== 'neutral' && target.owner !== this.playerId) {
                    let buffer = 1.1;
                    if (this.memory.phase === 'LATE') buffer = 1.05;
                    if (strengthRatio < 0.8) buffer = 1.3;
                    finalTroopAmount = Math.min(bestSource.troops - 1, Math.floor(predictedState.troops * buffer));
                } else {
                    finalTroopAmount = Math.min(bestSource.troops - 1, Math.floor(predictedState.troops * 1.1));
                }
                if (finalTroopAmount > 0) {
                    // Record this mission to avoid duplicate attacks.
                    this.memory.missions.set(target.id, {
                        type: target.owner === 'neutral' ? 'expand' : 'attack',
                        troopsCommitted: finalTroopAmount
                    });
                    this.log(`ATTACKING: Sending ${finalTroopAmount} troops from ${bestSource.id} to ${target.id} (predicted owner: ${predictedState.owner}).`);
                    return { from: bestSource, to: target, troops: finalTroopAmount };
                }
            }
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
        // Find planets with a large surplus of troops that are not on the front line.
        const safePlanetsWithSurplus = myPlanets.filter(planet => {
            const isThreatened = this.memory.threats[planet.id];
            return !isThreatened && planet.troops > planet.size * 2; // Arbitrary "large surplus" threshold
        });
        for (const source of safePlanetsWithSurplus) {
            // Send surplus to a nearby, valuable, and potentially threatened ally (or self) planet.
            const otherMyPlanets = myPlanets.filter(p => p.id !== source.id);
            let bestTarget = null;
            let bestScore = -Infinity;
            for (const target of otherMyPlanets) {
                if (source.id === target.id) continue;
                const distance = this.api.getDistance(source, target);
                const isTargetThreatened = this.memory.threats[target.id];
                // Prefer reinforcing our own threatened planets.
                let score = target.troops; // More troops on target -> more valuable to reinforce.
                if (isTargetThreatened) {
                    score *= 2; // Strongly prefer reinforcing threatened planets.
                }
                score *= (1 / distance); // Prefer closer targets.
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                }
            }
            if (bestTarget) {
                const amountToSend = Math.min(source.troops - Math.floor(source.size), Math.floor(source.troops * 0.3));
                if (amountToSend > 0) {
                    this.log(`OPTIMIZING: Reinforcing planet ${bestTarget.id} with ${amountToSend} troops from surplus on ${source.id}.`);
                    return { from: source, to: bestTarget, troops: amountToSend };
                }
            }
        }
        return null;
    }
}