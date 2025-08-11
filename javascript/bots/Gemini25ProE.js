// =============================================
// root/javascript/bots/Gemini25ProE.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * AegisBot employs a defense-first, phased strategy that adapts to the game's flow.
 * 
 * Core Strategic Pillars:
 * 1.  Prioritized Actions: The bot evaluates decisions in a strict order: Defense > Offense > Consolidation. It will always save a planet before attempting an attack.
 * 2.  Phased Strategy: It behaves differently depending on the game phase ('EARLY', 'MID', 'LATE').
 *     - EARLY: Focuses on rapid, efficient expansion to nearby high-value neutral planets.
 *     - MID/LATE: Switches to aggressive, calculated attacks on enemy planets.
 *     - FINAL MOMENTS: If the game timer is low, it enters a "planet grab" mode to maximize planet count for a timeout victory.
 * 3.  Calculated Aggression: Attacks are never reckless. It uses `predictPlanetState` to determine the number of troops needed for a conquest at the moment of arrival, plus a small safety margin.
 * 4.  Resource Management: Planets maintain a defensive buffer of troops and will only use "surplus" forces for offensive maneuvers, preventing it from leaving its core worlds vulnerable.
 */
export default class Gemini25ProE extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        this.memory.targetedPlanets = new Set(); // Stores IDs of planets we've sent a fleet to
        
        // --- Bot Configuration ---
        this.CONFIG = {
            // Leave a defensive buffer of troops on each planet equal to (planet.size * multiplier)
            DEFENSIVE_BUFFER_MULTIPLIER: 1.5,
            // When attacking, send this many extra troops as a safety margin
            ATTACK_SAFETY_MARGIN: 3,
            // How far in the future (seconds) to check for planets needing reinforcement
            DEFENSE_LOOKAHEAD_TIME: 15.0,
            // At what troop percentage should a planet consider consolidating its forces
            CONSOLIDATION_RATIO: 0.6,
            // When to switch to "planet grab" mode before timeout
            LATE_GAME_TIMER_THRESHOLD: 45,
        };
    }

    /**
     * This method is called by the game engine every turn.
     * It contains the bot's main decision-making logic.
     * @param {number} dt - The time elapsed since the last decision, in game seconds.
     * @returns {object|null} A decision object or null.
     */
    makeDecision(dt) {
        // Cooldown check to prevent actions from being spammed
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left, we have lost.
        }

        // --- Update bot memory and state ---
        this.updateTargetedPlanets();

        // The core decision loop, executed in order of priority.
        // A successful decision in any step will return immediately.
        
        // 1. Defense: The highest priority. Secure our planets.
        const defensiveMove = this.findDefensiveMove(myPlanets);
        if (defensiveMove) {
            this.setCooldown();
            return defensiveMove;
        }

        // 2. Offense: Based on the game's state, execute a strategic offensive move.
        const offensiveMove = this.findOffensiveMove(myPlanets);
        if (offensiveMove) {
            this.setCooldown();
            // Mark the target so we don't attack it again immediately
            this.memory.targetedPlanets.add(offensiveMove.to.id);
            return offensiveMove;
        }

        // 3. Consolidation: If no attack or defense is needed, reposition troops for future actions.
        const consolidationMove = this.findConsolidationMove(myPlanets);
        if (consolidationMove) {
            this.setCooldown();
            return consolidationMove;
        }

        // No optimal move found this turn.
        return null;
    }
    
    // ===================================================================
    // --- ACTION-FINDING METHODS (THE "BRAIN") ---
    // ===================================================================

    /**
     * Checks if any owned planets are predicted to be lost and sends reinforcements.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A decision object or null.
     */
    findDefensiveMove(myPlanets) {
        for (const myPlanet of myPlanets) {
            const prediction = this.api.predictPlanetState(myPlanet, this.CONFIG.DEFENSE_LOOKAHEAD_TIME);

            // If we predict losing this planet and it's not a lost cause (troops > 0 means it's a battle)
            if (prediction.owner !== this.playerId && prediction.troops > 0) {
                const troopsNeeded = Math.ceil(prediction.troops) + 1;

                // Find the best planet to send reinforcements from
                const bestSource = this.findBestSource(myPlanet, troopsNeeded, myPlanets.filter(p => p.id !== myPlanet.id));

                if (bestSource) {
                    return { from: bestSource, to: myPlanet, troops: troopsNeeded };
                }
            }
        }
        return null;
    }
    
    /**
     * Determines the current game strategy and finds an appropriate offensive move.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A decision object or null.
     */
    findOffensiveMove(myPlanets) {
        const gamePhase = this.api.getGamePhase();
        const timeRemaining = this.api.getGameDuration() - this.api.getElapsedTime();

        // Late Game: "Planet Grab" mode to secure a timeout victory
        if (timeRemaining < this.CONFIG.LATE_GAME_TIMER_THRESHOLD) {
            return this.findPlanetGrabMove(myPlanets);
        }

        // Early Game: Expand to neutral planets
        const neutralPlanets = this.api.getNeutralPlanets().filter(p => !this.memory.targetedPlanets.has(p.id));
        if (gamePhase === 'EARLY' && neutralPlanets.length > 0) {
            return this.findExpansionMove(myPlanets, neutralPlanets);
        }

        // Mid/Late Game: Attack the primary enemy
        const enemyPlanets = this.api.getEnemyPlanets().filter(p => !this.memory.targetedPlanets.has(p.id));
        if (enemyPlanets.length > 0) {
            return this.findBestAttack(myPlanets, enemyPlanets);
        }
        
        // If no enemies left, but still neutrals to conquer
        if (neutralPlanets.length > 0) {
            return this.findExpansionMove(myPlanets, neutralPlanets);
        }

        return null;
    }

    /**
     * Finds the best neutral planet to capture based on production value and proximity.
     * @param {Planet[]} myPlanets - List of owned planets.
     * @param {Planet[]} neutralPlanets - List of available neutral planets.
     * @returns {object|null} A decision object or null.
     */
    findExpansionMove(myPlanets, neutralPlanets) {
        let bestTarget = null;
        let bestSource = null;
        let bestScore = -Infinity;

        for (const target of neutralPlanets) {
            const troopsNeeded = Math.ceil(target.troops) + 1;
            const source = this.findBestSource(target, troopsNeeded, myPlanets);

            if (source) {
                const travelTime = this.api.getTravelTime(source, target);
                // Score prioritizes high production and low travel time
                const score = target.productionRate / (travelTime + 1);

                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                    bestSource = source;
                }
            }
        }

        if (bestSource && bestTarget) {
            const troopsToSend = Math.ceil(bestTarget.troops) + 1;
            return { from: bestSource, to: bestTarget, troops: troopsToSend };
        }

        return null;
    }

    /**
     * Finds the most opportune enemy planet to attack based on Return on Investment (RoI).
     * @param {Planet[]} myPlanets - List of owned planets.
     * @param {Planet[]} enemyPlanets - List of available enemy planets.
     * @returns {object|null} A decision object or null.
     */
    findBestAttack(myPlanets, enemyPlanets) {
        let bestAttack = { score: -Infinity };

        for (const source of myPlanets) {
            const surplus = this.getSurplusTroops(source);
            if (surplus < this.CONFIG.ATTACK_SAFETY_MARGIN) continue;

            for (const target of enemyPlanets) {
                const travelTime = this.api.getTravelTime(source, target);
                const prediction = this.api.predictPlanetState(target, travelTime);

                // Skip if we can't conquer it or an ally/we will get it first
                if (prediction.owner !== target.owner && prediction.owner !== this.playerId) continue;

                const troopsNeeded = Math.ceil(prediction.troops) + this.CONFIG.ATTACK_SAFETY_MARGIN;

                if (surplus >= troopsNeeded) {
                    // Score is Return on Investment: target production / troops risked
                    const score = target.productionRate / troopsNeeded;
                    if (score > bestAttack.score) {
                        bestAttack = { score, from: source, to: target, troops: troopsNeeded };
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
     * In late game, finds any weakly defended planet (neutral or enemy) to capture quickly.
     * @param {Planet[]} myPlanets - List of owned planets.
     * @returns {object|null} A decision object or null.
     */
    findPlanetGrabMove(myPlanets) {
        const potentialTargets = [...this.api.getNeutralPlanets(), ...this.api.getEnemyPlanets()]
            .filter(p => !this.memory.targetedPlanets.has(p.id));
        
        let bestTarget = null;
        let bestSource = null;
        let minTravelTime = Infinity;

        for (const target of potentialTargets) {
            const troopsNeeded = Math.ceil(target.troops) + 1;
            const source = this.findBestSource(target, troopsNeeded, myPlanets);

            if (source) {
                const travelTime = this.api.getTravelTime(source, target);
                if (travelTime < minTravelTime) {
                    minTravelTime = travelTime;
                    bestTarget = target;
                    bestSource = source;
                }
            }
        }
        
        if (bestSource && bestTarget) {
            const troopsNeeded = Math.ceil(bestTarget.troops) + 1;
            return { from: bestSource, to: bestTarget, troops: troopsNeeded };
        }
        return null;
    }
    
    /**
     * Repositions troops from safe, over-stocked planets to frontline planets.
     * @param {Planet[]} myPlanets - List of all planets owned by the bot.
     * @returns {object|null} A decision object or null.
     */
    findConsolidationMove(myPlanets) {
        if (myPlanets.length < 2) return null;

        const myTotalTroops = this.api.getMyTotalTroops();
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null; // No enemies to position against

        const source = myPlanets.sort((a, b) => b.troops - a.troops)[0];

        // If a planet holds a huge percentage of our troops, consolidate
        if (source.troops > myTotalTroops * this.CONFIG.CONSOLIDATION_RATIO) {
            // Find our "frontline" planet (closest to any enemy)
            const frontlinePlanet = myPlanets.sort((a, b) => {
                const distA = this.api.getDistance(a, this.api.getNearestEnemyPlanet(a));
                const distB = this.api.getDistance(b, this.api.getNearestEnemyPlanet(b));
                return distA - distB;
            })[0];
            
            if (frontlinePlanet && source.id !== frontlinePlanet.id) {
                const troopsToSend = Math.floor(this.getSurplusTroops(source) / 2);
                if (troopsToSend > 1) {
                    return { from: source, to: frontlinePlanet, troops: troopsToSend };
                }
            }
        }
        return null;
    }

    // ===================================================================
    // --- UTILITY METHODS ---
    // ===================================================================

    /** Sets the action cooldown to the game's minimum. */
    setCooldown() {
        this.memory.actionCooldown = this.api.getDecisionCooldown();
    }
    
    /**
     * Calculates the number of troops a planet can safely use for attacks.
     * @param {Planet} planet - The planet to calculate surplus for.
     * @returns {number} The number of available troops.
     */
    getSurplusTroops(planet) {
        const defensiveBuffer = Math.ceil(planet.size * this.CONFIG.DEFENSIVE_BUFFER_MULTIPLIER);
        return Math.floor(planet.troops - defensiveBuffer);
    }

    /**
     * Finds the best source planet for an action on a specific target.
     * @param {Planet} target - The target planet.
     * @param {number} troopsNeeded - The number of troops required.
     * @param {Planet[]} potentialSources - The list of potential source planets.
     * @returns {Planet|null} The best source planet (closest with enough troops) or null.
     */
    findBestSource(target, troopsNeeded, potentialSources) {
        let bestSource = null;
        let minDistance = Infinity;

        for (const source of potentialSources) {
            if (this.getSurplusTroops(source) >= troopsNeeded) {
                const distance = this.api.getDistance(source, target);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestSource = source;
                }
            }
        }
        return bestSource;
    }

    /**
     * Cleans the list of targeted planets by removing those that are no longer being targeted by an active fleet.
     */
    updateTargetedPlanets() {
        if (this.memory.targetedPlanets.size === 0) return;

        const myFleetTargets = new Set(this.api.getFleetsByOwner(this.playerId).map(f => f.to.id));
        const planetsToRemove = [];

        for (const planetId of this.memory.targetedPlanets) {
            if (!myFleetTargets.has(planetId)) {
                // If we no longer have a fleet going to this planet, it's free to be targeted again.
                planetsToRemove.push(planetId);
            }
        }

        for (const planetId of planetsToRemove) {
            this.memory.targetedPlanets.delete(planetId);
        }
    }
}