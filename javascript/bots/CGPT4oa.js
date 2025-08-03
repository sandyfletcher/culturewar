// =============================================
// root/javascript/bots/CGPT4oa.js
// =============================================

import BaseBot from './BaseBot.js';

export default class CGPT4oa extends BaseBot {
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        // Identify strongest planet with spare troops
        const source = myPlanets
            .filter(p => p.troops > 20)
            .sort((a, b) => b.troops - a.troops)[0];
        if (!source) return null;
        // Combine neutral and enemy planets into viable targets
        const targets = [
            ...this.api.getNeutralPlanets(),
            ...this.api.getEnemyPlanets()
        ];
        // Sort by proximity first, then strategic value
        const rankedTargets = targets
            .map(target => {
                const distance = this.api.getDistance(source, target);
                const value = this.api.calculatePlanetValue(target);
                const estimatedTroops = this.api.estimateTroopsAtArrival(source, target);
                return { target, distance, value, estimatedTroops };
            })
            .filter(t => t.estimatedTroops < source.troops - 5)
            .sort((a, b) => {
                // prioritize lower estimated defense, then higher value
                const scoreA = a.estimatedTroops * 1.5 - a.value;
                const scoreB = b.estimatedTroops * 1.5 - b.value;
                return scoreA - scoreB;
            });
        const best = rankedTargets[0];
        if (!best) return null;
        // Send a slightly padded force
        const sendAmount = Math.min(source.troops - 1, Math.ceil(best.estimatedTroops + 5));
        return {
            from: source,
            to: best.target,
            troops: sendAmount
        };
    }
}
