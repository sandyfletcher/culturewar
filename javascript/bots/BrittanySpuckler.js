// assets/javascript/bots/BrittanySpuckler.js
import BaseBot from './BaseBot.js';

export default class BrittanySpuckler extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        
        this.personality = {
            aggressiveness: 0.2,     // Low - rarely attacks enemy planets
            expansion: 0.4,          // Medium-low - some neutral planet expansion
            consolidation: 0.9,      // High - focuses on reinforcing owned planets
            riskTolerance: 0.3,      // Low - conservative with troops
            neighborAwareness: 0.8   // High - very aware of threats
        };
        this.turnCounter = 0;        // Track turns for periodic actions
    }

    makeDecision() {
        this.turnCounter++;
        
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        const threatenedPlanet = this.findMostThreatenedPlanet(myPlanets);
        const strongestPlanet = [...myPlanets].sort((a, b) => b.troops - a.troops)[0];
        
        const shouldExpand = this.turnCounter % 5 === 0 && Math.random() < this.personality.expansion;
        const shouldAttack = this.turnCounter % 7 === 0 && Math.random() < this.personality.aggressiveness;
        
        let sourcePlanet, targetPlanet, troopsToSend;
        
        // 1. If a planet is threatened and not the strongest, reinforce it
        if (threatenedPlanet && threatenedPlanet !== strongestPlanet && strongestPlanet.troops > 20) {
            sourcePlanet = strongestPlanet;
            targetPlanet = threatenedPlanet;
            troopsToSend = Math.floor(strongestPlanet.troops * 0.4);
        }
        // 2. If it's time to expand
        else if (shouldExpand && strongestPlanet.troops > 30) {
            const neutralPlanets = this.api.getNeutralPlanets();
            if (neutralPlanets.length > 0) {
                const closestNeutral = this.api.findNearestPlanet(strongestPlanet, neutralPlanets);
                sourcePlanet = strongestPlanet;
                targetPlanet = closestNeutral;
                troopsToSend = Math.floor(strongestPlanet.troops * 0.5);
            }
        }
        // 3. If it's time to attack
        else if (shouldAttack && strongestPlanet.troops > 50) {
            const enemyPlanets = this.api.getEnemyPlanets();
            if (enemyPlanets.length > 0) {
                const sortedEnemies = [...enemyPlanets].sort((a, b) => a.troops - b.troops);
                if (sortedEnemies[0].troops < strongestPlanet.troops * 0.5) {
                    sourcePlanet = strongestPlanet;
                    targetPlanet = sortedEnemies[0];
                    troopsToSend = Math.floor(strongestPlanet.troops * 0.6);
                }
            }
        }
        // 4. Otherwise, consolidate forces
        else {
            if (myPlanets.length > 1) {
                const secondStrongest = myPlanets.filter(p => p !== strongestPlanet).sort((a, b) => b.troops - a.troops)[0];
                if (secondStrongest && secondStrongest.troops > 15) {
                    sourcePlanet = secondStrongest;
                    targetPlanet = strongestPlanet;
                    troopsToSend = Math.floor(secondStrongest.troops * 0.7);
                }
            }
        }
        
        if (sourcePlanet && targetPlanet && troopsToSend > 5) {
            return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
        }
        
        return null;
    }
    
    findMostThreatenedPlanet(myPlanets) {
        const planetsWithThreatScores = myPlanets.map(planet => {
            const threatScore = this.api.calculateThreat(planet);
            return { planet, threatScore };
        });
        
        planetsWithThreatScores.sort((a, b) => b.threatScore - a.threatScore);
        
        return planetsWithThreatScores.length > 0 ? planetsWithThreatScores[0].planet : null;
    }
}