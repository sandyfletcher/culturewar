// =============================================
// root/javascript/bots/Gemini25ProA.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * AegisBot employs a balanced, phase-aware strategy that prioritizes robust defense and calculated aggression.
 * 
 * Core Strategic Pillars:
 * 1.  Defense First: The bot's highest priority is to defend its planets. It uses the `predictPlanetState` API to foresee
 *     threats and dispatches the precise number of troops required for reinforcement, ensuring they arrive before the enemy.
 * 2.  Phase-Adaptive Logic: Its behavior changes with the game's phase (`EARLY`, `MID`, `LATE`).
 *     - EARLY Game: Focuses on rapid, efficient expansion by capturing the most valuable and easily defended neutral planets.
 *     - MID Game: Shifts to a more aggressive posture, identifying the strongest opponent and launching calculated attacks on
 *       their key strategic planets, while continuing to defend and expand opportunistically.
 *     - LATE Game: Aims to secure victory either through a decisive final assault if stronger, or by consolidating forces
 *       to win on planet count if the timer is low.
 * 3.  Calculated Offense: Attacks are not random. The bot targets the strongest opponent and uses `predictPlanetState` to
 *     determine the exact troop count needed for a successful conquest, minimizing waste. Targets are chosen based on a
 *     cost-benefit analysis (planet value vs. cost to capture).
 * 4.  Efficient Resource Management: If no immediate defensive or offensive actions are available, the bot consolidates its
 *     forces, moving troops from safe, overstocked rear planets to strategically important frontline planets.
 */
export default class Gemini25ProA extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
    }

    /**
     * This method is called by the game engine every turn.
     * @param {number} dt - The time elapsed since the last decision, in game seconds.
     * @returns {object|null} A decision object or null.
     */
    makeDecision(dt) {
        // --- 1. Cooldown & Initialization ---
        this.memory.actionCooldown -= dt;
        if (this.memory.actionCooldown > 0) {
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left, nothing to do.
        }

        // Create a mutable "virtual" state of our planets for this turn's planning.
        // This prevents assigning the same troops to multiple tasks in a single decision cycle.
        const virtualPlanets = new Map(myPlanets.map(p => [p.id, { ...p }]));

        // --- 2. Information Gathering & Strategic Context ---
        const gamePhase = this.api.getGamePhase();
        const opponentIds = this.api.getOpponentIds();
        const strongestOpponent = this.getStrongestOpponent(opponentIds);

        // --- 3. Decision Making Priority Queue ---
        let decision = null;

        // Priority 1: Defend Planets Under Attack
        decision = this.findDefenseMove(virtualPlanets);
        if (decision) {
            this.setCooldown();
            return decision;
        }

        // Priority 2: Strategic Offense (Attack Players)
        // More important in mid/late game, or if few neutrals are left.
        const isTimeForWar = gamePhase !== 'EARLY' || this.api.getNeutralPlanets().length < 3;
        if (isTimeForWar) {
            decision = this.findAttackMove(virtualPlanets, strongestOpponent);
            if (decision) {
                this.setCooldown();
                return decision;
            }
        }
        
        // Priority 3: Expansion (Capture Neutrals)
        // Most important in early game.
        decision = this.findExpansionMove(virtualPlanets);
        if (decision) {
            this.setCooldown();
            return decision;
        }

        // Priority 4: Consolidate Forces
        // If nothing else to do, improve troop distribution.
        if (gamePhase !== 'EARLY') {
            decision = this.findConsolidationMove(virtualPlanets);
            if (decision) {
                this.setCooldown();
                return decision;
            }
        }

        return null;
    }

    // =============================================
    // === STRATEGIC HELPER METHODS ===
    // =============================================

    /**
     * Sets the action cooldown to prevent the bot from acting too frequently.
     */
    setCooldown() {
        // Use the API's cooldown + a small buffer for safety.
        this.memory.actionCooldown = this.api.getDecisionCooldown() * 1.1;
    }

    /**
     * Identifies the strongest active opponent based on production, then total troops.
     * @param {string[]} opponentIds - An array of opponent IDs.
     * @returns {object|null} The stats object of the strongest opponent.
     */
    getStrongestOpponent(opponentIds) {
        if (!opponentIds || opponentIds.length === 0) return null;
        
        const opponentStats = opponentIds
            .map(id => this.api.getPlayerStats(id))
            .filter(stats => stats && stats.isActive);

        if (opponentStats.length === 0) return null;

        opponentStats.sort((a, b) => {
            if (b.totalProduction !== a.totalProduction) {
                return b.totalProduction - a.totalProduction;
            }
            return b.totalTroops - a.totalTroops;
        });

        return opponentStats[0];
    }

    /**
     * Finds critical defensive moves to save planets from being conquered.
     * @param {Map<string, object>} virtualPlanets - A map of our mutable planet states for planning.
     * @returns {object|null} A decision object for reinforcement, or null.
     */
    findDefenseMove(virtualPlanets) {
        let threatenedPlanets = [];

        for (const myPlanet of virtualPlanets.values()) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            // Sort attacks by arrival time to handle the most imminent threat first.
            incomingAttacks.sort((a, b) => a.duration - b.duration);

            const earliestAttack = incomingAttacks[0];
            const arrivalTime = earliestAttack.duration;

            // Predict the state right after the earliest attack hits.
            const predictedState = this.api.predictPlanetState(myPlanet, arrivalTime + 0.01);

            if (predictedState.owner !== this.playerId) {
                // This attack is fatal! Calculate how many troops we were short by.
                const troopsDeficit = predictedState.troops + 1;
                threatenedPlanets.push({
                    planetToSave: myPlanet,
                    deficit: troopsDeficit,
                    deadline: arrivalTime,
                });
            }
        }
        
        if (threatenedPlanets.length === 0) return null;

        // Prioritize saving the planet with the earliest deadline.
        threatenedPlanets.sort((a, b) => a.deadline - b.deadline);

        for (const threat of threatenedPlanets) {
            const { planetToSave, deficit, deadline } = threat;
            
            const potentialSources = Array.from(virtualPlanets.values())
                .filter(p => p.id !== planetToSave.id) // Can't reinforce from itself
                .map(p => {
                    const sourcePlanetAPI = this.api.getPlanetById(p.id);
                    const travelTime = this.api.getTravelTime(sourcePlanetAPI, planetToSave);
                    
                    // Can't make it in time or doesn't have enough spare troops.
                    const spareTroops = p.troops - (p.size * 1.5); // Keep a defensive buffer
                    if (travelTime >= deadline || spareTroops < deficit) return null;

                    return { source: p, score: 1 / travelTime }; // Closer planets are better.
                })
                .filter(s => s !== null);

            if (potentialSources.length > 0) {
                potentialSources.sort((a, b) => b.score - a.score); // Pick the best (closest) source.
                const bestSource = potentialSources[0].source;
                const troopsToSend = Math.ceil(deficit);

                virtualPlanets.get(bestSource.id).troops -= troopsToSend;
                return {
                    from: this.api.getPlanetById(bestSource.id),
                    to: this.api.getPlanetById(planetToSave.id),
                    troops: troopsToSend,
                };
            }
        }
        return null; // No planet could be found to send reinforcements in time.
    }

    /**
     * Finds the best neutral planet to capture for expansion.
     * @param {Map<string, object>} virtualPlanets - A map of our mutable planet states.
     * @returns {object|null} A decision object for expansion, or null.
     */
    findExpansionMove(virtualPlanets) {
        let neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return null;

        const allFleetTargets = new Set(this.api.getAllTroopMovements().map(f => f.to.id));
        neutralPlanets = neutralPlanets.filter(p => !allFleetTargets.has(p.id)); // Ignore already-targeted planets.

        let bestOption = null;

        for (const target of neutralPlanets) {
            const troopsNeeded = target.troops + 1;

            for (const source of virtualPlanets.values()) {
                const availableTroops = source.troops - (source.size); // Leave a small buffer
                if (availableTroops >= troopsNeeded) {
                    const travelTime = this.api.getTravelTime(source, target);
                    // Score: value of planet / cost (time * troops)
                    const value = this.api.calculatePlanetValue(target);
                    const score = value / (travelTime * troopsNeeded);

                    if (!bestOption || score > bestOption.score) {
                        bestOption = { source, target, troops: troopsNeeded, score };
                    }
                }
            }
        }
        
        if (bestOption) {
            virtualPlanets.get(bestOption.source.id).troops -= bestOption.troops;
            return {
                from: this.api.getPlanetById(bestOption.source.id),
                to: bestOption.target,
                troops: Math.ceil(bestOption.troops),
            };
        }
        return null;
    }
    
    /**
     * Finds the best enemy planet to attack.
     * @param {Map<string, object>} virtualPlanets - A map of our mutable planet states.
     * @param {object|null} targetPlayer - The stats object of the player to attack.
     * @returns {object|null} A decision object for an attack, or null.
     */
    findAttackMove(virtualPlanets, targetPlayer) {
        if (!targetPlayer) return null;
        
        // Don't attack if we are significantly weaker, unless it's late game.
        if (this.api.getMyStrengthRatio() < 0.8 && this.api.getGamePhase() === 'MID') {
            return null;
        }

        const enemyPlanets = this.api.getEnemyPlanets().filter(p => p.owner === targetPlayer.id);
        if (enemyPlanets.length === 0) return null;

        let bestAttack = null;

        for (const target of enemyPlanets) {
            for (const source of virtualPlanets.values()) {
                const travelTime = this.api.getTravelTime(source, target);
                const predictedState = this.api.predictPlanetState(target, travelTime);

                if (predictedState.owner === this.playerId) continue; // We're already going to own it.

                const troopsNeeded = predictedState.troops + 2; // Need to beat their garrison, +1 for buffer.
                const defensiveBuffer = source.size * 2;
                const availableTroops = source.troops - defensiveBuffer;

                if (availableTroops > troopsNeeded) {
                    const value = this.api.calculatePlanetValue(target);
                    const cost = troopsNeeded * travelTime;
                    const score = value / cost;
                    
                    if (!bestAttack || score > bestAttack.score) {
                        bestAttack = { source, target, troops: troopsNeeded, score };
                    }
                }
            }
        }

        if (bestAttack) {
            virtualPlanets.get(bestAttack.source.id).troops -= bestAttack.troops;
            return {
                from: this.api.getPlanetById(bestAttack.source.id),
                to: bestAttack.target,
                troops: Math.ceil(bestAttack.troops),
            };
        }
        return null;
    }

    /**
     * Finds opportunities to consolidate forces by moving troops from safe planets to frontline planets.
     * @param {Map<string, object>} virtualPlanets - A map of our mutable planet states.
     * @returns {object|null} A decision object for consolidation, or null.
     */
    findConsolidationMove(virtualPlanets) {
        const myPlanetList = Array.from(virtualPlanets.values());
        if (myPlanetList.length < 2) return null;

        // Find safe planets with a surplus of troops.
        const potentialSources = myPlanetList
            .filter(p => {
                const threat = this.api.calculateThreat(p);
                // "Safe" means low threat and not on the immediate front line.
                const nearestEnemyDist = this.api.getNearestEnemyPlanet(p) ? this.api.getDistance(p, this.api.getNearestEnemyPlanet(p)) : Infinity;
                return threat < 0.1 && nearestEnemyDist > 150;
            })
            .map(p => ({ planet: p, excessTroops: p.troops - (p.size * 3) })) // Buffer of 3x size
            .filter(item => item.excessTroops > 10)
            .sort((a, b) => b.excessTroops - a.excessTroops);

        if (potentialSources.length === 0) return null;
        
        // Find important frontline planets that need reinforcement.
        const potentialDests = myPlanetList
            .filter(p => {
                // "Frontline" means an enemy is relatively close.
                const nearestEnemy = this.api.getNearestEnemyPlanet(p);
                return nearestEnemy && this.api.getDistance(p, nearestEnemy) < 300;
            })
            .sort((a, b) => this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a));

        if (potentialDests.length === 0) return null;

        const sourceData = potentialSources[0]; // Take the safest, most overstocked planet.
        // Find a destination that is not the source itself.
        const destData = potentialDests.find(d => d.id !== sourceData.planet.id);

        if (destData) {
            const troopsToSend = Math.floor(sourceData.excessTroops * 0.75); // Send 75% of the excess.
            if (troopsToSend > 0) {
                virtualPlanets.get(sourceData.planet.id).troops -= troopsToSend;
                return {
                    from: this.api.getPlanetById(sourceData.planet.id),
                    to: this.api.getPlanetById(destData.id),
                    troops: troopsToSend,
                };
            }
        }
        
        return null;
    }
}