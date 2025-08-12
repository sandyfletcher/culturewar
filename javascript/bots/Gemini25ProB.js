// =============================================
// root/javascript/bots/Gemini25ProB.js
// =============================================

// =============================================
// root/javascript/bots/Gemini25ProB.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * TitanBot employs a phased strategy of calculated aggression to achieve resource supremacy and opponent annihilation.
 * 
 * Core Pillars:
 * 1.  **Phased Strategy:** Adapts its priorities based on the game phase ('EARLY', 'MID', 'LATE').
 *     - EARLY: Focuses on rapid, efficient expansion to secure a strong production base.
 *     - MID: Identifies the greatest threat and systematically dismantles their economy with precise, overwhelming attacks.
 *     - LATE: Consolidates forces for a final decisive blow or secures a win by planet count.
 * 2.  **Calculated Precision:** Uses `predictPlanetState` to determine the *exact* number of troops needed for an attack or defense, minimizing waste. A small safety margin is added to ensure success.
 * 3.  **Value-Driven Decisions:** Every potential action (attack, expand, reinforce, consolidate) is scored based on its strategic value, cost, and potential return on investment. Only the highest-scoring action is taken each turn.
 * 4.  **Task Management:** Uses internal memory to track which planets are already assigned a mission, preventing over-commitment and enabling coordinated, multi-pronged strategies.
 */
export default class Gemini25ProB extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        // Keeps track of which planets are already tasked to prevent re-issuing orders.
        // Format: { "p-1": { type: 'attack', targetId: 'p-5' }, ... }
        this.memory.assignedTasks = {};
    }

    /**
     * This method is called by the game engine when it's your turn.
     * @param {number} dt - The time elapsed since the last turn, scaled by game speed.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // Surrender.
        }

        // --- Strategic Analysis & Decision Making ---

        // 1. Update internal state
        this._updateMemory(myPlanets);
        const availablePlanets = myPlanets.filter(p => !this.memory.assignedTasks[p.id] && p.troops > 1);

        // 2. Gather intelligence
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const gamePhase = this.api.getGamePhase();
        const myStrengthRatio = this.api.getMyStrengthRatio();

        // 3. Generate and score all possible moves
        let potentialActions = [];
        potentialActions.push(...this._findDefensiveMoves(myPlanets));
        potentialActions.push(...this._findExpansionMoves(availablePlanets, neutralPlanets, gamePhase));
        potentialActions.push(...this._findOffensiveMoves(availablePlanets, enemyPlanets, myStrengthRatio));
        potentialActions.push(...this._findConsolidationMoves(availablePlanets, myPlanets));

        if (potentialActions.length === 0) {
            return null;
        }

        // 4. Select the best action based on score
        potentialActions.sort((a, b) => b.score - a.score);
        const bestAction = potentialActions[0];

        // 5. Execute the action
        if (bestAction && bestAction.score > 0) {
            // Commit to the action
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            this.memory.assignedTasks[bestAction.fromId] = {
                type: bestAction.type,
                targetId: bestAction.toId
            };

            return {
                fromId: bestAction.fromId,
                toId: bestAction.toId,
                troops: bestAction.troops
            };
        }

        return null;
    }

    // =============================================
    // PRIVATE HELPER & STRATEGY METHODS
    // =============================================

    /**
     * Finds critical defensive reinforcements. This is the highest priority.
     * A planet needs help if a future prediction shows it will be lost.
     */
    _findDefensiveMoves(myPlanets) {
        const actions = [];
        const myId = this.api.getMyId();

        for (const planet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length === 0) continue;

            // Find the attack that will arrive first
            const firstAttack = incomingAttacks.sort((a, b) => a.duration - b.duration)[0];
            const timeToImpact = firstAttack.duration;

            const predictedState = this.api.predictPlanetState(planet, timeToImpact);

            // If we are predicted to lose the planet
            if (predictedState.owner !== myId) {
                const troopsNeeded = Math.ceil(Math.abs(predictedState.troops)) + 5; // 5 troops safety margin

                // Find the best planet to send reinforcements from
                const potentialReinforcers = myPlanets
                    .filter(p => p.id !== planet.id && p.troops > troopsNeeded)
                    .map(p => ({
                        planet: p,
                        travelTime: this.api.getTravelTime(p, planet)
                    }))
                    .filter(p => p.travelTime < timeToImpact); // Must arrive in time!

                if (potentialReinforcers.length > 0) {
                    potentialReinforcers.sort((a, b) => a.travelTime - b.travelTime);
                    const bestReinforcer = potentialReinforcers[0];

                    actions.push({
                        type: 'defend',
                        fromId: bestReinforcer.planet.id,
                        toId: planet.id,
                        troops: troopsNeeded,
                        score: 1000 + planet.size // Extremely high score to prioritize saving planets
                    });
                }
            }
        }
        return actions;
    }
    
    /**
     * Finds opportunities to capture neutral planets.
     * Focus is on high-value, low-cost targets. Prioritized in early game.
     */
    _findExpansionMoves(availablePlanets, neutralPlanets, gamePhase) {
        if (neutralPlanets.length === 0 || availablePlanets.length === 0) return [];

        const actions = [];
        const expansionUrgency = (gamePhase === 'EARLY') ? 1.5 : 0.5;

        for (const target of neutralPlanets) {
            const source = this.api.findNearestPlanet(target, availablePlanets);
            if (!source) continue;

            const travelTime = this.api.getTravelTime(source, target);
            // predictPlanetState handles incoming fleets to the neutral planet
            const predictedState = this.api.predictPlanetState(target, travelTime);
            
            // Only attack if it's still neutral upon arrival
            if (predictedState.owner === 'neutral') {
                const troopsNeeded = Math.ceil(predictedState.troops) + 1;

                if (source.troops > troopsNeeded) {
                    const value = this._calculatePlanetValue(target);
                    const score = (value * expansionUrgency) / (troopsNeeded + travelTime * 2);
                    actions.push({
                        type: 'expand',
                        fromId: source.id,
                        toId: target.id,
                        troops: troopsNeeded,
                        score: score
                    });
                }
            }
        }
        return actions;
    }

    /**
     * Finds viable attacks against enemy planets.
     * Prioritizes valuable, weakly defended targets.
     */
    _findOffensiveMoves(availablePlanets, enemyPlanets, myStrengthRatio) {
        if (enemyPlanets.length === 0 || availablePlanets.length === 0) return [];
        
        // Don't be aggressive if significantly weaker, unless it's a snipe
        if (myStrengthRatio < 0.75) return [];

        const actions = [];
        const myId = this.api.getMyId();

        for (const target of enemyPlanets) {
            for (const source of availablePlanets) {
                const travelTime = this.api.getTravelTime(source, target);
                const predictedState = this.api.predictPlanetState(target, travelTime);

                // Check if we can conquer it
                if (predictedState.owner !== myId) {
                    const troopsNeeded = Math.ceil(predictedState.troops) + 3; // 3 troops safety margin
                    const troopsAvailable = Math.floor(source.troops * 0.85); // Don't send all troops

                    if (troopsAvailable > troopsNeeded) {
                        const value = this._calculatePlanetValue(target);
                        // Score based on value, inversely proportional to cost and travel time
                        const score = value / (troopsNeeded + travelTime);
                        actions.push({
                            type: 'attack',
                            fromId: source.id,
                            toId: target.id,
                            troops: troopsNeeded,
                            score: score
                        });
                    }
                }
            }
        }
        return actions;
    }

    /**
     * Moves troops from safe, over-supplied "rear" planets to more critical "frontline" planets.
     * This is a low-priority "housekeeping" task.
     */
    _findConsolidationMoves(availablePlanets, myPlanets) {
        if (myPlanets.length < 2) return [];

        const actions = [];
        const frontlinePlanets = myPlanets.filter(p => this.api.calculateThreat(p) > 0 || this._isFrontline(p));
        const rearPlanets = availablePlanets.filter(p => p.troops > 100 && !frontlinePlanets.find(fp => fp.id === p.id));
        
        if (frontlinePlanets.length === 0 || rearPlanets.length === 0) return [];

        for (const source of rearPlanets) {
            // Find nearest frontline planet to send troops to
            const target = this.api.findNearestPlanet(source, frontlinePlanets);
            if (target) {
                // Send a significant chunk of troops, but leave some behind
                const troopsToSend = Math.floor(source.troops * 0.75);
                const travelTime = this.api.getTravelTime(source, target);
                
                // Low score, so it only happens when nothing else is better
                const score = 10 / travelTime; 

                actions.push({
                    type: 'consolidate',
                    fromId: source.id,
                    toId: target.id,
                    troops: troopsToSend,
                    score: score
                });
            }
        }
        return actions;
    }

    /**
     * Calculates a strategic value for a planet.
     */
    _calculatePlanetValue(planet) {
        // Using the built-in helper as a base, but could be customized
        return this.api.calculatePlanetValue(planet);
    }
    
    /**
     * Determines if a planet is on the "frontline" by checking for nearby enemies.
     */
    _isFrontline(planet) {
        const nearestEnemy = this.api.getNearestEnemyPlanet(planet);
        if (!nearestEnemy) return false;
        
        const distance = this.api.getDistance(planet, nearestEnemy);
        // A planet is frontline if an enemy is within 1/4 of the map width
        return distance < (this.api.getMapInfo().width / 4);
    }

    /**
     * Cleans up the task list, removing assignments for planets that are no longer owned.
     */
    _updateMemory(myPlanets) {
        const myPlanetIds = new Set(myPlanets.map(p => p.id));
        for (const planetId in this.memory.assignedTasks) {
            if (!myPlanetIds.has(planetId)) {
                delete this.memory.assignedTasks[planetId];
            }
        }
    }
}