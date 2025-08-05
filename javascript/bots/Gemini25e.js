// ===========================================================
// root/javascript/bots/Gemini25e.js
// ===========================================================

import BaseBot from './BaseBot.js';

/**
 * @description
 * An AI bot with a "long-term value investor" philosophy.
 * It operates in distinct phases, prioritizing high-value targets and strategic consolidation.
 * 
 * Core Principles:
 * 1.  **ROI-Driven Offense:** Evaluates attacks based on the strategic value of the target versus the cost in troops and time.
 * 2.  **Asset Protection:** Prioritizes the defense of its most valuable planets.
 * 3.  **Dynamic Phasing:** Adjusts its strategy as the game progresses from expansion to consolidation to aggressive elimination.
 * 4.  **Strategic Consolidation:** Redistributes troops from safe, non-productive planets to high-value, frontline assets.
 */
export default class Gemini25e extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);

        // --- STRATEGIC CONSTANTS ---
        this.DEFENSIVE_BUFFER = 10;
        this.ATTACK_TROOP_PERCENTAGE = 0.80; // The percentage of a planet's troops to send when launching a major attack.
        this.CONSOLIDATION_TROOP_PERCENTAGE = 0.60; // The percentage of troops to send when consolidating forces.
        this.CONSOLIDATION_FULL_THRESHOLD = 0.8; // A planet is considered "full" and a candidate for consolidation if its troop count exceeds this percentage of the max.
        this.CONSOLIDATION_SAFE_DISTANCE = 350; // A planet is considered "safe" for consolidation if it's at least this far from the nearest enemy.

        // --- MEMORY & DYNAMIC STATE ---
        this.memory.phase = 'EARLY';
        this.memory.strongestOpponent = null;
        this.memory.lastOpponentCheck = 0;

        // Calculate phase thresholds dynamically using the new API method
        const gameDuration = this.api.getGameDuration();
        this.memory.earlyGameEndTime = gameDuration * 0.33;
        this.memory.midGameEndTime = gameDuration * 0.66;
    }

    /**
     * The main decision-making function, called each turn.
     * It follows a strict priority order: Defense -> Offense -> Consolidation.
     */
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // I have been eliminated.
        }

        // 1. Analyze the current game state to inform strategy.
        this.updateGamePhase();
        this.updateStrongestOpponent();

        // 2. Execute the highest-priority available action.
        const defenseMove = this.handleDefense(myPlanets);
        if (defenseMove) return defenseMove;

        const offenseMove = this.handleOffense(myPlanets);
        if (offenseMove) return offenseMove;

        const consolidationMove = this.handleConsolidation(myPlanets);
        if (consolidationMove) return consolidationMove;

        return null; // No optimal action found this turn.
    }

    // --- State Analysis ---

    /**
     * Determines the current game phase (EARLY, MID, LATE) based on elapsed time.
     */
    updateGamePhase() {
        const elapsedTime = this.api.getElapsedTime();
        if (elapsedTime < this.memory.earlyGameEndTime) this.memory.phase = 'EARLY';
        else if (elapsedTime < this.memory.midGameEndTime) this.memory.phase = 'MID';
        else this.memory.phase = 'LATE';
    }

    /**
     * Identifies the strongest opponent based on total production.
     * This logic is cached to run only every 5 seconds for performance.
     */
    updateStrongestOpponent() {
        const now = this.api.getElapsedTime();
        if (now - this.memory.lastOpponentCheck < 5) {
            // Invalidate cache if the opponent is no longer active.
            if (this.memory.strongestOpponent && !this.api.isPlayerActive(this.memory.strongestOpponent)) {
                this.memory.strongestOpponent = null;
            }
            return;
        }
        this.memory.lastOpponentCheck = now;

        let maxProduction = -1;
        let strongest = null;
        for (const opponentId of this.api.getOpponentIds()) {
            if (!this.api.isPlayerActive(opponentId)) continue;
            const production = this.api.getPlayerTotalProduction(opponentId);
            if (production > maxProduction) {
                maxProduction = production;
                strongest = opponentId;
            }
        }
        this.memory.strongestOpponent = strongest;
    }

    // --- Strategic Action Handlers ---

    /**
     * Defends the most valuable planet currently under threat.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A decision object or null.
     */
    handleDefense(myPlanets) {
        let bestPlanetToSave = null;
        let highestValue = -1;
        let troopsNeededForBestSave = 0;

        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            const totalAttackForce = incomingAttacks.reduce((sum, m) => sum + m.amount, 0);
            const friendlyForces = myPlanet.troops + this.api.getIncomingReinforcements(myPlanet).reduce((sum, m) => sum + m.amount, 0);

            if (friendlyForces < totalAttackForce) {
                const value = this.api.calculatePlanetValue(myPlanet);
                if (value > highestValue) {
                    highestValue = value;
                    bestPlanetToSave = myPlanet;
                    troopsNeededForBestSave = Math.ceil(totalAttackForce - friendlyForces) + 1;
                }
            }
        }

        if (bestPlanetToSave) {
            // Find the best planet to send reinforcements FROM (closest, has enough troops, not under attack).
            let bestReinforcer = null;
            let minDistance = Infinity;
            for (const p of myPlanets) {
                if (p === bestPlanetToSave) continue;
                if (p.troops < troopsNeededForBestSave + this.DEFENSIVE_BUFFER) continue;
                if (this.api.getIncomingAttacks(p).length > 0) continue;

                const distance = this.api.getDistance(p, bestPlanetToSave);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestReinforcer = p;
                }
            }
            if (bestReinforcer) {
                return { from: bestReinforcer, to: bestPlanetToSave, troops: troopsNeededForBestSave };
            }
        }
        return null;
    }

    /**
     * Finds and executes the highest ROI (Return on Investment) attack.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A decision object or null.
     */
    handleOffense(myPlanets) {
        let targets = [];
        const neutrals = this.api.getNeutralPlanets();
        const enemies = this.api.getEnemyPlanets();

        if (this.memory.phase === 'EARLY') {
            targets = neutrals;
        } else if (this.memory.phase === 'MID') {
            targets = neutrals.concat(enemies);
        } else { // LATE
            targets = this.memory.strongestOpponent ?
                enemies.filter(p => p.owner === this.memory.strongestOpponent) :
                enemies;
            // If the primary target is wiped out, attack anyone.
            if (targets.length === 0) targets = enemies;
            // Still consider high-value neutrals in the late game.
            targets.push(...neutrals.filter(p => this.api.calculatePlanetValue(p) > 80));
        }

        if (targets.length === 0) return null;

        let bestAttack = { roi: -1, from: null, to: null, troops: 0 };
        const potentialAttackers = [...myPlanets].sort((a, b) => b.troops - a.troops);

        for (const source of potentialAttackers) {
            if (source.troops < this.DEFENSIVE_BUFFER * 2) continue;

            for (const target of targets) {
                const troopsAtArrival = this.api.estimateTroopsAtArrival(source, target);
                // A more accurate prediction must account for other fleets already heading to the target.
                const netIncomingTroops = this.api.getIncomingReinforcements(target).reduce((s, m) => s + m.amount, 0)
                                        - this.api.getIncomingAttacks(target).reduce((s, m) => s + m.amount, 0);
                
                const troopsNeeded = Math.ceil(troopsAtArrival + netIncomingTroops) + 1;
                const troopsToSend = Math.floor(source.troops * this.ATTACK_TROOP_PERCENTAGE);

                if (troopsToSend > troopsNeeded) {
                    const value = this.api.calculatePlanetValue(target);
                    // Cost is troops risked plus a penalty for how long they are in transit (opportunity cost).
                    const cost = troopsNeeded + (this.api.getTravelTime(source, target) * 0.5);
                    const roi = value / cost;

                    if (roi > bestAttack.roi) {
                        bestAttack = { roi, from: source, to: target, troops: troopsToSend };
                    }
                }
            }
        }

        if (bestAttack.from) {
            return { from: bestAttack.from, to: bestAttack.to, troops: bestAttack.troops };
        }
        return null;
    }

    /**
     * Consolidates forces by moving troops from safe, full "backline" planets.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A decision object or null.
     */
    handleConsolidation(myPlanets) {
        if (myPlanets.length <= 1) return null;

        const maxTroops = this.api.getMaxPlanetTroops();
        let bestSource = null;
        const allEnemies = this.api.getEnemyPlanets();

        // Find a safe, full planet to send troops FROM.
        const potentialSources = myPlanets.filter(p => {
            const isFull = p.troops > maxTroops * this.CONSOLIDATION_FULL_THRESHOLD;
            if (!isFull) return false;
            const nearestEnemy = this.api.findNearestPlanet(p, allEnemies);
            const isSafe = !nearestEnemy || this.api.getDistance(p, nearestEnemy) > this.CONSOLIDATION_SAFE_DISTANCE;
            return isSafe;
        });

        if (potentialSources.length > 0) {
            bestSource = potentialSources.sort((a, b) => b.troops - a.troops)[0];
        }

        if (bestSource) {
            // Find a valuable, non-full planet to send troops TO.
            let bestTarget = null;
            let maxScore = -1;
            for (const p of myPlanets) {
                if (p === bestSource) continue;
                if (p.troops < maxTroops * this.CONSOLIDATION_FULL_THRESHOLD) {
                    const value = this.api.calculatePlanetValue(p);
                    if (value > maxScore) {
                        maxScore = value;
                        bestTarget = p;
                    }
                }
            }

            if (bestTarget) {
                return {
                    from: bestSource,
                    to: bestTarget,
                    troops: Math.floor(bestSource.troops * this.CONSOLIDATION_TROOP_PERCENTAGE)
                };
            }
        }
        return null;
    }
}