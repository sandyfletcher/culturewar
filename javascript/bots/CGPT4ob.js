// =============================================
// root/javascript/bots/CGPT4ob.js
// =============================================

import BaseBot from './BaseBot.js';

export default class CGPT4ob extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.memory = {
            missions: new Map(), // planetId => timestamp
            phase: 'early'
        };
    }
    makeDecision(dt) {
        const now = this.api.getElapsedTime?.() || Date.now() / 1000;
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        const totalTroops = this.api.getMyTotalTroops();
        const totalProd = this.api.getMyTotalProduction();
        // Phase detection
        if (this.memory.phase === 'early' && totalTroops > 300) {
            this.memory.phase = 'mid';
        } else if (this.memory.phase === 'mid' && totalTroops > 700) {
            this.memory.phase = 'late';
        }
        // Pick source: surplus + healthy production
        const sources = myPlanets
            .filter(p => p.troops > 25)
            .sort((a, b) => b.troops - a.troops || b.productionRate - a.productionRate);
        const source = sources[0];
        if (!source) return null;
        const potentialTargets = [
            ...this.api.getNeutralPlanets(),
            ...this.api.getEnemyPlanets()
        ];
        // Filter out planets recently targeted
        const cooldown = 4; // seconds
        const viableTargets = potentialTargets
            .filter(t => {
                const pid = t.id ?? `${t.x}|${t.y}`;
                return !this.memory.missions.has(pid) || now - this.memory.missions.get(pid) > cooldown;
            });
        const scored = viableTargets.map(target => {
            const dist = this.api.getDistance(source, target);
            const estTroops = this.api.estimateTroopsAtArrival(source, target);
            const value = this.api.calculatePlanetValue(target);
            const centrality = this.api.calculateCentrality(target);
            let score = value - estTroops;

            if (target.owner === 'neutral') score += 15;
            if (target.owner !== 'neutral' && this.memory.phase !== 'early') score += 5;
            if (this.memory.phase === 'late') score += centrality * 30;

            return { target, score, estTroops };
        });
        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        if (!best) return null;
        const sendAmount = Math.min(
            source.troops - 1,
            Math.ceil(best.estTroops + 5)
        );
        // Mark mission
        const targetId = best.target.id ?? `${best.target.x}|${best.target.y}`;
        this.memory.missions.set(targetId, now);
        // Cap bleed logic (if full and no good attack, send to nearest friendly)
        if (source.troops >= 990 && !best) {
            const friendlies = myPlanets.filter(p => p !== source);
            const backup = this.api.findNearestPlanet(source, friendlies);
            if (backup) {
                return {
                    from: source,
                    to: backup,
                    troops: Math.floor(source.troops * 0.3)
                };
            }
        }
        return {
            from: source,
            to: best.target,
            troops: sendAmount
        };
    }
}
