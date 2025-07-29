// (Gemini1.js):
// Gemini's first run
// they've been removed now, but this model wrote its own functions
// to calculate things like distance between two planets
// or "function to get all planets owned by a specific player"
// initially i just let bots do this, write their own workarounds to determine the info they needed
// later i decided to create a singular file bots pull info from

import GameAPI from '../GameAPI.js';

class RumerSpuckler {
    constructor(game, playerId) {
        this.api = new GameAPI(game, playerId);
        this.lastDecisionTime = 0;
        this.decisionInterval = 250;
    }

    makeDecision() {
        const now = Date.now();
        if (now - this.lastDecisionTime < this.decisionInterval) return null;
        this.lastDecisionTime = now;

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        const defenseDecision = this.defendThreatenedPlanets(myPlanets);
        if (defenseDecision) return defenseDecision;

        const attackDecision = this.attackWeakestTarget(myPlanets);
        if (attackDecision) return attackDecision;

        return null;
    }

    defendThreatenedPlanets(myPlanets) {
        let threatenedPlanets = myPlanets.map(planet => ({
            planet: planet,
            incoming: this.api.getIncomingAttacks(planet).reduce((sum, m) => sum + m.amount, 0)
        })).filter(p => p.incoming > 0);

        if (threatenedPlanets.length === 0) return null;
        
        threatenedPlanets.sort((a, b) => b.incoming - a.incoming);
        const targetPlanet = threatenedPlanets[0].planet;
        const incomingTroops = threatenedPlanets[0].incoming;

        const reinforcers = myPlanets.filter(p => p !== targetPlanet);
        if (reinforcers.length === 0) return null;

        const bestSourcePlanet = this.api.findNearestPlanet(targetPlanet, reinforcers);
        if (!bestSourcePlanet) return null;

        const troopsToSend = Math.ceil(incomingTroops - targetPlanet.troops) + 5;
        const availableTroops = Math.floor(bestSourcePlanet.troops * 0.75);
        const troopsActuallySent = Math.min(troopsToSend, availableTroops);

        if (troopsActuallySent <= 0) return null;
        
        return { from: bestSourcePlanet, to: targetPlanet, troops: troopsActuallySent };
    }

    attackWeakestTarget(myPlanets) {
        const allTargets = this.api.getEnemyPlanets().concat(this.api.getNeutralPlanets());
        if (allTargets.length === 0) return null;

        const weakestTarget = allTargets.sort((a, b) => a.troops - b.troops)[0];
        if (!weakestTarget) return null;

        const bestSourcePlanet = this.api.findNearestPlanet(weakestTarget, myPlanets);
        if (!bestSourcePlanet) return null;
        
        const troopsToSend = Math.ceil(weakestTarget.troops) + 5;
        const availableTroops = Math.floor(bestSourcePlanet.troops * 0.75);
        const troopsActuallySent = Math.min(troopsToSend, availableTroops);

        if (troopsActuallySent <= 0 || troopsActuallySent >= bestSourcePlanet.troops) return null;

        return { from: bestSourcePlanet, to: weakestTarget, troops: troopsActuallySent };
    }
}

export default RumerSpuckler;