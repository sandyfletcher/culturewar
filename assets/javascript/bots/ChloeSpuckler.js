import GameAPI from '../GameAPI.js';

class ChloeSpuckler {
    constructor(game, playerId) {
        this.api = new GameAPI(game, playerId);
        this.lastMoveTime = 0;
        this.moveCooldown = 1000; // 1 move per second
    }

    makeDecision() {
        const now = Date.now();
        if (now - this.lastMoveTime < this.moveCooldown) return null;

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();

        let bestMove = null;
        let bestScore = -Infinity;

        for (const from of myPlanets) {
            if (from.troops <= 20) continue; // Keep defense minimum

            const targets = [...enemyPlanets, ...neutralPlanets];
            for (const to of targets) {
                const troopsAtArrival = this.api.estimateTroopsAtArrival(from, to);
                const troopsToSend = Math.ceil(troopsAtArrival) + 5;

                if (from.troops <= troopsToSend) continue;

                const threat = this.api.calculateThreat(from);
                const distance = this.api.getDistance(from, to);
                const targetValue = this.api.calculatePlanetValue(to);
                
                // Chloe's unique scoring logic
                const score = targetValue - (distance * 0.5) - (threat * 2);

                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { from, to, troops: troopsToSend };
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