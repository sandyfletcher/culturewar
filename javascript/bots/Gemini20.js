// ===========================================
// root/javascript/bots/Gemini20.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Gemini20 extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.aggressionFactor = 0.7; // Personality trait
    }
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        const defenseMove = this.getDefenseMove(myPlanets);
        if (defenseMove) return defenseMove;
        const expansionMove = this.getExpansionMove(myPlanets);
        if (expansionMove) return expansionMove;
        const attackMove = this.getAttackMove(myPlanets);
        if (attackMove) return attackMove;
        return null;
    }
    getDefenseMove(myPlanets) {
        for (const myPlanet of myPlanets) {
            const incomingAttackers = this.api.getIncomingAttacks(myPlanet).reduce((sum, m) => sum + m.amount, 0);
            const reinforcementNeed = incomingAttackers - myPlanet.troops;
            if (reinforcementNeed > 0) {
                const reinforcers = myPlanets.filter(p => p !== myPlanet && p.troops > 10);
                if (reinforcers.length === 0) continue;
                const bestSource = this.api.findNearestPlanet(myPlanet, reinforcers);
                const troopsToSend = Math.min(Math.floor(bestSource.troops * this.aggressionFactor), reinforcementNeed + 5);
                if (troopsToSend > 0) {
                    return { from: bestSource, to: myPlanet, troops: troopsToSend };
                }
            }
        }
        return null;
    }
    getExpansionMove(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return null;
        for (const myPlanet of myPlanets) {
            if (myPlanet.troops < 15) continue;
            const nearestNeutral = this.api.findNearestPlanet(myPlanet, neutralPlanets);
            if (nearestNeutral) {
                const troopsNeeded = nearestNeutral.troops + 3;
                if (myPlanet.troops > troopsNeeded) {
                    // Send just enough to capture, not a blind percentage
                    return { from: myPlanet, to: nearestNeutral, troops: troopsNeeded };
                }
            }
        }
        return null;
    }
    getAttackMove(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;

        const strongestPlanet = myPlanets.sort((a,b) => b.troops - a.troops)[0];
        if(!strongestPlanet || strongestPlanet.troops < 20) return null;

        const weakestEnemy = enemyPlanets.sort((a,b) => a.troops - b.troops)[0];
        
        // *** UPDATED: Use the superior predictPlanetState function ***
        const travelTime = this.api.getTravelTime(strongestPlanet, weakestEnemy);
        const predictedState = this.api.predictPlanetState(weakestEnemy, travelTime);

        // Only attack if it's not predicted to be ours
        if (predictedState.owner !== this.playerId) {
            const troopsNeeded = predictedState.troops + 5;
            if (strongestPlanet.troops > troopsNeeded) {
                // Send what is needed to win, which is more intelligent than a fixed percentage.
                return { from: strongestPlanet, to: weakestEnemy, troops: troopsNeeded };
            }
        }

        return null;
    }
}