// (TiffanySpuckler.js):
// Claude's first attempt at building a bot continues to beat later iterations, and will be kept on
// Assigned name: Tiffany Spuckler
import GameAPI from '../GameAPI.js';

export default class TiffanySpuckler {
    constructor(game, playerId) {
        this.api = new GameAPI(game, playerId);
        this.decisionCooldown = Math.random() * 2; // Random initial cooldown in seconds
        
        this.config = {
            minTroopsToLeave: 3,
            decisionInterval: 2,
            attackChance: 0.7,
        };
    }
    
    makeDecision() {
        this.decisionCooldown -= 1/60; // Approximate dt
        if (this.decisionCooldown > 0) return null;
        
        this.decisionCooldown = this.config.decisionInterval + Math.random();
        
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        if (Math.random() < this.config.attackChance) {
            return this.makeAttackMove(myPlanets);
        } else {
            return this.makeReinforceMove(myPlanets);
        }
    }
    
    makeAttackMove(myPlanets) {
        const attackablePlanets = myPlanets.filter(p => p.troops > this.config.minTroopsToLeave * 2);
        if (attackablePlanets.length === 0) return null;
        
        const sourcePlanet = attackablePlanets[Math.floor(Math.random() * attackablePlanets.length)];
        
        const potentialTargets = this.api.getEnemyPlanets().concat(this.api.getNeutralPlanets());
        if (potentialTargets.length === 0) return null;
        
        const closestTarget = this.api.findNearestPlanet(sourcePlanet, potentialTargets);
        if (!closestTarget) return null;
        
        const availableTroops = sourcePlanet.troops - this.config.minTroopsToLeave;
        const troopsToSend = Math.floor(availableTroops * (0.5 + Math.random() * 0.3));
        
        if (troopsToSend <= 0) return null;
        
        return { from: sourcePlanet, to: closestTarget, troops: troopsToSend };
    }
    
    makeReinforceMove(myPlanets) {
        if (myPlanets.length < 2) return null;
        
        const sourcePlanets = myPlanets.filter(p => p.troops > this.config.minTroopsToLeave * 3);
        if (sourcePlanets.length === 0) return null;
        
        const sourcePlanet = sourcePlanets[Math.floor(Math.random() * sourcePlanets.length)];
        
        const potentialTargets = myPlanets.filter(p => p !== sourcePlanet);
        const targetPlanet = potentialTargets.sort((a, b) => a.troops - b.troops)[0];
        
        const availableTroops = sourcePlanet.troops - this.config.minTroopsToLeave;
        const troopsToSend = Math.floor(availableTroops * (0.3 + Math.random() * 0.2));
        
        if (troopsToSend <= 0) return null;
        
        return { from: sourcePlanet, to: targetPlanet, troops: troopsToSend };
    }
}