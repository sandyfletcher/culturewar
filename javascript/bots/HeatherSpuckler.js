// assets/javascript/bots/HeatherSpuckler.js
import BaseBot from './BaseBot.js';

export default class HeatherSpuckler extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        
        this.personality = {
            aggressiveness: 1,
            expansion: 0.4,
            consolidation: 0.3,
            riskTolerance: 1,
            neighborAwareness: 0.3
        };
    }

    makeDecision() {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        const sortedMyPlanets = [...myPlanets].sort((a, b) => b.troops - a.troops);
        const sourcePlanet = sortedMyPlanets[0];
        
        const minimumTroopsToSend = 5;
        if (sourcePlanet.troops < minimumTroopsToSend) return null;
        
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        
        if (enemyPlanets.length === 0 && neutralPlanets.length === 0) return null;
        
        let targetPlanet;
        
        if (enemyPlanets.length > 0 && Math.random() < this.personality.aggressiveness) {
            const sortedEnemies = enemyPlanets.sort((a, b) => 
                (a.troops / this.api.getDistance(sourcePlanet, a)) - 
                (b.troops / this.api.getDistance(sourcePlanet, b))
            );
            targetPlanet = sortedEnemies[0];
        } else if (neutralPlanets.length > 0 && Math.random() < this.personality.expansion) {
            targetPlanet = this.api.findNearestPlanet(sourcePlanet, neutralPlanets);
        } else if (myPlanets.length > 1 && Math.random() < this.personality.consolidation) {
            const otherOwnedPlanets = myPlanets.filter(p => p !== sourcePlanet);
            targetPlanet = otherOwnedPlanets.sort((a, b) => a.troops - b.troops)[0];
        } else {
            const allTargets = enemyPlanets.concat(neutralPlanets);
            targetPlanet = this.api.findNearestPlanet(sourcePlanet, allTargets);
        }

        if (!targetPlanet) return null;
        
        let troopPercentage;
        if (targetPlanet.owner === 'neutral') {
            troopPercentage = 0.3 + (this.personality.riskTolerance * 0.2);
        } else if (targetPlanet.owner === this.api.playerId) {
            troopPercentage = 0.2 + (this.personality.consolidation * 0.3);
        } else {
            troopPercentage = 0.5 + (this.personality.aggressiveness * 0.4);
        }
        
        const troopsToSend = Math.floor(sourcePlanet.troops * troopPercentage);
        if (troopsToSend < minimumTroopsToSend) return null;
        
        return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
    }
}