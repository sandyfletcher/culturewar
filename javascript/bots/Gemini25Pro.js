// ===========================================================
// assets/javascript/bots/Gemini25Pro.js
// ===========================================================

import BaseBot from './BaseBot.js';

/**
 * Gemini25Pro - A strategic AI for a Galcon-style RTS game.
 *
 * This bot operates on a prioritized, predictive decision-making loop:
 * 1. DEFEND: Use future-state prediction to save any planets under imminent threat.
 * 2. ATTACK: Identify the most valuable, vulnerable targets and launch calculated, efficient attacks.
 * 3. CONSOLIDATE: Move troops from safe, over-populated planets to strategic frontline positions.
 *
 * It uses a mission-tracking system to avoid over-committing troops and acts with tactical precision.
 */
export default class Gemini25Pro extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);        
        // --- Bot Configuration ---
        // These values are stored in memory to persist between decisions.
        this.memory.ACTION_COOLDOWN_SECONDS = 0.3; // Min time between actions.
        this.memory.DEFENSIVE_BUFFER = 5; // Min troops to leave on a planet after an action.
        this.memory.CONSOLIDATION_THRESHOLD = 0.8; // Move troops from planets over this % of max capacity.
        this.memory.ATTACK_FORCE_MULTIPLIER = 1.1; // Send 110% of troops needed for an attack, for safety.

        // --- Bot State ---
        this.memory.lastActionTime = 0;
    }

    /**
     * The main decision-making function, called periodically by the game engine.
     * It follows a strict priority list: Defend -> Attack -> Consolidate.
     * @param {number} dt - The delta time since the last call, scaled by game speed.
     * @returns {object|null} A decision object or null for no action.
     */
    makeDecision(dt) {
        this.memory.lastActionTime -= dt;
        if (this.memory.lastActionTime > 0) {
            return null; // Bot is on cooldown, thinking...
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // Eliminated, no actions possible.
        }

        // The core logic loop, executed in order of priority.
        let decision = this._runDefense(myPlanets);
        if (decision) return this._executeDecision(decision, "DEFENSE");

        decision = this._runOffense(myPlanets);
        if (decision) return this._executeDecision(decision, "OFFENSE");
        
        decision = this._runConsolidation(myPlanets);
        if (decision) return this._executeDecision(decision, "CONSOLIDATION");

        return null; // No profitable action found this cycle.
    }

    // =======================================================================
    // ==                                                                   ==
    // ==                      STRATEGIC SUB-ROUTINES                       ==
    // ==                                                                   ==
    // =======================================================================

    /**
     * PRIORITY 1: Defend planets that are predicted to be captured.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A reinforcement decision or null.
     */
    _runDefense(myPlanets) {
        for (const planet of myPlanets) {
            // Predict the outcome of the earliest incoming attack.
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            if (incomingAttacks.length === 0) continue;
            
            // Find the attack that will arrive first.
            const earliestAttack = incomingAttacks.reduce((earliest, current) => 
                current.duration < earliest.duration ? current : earliest
            );
            const timeToImpact = earliestAttack.duration;

            // Predict if we will lose the planet.
            const futureState = this.api.predictPlanetState(planet, timeToImpact);
            if (futureState.owner === this.playerId) continue; // We are predicted to hold, no action needed.

            // We will lose! Calculate troops needed to save it and find a helper.
            const troopsNeeded = futureState.troops + 1;
            const reinforcementSource = this._findBestReinforcementSource(planet, troopsNeeded, timeToImpact, myPlanets);

            if (reinforcementSource) {
                return { from: reinforcementSource, to: planet, troops: troopsNeeded };
            }
        }
        return null;
    }

    /**
     * PRIORITY 2: Find and execute the most profitable attack.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} An attack decision or null.
     */
    _runOffense(myPlanets) {
        const potentialTargets = [...this.api.getEnemyPlanets(), ...this.api.getNeutralPlanets()];
        if (potentialTargets.length === 0) return null;

        // Find the single best target to attack right now.
        const bestAttack = this._findBestAttack(potentialTargets, myPlanets);

        if (bestAttack) {
            const { source, target, troops } = bestAttack;
            return { from: source, to: target, troops: troops };
        }
        
        return null;
    }

    /**
     * PRIORITY 3: Consolidate forces by moving them from safe planets to frontline planets.
     * @param {Planet[]} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A consolidation decision or null.
     */
    _runConsolidation(myPlanets) {
        if (myPlanets.length < 2) return null; // Can't consolidate with only one planet.

        // Find a safe, well-stocked planet to send troops from.
        const sourcePlanet = myPlanets
            .filter(p => p.troops > this.api.getMaxPlanetTroops() * this.memory.CONSOLIDATION_THRESHOLD)
            .sort((a, b) => this.api.calculateThreat(a) - this.api.calculateThreat(b))[0]; // Pick the least threatened one.

        if (!sourcePlanet) return null; // No overstocked planets.

        // Find a strategically valuable planet to send troops to.
        const destinationPlanet = myPlanets
            .filter(p => p.id !== sourcePlanet.id) // Don't send to self.
            .sort((a, b) => this.api.calculateThreat(b) - this.api.calculateThreat(a))[0]; // Pick the most threatened one.

        if (!destinationPlanet) return null;

        const availableTroops = sourcePlanet.troops - this.memory.DEFENSIVE_BUFFER;
        if (availableTroops <= 0) return null;
        
        // Send half of the available troops to reinforce the frontline.
        const troopsToSend = Math.floor(availableTroops / 2);

        return { from: sourcePlanet, to: destinationPlanet, troops: troopsToSend };
    }

    // =======================================================================
    // ==                                                                   ==
    // ==                         TACTICAL HELPERS                          ==
    // ==                                                                   ==
    // =======================================================================
    
    /**
     * Finds the best planet to send reinforcements from to save a threatened planet.
     * @param {Planet} threatenedPlanet - The planet that needs saving.
     * @param {number} troopsNeeded - The number of troops required.
     * @param {number} timeToImpact - Reinforcements must arrive before this time.
     * @param {Planet[]} myPlanets - List of all my planets.
     * @returns {Planet|null} The best planet to send troops from, or null if none can help in time.
     */
    _findBestReinforcementSource(threatenedPlanet, troopsNeeded, timeToImpact, myPlanets) {
        const potentialSources = myPlanets.filter(p => {
            if (p.id === threatenedPlanet.id) return false; // Can't reinforce from itself.
            const availableTroops = p.troops - this.memory.DEFENSIVE_BUFFER;
            if (availableTroops < troopsNeeded) return false; // Doesn't have enough troops.
            // Crucially, can the reinforcements get there in time?
            if (this.api.getTravelTime(p, threatenedPlanet) >= timeToImpact) return false;
            return true;
        });

        // From the valid sources, pick the one with the most spare troops.
        potentialSources.sort((a, b) => b.troops - a.troops);
        return potentialSources.length > 0 ? potentialSources[0] : null;
    }

    /**
     * Evaluates all potential attacks and returns the single most promising one.
     * @param {Planet[]} potentialTargets - All neutral and enemy planets.
     * @param {Planet[]} myPlanets - All planets owned by the bot.
     * @returns {object|null} An object { source, target, troops } for the best attack, or null.
     */
    _findBestAttack(potentialTargets, myPlanets) {
        let bestAttack = null;
        let maxScore = -Infinity;

        // Sort my planets by troop count, so we always consider our strongest planets first.
        const mySortedPlanets = [...myPlanets].sort((a, b) => b.troops - a.troops);

        for (const target of potentialTargets) {
            for (const source of mySortedPlanets) {
                const availableTroops = source.troops - this.memory.DEFENSIVE_BUFFER;
                if (availableTroops <= 1) continue;

                const travelTime = this.api.getTravelTime(source, target);
                const futureState = this.api.predictPlanetState(target, travelTime);

                // Don't attack if we're predicted to already own it.
                if (futureState.owner === this.playerId) continue;

                const troopsRequired = Math.ceil(futureState.troops * this.memory.ATTACK_FORCE_MULTIPLIER) + 1;
                
                if (availableTroops >= troopsRequired) {
                    // This is a viable attack. Now, score it to see if it's the *best* one.
                    const value = this.api.calculatePlanetValue(target);
                    // Score is based on target value, penalized by travel time.
                    // We prioritize high-value, close targets.
                    const score = value / (1 + travelTime);

                    if (score > maxScore) {
                        maxScore = score;
                        bestAttack = { 
                            source: source, 
                            target: target, 
                            troops: Math.min(availableTroops, troopsRequired) // Send required amount, not all available.
                        };
                    }
                }
            }
        }
        return bestAttack;
    }

    // =======================================================================
    // ==                                                                   ==
    // ==                         SYSTEM & UTILITY                          ==
    // ==                                                                   ==
    // =======================================================================

    /**
     * Finalizes and logs a decision, and resets the action cooldown.
     * @param {object} decision - The decision object { from, to, troops }.
     * @param {string} type - The type of action for logging ('DEFENSE', 'OFFENSE', 'CONSOLIDATION').
     * @returns {object} The finalized decision object.
     */
    _executeDecision(decision, type) {
        const { from, to, troops } = decision;
        this.log(`${type}: Sending ${Math.floor(troops)} troops from ${from.id} to ${to.id}.`);
        this.memory.lastActionTime = this.memory.ACTION_COOLDOWN_SECONDS;
        return decision;
    }
}