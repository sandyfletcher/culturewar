// =============================================
// root/javascript/bots/CGPT4o.js
// =============================================

import BaseBot from './BaseBot.js';

export default class CGPT4o extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.memory = {
            missions: new Map(), // planetId => timestamp
            phase: 'early'
        };
    }
    makeDecision(dt) {
        const now = this.api.getElapsedTime();
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        const totalTroops = this.api.getMyTotalTroops();
        
        // Phase detection
        if (this.memory.phase === 'early' && totalTroops > 300) {
            this.memory.phase = 'mid';
        } else if (this.memory.phase === 'mid' && totalTroops > 700) {
            this.memory.phase = 'late';
        }

        const source = myPlanets
            .filter(p => p.troops > 25)
            .sort((a, b) => b.troops - a.troops)[0];
        
        if (!source) return null;

        const potentialTargets = [
            ...this.api.getNeutralPlanets(),
            ...this.api.getEnemyPlanets()
        ];
        
        // Filter out planets recently targeted
        const cooldown = 4; // seconds
        const viableTargets = potentialTargets
            .filter(t => !this.memory.missions.has(t.id) || now - this.memory.missions.get(t.id) > cooldown);

        const scored = viableTargets.map(target => {
            const travelTime = this.api.getTravelTime(source, target);
            const predictedState = this.api.predictPlanetState(target, travelTime);
            // Do not attack if we predict we will already own the planet upon arrival.
            if (predictedState.owner === this.playerId) return null;
            const troopsOnArrival = predictedState.troops;
            const value = this.api.calculatePlanetValue(target);
            const centrality = this.api.calculateCentrality(target);
            let score = value - troopsOnArrival;

            if (target.owner === 'neutral') score += 15;
            if (this.memory.phase === 'late') score += centrality * 30;

            return { target, score, troopsNeeded: troopsOnArrival + 5 };
        }).filter(item => item && item.score > 0); // Filter out nulls and unprofitable moves
        if (scored.length === 0) return null;

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];
        
        if (!best) return null;

        const troopsToSend = Math.ceil(best.troopsNeeded);

        if (source.troops > troopsToSend) {
            this.memory.missions.set(best.target.id, now);
            return {
                from: source,
                to: best.target,
                troops: troopsToSend
            };
        }

        return null;
    }
}