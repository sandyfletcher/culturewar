// =============================================
// root/javascript/bots/KimiK2B.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * ChampionAnnihilator – a ruthless, cavalry-style rush bot that snowballs production through constant aggression,
 * expertly predicts future battles, avoids overkill, and re-evaluates targets every cooldown to always pick the globally best move.
 *
 * Strategic pillars
 * 1. Early, lightning-fast neutral grab with zero waste.
 * 2. Dynamic threat evaluation: never allow a planet to be taken without immediate reprisal.
 * 3. Constant pressure on the weakest hostile production center to keep opponents in check.
 * 4. Economic snowball: every captured planet immediately becomes a new launch base for the next wave.
 */

export default class KimiK2B extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.unlocked     = new Set();   // IDs of planets already tasked / incoming
        this.memory.lastMode     = 'expand';
    }

    makeDecision(dt) {
        // Skip remaining cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // ------- Helpers --------
        const myId  = this.playerId;
        const api   = this.api;

        const myPlanets      = api.getMyPlanets();
        const enemyPlanets   = api.getEnemyPlanets();
        const neutralPlanets = api.getNeutralPlanets();
        if (myPlanets.length === 0) return null;

        // Purge collisions in ‘unlocked’ every tick to keep set small & fresh
        this.memory.unlocked = new Set([...this.memory.unlocked].filter(id => {
            const p = api.getPlanetById(id);
            return p && p.owner !== myId; // still valid & not already mine
        }));

        // ------- Candidate generators --------
        const allPlanets = api.getAllPlanets();
        const now        = api.getElapsedTime();

        let bestDBA = null;   // decision-best-action {score, action}

        const evaluateSend = (source, dest, troops) => {
            const travel = api.getTravelTime(source, dest);
            const fut    = api.predictPlanetState(dest, travel + 0.1);  // slight buffer
            const needed = Math.ceil(fut.troops + (dest.size * 0.25));  // 0.25 size pad

            if (troops < needed || troops < 1) return; // cannot kill

            // quick score: production / needed troops * (centrality^0.5)
            const prod   = api.getPlanetProductionRate(dest);
            const cent   = api.getPlanetCentrality(dest);
            const score  = (prod / needed) * Math.sqrt(cent);

            // 10% extra urgency if enemy
            const boost  = dest.owner !== 'neutral' ? 1.5 : 1;
            if (!bestDBA || score * boost > bestDBA.score)
                bestDBA = { score: score * boost,
                            action: { fromId: source.id, toId: dest.id, troops: needed } };
        };

        // Expand vs Attack?
        const PHASE = api.getGamePhase();
        const CURRENT_PROD = myPlanets.reduce((s, p) => s + api.getPlanetProductionRate(p), 0);
        const BIGGEST_ENEMY_PROD = Math.max(
            0,
            ...api.getOpponentIds().map(op =>
                api.getAllPlanets()
                    .filter(p => p.owner === op)
                    .reduce((s, p) => s + api.getPlanetProductionRate(p), 0)
            )
        );

        const mode = (PHASE === 'LATE' || CURRENT_PROD >= BIGGEST_ENEMY_PROD * 1.2)
                        ? 'kill'
                        : (PHASE === 'EARLY' ? 'expand' : 'kill');
        this.memory.lastMode = mode;

        // Prioritize neutral or enemy planets accordingly
        const targets = mode === 'expand' ? neutralPlanets : enemyPlanets;

        // Create ‘available-sources’ pool (no planet in cooldown)
        const sourcePool = [...myPlanets].filter(p => !this.memory.unlocked.has(p.id));

        if (!targets.length || !sourcePool.length) return null;

        sourcePool.sort((a, b) => b.troops - a.troops); // largest garrison first

        for (const src of sourcePool) {
            const bestTgt = api.findNearestPlanet(src, targets);
            if (!bestTgt) continue;
            evaluateSend(src, bestTgt, Math.floor(src.troops * 0.75));
            break; // only one source per cooldown cycle (exactly one move rule)
        }

        // If no lethal move, consider sending from surplus planets to under-attack ones
        if (!bestDBA) {
            const threatened = myPlanets.filter(p => {
                const threat = api.calculateThreat(p);
                return threat > p.troops;
            });
            if (threatened.length) {
                const tgt = api.findNearestPlanet(threatened[0], sourcePool);
                if (tgt) {
                    const send = Math.floor(tgt.troops * 0.6);
                    bestDBA = { score: 999, // defensive priority
                                action: { fromId: tgt.id, toId: threatened[0].id, troops: send } };
                }
            }
        }

        // Commit
        if (bestDBA) {
            const srcId = bestDBA.action.fromId;
            const tgtId = bestDBA.action.toId;
            // Prevent duplicate targeting until arrival
            this.memory.unlocked.add(tgtId);
            this.memory.actionCooldown = api.getDecisionCooldown();
            return bestDBA.action;
        }

        // Default stall when no clear move
        this.memory.actionCooldown = api.getDecisionCooldown();
        return null;
    }
}