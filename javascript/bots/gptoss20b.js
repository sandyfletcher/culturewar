// =============================================
// root/javascript/bots/gptoss20b.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    ChampionBot: A phased, predictive Galcon AI.
    • Early: Quickly grab nearby neutral planets.
    • Mid: Target the weakest opponent or unowned planet that offers the best attack‑score.
    • Late: Coordinate decisive all‑in moves while keeping our own planets protected.
    It uses the `predictPlanetState` helper to calculate exactly how many troops are needed
    for a conquest, and it keeps track of already‑targeted planets to avoid over‑committing.
    The bot respects the one‑action‑per‑cooldown rule and never mutates game objects.
*/

export default class gptoss20b extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            actionCooldown: 0,
            targeted: new Set(),   // planet IDs we have already targeted in the current phase
            phase: null,
        };
    }

    /** @private */
    #selectTarget() {
        const myPlanets = this.api.getMyPlanets();
        const neutral = this.api.getNeutralPlanets();
        const enemies = this.api.getEnemyPlanets();
        const allTargets = [...neutral, ...enemies];

        if (!allTargets.length) return null;

        // Score each target – lower score = better to attack
        const scores = allTargets
            .filter(t => !this.memory.targeted.has(t.id))
            .map(t => ({
                target: t,
                score:(t, myPlanets),
            }))
            .sort((a, b) => a.score - b.score);

        return scores.length ? scores[0].target : null;
    }

    /** @private */
    #scoreTarget(target, myPlanets) {
        const phase = this.api.getGamePhase();
        const origin = this.#bestOrigin(target, myPlanets);
        if (!origin) return Infinity;

        const travel = this.api.getTravelTime(origin, target);
        const future = this.api.predictPlanetState(target, travel);

        // Base value: enemy strength or neutral size
        let value = target.owner === 'neutral'
            ? target.size * 0.8   // neutral planets are cheaper
            : this.api.getPlayerStats(target.owner).totalTroops * 1.0;

        // Add travel time penalty
        value += travel * 2;

        // Safety buffer (if defenders may grow)
        if (future.troops > target.troops * 1.1) value *= 1.2;

        // Phase adjustments
        if (phase === 'EARLY') value *= 0.9;
        if (phase === 'LATE')  value *= 1.05;

        return value;
    }

    /** @private */
    #bestOrigin(target, myPlanets) {
        return myPlanets.reduce(
            (best, p) => !best || p.troops > best.troops ? p : best,
            null
        );
    }

    /** @private */
    #attemptAttack(origin, target) {
        const travel = this.api.getTravelTime(origin, target);
        const future = this.api.predictPlanetState(target, travel);

        // Troops needed: defenders + small safety margin
        const needed = Math.ceil(future.troops + 5);

        if (origin.troops < needed) return null; // not enough

        // Keep 10% reserve on the origin planet
        const send = Math.min(origin.troops * 0.9, origin.troops - 20);
        const troopsToSend = Math.max(0, Math.min(send, origin.troops - needed));

        if (!troopsToSend) return null;

        return this.#makeDecision(origin.id, target.id, Math.floor(troopsToSend));
    }

    /** @private */
    #defendThreats() {
        const myPlanets = this.api.getMyPlanets();

        for (const p of myPlanets) {
            const incoming = this.api.getIncomingAttacks(p);
            if (!incoming.length) continue;

            const netIncoming = incoming.reduce((s, f) => s + f.amount, 0);
            const future = this.api.predictPlanetState(p, 0);

            if (future.owner !== this.playerId || future.troops < netIncoming + 10) {
                const origin = this.#bestOrigin(p, myPlanets);
                if (!origin || origin.id === p.id) continue;

                const travel = this.api.getTravelTime(origin, p);
                const destFuture = this.api.predictPlanetState(p, travel);
                const needed = Math.max(0, netIncoming - destFuture.troops + 5);

                if (origin.troops > needed) {
                    return this.#makeDecision(origin.id, p.id, Math.floor(needed));
                }
            }
        }
        return null;
    }

    /** @private */
    #makeDecision(fromId, toId, troops) {
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        this.memory.targeted.add(toId);
        return { fromId, toId, troops };
    }

    /**
     * Called by the engine each time the bot may act.
     * @param {number} dt - Time elapsed since the last decision, scaled by game speed.
     * @returns {object|null} Decision object or null to do nothing.
     */
    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const currentPhase = this.api.getGamePhase();
        if (currentPhase !== this.memory.phase) {
            this.memory.phase = currentPhase;
            this.memory.targeted.clear(); // reset during phase change
        }

        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets.length) return null;

        // 1) Try an attack
        const target = this.#selectTarget();
        if (target) {
            const origin = this.#bestOrigin(target, myPlanets);
            if (origin) {
                const decision = this.#attemptAttack(origin, target);
                if (decision) return decision;
            }
        }

        // 2) Defend if threatened
        const defendDecision = this.#defendThreats();
        if (defendDecision) return defendDecision;

        // 3) Nothing worthwhile to do
        return null;
    }
}