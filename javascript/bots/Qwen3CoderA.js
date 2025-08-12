// =============================================
// root/javascript/bots/Qwen3CoderA.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * The Dominator AI Bot - A strategic, adaptive RTS commander.
 * Core Strategy: Rapid expansion, predictive attacks, and phase-based dominance.
 * Detailed: Dominator focuses on macro-management, identifying high-value planets,
 * predicting future states for optimal attacks, and efficiently managing its fleet
 * to out-produce and overwhelm opponents. It adapts its aggression and tactics
 * based on its relative strength and the game phase.
 */

export default class Qwen3CoderA extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // Persistent memory for mission tracking and strategic state.
        this.memory.missions = new Map(); // Maps target planet ID to mission details
        this.memory.actionCooldown = 0;
    }

    /**
     * Main decision-making method, called by the game engine on bot's turn.
     * @param {number} dt - Scaled time elapsed since last decision.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        // Cooldown management as an optimization.
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // Game over for this bot.
        }

        // --- Strategic Analysis and Decision Engine ---

        const gamePhase = this.api.getGamePhase();
        const myStrengthRatio = this.api.getMyStrengthRatio();
        const isWinning = myStrengthRatio > 1.0;

        // 1. Clean up completed or obsolete missions
        this._updateMissions();

        // 2. Defend: High-priority response to threats
        const defensiveMove = this._findDefensiveMove();
        if (defensiveMove) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return defensiveMove;
        }

        // 3. Expand: Capture high-value neutral planets early and mid-game
        if (gamePhase !== 'LATE') {
            const expansionMove = this._findExpansionMove();
            if (expansionMove) {
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return expansionMove;
            }
        }

        // 4. Attack: Proactively eliminate opponents
        const attackMove = this._findStrategicAttackMove();
        if (attackMove) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return attackMove;
        }

        // 5. Consolidate: Reinforce key planets if no other action is better
        if (isWinning) {
            const consolidationMove = this._findConsolidationMove();
            if (consolidationMove) {
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                return consolidationMove;
            }
        }

        return null; // No high-impact move available this turn.
    }

    /**
     * Cleans up the mission list, removing those that are no longer relevant.
     */
    _updateMissions() {
        for (const [targetId, mission] of this.memory.missions) {
            const targetPlanet = this.api.getPlanetById(targetId);
            // If the planet is now ours, the mission is complete.
            if (targetPlanet.owner === this.playerId) {
                this.memory.missions.delete(targetId);
                continue;
            }
            // If the planet is neutral, the mission might be outdated.
            // We'll re-evaluate it on the next attack cycle.
            if (targetPlanet.owner === 'neutral') {
                this.memory.missions.delete(targetId);
            }
        }
    }

    /**
     * Identifies and responds to imminent attacks on our planets.
     * @returns {object|null} A defensive move or null.
     */
    _findDefensiveMove() {
        const myPlanets = this.api.getMyPlanets();
        for (const planet of myPlanets) {
            const predictedState = this.api.predictPlanetState(planet, 10); // Predict a few seconds ahead
            const isUnderThreat = predictedState.owner !== this.playerId || predictedState.troops < planet.troops * 0.3;
            
            if (isUnderThreat) {
                // Find nearest friendly planet to send reinforcements
                const friendlyPlanets = this.api.getMyPlanets().filter(p => p.id !== planet.id && p.troops > 20);
                const nearestFriendly = this.api.findNearestPlanet(planet, friendlyPlanets);
                
                if (nearestFriendly) {
                    // Send enough troops to recapture and hold, with a buffer
                    const currentDefenders = planet.troops;
                    const incomingAttackers = this.api.getIncomingAttacks(planet).reduce((sum, fleet) => sum + fleet.amount, 0);
                    const troopsNeeded = incomingAttackers - currentDefenders + 20; // +20 buffer
                    
                    if (nearestFriendly.troops > troopsNeeded) {
                        return {
                            fromId: nearestFriendly.id,
                            toId: planet.id,
                            troops: Math.min(nearestFriendly.troops - 1, troopsNeeded)
                        };
                    }
                }
            }
        }
        return null;
    }

    /**
     * Identifies the best neutral planet to capture for expansion.
     * @returns {object|null} An expansion move or null.
     */
    _findExpansionMove() {
        const myPlanets = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();

        if (myPlanets.length === 0 || neutralPlanets.length === 0) {
            return null;
        }

        let bestCandidate = null;
        let bestValue = -Infinity;

        for (const neutral of neutralPlanets) {
            const nearestMyPlanet = this.api.findNearestPlanet(neutral, myPlanets.filter(p => p.troops > 10));
            if (!nearestMyPlanet) continue;

            const distance = this.api.getDistance(nearestMyPlanet, neutral);
            const travelTime = this.api.getTravelTime(nearestMyPlanet, neutral);
            
            // Custom value function prioritizing production, centrality, and proximity
            const value = (neutral.size * 0.5 + this.api.getPlanetProductionRate(neutral) * 2 + this.api.getPlanetCentrality(neutral) * 3) / (distance * 0.01 + 1);

            if (value > bestValue) {
                const futureState = this.api.predictPlanetState(neutral, travelTime);
                if (futureState.owner === 'neutral' && futureState.troops < nearestMyPlanet.troops * 0.8) {
                    bestValue = value;
                    bestCandidate = { source: nearestMyPlanet, target: neutral, futureTroops: futureState.troops };
                }
            }
        }

        if (bestCandidate) {
            // Send enough to conquer plus a small garrison
            const troopsToSend = Math.min(Math.floor(bestCandidate.source.troops * 0.8), Math.floor(bestCandidate.futureTroops) + 5);
            if (troopsToSend > 0) {
                return {
                    fromId: bestCandidate.source.id,
                    toId: bestCandidate.target.id,
                    troops: troopsToSend
                };
            }
        }

        return null;
    }

    /**
     * Finds a high-impact offensive move against an enemy.
     * @returns {object|null} An attack move or null.
     */
    _findStrategicAttackMove() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();

        let bestTarget = null;
        let highestPriority = -Infinity;

        for (const enemy of enemyPlanets) {
            // Skip if already a high-priority mission to take it
            if (this.memory.missions.has(enemy.id)) continue;

            const nearestMyPlanets = myPlanets.filter(p => p.troops > 15);

            if (nearestMyPlanets.length === 0) continue;

            // Priority: High production, central location, and weakened state
            const travelTime = this.api.getTravelTime(nearestMyPlanets[0], enemy); // rough estimate
            const predictedState = this.api.predictPlanetState(enemy, travelTime);
            
            if (predictedState.owner !== this.playerId) { // Still enemy
                const priority = this.api.getPlanetProductionRate(enemy) * 3 + this.api.getPlanetCentrality(enemy) * 2 - predictedState.troops * 0.1;
                if (priority > highestPriority) {
                    highestPriority = priority;
                    bestTarget = { planet: enemy, predictedTroops: predictedState.troops };
                }
            }
        }

        if (bestTarget) {
            const sourcePlanet = this.api.findNearestPlanet(bestTarget.planet, myPlanets.filter(p => p.troops > bestTarget.predictedTroops + 10));
            if (sourcePlanet) {
                const requiredTroops = Math.floor(bestTarget.predictedTroops) + 8; // +8 buffer for safety
                if (sourcePlanet.troops > requiredTroops) {
                    // Record this mission to avoid over-committing
                    this.memory.missions.set(bestTarget.planet.id, { targetId: bestTarget.planet.id, sourceId: sourcePlanet.id });
                    return {
                        fromId: sourcePlanet.id,
                        toId: bestTarget.planet.id,
                        troops: requiredTroops
                    };
                }
            }
        }

        return null;
    }

    /**
     * Reinforces strong planets to build an unstoppable force.
     * @returns {object|null} A consolidation move or null.
     */
    _findConsolidationMove() {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length < 2) return null;

        // Find our strongest planet
        const strongest = myPlanets.reduce((max, planet) => (planet.troops > max.troops ? planet : max), myPlanets[0]);
        // Find a weaker, nearby planet to reinforce
        const targets = myPlanets.filter(p => p.id !== strongest.id && p.troops < strongest.troops * 0.7);
        
        if (targets.length > 0) {
            const target = this.api.findNearestPlanet(strongest, targets);
            if (target && strongest.troops > 50) {
                const troopsToSend = Math.min(Math.floor(strongest.troops * 0.3), 100);
                return {
                    fromId: strongest.id,
                    toId: target.id,
                    troops: troopsToSend
                };
            }
        }

        return null;
    }
}