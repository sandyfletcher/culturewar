import BaseBot from './BaseBot.js';

export default class KimiDev72b extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.memory.phase = 'EARLY';
    }
    
    makeDecision(dt) {
        this.log(`Making decision at phase ${this.memory.phase}`);
        let action = null;
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const allTargets = [...enemyPlanets, ...neutralPlanets];
        
        // Prioritize reinforcing planets under attack
        for (const planet of myPlanets) {
            if (this.api.calculateThreat(planet) > planet.troops) {
                const reinforcements = Math.floor((this.api.calculateThreat(planet) - planet.troops) * 1.5);
                const available = planet.troops;
                if (available > reinforcements) {
                    action = { from: planet, to: planet, troops: reinforcements };
                    this.log(`Reinforcing ${planet.id} with ${reinforcements} troops`);
                    return action;
                }
            }
        }
        
        // Attack weakest enemy or nearest neutral planet
        let bestTarget = null;
        let minRatio = Infinity;
        const now = this.api.getElapsedTime();
        
        for (const planet of allTargets) {
            const distance = this.api.findNearestPlanet(planet, myPlanets);
            if (!distance) continue;
            const travelTime = this.api.getTravelTime(planet, distance);
            const predicted = this.api.predictPlanetState(planet, travelTime);
            
            if (predicted.owner !== this.playerId) {
                const requiredTroops = predicted.troops + 1;
                const ratio = requiredTroops / (planet.size + planet.troops);
                if (ratio < minRatio) {
                    minRatio = ratio;
                    bestTarget = { planet, requiredTroops, source: distance };
                }
            }
        }
        
        if (bestTarget) {
            const { source, planet, requiredTroops } = bestTarget;
            const available = source.troops;
            if (available > requiredTroops) {
                action = { from: source, to: planet, troops: requiredTroops };
                this.log(`Attacking ${planet.id} from ${source.id} with ${requiredTroops} troops`);
                return action;
            }
        }
        
        // Update game phase memory
        const currentPhase = this.api.getGamePhase();
        if (currentPhase !== this.memory.phase) {
            this.memory.phase = currentPhase;
            this.log(`Transitioning to phase: ${currentPhase}`);
        }
        
        this.log(`No valid action found; skipping turn.`);
        return null;
    }
}