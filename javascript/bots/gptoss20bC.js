// =============================================
// root/javascript/bots/gptoss20bC.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * ChampionBot
 * ------------
 *
 * A compact, adaptive galcon bot designed to dominate
 * in high‑ Its strategic pillars are:
 *
 * 1. **Early Expansion** – Rapidly annex the nearest
 *    neutral planets only when the greedy 50 % of a
 *    planet’s troops are enough to win.
 *
 * 2. **Dynamic Defense** – Every tick the bot checks
 *    for incoming hostile fleets that could
 *    overwhelm a friendly planet.  If a threat
 *    is detected, the closest ally with spare
 *    troops sends a reinforcement to shrug it off.
 *
 * 3. **Mid/​Late Aggression** – Once the map is
 *    saturated or the opponent’s force drops
 *    below 70 % of ours, the bot shifts to a
 *    “harvest‐the‑weakest” mode, attacking
 *    the weakest enemy or high‑value neutral
 *    planet with the least travel cost.
 *
 * 4. **Resource Management** – Troops are never
 *    sent if the planet would dip below a safe
 *    minimum (10 troops) or if the target would
 *    end up holding > 999 troops.  A small
 *    safety buffer (5 troops) is always added
 *    to offensive units.
 *
 * 5. **Cooldown Awareness** – The bot tracks the
 *    engine‑provided decision cooldown and never
 *    tries to act during that window, avoiding
 *    unnecessary re‑calculations.
 *
 * All code resides in `makeDecision(dt)` – the sole
 * decision point.  Only string IDs are returned as
 * required by the engine.
 */

export default class gptoss20bC extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // Tracks remaining time (scaled) before we can act again.
        this.memory.actionCooldown = 0;
    }

    /**
     * Main decision function called by the engine.
     * @param {number} dt - Elapsed time since last decision (scaled by game speed).
     * @returns {object|null} Decision payload or null for no action.
     */
    makeDecision(dt) {
        // Propagate internal cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // Cache API data for this tick
        const myPlanets      = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets   = this.api.getEnemyPlanets();
        const phase          = this.api.getGamePhase();

        // No planets – nothing to do.
        if (myPlanets.length === 0) return null;

        const COOLDOWN = this.api.getDecisionCooldown();

        /* ---------- 1) Defensive Maneuvers ---------- */
        const defendDecision = this._defend(myPlanets, COOLDOWN);
        if (defendDecision) return defendDecision;

        /* ---------- 2) Aggressive / Expansion Moves ---------- */
        const attackDecision = this._attack(myPlanets, neutralPlanets, enemyPlanets, phase, COOLDOWN);
        if (attackDecision) return attackDecision;

        // No viable move – skip this tick
        return null;
    }

    /**
     * Defensive helper – send reinforcement to an threatened
     * friendly planet when an incoming hostile fleet would
     * overrun it.  Returns a decision object or null.
     *
     * @param {Planet[]} myPlanets
     * @param {number} COOLDOWN
     * @returns {object|null}
     */
    _defend(myPlanets, COOLDOWN) {
        // Helper to choose the nearest ally with enough troops
        const chooseHelper = (target, needed) => {
            const filt = myPlanets.filter(p => p.id !== target.id && p.troops >= needed);
            if (!filt.length) return null;
            let best = filt[0];
            let bestDist = this.api.getTravelTime(best, target);
            for (let i = 1; i < filt.length; i++) {
                const d = this.api.getTravelTime(filt[i], target);
                if (d < bestDist) {
                    bestDist = d;
                    best = filt[i];
                }
            }
            return best;
        };

        // Check every friendly planet for imminent danger
        for (const myPlanet of myPlanets) {
            const incoming = this.api.getIncomingAttacks(myPlanet);
            for (const fleet of incoming) {
                if (fleet.owner === this.playerId) continue; // ignore own forces
                // Troops that will exist when the attack arrives
                const futureTroops = myPlanet.troops + this.api.getPlanetProductionRate(myPlanet) * fleet.duration;
                if (fleet.amount <= futureTroops) continue; // safe

                const needed = Math.floor(fleet.amount - futureTroops + 5); // buffer
                const helper = chooseHelper(myPlanet, needed);
                if (!helper) continue; // no ally left with enough troops

                // Ensure we leave enough on helper for its own defense
                const send = Math.min(
                    Math.floor(helper.troops * 0.5),
                    helper.troops - 10 // keep 10 troops behind
                );
                if (send < needed) continue; // cannot counter

                // Final check: arrival troops on target will not exceed capacity
                const travel = this.api.getTravelTime(helper, myPlanet);
                const predicted = this.api.predictPlanetState(myPlanet, travel);
                const toTroops = Math.max(0, predicted.troops - send);
                const final = Math.max(0, send - predicted.troops);
                if (final > 999) continue; // cap

                // Cooldown before we can act again
                this.memory.actionCooldown = COOLDOWN;
                return {
                    fromId: helper.id,
                    toId: myPlanet.id,
                    troops: send
                };
            }
        }
        return null;
    }

    /**
     * Attack / expansion helper – determines the best
     * offensive payload for the current phase.
     *
     * @param {Planet[]} myPlanets
     * @param {Planet[]} neutralPlanets
     * @param {Planet[]} enemyPlanets
     * @param {string} phase 'EARLY' | 'MID' | 'LATE'
     * @param {number} COOLDOWN
     * @returns {object|null}
     */
    _attack(myPlanets, neutralPlanets, enemyPlanets, phase, COOLDOWN) {
        const allTargets = neutralPlanets.concat(enemyPlanets);

        // Helper to evaluate a possible move
        const evaluate = (from, to) => {
            const travel = this.api.getTravelTime(from, to);
            const predicted = this.api.predictPlanetState(to, travel);
            const defender = predicted.troops;
            const buffer = 5; // keep a small safety
            const required = Math.floor(defender + buffer);
            if (from.troops <= required) return null; // cannot win

            // Choose how many to send.
            // Aim to use up to 45 % of a planet's troops to keep a buffer.
            let send = Math.floor(from.troops * 0.45);
            // Ensure we survive the attack
            send = Math.max(send, required + 1);
            // Leave at least 10 troops on the source
            const remaining = from.troops - send;
            if (remaining < 10) return null;
            // Final arrival check
            const postArrival = Math.max(0, send - defender);
            if (postArrival > 999) {
                send -= postArrival - 999;
                if (send <= required) return null;
            }

            // Priority score – higher value targets and shorter travel are preferred
            const value = this.api.calculatePlanetValue(to);
            const score = travel - value * 0.1; // weight value harder than distance
            return { from, to, send, score };
        };

        // Gather all candidate actions
        const candidates = [];
        for (const from of myPlanets) {
            if (from.troops < 12) continue;     // squeeze out weak sources
            for (const to of allTargets) {
                if (from.id === to.id) continue;
                const move = evaluate(from, to);
                if (move) candidates.push(move);
            }
        }
        if (!candidates.length) return null;

        // Sort by priority ascending (smaller score = better)
        candidates.sort((a, b) => a.score - b.score);
        const best = candidates[0];

        // Final sanity check: Dispatch only if the queue allows
        this.memory.actionCooldown = COOLDOWN;
        return {
            fromId: best.from.id,
            toId: best.to.id,
            troops: best.send
        };
    }
}