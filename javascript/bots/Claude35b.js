// assets/javascript/bots/CodySpuckler.js

import BaseBot from './BaseBot.js';

export default class Claude35b extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.decisionCooldown = 0;
        this.minDecisionTime = 1.5;
        this.maxDecisionTime = 3.0;
    }
    makeDecision() {
        this.decisionCooldown -= 1/60;
        if (this.decisionCooldown > 0) return null;
        this.decisionCooldown = this.minDecisionTime + Math.random() * (this.maxDecisionTime - this.minDecisionTime);
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