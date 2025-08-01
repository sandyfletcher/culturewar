// ===========================================
// assets/javascript/bots/Claude37b.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Claude37b extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.targetedPlanets = new Map();
        this.threatAssessmentCooldown = 0;
    }
    makeDecision(dt) {
        this.threatAssessmentCooldown -= dt;
        if (this.threatAssessmentCooldown <= 0) {
            this.assessThreats();
            this.threatAssessmentCooldown = 5; // Re-assess threats every 5 game seconds
        }
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        const gameStrategy = this.analyzeGameState(myPlanets);
        switch (gameStrategy) {
            case 'defend': return this.executeDefensiveMove(myPlanets);
            case 'expand': return this.executeExpansionMove(myPlanets);
            case 'attack': return this.executeAttackMove(myPlanets);
            default: return this.executeOpportunisticMove(myPlanets);
        }
    }
    assessThreats() {
        this.targetedPlanets.clear();
        this.api.getMyPlanets().forEach(myPlanet => {
            const incomingThreat = this.api.getIncomingAttacks(myPlanet).reduce((sum, m) => sum + m.amount, 0);
            if(incomingThreat > 0) this.targetedPlanets.set(myPlanet, incomingThreat);
        });
        const vulnerableEnemies = this.api.getEnemyPlanets().filter(p => p.troops < 15);
        vulnerableEnemies.forEach(p => this.targetedPlanets.set(p, -p.troops));
    }
    analyzeGameState(myPlanets) {
        const neutralCount = this.api.getNeutralPlanets().length;
        const underThreat = Array.from(this.targetedPlanets.values()).some(threat => threat > 0);
        if (underThreat) return 'defend';
        if (myPlanets.length < 3 || (neutralCount > 0 && myPlanets.length < 5)) return 'expand';
        return 'attack';
    }
    executeDefensiveMove(myPlanets) {
        let mostThreatenedPlanet = null;
        let highestThreat = 0;
        for (const [planet, threat] of this.targetedPlanets.entries()) {
            if (threat > highestThreat && planet.owner === this.api.playerId) {
                highestThreat = threat;
                mostThreatenedPlanet = planet;
            }
        }
        if (!mostThreatenedPlanet) return this.executeOpportunisticMove(myPlanets);
        const reinforcers = myPlanets.filter(p => p !== mostThreatenedPlanet && p.troops > 10);
        if (reinforcers.length === 0) return null;
        const closestReinforcement = this.api.findNearestPlanet(mostThreatenedPlanet, reinforcers);
        const troopsToSend = Math.floor(closestReinforcement.troops * 0.7);
        if (troopsToSend > 0) return { from: closestReinforcement, to: mostThreatenedPlanet, troops: troopsToSend };
        return null;
    }
    executeExpansionMove(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return this.executeAttackMove(myPlanets);
        const sourcePlanet = myPlanets.filter(p => p.troops > 15).sort((a, b) => b.troops - a.troops)[0];
        if (!sourcePlanet) return null;
        const capturable = neutralPlanets.filter(p => p.troops < sourcePlanet.troops * 0.6);
        const targetPlanet = this.api.findNearestPlanet(sourcePlanet, capturable.length > 0 ? capturable : neutralPlanets);
        if (!targetPlanet) return null;
        const requiredTroops = targetPlanet.troops * 1.5;
        const troopsToSend = Math.min(Math.floor(sourcePlanet.troops * 0.7), Math.ceil(requiredTroops));
        return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
    }
    executeAttackMove(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return this.executeOpportunisticMove(myPlanets);
        const sourcePlanet = myPlanets.filter(p => p.troops > 20).sort((a, b) => b.troops - a.troops)[0];
        if (!sourcePlanet) return null;
        const vulnerableEnemies = enemyPlanets.filter(p => p.troops < sourcePlanet.troops * 0.7);
        const targetPlanet = vulnerableEnemies.length > 0 ? this.api.findNearestPlanet(sourcePlanet, vulnerableEnemies) : enemyPlanets.sort((a,b) => a.troops - b.troops)[0];
        let troopsToSend = Math.floor(targetPlanet.troops < sourcePlanet.troops * 0.5 ? targetPlanet.troops * 1.5 : sourcePlanet.troops * 0.8);
        troopsToSend = Math.max(troopsToSend, 10);
        if(troopsToSend >= sourcePlanet.troops) troopsToSend = Math.floor(sourcePlanet.troops * 0.7);
        if (troopsToSend > 0) return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
        return null;
    }
    executeOpportunisticMove(myPlanets) {
        const sourcePlanet = myPlanets.filter(p => p.troops > 15).sort((a,b) => b.troops - a.troops)[0];
        if (!sourcePlanet) return null;
        const opportunities = Array.from(this.targetedPlanets.entries()).filter(([p, threat]) => threat < 0).sort((a,b) => a[1] - b[1]);
        if (opportunities.length > 0) {
            const [targetPlanet, threat] = opportunities[0];
            const troopsToSend = Math.floor(Math.max(sourcePlanet.troops * 0.6, Math.abs(threat) * 1.5));
            if (troopsToSend < sourcePlanet.troops) return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
        }
        return null;
    }
}