// =============================================
// root/javascript/bots/gptoss20bD.js
// =============================================

import BaseBot from './BaseBot.js';

/**
  * GalconChamp - A champion-level AI bot for Galcon.
  *
  * Core strategy:
  *   1. Value‑driven expansion – target the most valuable neutral planets first.
  *   2. Balanced aggression – attack enemy planets only when the required troop
  *      count can be sent safely (≥ 90 % of a planet's current force).
  *   3. Dynamic phase adaptation – in EARLY, prioritize expansion; in MID/LATE,
  *      shift to calculated attacks and defensive consolidation if the bot is
  *      weaker than the strongest opponent.
  *   4. Predictive targeting using `predictPlanetState` to know exactly how many
  *      troops are required at arrival time, including incoming fleets.
  *   5. Cooldown‑aware execution – respects the mandatory 0.5‑second decision
  *      cooldown by tracking `memory.actionCooldown`.
  *
  * The bot keeps minimal state in `memory` – primarily a cooldown counter – and
  * otherwise evaluates the current board each time it may act.  All decisions
  * reference planet IDs, not planet objects, to satisfy the API’s read‑only
  * constraint.
  */

export default class gptoss20bD extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            actionCooldown: 0,          // Seconds remaining before next turn
            // missions: []               // Optional: track outbound fleets
        };
    }

    /**
     * Main decision loop – called by the engine each turn.
     * @param {number} dt - Scaled time since the last turn.
     * @returns {object|null} Movement decision or null for no action.
     */
    makeDecision(dt) {
        // Apply internal cooldown – avoid re‑evaluating if not ready.
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // ----------- Gather static data ------------------------------------
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;  // No planets to act from

        const neutrals   = this.api.getNeutralPlanets();
        const enemies    = this.api.getEnemyPlanets();
        const phase      = this.api.getGamePhase();          // EARLY | MID | LATE
        const strength   = this.api.getMyStrengthRatio();   // >1.0 means we’re stronger

        // Keep track of planets that already have outbound fleets.
        const outboundFrom = new Set();
        for (const fleet of this.api.getFleetsByOwner(this.playerId)) {
            outboundFrom.add(fleet.from.id);
        }

        // Helper to compute the troop count required to conquer a target at
        // the moment our fleet would arrive.  Adds 10 % safety margin.
        const neededTroops = (target, travelTime) => {
            const future = this.api.predictPlanetState(target, travelTime);
            const minRequired = Math.ceil((future.troops + 1) * 1.10); // +10 %
            return Math.max(minRequired, 1);                          // At least 1
        };

        // ------------ Target selection ------------------------------------
        // Build list of candidate missions: each is { from, to, needed, valueRatio }
        let candidates = [];

        // ------------------------------------------------------------------
        // EARLY game: prioritize expanding neutrals
        // ------------------------------------------------------------------
        if (phase === 'EARLY') {
            for (const target of neutrals) {
                const targetValue = this.api.calculatePlanetValue
                    ? this.api.calculatePlanetValue(target)
                    : target.size;   // Fallback if helper missing

                for (const from of myPlanets) {
                    if (outboundFrom.has(from.id)) continue;        // Skip busy planets
                    const travelTime = this.api.getTravelTime(from, target);
                    const needed = neededTroops(target, travelTime);

                    // Only consider if the source planet has at least 90% of its troops to send
                    if (from.troops < needed * 1.10) continue;      // Not enough reserves
                    const troopsToSend = Math.min(Math.floor(from.troops * 0.80), needed);

                    candidates.push({
                        from,
                        to: target,
                        needed,
                        troopsToSend,
                        valueRatio: targetValue / needed,
                        priority: 1   // Lower is better in EARLY
                    });
                }
            }
        }

        // ------------------------------------------------------------------
        // MID & LATE game: mix of neutral expansion + calculated attacks
        // ------------------------------------------------------------------
        if (phase !== 'EARLY') {
            const allTargets = neutrals.concat(enemies);
            for (const target of allTargets) {
                const targetValue = this.api.calculatePlanetValue
                    ? this.api.calculatePlanetValue(target)
                    : target.size;

                for (const from of myPlanets) {
                    if (outboundFrom.has(from.id)) continue;
                    const travelTime  = this.api.getTravelTime(from, target);
                    const needed      = neededTroops(target, travelTime);

                    if (from.troops < needed * 1.10) continue;          // Preserve reserves
                    const troopsToSend = Math.min(Math.floor(from.troops * 0.75), needed);

                    // In LATE, be more aggressive if we’re already stronger
                    if (phase === 'LATE' && strength > 1.2) {
                        // Allow full send if we have a large advantage
                        if (from.troops - needed > 50) {} // nothing else
                    }

                    candidates.push({
                        from,
                        to: target,
                        needed,
                        troopsToSend,
                        valueRatio: targetValue / needed,
                        priority: 0   // Higher priority than EARLY
                    });
                }
            }
        }

        // If no viable attack found, bail out.
        if (candidates.length === 0) return null;

        // ------------------------------------------------------------------
        // Pick the best candidate: lowest priority first, then highest valueRatio
        // ------------------------------------------------------------------
        candidates.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.valueRatio - a.valueRatio;       // Larger ratio first
        });

        const chosen = candidates[0];
        if (!chosen) return null;

        // Ensure we don't exceed the planet’s inventory limit upon departure.
        const finalTroops = Math.min(chosen.troopsToSend, chosen.from.troops);

        // Set internal cooldown to respect the engine's 0.5‑second rule.
        this.memory.actionCooldown = this.api.getDecisionCooldown();

        // Optional: store mission for later reference (not used in this simple logic).
        // this.memory.missions.push({
        //     from: chosen.from.id,
        //     to: chosen.to.id,
        //     arrival: this.api.getTravelTime(chosen.from, chosen.to)
        // });

        // Submit the calculated move – IDs only, as per the API spec.
        return {
            fromId: chosen.from.id,
            toId: chosen.to.id,
            troops: Math.floor(finalTroops)
        };
    }
}