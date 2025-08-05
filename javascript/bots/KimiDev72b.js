// =============================================
// root/javascript/bots/KimiDev72b.js
// =============================================

import BaseBot from './BaseBot.js';

export default class KimiDev72b extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.memory.phase = 'EARLY';
    }
    
    makeDecision(dt) {
        this.log(`Making decision at phase ${this.memory.phase}`);
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        // --- Defensive Priority ---
        // Prioritize reinforcing planets under attack.
        const threatenedPlanets = myPlanets.filter(p => this.api.calculateThreat(p) > p.troops);
        if (threatenedPlanets.length > 0) {
            // Find the most threatened planet to save first.
            const planetToSave = threatenedPlanets.sort((a,b) => this.api.calculateThreat(b) - this.api.calculateThreat(a))[0];
            const troopsNeeded = Math.ceil(this.api.calculateThreat(planetToSave) - planetToSave.troops) + 1;

            // Find a *different* planet to send reinforcements from.
            const potentialHelpers = myPlanets.filter(p => p.id !== planetToSave.id && p.troops > troopsNeeded);
            if (potentialHelpers.length > 0) {
                const reinforcementSource = this.api.findNearestPlanet(planetToSave, potentialHelpers);
                if (reinforcementSource) {
                    const troopsToSend = Math.min(reinforcementSource.troops - 5, troopsNeeded); // Keep a small garrison
                    this.log(`DEFENDING: Sending ${troopsToSend} troops from ${reinforcementSource.id} to threatened planet ${planetToSave.id}`);
                    return { from: reinforcementSource, to: planetToSave, troops: troopsToSend };
                }
            }
        }
        
        // --- Offensive Priority ---
        // If no defense is needed, attack weakest enemy or nearest neutral planet.
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const allTargets = [...enemyPlanets, ...neutralPlanets];
        
        let bestTarget = null;
        let minTroopsRequired = Infinity;
        
        for (const targetPlanet of allTargets) {
            const nearestSource = this.api.findNearestPlanet(targetPlanet, myPlanets);
            if (!nearestSource) continue;
            
            const travelTime = this.api.getTravelTime(targetPlanet, nearestSource);
            const predictedState = this.api.predictPlanetState(targetPlanet, travelTime);
            
            if (predictedState.owner !== this.playerId) {
                const requiredTroops = predictedState.troops + 1;
                if (nearestSource.troops > requiredTroops) {
                    // Prioritize targets that are cheapest to capture.
                    if (requiredTroops < minTroopsRequired) {
                        minTroopsRequired = requiredTroops;
                        bestTarget = { from: nearestSource, to: targetPlanet, troops: requiredTroops };
                    }
                }
            }
        }
        
        if (bestTarget) {
            this.log(`ATTACKING: Sending ${bestTarget.troops} troops from ${bestTarget.from.id} to ${bestTarget.to.id}`);
            return bestTarget;
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