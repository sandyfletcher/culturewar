import SummaryForAI from '../SummaryForAI.js';

class MyAIController {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.summary = new SummaryForAI(game);
    }

    makeDecision(dt) {
        // Get my planets
        const myPlanets = this.summary.getPlanetsOwnedBy(this.playerId);

        // Find the weakest enemy planet
        const weakestEnemyPlanet = this.summary.getWeakestPlanet(planet => planet.owner !== this.playerId && planet.owner !== 'neutral');

        if (weakestEnemyPlanet && myPlanets.length > 0) {
            // Attack the weakest enemy planet from my strongest planet
            const strongestPlanet = this.summary.getStrongestPlanet(planet => planet.owner === this.playerId);
            if(strongestPlanet) {
                this.game.sendTroops(strongestPlanet, weakestEnemyPlanet, Math.floor(strongestPlanet.troops / 2));
            }
        }
    }
}

export default MyAIController;