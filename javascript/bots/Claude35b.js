// ===========================================
// assets/javascript/bots/Claude35b.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Claude35b extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
    }
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        const sourcePlanet = this.findSourcePlanet(myPlanets);
        if (!sourcePlanet || sourcePlanet.troops < 10) return null;
        const targetPlanet = this.findTargetPlanet(sourcePlanet);
        if (!targetPlanet) return null;
        const troopsToSend = Math.floor(sourcePlanet.troops / 2);
        return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
    }
    findSourcePlanet(myPlanets) {
        return [...myPlanets]
            .filter(planet => planet.troops >= 10)
            .sort((a, b) => b.troops - a.troops)[0] || null;
    }
    findTargetPlanet(sourcePlanet) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length > 0) {
            return this.api.findNearestPlanet(sourcePlanet, neutralPlanets);
        }
        const enemyPlanets = this.api.getEnemyPlanets();
        const vulnerableEnemyPlanets = enemyPlanets.filter(p => p.troops < sourcePlanet.troops / 2);
        if (vulnerableEnemyPlanets.length > 0) {
            return this.api.findNearestPlanet(sourcePlanet, vulnerableEnemyPlanets);
        }
        if (enemyPlanets.length > 0) {
            return this.api.findNearestPlanet(sourcePlanet, enemyPlanets);
        }
        return null;
    }
}