// =============================================
// root/javascript/bots/KimiK2D.js
// =============================================

import BaseBot from './BaseBot.js';

/**
    An adaptive, aggression-calibrated expansion and elimination engine.
    ChronosBot evaluates local strength, global tempo, explicit risk windows, 
    and future state predictions to pick the single most "tempo-efficient" move each turn.
*/

export default class KimiK2D extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // Memory fields
        this.memory.actionCooldown = 0;
        this.memory.missions = {}; // {planetId: {type:'attack'|'reinforce', targetId, eta}}
        this.memory.lastPhase = null;
        this.memory.frontier = null; // a quick cached ordered list of expanding front planets
        this.memory.evalCache = new Map(); // shallow cache for planet valuations
    }

    //----------------------------------------------------------------------
    // Planet & move value helpers
    //----------------------------------------------------------------------
    
    // Blend of production, distance to my borders, centrality, owning value (neutral vs enemy)
    scorePlanet(p, myClosest) {
        const k = `${p.id}|${myClosest.id}`;
        if (this.memory.evalCache.has(k)) return this.memory.evalCache.get(k);

        let score = 0;
        const enemyDist = this.api.getDistance(p, myClosest);
        const prod = this.api.getPlanetProductionRate(p);
        const centrality = this.api.getPlanetCentrality(p);
        
        // Neutral planets: capture is always positive but must beat distance penalty
        if (p.owner === 'neutral') {
            // Early neutrals are worth slightly more than their production
            score = (prod + 0.75 * p.size) / (1 + enemyDist / 100);
        } else if (!this.ownedByMe(p)) {
            // Enemy – value goes up with how many of *my* planets it threatens
            const thrust = this.api.getMyPlanets()
                               .reduce((sum, mp) => sum + (this.api.getDistance(mp, p) < 120), 0);
            score = (prod + p.troops + thrust * 5) / (1 + enemyDist / 150);
        }
        this.memory.evalCache.set(k, score);
        return score;
    }

    // Cost to conquer a planet at a given projected time
    projectedCaptureCost(targetPlanet, buffer = 1.15) {
        const t0 = 0;
        const futureState = this.api.predictPlanetState(targetPlanet, t0);
        const needed = Math.ceil(futureState.troops * buffer);
        return needed;
    }

    // Determine whether a planet is already in a mission queue
    isCommitted(planetId) {
        return this.memory.missions[planetId] && 
               this.api.getElapsedTime() < this.memory.missions[planetId].eta;
    }

    // Utility: heat-map of immediate threat on every single planet
    immediateThreatOn(p) {
        const enemyFleets = this.api.getIncomingAttacks(p);
        return enemyFleets.reduce((sum, f) => sum + f.amount, 0) + 0.1;
    }

    //----------------------------------------------------------------------
    // Phased high-level strategies
    //----------------------------------------------------------------------

    earlyPhase(myPlanets) {
        // 1. Take the most profitable neutral within 2 hops
        let bestOpportunity = null;
        let bestGain = -999;
        for (const p of this.api.getNeutralPlanets()) {
            if (this.isCommitted(p.id)) continue;
            const bestSrc = this.api.findNearestPlanet(p, myPlanets);
            const dist   = this.api.getTravelTime(bestSrc, p);
            const needed = this.projectedCaptureCost(p, 1.25);
            const gain   = (this.api.getPlanetProductionRate(p) + 1) / (needed + dist);
            if (gain > bestGain && bestSrc.troops > needed * 1.5) {
                bestGain = gain;
                bestOpportunity = { src: bestSrc, dst: p, needed };
            }
        }
        if (bestOpportunity) return this.createMission(bestOpportunity);
        return null;
    }

    midPhase(myPlanets) {
        // 2a. Blitz smaller enemy planets on edge of my cluster
        let enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;

        let bestCommand = null;
        let bestScore = -999;
        for (const e of enemies) {
            if (this.isCommitted(e.id)) continue;

            // pick best holder
            const src = myPlanets
                            .filter(p => p.troops > 25)
                            .sort((a, b) => this.api.getDistance(a, e) - this.api.getDistance(b, e))[0];
            if (!src) continue;

            const enemyDist = this.api.getDistance(src, e);
            if (enemyDist > 200) continue;  // limit blitz range

            const captureCost = this.projectedCaptureCost(e, 1.2);
            const available   = src.troops - 20 > captureCost;
            const myRealScore = this.scorePlanet(e, src);
            if (available && myRealScore > bestScore) {
                bestScore = myRealScore;
                bestCommand = { src, dst: e, troops: captureCost };
            }
        }
        if (bestCommand) return this.createMission(bestCommand);

        // 2b. Reinforce planets under direct siege
        let underSiege = myPlanets.filter(p => this.immediateThreatOn(p) > 0);
        for (const sp of underSiege) {
            const surplus = myPlanets
                .filter(p => this.api.getDistance(p, sp) < 120 && p.troops > 30)
                .sort((a,b) => a.troops - b.troops)[0];
            const needed = Math.ceil(this.immediateThreatOn(sp) * 1.2);
            if (surplus && surplus.troops > needed + 20) {
                return this.createMission({ src: surplus, dst: sp, troops: needed });
            }
        }
        return null;
    }

    latePhase(myPlanets) {
        // All-in: hit the largest enemy cluster with an overwhelming fleet
        const enemyIds = this.api.getOpponentIds();
        const stats = enemyIds.map(id => ({
            id,
            ...this.api.getPlayerStats(id)
        })).filter(p => p.isActive).sort((a,b) => b.totalTroops - a.totalTroops)[0];

        if (!stats) return null;

        const enemyPlanets = this.api.getEnemyPlanets()
            .filter(e => e.owner === stats.id)
            .sort((a,b) => b.troops - a.troops);

        if (enemyPlanets.length === 0) return null;

        const target = enemyPlanets[0];
        const src = this.api.findNearestPlanet(target, myPlanets);
        const troopSum = myPlanets.reduce((sum,p)=>sum+p.troops,0);
        const enemySum = stats.totalTroops;
        if (troopSum / enemySum > 1.6) {
            // 60 % overhead – push hard
            const takeForce = Math.ceil(this.projectedCaptureCost(target) * 1.05);
            if (src.troops > takeForce) {
                return this.createMission({ src, dst: target, troops: takeForce });
            }
        }
        return null;
    }

    //----------------------------------------------------------------------
    // Framework glue
    //----------------------------------------------------------------------

    ownedByMe(p) {
        return p.owner === this.playerId;
    }

    createMission(task) {
        const { src, dst, troops } = task;
        const eta = this.api.getTravelTime(src, dst) + this.api.getElapsedTime() + 1.0;
        this.memory.missions[dst.id] = { type:'attack', targetId: src.id, eta };
        // saturate task cost to survive rounding
        const toSend = Math.min(src.troops - 0.5, troops);
        return {
            fromId: src.id,
            toId:   dst.id,
            troops: Math.max(1, Math.floor(toSend))
        };
    }

    clearStaleMissions() {
        const now = this.api.getElapsedTime();
        for (const [pid, data] of Object.entries(this.memory.missions)) {
            if (now > data.eta) delete this.memory.missions[pid];
        }
    }

    //----------------------------------------------------------------------
    // Main decision entry point
    //----------------------------------------------------------------------

    makeDecision(dt) {
        // Core cooldown check (engine still enforces hard cooldown, but this prevents burning CPU)
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        this.clearStaleMissions();
        this.memory.evalCache.clear(); // keep cache lean

        const phase = this.api.getGamePhase();
        if (phase !== this.memory.lastPhase) {
            // reset on phase change to immediately adapt
            this.memory.missions = {};
            this.memory.lastPhase = phase;
        }

        let decision = null;
        switch(phase) {
            case 'EARLY': decision = this.earlyPhase(myPlanets); break;
            case 'MID':   decision = this.midPhase(myPlanets);   break;
            case 'LATE':  decision = this.latePhase(myPlanets);  break;
        }

        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
        }

        return decision;
    }
}