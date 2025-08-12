// =============================================
// root/javascript/bots/KimiK2.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * K2Champion – “Calculated Aggression”
 * Explosive early–expansion that turns into remorseless mid-game strikes on the strongest neighbour,
 * then clinical endgame consolidation.  Uses predictive state, multi-objective scoring,
 * safe-buffer math, and dynamic task lists to hoard value, not troops.
 */

export default class KimiK2 extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.lastTickElapsed = 0;
        this.memory.taskedFrom = new Set();          // planets already assigned a mission this tick
        this.memory.taskedTo   = new Set();          // targets already under fire
        this.memory.buffer     = 0.05;               // early expansion safety buffer
    }

    // ---------- Utility Layer --------------------------------------------------
    #copy(p) { return { ...p }; }

    #score(p) {                       // Expected value of a planet (higher=better)
        const prod   = this.api.getPlanetProductionRate(p);
        const centr  = this.api.getPlanetCentrality(p);
        return p.size * prod * (1 + centr);
    }

    #travelTime(from, to) { return this.api.getTravelTime(from, to); }

    #dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    // Current troops on planet **right now** (including queued arrivals)
    #trueGarrison(planet) {
        const fleets   = this.api.getAllTroopMovements()
            .filter(f => f.to.id === planet.id && f.owner !== this.playerId);
        const hostile  = fleets.reduce((sum, f) => sum + f.amount, 0);
        const future   = this.api.predictPlanetState(planet, 0); // “now”
        return future.owner === this.playerId
             ? Math.max(0, future.troops - hostile)
             : -hostile;   // negative → easier to take
    }

    // Minimum troops to conquer with chosen safety buffer
    #tToConquer(from, to, troopsOnTarget, buffer) {
        const t              = this.#travelTime(from, to);
        const prod           = this.api.getPlanetProductionRate(to);
        const reinforcements = Math.ceil(t * prod);
        return Math.ceil((troopsOnTarget + reinforcements + 1) * (1 + buffer));
    }

    // ---------- Tactical Layers ------------------------------------------------
    // 1. Pig-expansion on neutrals we can crush quickly.
    #tryExpansion() {
        const myPs   = this.api.getMyPlanets();
        const neut   = this.api.getNeutralPlanets()
            .filter(p => !this.memory.taskedTo.has(p.id));

        const candidates = [];
        for (const src of myPs) {
            if (this.memory.taskedFrom.has(src.id)) continue;
            for (const dst of neut) {
                const tgt       = this.#trueGarrison(dst);
                const sendReq   = this.#tToConquer(src, dst, tgt, this.memory.buffer);
                if (sendReq < src.troops - 2) {
                    const travelT = this.#travelTime(src, dst);
                    const value   = this.#score(dst) / sendReq;   // value per troop
                    candidates.push({ src, dst, sendReq, travelT, value });
                }
            }
        }
        if (!candidates.length) return null;

        // Best “value-per-troop” within shortest time wins
        candidates.sort((a, b) => (b.value + 200 / b.travelT) - (a.value + 200 / a.travelT));
        const pick = candidates[0];
        this.memory.taskedFrom.add(pick.src.id);
        this.memory.taskedTo.add(pick.dst.id);
        return { fromId: pick.src.id, toId: pick.dst.id, troops: pick.sendReq };
    }

    // 2. Striking overt hostile planets to cut their production.
    #tryStrike() {
        const phase  = this.api.getGamePhase();
        const myPs   = this.api.getMyPlanets();
        const foeId  = this.api.getOpponentIds()
            .sort((a, b) => this.api.getPlayerStats(b).totalProduction -
                           this.api.getPlayerStats(a).totalProduction)[0]; // strongest
        if (!foeId) return null;

        const enemyPs = this.api.getEnemyPlanets().filter(p => p.owner === foeId);
        const peers   = this.api.getOpponentIds().length - 1;

        // Lower buffer late game or when fighting many opponents aggressively
        const strikeBuffer = phase === 'LATE' ? 0.03 :
                             peers >= 2 ? 0.08 : 0.05;

        const candidates = [];
        for (const src of myPs) {
            if (this.memory.taskedFrom.has(src.id)) continue;

            const within = enemyPs.filter(p =>
                this.#dist(src, p) < (phase === 'EARLY' ? 250 : 450)
            );
            for (const e of within) {
                const troopsNow = this.#trueGarrison(e);
                if (troopsNow <= 0) continue;

                const sendReq = this.#tToConquer(src, e, troopsNow, strikeBuffer);
                if (sendReq < src.troops - 1) {
                    const travel = this.#travelTime(src, e);
                    const prod   = this.api.getPlanetProductionRate(e);
                    // Prefer hit that removes a high producer
                    const priority = prod / (travel * (troopsNow + sendReq));
                    candidates.push({ src, dst: e, sendReq, priority });
                }
            }
        }
        if (!candidates.length) return null;

        candidates.sort((a, b) => b.priority - a.priority);
        const pick = candidates[0];
        this.memory.taskedFrom.add(pick.src.id);
        this.memory.taskedTo.add(pick.dst.id);
        return { fromId: pick.src.id, toId: pick.dst.id, troops: pick.sendReq };
    }

    // 3. When ahead → consolidate by reinforcing safe big planets
    #tryReinforce() {
        if (this.api.getGamePhase() !== 'LATE') return null;

        const myPlanets = this.api.getMyPlanets();
        const Centres   = myPlanets
            .filter(p => !this.memory.taskedFrom.has(p.id))
            .sort((a, b) => this.api.getPlanetCentrality(b) - this.api.getPlanetCentrality(a))
            .slice(0, 3);  // Top 3 centre pieces

        let maxMerge = null;
        for (const src of myPlanets) {
            if (this.memory.taskedFrom.has(src.id)) continue;
            for (const dst of Centres) {
                if (dst.id === src.id) continue;
                const dist     = this.#dist(src, dst);
                const spare    = Math.max(0, src.troops - 2);  // keep micro-guard
                const arrive   = this.api.predictPlanetState(dst, this.#travelTime(src, dst));
                const capLeft  = 999 - arrive.troops;
                if (capLeft <= 2) continue;
                const send = Math.min(spare, Math.min(50, capLeft));
                if (send < 5) continue;

                // Pagerank-merge: bigger centrality jump first
                const centrGain = 10 + this.api.getPlanetCentrality(dst) - 0.3;
                if (!maxMerge || centrGain / dist > maxMerge.measure) {
                    maxMerge = { fromId: src.id, toId: dst.id, troops: send, measure: centrGain / dist };
                }
            }
        }
        return maxMerge ? { fromId: maxMerge.fromId, toId: maxMerge.toId, troops: maxMerge.troops } : null;
    }

    // ---------- Main Loop ------------------------------------------------------
    makeDecision(dt) {
        // Re-init per tick
        this.memory.taskedFrom.clear();
        this.memory.taskedTo.clear();
        this.memory.lastTickElapsed += dt;

        if (this.api.getMyPlanets().length === 0) return null;

        // Adapt safety buffer on the fly
        const rivals   = this.api.getOpponentIds().filter(id => this.api.isPlayerActive(id)).length;
        this.memory.buffer = rivals > 3 ? 0.07 : 0.04;

        const moves = [
            this.#tryExpansion(),
            this.#tryStrike(),
            this.#tryReinforce()
        ];

        const action = moves.find(a => a !== null);
        if (!action) return null;     // idle until next tick

        // Use engine cooldown directly
        return action;
    }
}