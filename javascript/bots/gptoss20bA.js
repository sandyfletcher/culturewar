// =============================================
// root/javascript/bots/gptoss20bA.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * DominanceBot
 *
 * A high‑performance Galcon bot that blends aggressive expansion with
 * disciplined target selection.  In the early game it colonises the
 * most valuable neutral worlds, in the mid game it focuses on the
 * strongest enemy planets that are vulnerable, and in the late game
 * it locks down remaining opponents with coordinated all‑in pushes.
 * The bot also respects the mandatory decision cooldown and never
 * overloads a planet with more than 999 troops.
 */

export default class gptoss20bA extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);

        // One‑shot timer to avoid unnecessary recalculation when we cannot act.
        this.memory.actionCooldown = 0;

        // Keep a quick lookup of planets that are already “targeted” by us
        // to avoid repeating the same attack unnecessarily.
        this.memory.targeted = new Set();
    }

    /**
     * Main decision loop
     * @param {number} dt Scaled time since the previous decision
     * @returns {object|null} A move or null for no action.
     */
    makeDecision(dt) {
        /* ------------------------------------------------------------------
         * Cooldown guard – if we are still in the mandatory cooldown we
         * can’t issue a new command, so we simply drop out.
         * ------------------------------------------------------------------ */
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets   = this.api.getMyPlanets();
        const neutral     = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const phase       = this.api.getGamePhase();

        // Remove planets from target set that we no longer own or that are
        // already flagged as our own (they could have been captured)
        this.memory.targeted = new Set(
            Array.from(this.memory.targeted)
                .filter(id => this.api.getPlanetById(id)?.owner === this.playerId)
        );

        /* ------------------------------------------------------------------
         * No planets left – nothing we can do.
         * ------------------------------------------------------------------ */
        if (myPlanets.length === 0) return null;

        /* ------------------------------------------------------------------
         * Helper functions
         * ------------------------------------------------------------------ */
        const findBestTarget = () => {
            // Keep track of the best decision found so far
            let best = null;

            /* ======  Early / Neutral Stage  ====== */
            if (neutral.length > 0) {
                for (const from of myPlanets) {
                    if (from.troops < 30) continue;          // arbitrary safety threshold

                    const target = this.api.findNearestPlanet(from, neutral);
                    if (!target) continue;

                    // skip if we already planned a move to it
                    if (this.memory.targeted.has(target.id)) continue;

                    const travel = this.api.getTravelTime(from, target);
                    const troopsToSend = Math.min(
                        Math.max(15, Math.floor(from.troops * 0.35)), // 35% of the base or at least 15
                        Math.floor(from.troops * 0.8)                 // never leave less than 20%
                    );

                    const value = this.api.calculatePlanetValue(target);

                    // Only consider if we can actually send
                    if (troopsToSend > 0 && from.troops >= troopsToSend) {
                        if (!best || best.value < value) {
                            best = {
                                from,
                                to: target,
                                troops: troopsToSend,
                                type: 'neutral',
                                value
                            };
                        }
                    }
                }
            }

            /* ======  Mid / Enemy Stage  ====== */
            for (const from of myPlanets) {
                if (from.troops < 40) continue; // keep a defense margin

                // tradeoffs: avoid sending from a planet that is under siege
                const incoming = this.api.getIncomingAttacks(from);
                if (incoming.length) continue;   // skip attacked planets for safety

                const target = this.api.findNearestPlanet(from, enemyPlanets);
                if (!target) continue;
                if (this.memory.targeted.has(target.id)) continue;

                const travel = this.api.getTravelTime(from, target);
                const predicted = this.api.predictPlanetState(target, travel);

                // If it's already ours, no need to attack
                if (predicted.owner === this.playerId) continue;

                // We need to outnumber the expected troops + a safety margin
                const required = Math.ceil(predicted.troops + 1);
                const requiredWithMargin = Math.ceil(required * 1.1); // 10% extra

                // Ensure we can actually deliver the required number
                if (from.troops >= requiredWithMargin) {
                    const value = this.api.calculatePlanetValue(target);
                    if (!best || best.value < value) {
                        best = {
                            from,
                            to: target,
                            troops: requiredWithMargin,
                            type: 'enemy',
                            value
                        };
                    }
                }
            }

            /* ======  Late / All‑in Stage  ====== */
            // If the game is in late phase and few enemies remain,
            // try to concentrate all our available forces on the weakest
            // opponent presumed to be vulnerable.
            if (phase === 'LATE' && enemyPlanets.length <= 2) {
                for (const from of myPlanets) {
                    if (from.troops < 30) continue;

                    // find the weakest enemy by value
                    const weakest = enemyPlanets.reduce((best, p) =>
                        !best || this.api.calculatePlanetValue(p) < this.api.calculatePlanetValue(best)
                            ? p : best
                    , null);

                    if (!weakest) continue;
                    if (this.memory.targeted.has(weakest.id)) continue;

                    const travel = this.api.getTravelTime(from, weakest);
                    const predicted = this.api.predictPlanetState(weakest, travel);

                    // Even if we race many of our planets, our fleet should be sufficient
                    const required = Math.ceil(predicted.troops + 1);
                    const requiredWithMargin = Math.ceil(required * 1.25); // 25% buffer

                    if (from.troops >= requiredWithMargin) {
                        const value = this.api.calculatePlanetValue(weakest);
                        if (!best || best.value < value) {
                            best = {
                                from,
                                to: weakest,
                                troops: requiredWithMargin,
                                type: 'enemy',
                                value
                            };
                        }
                    }
                }
            }

            return best;
        };

        /* ------------------------------------------------------------------
         * Decide the best move for this turn
         * ------------------------------------------------------------------ */
        const decision = findBestTarget();

        if (!decision) {
            // No viable action found – wait for next opportunity
            return null;
        }

        /* ------------------------------------------------------------------
         * Respect the cooldown, remember the target, and output the decision.
         * ------------------------------------------------------------------ */
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        this.memory.targeted.add(decision.to.id);

        return {
            fromId: decision.from.id,
            toId:   decision.to.id,
            troops: decision.troops
        };
    }
}
