// (Gemini2.js):
// Gemini's more sophisticated AI bot for Galcon

import SummaryForAI from '../SummaryForAI.js';

class ScoutSpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        this.summary = new SummaryForAI(game);
        this.aggressionFactor = 0.7; // Adjust for more/less aggressive behavior
    }

    makeDecision(dt) {
        if(this.summary.getGameOver()){
            return;
        }
        // Get my planets
        const myPlanets = this.summary.getPlanetsOwnedBy(this.playerId);

        if (myPlanets.length === 0) {
            return; // Nothing to do if I have no planets
        }

        // --- Early Game: Expand to nearby neutral planets ---
        if (this.summary.getTimeRemaining() > 240) { // First minute of the game
            this.expandToNeutrals(myPlanets);
        }

        // --- Mid Game: Reinforce, Attack, and Defend ---
        else {
            this.reinforcePlanets(myPlanets);
            this.attackBestTarget(myPlanets);
        }
    }

    expandToNeutrals(myPlanets) {
        for (const myPlanet of myPlanets) {
            // Find the nearest neutral planet
            const nearestNeutral = this.summary.getNearestPlanet(myPlanet, planet => planet.owner === 'neutral');

            if (nearestNeutral) {
                // Calculate the attack force needed to take the neutral planet
                const attackForce = this.summary.calculateAttackForce(nearestNeutral);

                // If we have enough available troops, launch the attack
                const availableTroops = this.summary.getAvailableTroopsForAttack(myPlanet);

                if (availableTroops > attackForce * this.aggressionFactor) {
                    this.game.sendTroops(myPlanet, nearestNeutral, Math.floor(availableTroops * this.aggressionFactor));
                }
            }
        }
    }

    reinforcePlanets(myPlanets) {
        for (const myPlanet of myPlanets) {
            // Calculate the reinforcement need for the planet
            const reinforcementNeed = this.summary.calculateReinforcementNeed(myPlanet);

            // If the planet needs reinforcements
            if (myPlanet.troops < reinforcementNeed) {
                // Find the best source to send reinforcements from
                const bestSource = this.summary.findBestDefenseSource(myPlanet);

                if (bestSource) {
                    // Calculate the number of troops to send
                    const availableTroops = this.summary.getAvailableTroopsForAttack(bestSource);
                    const troopsToSend = Math.min(availableTroops * this.aggressionFactor, reinforcementNeed - myPlanet.troops);

                    // Send the troops
                    if (troopsToSend > 10) {
                        this.game.sendTroops(bestSource, myPlanet, Math.floor(troopsToSend));
                    }
                }
            }
        }
    }

    attackBestTarget(myPlanets) {
        // Find the best attack target
        const bestTarget = this.summary.findBestAttackTarget();

        if (bestTarget) {
            // Find the strongest planet to launch the attack from
            const strongestPlanet = this.summary.getStrongestPlanet(planet => planet.owner === this.playerId);

            if (strongestPlanet) {
                // Calculate the attack force needed to take the target planet
                const attackForce = this.summary.calculateAttackForce(bestTarget);

                // If we have enough available troops, launch the attack
                const availableTroops = this.summary.getAvailableTroopsForAttack(strongestPlanet);

                if (availableTroops > attackForce * this.aggressionFactor) {
                    this.game.sendTroops(strongestPlanet, bestTarget, Math.floor(availableTroops * this.aggressionFactor));
                }
            }
        }
    }
}

export default ScoutSpuckler;