// ===========================================
// root/javascript/bots/Gemini25b.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Gemini25b extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.name = 'Gemini 2.5 B';
        this.config = {
            // --- Phase Timings (in game seconds) ---
            openingPhaseEnd: 60, // The first minute is the 'Opening'
            // Mid-game is between opening and late-game
            // --- Strategic Parameters ---
            reinforcementRatio: 0.6,    // Move 60% of troops from core worlds to the front
            troopReserveRatio: 0.35,   // Always leave 35% of troops on a planet for defense
            swarmAttackBuffer: 1.1,     // Send 110% of the troops needed for a capture
            swarmCoordinationRadius: 400 // Look for contributing planets within this pixel radius
        };
    }
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        // Determine the current game phase
        const elapsed = this.api.game.gameState.elapsedGameTime;
        if (elapsed < this.config.openingPhaseEnd) {
            return this.executeOpeningPhase(myPlanets);
        } else if (this.isMidGame()) {
            return this.executeMidGamePhase(myPlanets);
        } else {
            return this.executeLateGamePhase(myPlanets);
        }
    }
    // --- PHASE 1: OPENING (Rapid Expansion) ---
    executeOpeningPhase(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return this.executeMidGamePhase(myPlanets); // Early end to opening
        // Find the most valuable, easily conquerable neutral planet
        let bestTarget = null;
        let bestScore = -Infinity;
        for (const target of neutralPlanets) {
            const source = this.api.findNearestPlanet(target, myPlanets);
            if (!source || source.troops <= target.troops + 5) continue;
            // Score based on value and proximity
            const value = this.api.calculatePlanetValue(target);
            const distance = this.api.getDistance(source, target);
            const score = value / (distance + 50); // Prioritize close, valuable planets
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
    // --- PHASE 2: MID-GAME (Consolidation & Fortification) ---
    executeMidGamePhase(myPlanets) {
        // Identify "core" (safe) and "border" (exposed) planets
        const corePlanets = myPlanets.filter(p => {
            const nearest = this.api.findNearestPlanet(p, this.api.getAllPlanets().filter(other => other !== p));
            return nearest && nearest.owner === this.playerId;
        });
        const borderPlanets = myPlanets.filter(p => !corePlanets.includes(p));
        if (corePlanets.length === 0 || borderPlanets.length === 0) {
            return this.executeLateGamePhase(myPlanets); // Not enough planets to have a core/border
        }
        // Find a rich core planet to send reinforcements from
        const source = corePlanets.sort((a,b) => b.troops - a.troops)[0];
        if (source.troops < 20) return this.executeLateGamePhase(myPlanets); // Not enough troops to share
        // Find a border planet that needs troops
        const target = this.api.findNearestPlanet(source, borderPlanets);
        if (source && target) {
            const troopsToSend = Math.floor(source.troops * this.config.reinforcementRatio);
            return { from: source, to: target, troops: troopsToSend };
        }
        return null;
    }
    // --- PHASE 3: LATE-GAME (Coordinated Swarm Attacks) ---
    executeLateGamePhase(myPlanets) {
        // Prioritize finding and launching a swarm attack
        const swarmDecision = this.findSwarmAttack(myPlanets);
        if (swarmDecision) return swarmDecision;
        // Fallback: If no swarm is possible, make a standard attack or reinforcement move
        return this.findStandardAttack(myPlanets);
    }
    findSwarmAttack(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;
        // Find the best enemy planet to swarm
        const potentialTargets = enemyPlanets.map(target => ({
            planet: target,
            value: this.api.calculatePlanetValue(target) / (target.troops + 10)
        })).sort((a, b) => b.value - a.value);
        for (const targetInfo of potentialTargets) {
            const target = targetInfo.planet;
            // Find all of our planets close enough to contribute to the swarm
            const contributors = myPlanets.filter(p =>
                this.api.getDistance(p, target) < this.config.swarmCoordinationRadius
            );
            if (contributors.length < 2) continue; // A swarm needs at least 2 planets
            const availableForce = contributors.reduce((sum, p) => {
                return sum + Math.floor(p.troops * (1 - this.config.troopReserveRatio));
            }, 0);
            const estimatedTroopsAtArrival = this.api.estimateTroopsAtArrival(contributors[0], target);
            const requiredForce = Math.ceil(estimatedTroopsAtArrival * this.config.swarmAttackBuffer);
            // If we have enough combined force, launch the attack from the strongest contributor THIS turn
            if (availableForce > requiredForce) {
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
        // Mid-game is when less than half the planets are neutral
        return (neutralPlanets / totalPlanets) < 0.5;
    }
}