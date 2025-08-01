// ===========================================
// root/javascript/bots/Claude37a.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Claude37a extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.minTroopsToSend = 5;
        this.capturePadding = 3;
        this.threatThreshold = 1.5;
        this.defenseReserveFactor = 0.3;
    }
    makeDecision(dt) {
        if (this.api.getMyPlanets().length === 0) return null;
        const defenseTarget = this.assessDefensiveNeeds();
        if (defenseTarget) {
            return defenseTarget;
        }
        const expansionTarget = this.findBestExpansionTarget();
        if (expansionTarget) {
            return expansionTarget;
        }
        const attackTarget = this.findBestAttackTarget();
        if (attackTarget) {
            return attackTarget;
        }
        return null;
    }
    findBestExpansionTarget() {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return null;
        const myPlanets = this.api.getMyPlanets();
        const rankedTargets = neutralPlanets.map(planet => {
            const sourcePlanet = this.api.findNearestPlanet(planet, myPlanets);
            if (!sourcePlanet) return null;
            const requiredTroops = planet.troops + this.capturePadding;
            const value = this.api.calculatePlanetValue(planet) / (1 + this.api.getDistance(sourcePlanet, planet)/500);
            return { planet, sourcePlanet, requiredTroops, value };
        }).filter(t => t !== null);
        rankedTargets.sort((a, b) => b.value - a.value);
        for (const target of rankedTargets) {
            const availableTroops = Math.floor(target.sourcePlanet.troops * (1 - this.defenseReserveFactor));
            if (availableTroops >= target.requiredTroops && target.requiredTroops >= this.minTroopsToSend) {
                return { from: target.sourcePlanet, to: target.planet, troops: target.requiredTroops };
            }
        }
        return null;
    }
    findBestAttackTarget() {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;
        const myPlanets = this.api.getMyPlanets();
        const attackTargets = enemyPlanets.map(planet => {
            const sourcePlanet = this.api.findNearestPlanet(planet, myPlanets);
            if (!sourcePlanet) return null;
            const estimatedTroops = this.api.estimateTroopsAtArrival(sourcePlanet, planet);
            const requiredTroops = Math.ceil(estimatedTroops) + this.capturePadding;
            const value = this.api.calculatePlanetValue(planet);
            return { planet, sourcePlanet, requiredTroops, value };
        }).filter(t => t !== null);
        attackTargets.sort((a, b) => (b.value / b.requiredTroops) - (a.value / a.requiredTroops));
        for (const target of attackTargets) {
            const availableTroops = Math.floor(target.sourcePlanet.troops * (1 - this.defenseReserveFactor));
            if (availableTroops >= target.requiredTroops && target.requiredTroops >= this.minTroopsToSend) {
                return { from: target.sourcePlanet, to: target.planet, troops: target.requiredTroops };
            }
        }
        return null;
    }
    assessDefensiveNeeds() {
        const myPlanets = this.api.getMyPlanets();
        const threatenedPlanets = myPlanets.map(planet => ({
            planet,
            threat: this.api.calculateThreat(planet),
        })).filter(data => data.threat / (data.planet.troops + 1) > this.threatThreshold);
        if (threatenedPlanets.length === 0) return null;
        threatenedPlanets.sort((a, b) => b.threat - a.threat);
        const mostThreatened = threatenedPlanets[0];
        const safeReinforcers = myPlanets.filter(p => p !== mostThreatened.planet && this.api.calculateThreat(p) < p.troops);
        if (safeReinforcers.length === 0) return null;
        const source = this.api.findNearestPlanet(mostThreatened.planet, safeReinforcers);
        const troopsToSend = Math.min(
            Math.floor(source.troops * (1 - this.defenseReserveFactor)),
            Math.ceil(mostThreatened.threat)
        );
        if (troopsToSend >= this.minTroopsToSend) {
            return { from: source, to: mostThreatened.planet, troops: troopsToSend };
        }
        return null;
    }
}