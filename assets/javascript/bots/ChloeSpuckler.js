import GameUtilities from '../GameUtilities.js';

class ChloeSpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.lastMoveTime = 0;
        this.moveCooldown = 1000; // 1 move per second
    }

    makeDecision({ planets, troopMovements }) {
        const now = Date.now();
        if (now - this.lastMoveTime < this.moveCooldown) return null; // Throttle moves

        const myPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        const enemyPlanets = GameUtilities.getEnemyPlanets(this.game, this.playerId);
        const neutralPlanets = GameUtilities.getNeutralPlanets(this.game);

        let bestMove = null;
        let bestScore = -Infinity;

        for (const from of myPlanets) {
            const targets = [...enemyPlanets, ...neutralPlanets];
            for (const to of targets) {
                if (from.troops <= 20) continue; // Keep defense minimum
                const amount = GameUtilities.recommendTroopSendAmount(from, to);
                if (amount <= 0) continue;

                const threat = GameUtilities.calculatePlanetThreat(this.game, from, this.playerId).threatLevel;
                const distance = GameUtilities.calculateDistance(from, to);
                const targetValue = GameUtilities.evaluatePlanetValue(to).totalValue;
                const score = targetValue - (distance * 0.5) - (threat * 50);

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { from, to, troops: amount };
                }
            }
        }

        if (bestMove) {
            this.lastMoveTime = now;
            return bestMove;
        }

        return null;
    }
}

export default ChloeSpuckler;
