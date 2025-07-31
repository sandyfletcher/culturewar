import BaseBot from './BaseBot.js';

class WesleySpuckler extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        
        this.lastDecisionTime = 0;
        this.decisionDelay = 1000;
    }

    findBestTarget(myPlanets, targetPlanets, myTotalTroops) {
        let bestTarget = null;
        let bestScore = -Infinity;

        for (const target of targetPlanets) {
            const closestPlanet = this.api.findNearestPlanet(target, myPlanets);
            if (!closestPlanet) continue;

            const distance = this.api.getDistance(closestPlanet, target);
            
            const score = (target.productionRate * 50) - (target.troops * 0.5) - (distance * 0.1) + (closestPlanet.troops > target.troops ? 20 : -20);

            const troopsNeeded = target.troops + 10;
            if (troopsNeeded > closestPlanet.troops || troopsNeeded > myTotalTroops * 0.4) {
                continue;
            }

            if (score > bestScore) {
                bestScore = score;
                bestTarget = {
                    from: closestPlanet,
                    to: target,
                    troops: Math.min(Math.floor(closestPlanet.troops * 0.7), troopsNeeded)
                };
            }
        }
        return bestTarget;
    }

    makeDecision() {
        const now = Date.now();
        if (now - this.lastDecisionTime < this.decisionDelay) return null;
        this.lastDecisionTime = now;

        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        const targetPlanets = enemyPlanets.length > 0 ? enemyPlanets : this.api.getNeutralPlanets();
        
        if (myPlanets.length === 0 || targetPlanets.length === 0) return null;

        const myTotalTroops = this.api.getMyTotalTroops();
        const playerTotalTroops = this.api.getPlayerTotalTroops('player1');

        if (myTotalTroops < playerTotalTroops * 0.7) {
            this.decisionDelay = 2000;
            return null;
        }
        this.decisionDelay = 1000;

        const bestMove = this.findBestTarget(myPlanets, targetPlanets, myTotalTroops);
        if (bestMove && bestMove.troops > 0) {
            return bestMove;
        }
        return null;
    }
}

export default WesleySpuckler;