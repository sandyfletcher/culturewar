// =============================================
// root/javascript/bots/Gemini25Pro.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * Gemini25Pro employs a phased, priority-driven strategy to achieve galactic dominance.
 * 
 * This bot operates on a "waterfall" logic model, where it evaluates a strict hierarchy of
 * possible actions each turn. This ensures that critical tasks are always handled first.
 *
 * Core Strategic Pillars:
 * 1.  **Priority-Based Action**: The bot's decision-making follows a non-negotiable order:
 *     a. Emergency Defense: First, save any planets predicted to fall to an imminent attack.
 *     b. Strategic Expansion/Offense: Second, find the most valuable and cost-effective planet to capture.
 *     c. Troop Consolidation: If no threats or opportunities exist, reinforce the front lines with idle troops from the rear.
 * 2.  **Phased Adaptation**: The bot's aggression and risk-taking change based on the game phase (Early, Mid, Late). 
 *     It focuses on rapid expansion early on, calculated attacks mid-game, and either defensive turtling or desperate all-in attacks late-game based on its relative strength.
 * 3.  **Predictive Efficiency**: It heavily leverages the `predictPlanetState` API to send the minimum troops necessary for a successful conquest, conserving forces and maximizing efficiency.
 * 4.  **Stateful Missions**: Uses `this.memory` to track ongoing missions, preventing it from over-committing troops from a single planet and leaving it vulnerable.
 */
export default class Gemini25Pro extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        // Custom configuration for easy tuning of the bot's behavior.
        this.CONFIG = {
            // General
            ACTION_COOLDOWN: 0.25, // Minimum time between actions to prevent twitchy behavior.
            // Defense
            DEFENSE_SAFETY_BUFFER: 5, // Send this many extra troops when reinforcing a planet.
            // Offense
            MIN_TROOPS_TO_ATTACK: 15, // A planet must have at least this many troops to be a source for an attack.
            ATTACK_SAFETY_BUFFER: 3,  // Send this many extra troops on an attack to ensure victory.
            GARRISON_TO_LEAVE_BEHIND: 5, // Always leave at least this many troops on an attacking planet by default.
            // Consolidation
            CONSOLIDATION_SOURCE_THRESHOLD: 0.7, // Consolidate from planets with > 70% of max troops.
            CONSOLIDATION_TARGET_THRESHOLD: 25,  // Consolidate to planets with < 25 troops.
        };
        this.log("Gemini25Pro initialized.");
    }

    /**
     * This method is called by the game engine every turn. It contains the bot's main decision-making loop.
     * @param {number} dt - The time elapsed since the last decision, in game seconds.
     * @returns {object|null} A decision object { from, to, troops } or null to do nothing.
     */
    makeDecision(dt) {
        // 1. Cooldown and initial state checks
        this.memory.actionCooldown -= dt;
        if (this.memory.actionCooldown > 0) {
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            this.log("No planets left. Surrendering.");
            return null;
        }
        
        this._updateMissions();

        // 2. Execute decision logic based on priority waterfall
        let decision;

        // Priority 1: Emergency Defense
        decision = this._findDefensiveMove(myPlanets);
        if (decision) {
            this.log(`DEFENSE: Sending ${decision.troops} from ${decision.from.id} to ${decision.to.id}`);
            return this._commitDecision(decision);
        }

        // Priority 2: Strategic Expansion & Offense
        decision = this._findOffensiveMove(myPlanets);
        if (decision) {
            this.log(`OFFENSE: Sending ${decision.troops} from ${decision.from.id} to ${decision.to.id}`);
            return this._commitDecision(decision);
        }
        
        // Priority 3: Troop Consolidation
        decision = this._findConsolidationMove(myPlanets);
        if (decision) {
            this.log(`CONSOLIDATE: Sending ${decision.troops} from ${decision.from.id} to ${decision.to.id}`);
            return this._commitDecision(decision);
        }
        
        return null;
    }

    /** Helper method to log messages with the bot's ID for easier debugging. */
    log(message) {
        // console.log(`[${this.playerId}] ${message}`); // Uncomment for debugging
    }

    /** Commits to a decision, setting a cooldown and tracking the mission in memory. */
    _commitDecision(decision) {
        this.memory.actionCooldown = this.CONFIG.ACTION_COOLDOWN;
        // Track the mission to prevent the source planet from being used again immediately.
        this.memory.missions.set(decision.from.id, {
            toId: decision.to.id,
            troops: decision.troops
        });
        return decision;
    }
    
    /** Removes missions from memory if we no longer own the source planet. */
    _updateMissions() {
        if (this.memory.missions.size === 0) return;
        
        for (const planetId of this.memory.missions.keys()) {
            const planet = this.api.getPlanetById(planetId);
            // If we lost the planet, the mission is moot. Clear it.
            if (!planet || planet.owner !== this.playerId) {
                this.memory.missions.delete(planetId);
            }
        }
    }
    
    /** Returns a list of planets that are not currently assigned to a mission. */
    _getAvailableSources(myPlanets) {
        return myPlanets.filter(p => !this.memory.missions.has(p.id));
    }

    /**
     * PRIORITY 1: Finds a crucial planet that needs reinforcements and sends them.
     * Iterates through owned planets, predicts outcomes of incoming attacks, and dispatches reinforcements if a planet is predicted to be lost.
     */
    _findDefensiveMove(myPlanets) {
        const threatenedPlanets = [];

        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            const soonestAttack = incomingAttacks.reduce((s, c) => c.duration < s.duration ? c : s);
            const timeToImpact = soonestAttack.duration;

            const predictedState = this.api.predictPlanetState(myPlanet, timeToImpact - 0.1);

            if (predictedState.owner !== this.playerId) {
                const troopsNeeded = Math.ceil(predictedState.troops) + this.CONFIG.DEFENSE_SAFETY_BUFFER;
                threatenedPlanets.push({ planet: myPlanet, needed: troopsNeeded, timeToImpact });
            }
        }
        
        if (threatenedPlanets.length === 0) return null;

        threatenedPlanets.sort((a, b) => this.api.calculatePlanetValue(b.planet) - this.api.calculatePlanetValue(a.planet));
        
        const availableSources = this._getAvailableSources(myPlanets);

        for (const threat of threatenedPlanets) {
            const { planet: targetPlanet, needed: troopsNeeded, timeToImpact } = threat;
            
            const potentialHelpers = availableSources
                .filter(p => p.id !== targetPlanet.id)
                .filter(p => this.api.getTravelTime(p, targetPlanet) < timeToImpact)
                .map(p => ({
                    planet: p,
                    surplus: p.troops - this.CONFIG.GARRISON_TO_LEAVE_BEHIND,
                    distance: this.api.getDistance(p, targetPlanet)
                }))
                .filter(p => p.surplus >= troopsNeeded)
                .sort((a, b) => a.distance - b.distance);

            if (potentialHelpers.length > 0) {
                const helper = potentialHelpers[0];
                return { from: helper.planet, to: targetPlanet, troops: troopsNeeded };
            }
        }
        return null;
    }

    /**
     * PRIORITY 2: Finds the best expansion or attack opportunity.
     * Scores potential targets based on value and accessibility, then finds an available source planet to launch an efficient attack.
     */
    _findOffensiveMove(myPlanets) {
        const availableSources = this._getAvailableSources(myPlanets)
            .filter(p => p.troops > this.CONFIG.MIN_TROOPS_TO_ATTACK)
            .sort((a, b) => b.troops - a.troops);

        if (availableSources.length === 0) return null;

        const potentialTargets = [...this.api.getNeutralPlanets(), ...this.api.getEnemyPlanets()]
            .filter(p => ![...this.memory.missions.values()].some(m => m.toId === p.id));

        if (potentialTargets.length === 0) return null;

        const scoredTargets = potentialTargets.map(target => {
            let score = this.api.calculatePlanetValue(target);
            if (this.api.getGamePhase() === 'EARLY' && target.owner === 'neutral') {
                const nearest = this.api.findNearestPlanet(target, myPlanets);
                score *= 2000 / (100 + this.api.getDistance(target, nearest || target)); // Heavily prioritize close neutrals early
            }
            return { target, score };
        }).sort((a, b) => b.score - a.score);

        for (const { target } of scoredTargets) {
            for (const source of availableSources) {
                const travelTime = this.api.getTravelTime(source, target);
                const predictedState = this.api.predictPlanetState(target, travelTime);

                if (predictedState.owner === this.playerId) continue;

                const troopsNeeded = Math.ceil(predictedState.troops) + this.CONFIG.ATTACK_SAFETY_BUFFER;
                const garrisonToLeave = this._calculateGarrisonToLeave(source);
                
                if (source.troops - garrisonToLeave > troopsNeeded) {
                    return { from: source, to: target, troops: troopsNeeded };
                }
            }
        }
        return null;
    }

    /** Calculates how many troops to leave behind based on game state, returning to a default if logic doesn't apply. */
    _calculateGarrisonToLeave(planet) {
        const strengthRatio = this.api.getMyStrengthRatio();
        
        if (this.api.getGamePhase() === 'LATE') {
            if (strengthRatio > 1.2) return Math.max(this.CONFIG.GARRISON_TO_LEAVE_BEHIND, 25); // Play it safe when winning
            if (strengthRatio < 0.8) return 1; // Be reckless when losing
        }
        return this.CONFIG.GARRISON_TO_LEAVE_BEHIND;
    }

    /**
     * PRIORITY 3: Moves troops from safe, over-stocked planets to needy front-line planets.
     * This is an "idle" action to optimize troop distribution when there are no immediate threats or good attack opportunities.
     */
    _findConsolidationMove(myPlanets) {
        if (myPlanets.length < 3) return null;

        const availableSources = this._getAvailableSources(myPlanets);
        const maxTroops = this.api.getMaxPlanetTroops();

        const backlineSources = availableSources
            .filter(p => p.troops > maxTroops * this.CONFIG.CONSOLIDATION_SOURCE_THRESHOLD)
            .sort((a,b) => b.troops - a.troops);

        const frontlineTargets = myPlanets
            .filter(p => p.troops < this.CONFIG.CONSOLIDATION_TARGET_THRESHOLD && !this.memory.missions.has(p.id))
            .sort((a,b) => this.api.calculateThreat(b) - this.api.calculateThreat(a));

        if (backlineSources.length > 0 && frontlineTargets.length > 0) {
            const source = backlineSources[0];
            const target = this.api.findNearestPlanet(source, frontlineTargets);
            
            if (target && source.id !== target.id) {
                 // Leave a buffer of 30 seconds of production
                 const troopsToLeave = Math.floor(source.productionRate * 30);
                 const troopsToSend = Math.floor(source.troops - troopsToLeave);
                 if (troopsToSend > 1) {
                    return { from: source, to: target, troops: troopsToSend };
                 }
            }
        }
        return null;
    }
}