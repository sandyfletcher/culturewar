// =============================================
// root/javascript/bots/KimiDev72b.js
// =============================================

import BaseBot from './BaseBot.js';

export default class KimiDev72b extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
    }

    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }

        // Check for planets under threat
        for (const planet of myPlanets) {
            const threat = this.api.calculateThreat(planet);
            if (threat > 0) {
                const nearestRein = this.api.findNearestPlanet(planet, myPlanets.filter(p => p.id !== planet.id));
                if (nearestRein) {
                    const travelTime = this.api.getTravelTime(nearestRein, planet);
                    const requiredRein = threat + 1;
                    const futureRein = nearestRein.troops + (nearestRein.productionRate * travelTime);
                    const troopsToSend = Math.min(requiredRein, futureRein);
                    if (troopsToSend > 0) {
                        this.log(`Reinforcing ${planet.id} with ${troopsToSend} from ${nearestRein.id}`);
                        return { from: nearestRein, to: planet, troops: troopsToSend };
                    }
                }
            }
        }

        // No threats, proceed to offense
        const targets = [...this.api.getNeutralPlanets(), ...this.api.getEnemyPlanets()];
        if (targets.length === 0) {
            return null;
        }

        // Sort targets by strategic value in descending order
        targets.sort((a, b) => this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a));

        for (const target of targets) {
            const nearestSource = this.api.findNearestPlanet(target, myPlanets);
            if (nearestSource) {
                const travelTime = this.api.getTravelTime(nearestSource, target);
                const futureTarget = this.api.predictPlanetState(target, travelTime);
                let requiredTroops = 0;

                // Check if the target is neutral or enemy
                if (futureTarget.owner === 'neutral') {
                    requiredTroops = futureTarget.troops + 1;
                } else if (futureTarget.owner !== this.playerId) {
                    requiredTroops = futureTarget.troops + 1;
                } else {
                    // Already owned, just send some troops for reinforcement
                    requiredTroops = 1;
                }

                const futureSourceTroops = nearestSource.troops + (nearestSource.productionRate * travelTime);
                const troopsToSend = Math.min(requiredTroops, futureSourceTroops);
                if (troopsToSend > 0) {
                    this.log(`Attacking ${target.id} from ${nearestSource.id} with ${troopsToSend}`);
                    return { from: nearestSource, to: target, troops: troopsToSend };
                }
            }
        }

        return null;
    }
}