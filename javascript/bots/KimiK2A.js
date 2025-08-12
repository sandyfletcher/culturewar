// =============================================
// root/javascript/bots/KimiK2A.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * K2GalconBot
 * A greedy-yet-cautious hybrid strategist that balances expansion, defense,
 * and decisive strikes using predictive battle simulation.
 */

export default class KimiK2A extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);

        // memory blueprint
        this.memory.missions       = {};     // {planetId : {type:'attack|defend|reinforce', eta:number}}
        this.memory.phaseTactics   = null;   // last remembered game phase
        this.memory.actionCooldown = 0;      // local CPU throttle
    }

    /* ==========================================================
       MEMBER HELPERS
    ========================================================== */

    // build a quick score for candidate planets
    _scoreTarget(planet, isEnemy) {
        let score = 0;

        // core stats
        score += planet.productionRate * 20;           // raw income
        score += planet.size * 0.5;                    // easier to defend
        score += this.api.getPlanetCentrality(planet); // map position

        // front-line bonus for enemy planets
        if (isEnemy) {
            const myClosest = this.api.findNearestPlanet(planet, this.api.getMyPlanets());
            const enemyClosest = this.api.findNearestPlanet(planet, this.api.getEnemyPlanets());
            if (myClosest && enemyClosest) {
                const myDist   = this.api.getDistance(planet, myClosest);
                const theirDist = this.api.getDistance(planet, enemyClosest);
                if (myDist < theirDist) score += 5;
            }
        }

        return score;
    }

    // is planet already en-route or reserved?
    _isTasked(id) {
        return this.memory.missions[id] != null;
    }

    // prune missions whose fleets have arrived
    _pruneMissions() {
        const now = this.api.getElapsedTime();
        for (const id in this.memory.missions) {
            if (this.memory.missions[id].eta < now + 0.2) {
                delete this.memory.missions[id];
            }
        }
    }

    // lightweight timing cooldown (not the engine one)
    _onCooldown(dt) {
        if (this.memory.actionCooldown <= 0) return false;
        this.memory.actionCooldown -= dt;
        return this.memory.actionCooldown > 0;
    }

    /* ==========================================================
       CORE DECISION DRIVER
    ========================================================== */

    makeDecision(dt) {
        // ---- initial fast-reject checks ----
        if (this._onCooldown(dt)) return null;

        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets.length) return null;

        this._pruneMissions();

        // ---- derive strategic priority lists ----

        // Neutral and enemy planets grouped
        const neutrals = this.api.getNeutralPlanets();
        const enemies  = this.api.getEnemyPlanets();

        // detect game phase shift
        const phase = this.api.getGamePhase();
        if (phase !== this.memory.phaseTactics) {
            this.memory.phaseTactics = phase;
        }

        /* ---------- 1) EARLY or MID: Expansion Phase ---------- */
        if (phase === 'EARLY' || phase === 'MID') {
            // find best neutral target
            const untasked = neutrals.filter(p => !this._isTasked(p.id));
            if (untasked.length) {
                untasked.sort((a, b) => this._scoreTarget(a, false) - this._scoreTarget(b, false));
                const victim = untasked[0];

                // pick nearest source with overkill %
                let src = null;
                for (const p of myPlanets) {
                    if (p.troops < victim.troops + 5) continue;
                    if (!src || this.api.getDistance(p, victim) < this.api.getDistance(src, victim)) {
                        src = p;
                    }
                }

                if (src) {
                    const troopsNeeded = Math.ceil(victim.troops) + 1;
                    const safeSend     = Math.floor(src.troops * 0.9);

                    if (troopsNeeded <= safeSend) {
                        this.memory.actionCooldown = this.api.getDecisionCooldown();
                        this.memory.missions[victim.id] = {
                            type: 'attack',
                            eta: this.api.getElapsedTime() + this.api.getTravelTime(src, victim)
                        };
                        return { fromId: src.id, toId: victim.id, troops: troopsNeeded };
                    }
                }
            }
        }

        /* ---------- 2) Any Phase: Strongest Nearby Enemy ---------- */
        if (enemies.length) {
            // evaluate enemy targets
            const enemyScores = enemies.map(ep => ({
                planet: ep,
                score : this._scoreTarget(ep, true),
                src   : undefined
            }));

            // find best per-enemy source
            enemyScores.forEach(es => {
                const src = this.api.findNearestPlanet(es.planet, myPlanets);
                es.src = src;
                if (src) {
                    const timeToArrive = this.api.getTravelTime(src, es.planet);
                    const futureState  = this.api.predictPlanetState(es.planet, timeToArrive);

                    // only worth attacking if we can win with surplus
                    const attackPower  = Math.floor(src.troops * 0.8);
                    const needed       = Math.max(futureState.troops, 1) + 3;
                    es.canWin          = attackPower >= needed;
                    es.troopsNeeded    = needed;
                } else {
                    es.canWin = false;
                }
            });

            // choose the highest-value winnable
            enemyScores.filter(es => es.canWin)
                       .sort((a, b) => b.score - a.score);

            if (enemyScores.length && enemyScores[0].canWin) {
                const es = enemyScores[0];
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                this.memory.missions[es.planet.id] = {
                    type: 'attack',
                    eta: this.api.getElapsedTime() + this.api.getTravelTime(es.src, es.planet)
                };
                return {
                    fromId: es.src.id,
                    toId  : es.planet.id,
                    troops: es.troopsNeeded
                };
            }
        }

        /* ---------- 3) MID/LATE: Reinforce Weakest Planet ---------- */
        // Identify our weakest frontline planet under attack
        if (phase === 'MID' || phase === 'LATE') {
            let bestSrc = null;
            let bestDst = null;
            let bestReinforce = 0;

            myPlanets.forEach(dst => {
                const incomingAttacks = this.api.getIncomingAttacks(dst);
                if (incomingAttacks.length === 0) return;

                let totalThreat = 0;
                incomingAttacks.forEach(f => totalThreat += f.amount);

                // predict future troops
                const future = this.api.predictPlanetState(dst, Math.max(...incomingAttacks.map(f => f.duration)));
                const surplusNeeded = Math.ceil(totalThreat) - Math.floor(dst.troops) + 5;

                // nearest source that can donate excess
                const donors = myPlanets.filter(p => p.id !== dst.id && p.troops > 40);
                if (donors.length === 0) return;

                const donor = this.api.findNearestPlanet(dst, donors);
                if (donor && donor.troops > surplusNeeded) {
                    bestSrc      = donor;
                    bestDst      = dst;
                    bestReinforce = surplusNeeded;
                }
            });

            if (bestSrc && bestDst) {
                this.memory.actionCooldown = this.api.getDecisionCooldown();
                this.memory.missions[bestDst.id] = {
                    type: 'reinforce',
                    eta: this.api.getElapsedTime() + this.api.getTravelTime(bestSrc, bestDst)
                };
                return {
                    fromId: bestSrc.id,
                    toId  : bestDst.id,
                    troops: bestReinforce
                };
            }
        }

        // no tactically sound move this turn
        return null;
    }
}