// ===========================================
// root/javascript/bots/Gemini25b.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Gemini25b extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.config = {
            openingPhaseEnd: 60, // first minute is the 'Opening'
            reinforcementRatio: 0.6, // move 60% of troops from core worlds to the front
            troopReserveRatio: 0.35, // always leave 35% of troops on a planet for defense
            swarmAttackBuffer: 1.1, // send 110% of the troops needed for a capture
            swarmCoordinationRadius: 400 // look for contributing planets within this pixel radius
        };
    }
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        const elapsed = this.api.game.gameState.elapsedGameTime; // determine current game phase
        if (elapsed < this.config.openingPhaseEnd) {
            return this.executeOpeningPhase(myPlanets);
        } else if (this.isMidGame()) {
            return this.executeMidGamePhase(myPlanets);
        } else {
            return this.executeLateGamePhase(myPlanets);
        }
    }
    executeOpeningPhase(myPlanets) { // PHASE 1: Rapid Expansion
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return this.executeMidGamePhase(myPlanets); // early end to opening
        let bestTarget = null; // find most valuable, easily conquerable neutral planet
        let bestScore = -Infinity;
        for (const target of neutralPlanets) {
            const source = this.api.findNearestPlanet(target, myPlanets);
            if (!source || source.troops <= target.troops + 5) continue;
            const value = this.api.calculatePlanetValue(target); // score based on value and proximity
            const distance = this.api.getDistance(source, target);
            const score = value / (distance + 50); // prioritize close, valuable planets
            if (score > bestScore) {
                bestScore = score;
                bestTarget = { source, target };
            }
        }
        if (bestTarget) {
            const troopsToSend = bestTarget.target.troops + 5;
            if (bestTarget.source.troops > troopsToSend) {
                return { from: bestTarget.source, to: bestTarget.target, troops: troopsToSend };
            }
        }
        return null;
    }
    executeMidGamePhase(myPlanets) { // PHASE 2: MConsolidation & Fortification
        const corePlanets = myPlanets.filter(p => { // identify "core" (safe) and "border" (exposed) planets
            const nearest = this.api.findNearestPlanet(p, this.api.getAllPlanets().filter(other => other !== p));
            return nearest && nearest.owner === this.playerId;
        });
        const borderPlanets = myPlanets.filter(p => !corePlanets.includes(p));
        if (corePlanets.length === 0 || borderPlanets.length === 0) {
            return this.executeLateGamePhase(myPlanets); // not enough planets to have a core/border
        }
        const source = corePlanets.sort((a,b) => b.troops - a.troops)[0]; // find a rich core planet to send reinforcements from
        if (source.troops < 20) return this.executeLateGamePhase(myPlanets); // not enough troops to share
        const target = this.api.findNearestPlanet(source, borderPlanets); // find a border planet that needs troops
        if (source && target) {
            const troopsToSend = Math.floor(source.troops * this.config.reinforcementRatio);
            return { from: source, to: target, troops: troopsToSend };
        }
        return null;
    }
    executeLateGamePhase(myPlanets) { // PHASE 3: Coordinated Swarm Attacks
        const swarmDecision = this.findSwarmAttack(myPlanets); // prioritize finding and launching a swarm attack
        if (swarmDecision) return swarmDecision;
        return this.findStandardAttack(myPlanets); // fallback: if no swarm is possible, make a standard attack or reinforcement move
    }
    findSwarmAttack(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;
        const potentialTargets = enemyPlanets.map(target => ({ // find best enemy planet to swarm
            planet: target,
            value: this.api.calculatePlanetValue(target) / (target.troops + 10)
        })).sort((a, b) => b.value - a.value);
        for (const targetInfo of potentialTargets) {
            const target = targetInfo.planet;
            const contributors = myPlanets.filter(p => // find all our planets close enough to contribute to swarm
                this.api.getDistance(p, target) < this.config.swarmCoordinationRadius
            );
            if (contributors.length < 2) continue; // swarm needs at least 2 planets
            const availableForce = contributors.reduce((sum, p) => {
                return sum + Math.floor(p.troops * (1 - this.config.troopReserveRatio));
            }, 0);
            const estimatedTroopsAtArrival = this.api.estimateTroopsAtArrival(contributors[0], target);
            const requiredForce = Math.ceil(estimatedTroopsAtArrival * this.config.swarmAttackBuffer);
            if (availableForce > requiredForce) { // if we have enough combined force, launch the attack from the strongest contributor THIS turn
                const primaryAttacker = contributors.sort((a, b) => b.troops - a.troops)[0];
                const troopsToSend = Math.floor(primaryAttacker.troops * (1 - this.config.troopReserveRatio));
                if (troopsToSend > 0) {
                    return { from: primaryAttacker, to: target, troops: troopsToSend };
                }
            }
        }
        return null;
    }
    findStandardAttack(myPlanets) {
        const strongestPlanet = myPlanets.sort((a,b) => b.troops-a.troops)[0];
        if(!strongestPlanet || strongestPlanet.troops < 15) return null;
        const allTargets = this.api.getEnemyPlanets().concat(this.api.getNeutralPlanets());
        if (allTargets.length === 0) return null;
        const nearestTarget = this.api.findNearestPlanet(strongestPlanet, allTargets);
        if(!nearestTarget) return null;
        const requiredForce = nearestTarget.troops + 5;
        const availableTroops = Math.floor(strongestPlanet.troops * (1 - this.config.troopReserveRatio));
        if(availableTroops > requiredForce) {
            return { from: strongestPlanet, to: nearestTarget, troops: availableTroops };
        }
        return null;
    }
    isMidGame() {
        const allPlanets = this.api.getAllPlanets();
        const totalPlanets = allPlanets.length;
        const neutralPlanets = this.api.getNeutralPlanets().length;
        return (neutralPlanets / totalPlanets) < 0.5; // mid-game is when less than half the planets are neutral
    }
}