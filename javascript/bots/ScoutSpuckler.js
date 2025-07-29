// (Gemini2.js):
// Gemini's more sophisticated AI bot for Galcon
import GameAPI from '../GameAPI.js';

class ScoutSpuckler {
    constructor(game, playerId) {
        this.api = new GameAPI(game, playerId);
        this.aggressionFactor = 0.7;
        this.lastDecisionTime = 0;
        this.decisionInterval = 1000; // ms
    }

    makeDecision() {
        const now = Date.now();
        if (now - this.lastDecisionTime < this.decisionInterval) {
            return null;
        }
        this.lastDecisionTime = now;
        
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        // Priority 1: Defend if necessary
        const defenseMove = this.getDefenseMove(myPlanets);
        if (defenseMove) return defenseMove;

        // Priority 2: Expand to neutrals if viable
        const expansionMove = this.getExpansionMove(myPlanets);
        if (expansionMove) return expansionMove;

        // Priority 3: Attack an enemy
        const attackMove = this.getAttackMove(myPlanets);
        if (attackMove) return attackMove;
        
        return null; // No valid move found
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
                const attackForce = nearestNeutral.troops + 3;
                if (myPlanet.troops > attackForce) {
                    return { from: myPlanet, to: nearestNeutral, troops: Math.floor(myPlanet.troops * 0.5) };
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

        // Find weakest enemy
        const weakestEnemy = enemyPlanets.sort((a,b) => a.troops - b.troops)[0];
        const troopsAtArrival = this.api.estimateTroopsAtArrival(strongestPlanet, weakestEnemy);
        const attackForce = troopsAtArrival + 5;

        if (strongestPlanet.troops > attackForce) {
             return { from: strongestPlanet, to: weakestEnemy, troops: Math.floor(strongestPlanet.troops * this.aggressionFactor) };
        }
        return null;
    }
}

export default ScoutSpuckler;