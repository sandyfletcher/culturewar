// ===========================================
// root/javascript/bots/Claude35Sonnet.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Claude35Sonnet extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId); // call the parent constructor
        this.config = {
            minTroopsToLeave: 3,
            attackChance: 0.7,
        };
    }
    makeDecision(dt) { 
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        if (Math.random() < this.config.attackChance) {
            return this.makeAttackMove(myPlanets);
        } else {
            return this.makeReinforceMove(myPlanets);
        }
    }
    makeAttackMove(myPlanets) {
        const attackablePlanets = myPlanets.filter(p => p.troops > this.config.minTroopsToLeave * 2);
        if (attackablePlanets.length === 0) return null;
        const sourcePlanet = attackablePlanets[Math.floor(Math.random() * attackablePlanets.length)];
        const potentialTargets = this.api.getEnemyPlanets().concat(this.api.getNeutralPlanets());
        if (potentialTargets.length === 0) return null;
        const closestTarget = this.api.findNearestPlanet(sourcePlanet, potentialTargets);
        if (!closestTarget) return null;
        const availableTroops = sourcePlanet.troops - this.config.minTroopsToLeave;
        const troopsToSend = Math.floor(availableTroops * (0.5 + Math.random() * 0.3));
        if (troopsToSend <= 0) return null;
        return { from: sourcePlanet, to: closestTarget, troops: troopsToSend };
    }
    makeReinforceMove(myPlanets) {
        if (myPlanets.length < 2) return null;
        const sourcePlanets = myPlanets.filter(p => p.troops > this.config.minTroopsToLeave * 3);
        if (sourcePlanets.length === 0) return null;
        const sourcePlanet = sourcePlanets[Math.floor(Math.random() * sourcePlanets.length)];
        const potentialTargets = myPlanets.filter(p => p !== sourcePlanet);
        const targetPlanet = potentialTargets.sort((a, b) => a.troops - b.troops)[0];
        const availableTroops = sourcePlanet.troops - this.config.minTroopsToLeave;
        const troopsToSend = Math.floor(availableTroops * (0.3 + Math.random() * 0.2));
        if (troopsToSend <= 0) return null;
        return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
    }
}