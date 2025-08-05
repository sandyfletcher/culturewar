// =============================================
// root/javascript/bots/Qwen3Coder.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * A strategic bot that prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.
 * 1. Defensive Priority: Protects threatened planets.
 * 2. Value-based Expansion: Attacks high-value planets.
 * 3. Adaptive Playstyle: Switches between aggressive and conservative based on strength ratio.
 * 4. Production Optimization: Prioritizes capturing planets with good production rates.
 */
export default class Qwen3Coder extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        // Custom properties in memory for advanced state management
        this.memory.lastEvaluatedThreats = 0;
        this.memory.playerThreatLevels = {}; // { playerId: number }
    }

    /**
     * This method is called by the game engine every turn.
     * @param {number} dt - The time elapsed since the last decision, in game seconds.
     * @returns {object|null} A decision object { from, to, troops } or null to do nothing.
     */
    makeDecision(dt) {
        // Cooldown to prevent too many actions in a short time, making decisions more deliberate
        this.memory.actionCooldown -= dt;
        if (this.memory.actionCooldown > 0) {
            return null;
        }

        // Get the current state of my planets and the game phase
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }

        const gamePhase = this.api.getGamePhase();
        const myStrengthRatio = this.api.getMyStrengthRatio();

        // --- 1. DEFENSIVE LOGIC: Protect our planets under threat ---
        const defensiveAction = this._findDefensiveAction(myPlanets);
        if (defensiveAction) {
            this.memory.actionCooldown = 0.5; // Brief cooldown after a defensive move
            return defensiveAction;
        }

        // --- 2. OPPORTUNITY ATTACK LOGIC: Seize vulnerable planets ---
        const opportunisticAction = this._findOpportunisticAttack(myPlanets);
        if (opportunisticAction) {
            this.memory.actionCooldown = 0.75; // Slightly longer cooldown for opportunistic moves
            return opportunisticAction;
        }

        // --- 3. STRATEGIC EXPANSION LOGIC: Expand based on value and phase ---
        const expansionAction = this._findStrategicExpansion(myPlanets, gamePhase, myStrengthRatio);
        if (expansionAction) {
            this.memory.actionCooldown = 1.0; // Longer cooldown for major strategic moves
            return expansionAction;
        }

        // --- 4. PRODUCTION OPTIMIZATION: If nothing else, reinforce strong planets to grow production ---
        const optimizationAction = this._findProductionOptimization(myPlanets);
        if (optimizationAction) {
            this.memory.actionCooldown = 1.5; // Longest cooldown for optimization
            return optimizationAction;
        }

        // No action taken this turn
        return null;
    }

    /**
     * Finds the most urgent defensive action.
     * @param {Planet[]} myPlanets Our owned planets.
     * @returns {object|null} A defensive decision or null.
     */
    _findDefensiveAction(myPlanets) {
        for (const planet of myPlanets) {
            const threatScore = this.api.calculateThreat(planet);
            if (threatScore > 0) {
                // This planet is under threat. How much reinforcement is needed?
                const incomingAttacks = this.api.getIncomingAttacks(planet);
                let totalEnemyTroops = 0;
                for (const attack of incomingAttacks) {
                    totalEnemyTroops += attack.amount;
                }

                // If we are already sending reinforcements, don't double-send.
                let totalIncomingFriendlyTroops = 0;
                const incomingReinforcements = this.api.getIncomingReinforcements(planet);
                for (const reinforcement of incomingReinforcements) {
                    totalIncomingFriendlyTroops += reinforcement.amount;
                }

                const netDeficit = totalEnemyTroops - totalIncomingFriendlyTroops;
                if (netDeficit > 0) {
                    // We need to send more troops to defend.
                    // Find a nearby planet to send them from.
                    const myOtherPlanets = myPlanets.filter(p => p.id !== planet.id);
                    const donorPlanet = this.api.findNearestPlanet(planet, myOtherPlanets);
                    if (donorPlanet && donorPlanet.troops > netDeficit + 5) { // +5 as a safety buffer
                        this.log(`DEFENSE: Sending ${netDeficit + 5} troops to defend ${planet.id}`);
                        return {
                            from: donorPlanet,
                            to: planet,
                            troops: netDeficit + 5
                        };
                    }
                }
            }
        }
        return null;
    }

    /**
     * Looks for easy, undefended enemy planets to capture.
     * @param {Planet[]} myPlanets Our owned planets.
     * @returns {object|null} An opportunistic attack decision or null.
     */
    _findOpportunisticAttack(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        const vulnerablePlanets = enemyPlanets.filter(p => {
            // A planet is vulnerable if it has very few troops and no incoming friendly fleets
            // and is not expected to build up a large force before we can reach it.
            const incomingFriendly = this.api.getIncomingReinforcements(p);
            if (incomingFriendly.length > 0) return false; // Someone is already reinforcing it, likely not easy.

            const travelTime = this.api.getTravelTime(myPlanets[0], p); // approximate
            const predictedState = this.api.predictPlanetState(p, travelTime);
            
            // If it's predicted to be still weak when our fleet arrives, it's a good target.
            return predictedState.troops < 10 && predictedState.owner === p.owner; // Still owned by enemy
        });

        if (vulnerablePlanets.length > 0) {
            // Sort by how easy they are to take (lowest troops first)
            vulnerablePlanets.sort((a, b) => a.troops - b.troops);
            const target = vulnerablePlanets[0];

            // Find the best source planet to attack from
            const source = this._findBestSource(myPlanets, target, 15); // Send enough to take it with a small margin
            if (source) {
                this.log(`OPPORTUNITY: Attacking vulnerable planet ${target.id} from ${source.id}`);
                return {
                    from: source,
                    to: target,
                    troops: Math.min(source.troops - 1, target.troops + 5) // Leave 1 troop behind, send enough to win
                };
            }
        }
        return null;
    }

    /**
     * Finds a strategic expansion target based on phase and strength.
     * @param {Planet[]} myPlanets Our owned planets.
     * @param {string} gamePhase Current game phase ('EARLY', 'MID', 'LATE').
     * @param {number} myStrengthRatio Our strength relative to the strongest opponent.
     * @returns {object|null} An expansion decision or null.
     */
    _findStrategicExpansion(myPlanets, gamePhase, myStrengthRatio) {
        let potentialTargets = [];

        if (gamePhase === 'EARLY') {
            // In early game, focus on nearby, high-value neutral planets to establish a foothold.
            potentialTargets = this.api.getNeutralPlanets().filter(p => p.size > 15);
        } else {
            // In mid/late game, focus on enemy planets.
            potentialTargets = this.api.getEnemyPlanets();
        }

        // Score and sort targets
        const scoredTargets = potentialTargets.map(target => {
            const value = this.api.calculatePlanetValue(target);
            const nearestMyPlanet = this.api.findNearestPlanet(target, myPlanets);
            if (!nearestMyPlanet) return { target, score: -Infinity };

            const distance = this.api.getDistance(nearestMyPlanet, target);
            const travelTime = this.api.getTravelTime(nearestMyPlanet, target);
            
            // Predict if the planet will be easy to take when our fleet arrives
            const predictedState = this.api.predictPlanetState(target, travelTime);
            let effectiveTroopsToConquer = predictedState.troops;
            if(predictedState.owner !== target.owner) {
                effectiveTroopsToConquer = predictedState.troops; // It might be taken by someone else, risky.
            }

            // A good score is high value, low distance, and low effective troops
            const score = (value * 100) / (distance * (effectiveTroopsToConquer + 1));
            return { target, score, nearestMyPlanet, effectiveTroopsToConquer };
        }).filter(item => item.score > 0 && item.nearestMyPlanet.troops > item.effectiveTroopsToConquer + 5);

        scoredTargets.sort((a, b) => b.score - a.score);

        for (const item of scoredTargets) {
            const { target, nearestMyPlanet, effectiveTroopsToConquer } = item;
            // Check if we are strong enough for a major push, or if it's a safe, small expansion.
            const isSafePush = effectiveTroopsToConquer < 20;
            const isStrongPush = myStrengthRatio > 1.2;

            if (isSafePush || isStrongPush) {
                this.log(`EXPANSION: Attacking valued planet ${target.id} from ${nearestMyPlanet.id} (Score: ${item.score.toFixed(2)})`);
                return {
                    from: nearestMyPlanet,
                    to: target,
                    troops: Math.min(nearestMyPlanet.troops - 1, effectiveTroopsToConquer + 5)
                };
            }
        }
        return null;
    }

    /**
     * Finds an action to optimize our overall production, like reinforcing a strong production planet.
     * @param {Planet[]} myPlanets Our owned planets.
     * @returns {object|null} An optimization decision or null.
     */
    _findProductionOptimization(myPlanets) {
        // Find our strongest production planet
        const producers = myPlanets.filter(p => p.productionRate > 1.0);
        if (producers.length === 0) return null;

        producers.sort((a, b) => b.productionRate - a.productionRate);
        const keyProducer = producers[0];

        // If it's not under threat and has a lot of capacity, send it some troops to fill it up
        const threatScore = this.api.calculateThreat(keyProducer);
        if (threatScore === 0 && keyProducer.troops < this.api.getMaxPlanetTroops() * 0.8) {
            const donorPlanets = myPlanets.filter(p => p.id !== keyProducer.id && p.troops > 20);
            if (donorPlanets.length > 0) {
                const donor = donorPlanets[0]; // Simple choice
                const amountToSend = Math.min(30, donor.troops - 1);
                if (amountToSend > 0) {
                    this.log(`OPTIMIZATION: Reinforcing key producer ${keyProducer.id} from ${donor.id}`);
                    return {
                        from: donor,
                        to: keyProducer,
                        troops: amountToSend
                    };
                }
            }
        }
        return null;
    }

    /**
     * Helper to find the best source planet for an attack.
     * @param {Planet[]} myPlanets Our planets.
     * @param {Planet} target The target planet.
     * @param {number} requiredTroops Minimum troops needed for the attack.
     * @returns {Planet|null} The best source planet or null.
     */
    _findBestSource(myPlanets, target, requiredTroops) {
        const viableSources = myPlanets.filter(p => p.troops > requiredTroops);
        if (viableSources.length === 0) return null;

        // Prefer the closest one that has enough troops
        viableSources.sort((a, b) => this.api.getDistance(a, target) - this.api.getDistance(b, target));
        return viableSources[0];
    }
}