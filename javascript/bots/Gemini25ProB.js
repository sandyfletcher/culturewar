// =============================================
// root/javascript/bots/Gemini25ProB.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * DominatorBot employs a dynamic, multi-phased strategy to achieve victory through economic superiority and decisive military action.
 * This bot's core pillars are:
 * 1. Phased Strategy: Adapts its priorities from rapid expansion (Early Game) to targeted aggression (Mid Game) and decisive strikes (Late Game).
 * 2. Predictive Warfare: Heavily uses `predictPlanetState` to launch perfectly timed attacks and reinforcements, minimizing troop waste.
 * 3. Prioritized Actions: Follows a strict decision hierarchy each turn: Defend -> Attack -> Expand -> Consolidate, ensuring the most critical move is always made first.
 * 4. Intelligent Resource Management: Identifies high-value targets and prevents over-commitment of forces by tracking assigned planets per decision cycle.
 */
export default class Gemini25ProB extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
        // A set to track planets that have already been given a task this turn.
        this.memory.assignedPlanetIds = new Set();
    }

    /**
     * This method is called by the game engine when it's your turn.
     * @param {number} dt - The time elapsed since the last turn, scaled by game speed.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // Reset the set of assigned planets at the beginning of each decision.
        this.memory.assignedPlanetIds.clear();

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // Surrender if we have no planets left.
        }

        // --- Main Decision Logic ---
        // The bot will try to execute the first valid action it finds in this priority list.
        let decision = null;

        // 1. Defend planets in critical danger.
        decision = this.handleDefense(myPlanets);
        if (decision) return decision;

        const gamePhase = this.api.getGamePhase();

        // 2. Execute phase-specific offensive/expansionary maneuvers.
        switch (gamePhase) {
            case 'EARLY':
                decision = this.handleEarlyGame(myPlanets);
                break;
            case 'MID':
                decision = this.handleMidGame(myPlanets);
                break;
            case 'LATE':
                decision = this.handleLateGame(myPlanets);
                break;
        }
        if (decision) return decision;

        // 3. If no other action was taken, consolidate forces.
        decision = this.handleConsolidation(myPlanets);
        if (decision) return decision;

        return null; // No profitable action found.
    }

    /**
     * Finds the best source planet for a given task.
     * @param {object[]} potentialSources - A list of your planets to choose from.
     * @param {object} target - The target planet.
     * @param {number} troopsNeeded - The number of troops required for the mission.
     * @returns {object|null} The best source planet or null if none is suitable.
     */
    findBestSource(potentialSources, target, troopsNeeded) {
        let bestSource = null;
        let minTravelTime = Infinity;

        for (const source of potentialSources) {
            // Skip planets that are already assigned a task this turn.
            if (this.memory.assignedPlanetIds.has(source.id)) {
                continue;
            }

            // A planet should keep some troops for defense. Let's say at least 10 or 10% of its max.
            const troopsToKeep = Math.max(10, source.size * 0.2);
            if (source.troops > troopsNeeded + troopsToKeep) {
                const travelTime = this.api.getTravelTime(source, target);
                if (travelTime < minTravelTime) {
                    minTravelTime = travelTime;
                    bestSource = source;
                }
            }
        }
        return bestSource;
    }

    /**
     * A helper function to create and return a valid move object.
     * @param {string} fromId - The ID of the source planet.
     * @param {string} toId - The ID of the target planet.
     * @param {number} troops - The number of troops to send.
     * @returns {object} The formatted decision object.
     */
    makeMove(fromId, toId, troops) {
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        this.memory.assignedPlanetIds.add(fromId);
        return {
            fromId,
            toId,
            troops: Math.floor(troops)
        };
    }

    // ===============================================
    // STRATEGIC HANDLERS
    // ===============================================

    /** Priority 1: Defend planets under imminent threat. */
    handleDefense(myPlanets) {
        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            // Find the earliest arriving attack to determine our response window.
            const earliestAttack = incomingAttacks.reduce((earliest, current) =>
                current.duration < earliest.duration ? current : earliest
            );
            const timeToImpact = earliestAttack.duration;

            const predictedState = this.api.predictPlanetState(myPlanet, timeToImpact);

            // If we are predicted to lose the planet
            if (predictedState.owner !== this.playerId && predictedState.troops > 0) {
                const troopsNeeded = predictedState.troops + 5; // Need to beat the remaining enemy troops + safety buffer.

                // Find a nearby planet that can send reinforcements IN TIME.
                const potentialReinforcers = myPlanets.filter(p =>
                    p.id !== myPlanet.id && this.api.getTravelTime(p, myPlanet) < timeToImpact
                );

                const bestReinforcer = this.findBestSource(potentialReinforcers, myPlanet, troopsNeeded);

                if (bestReinforcer) {
                    // console.log(`DEFENDING ${myPlanet.id} with ${troopsNeeded} troops from ${bestReinforcer.id}`);
                    return this.makeMove(bestReinforcer.id, myPlanet.id, troopsNeeded);
                }
            }
        }
        return null;
    }

    /** Early Game: Focus on rapid expansion to high-value neutral planets. */
    handleEarlyGame(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) {
            return this.handleMidGame(myPlanets); // Transition if no neutrals left.
        }

        // Target high-production planets first.
        const valuableNeutrals = neutralPlanets
            .map(p => ({
                planet: p,
                value: p.productionRate / (this.api.getDistance(myPlanets[0], p) + 1) // Simple value: production over distance
            }))
            .sort((a, b) => b.value - a.value);

        for (const target of valuableNeutrals) {
            const troopsNeeded = target.planet.troops + 5; // Simple calc for neutrals
            const sourcePlanet = this.findBestSource(myPlanets, target.planet, troopsNeeded);
            if (sourcePlanet) {
                const troopsToSend = troopsNeeded + (sourcePlanet.troops - troopsNeeded) * 0.5; // Send a bit extra
                return this.makeMove(sourcePlanet.id, target.planet.id, troopsToSend);
            }
        }
        return null;
    }

    /** Mid Game: Target the strongest opponent and consolidate forces. */
    handleMidGame(myPlanets) {
        const opponentIds = this.api.getOpponentIds();
        if (opponentIds.length === 0) return this.handleLateGame(myPlanets);

        // Find the strongest opponent to target
        const strongestOpponent = opponentIds
            .map(id => this.api.getPlayerStats(id))
            .filter(stats => stats.isActive)
            .sort((a, b) => b.totalProduction - a.totalProduction)[0];

        if (!strongestOpponent) return null; // No active opponents

        const enemyPlanets = this.api.getEnemyPlanets().filter(p => p.owner === strongestOpponent.id);
        if (enemyPlanets.length === 0) return null;

        // Find the best enemy planet to attack (high value, vulnerable)
        const attackCandidates = enemyPlanets.map(p => {
            const travelTime = this.api.getTravelTime(this.api.findNearestPlanet(p, myPlanets), p);
            const predictedState = this.api.predictPlanetState(p, travelTime);
            return {
                planet: p,
                predictedTroops: predictedState.owner === p.owner ? predictedState.troops : 0,
                value: p.productionRate / (predictedState.troops + 1)
            };
        }).sort((a, b) => b.value - a.value);

        for (const target of attackCandidates) {
            const troopsNeeded = target.predictedTroops + 5; // Precision strike
            const sourcePlanet = this.findBestSource(myPlanets, target.planet, troopsNeeded);
            if (sourcePlanet) {
                const troopsToSend = troopsNeeded + (sourcePlanet.troops - troopsNeeded) * 0.75;
                return this.makeMove(sourcePlanet.id, target.planet.id, troopsToSend);
            }
        }

        // If no attack is possible, try to expand to any remaining neutrals.
        return this.handleEarlyGame(myPlanets);
    }

    /** Late Game: All-in attacks to finish the game or turtling for a win. */
    handleLateGame(myPlanets) {
        // If we are significantly stronger, we might not need to attack recklessly.
        if (this.api.getMyStrengthRatio() > 1.5) {
            return this.handleConsolidation(myPlanets); // Fortify and wait for timeout win.
        }

        // Otherwise, it's do or die. Go for the kill.
        // The logic is similar to Mid Game, but more aggressive.
        const allEnemyPlanets = this.api.getEnemyPlanets();
        if (allEnemyPlanets.length === 0) return null;

        const attackCandidates = allEnemyPlanets.map(p => {
            const travelTime = this.api.getTravelTime(this.api.findNearestPlanet(p, myPlanets), p);
            const predictedState = this.api.predictPlanetState(p, travelTime);
            return {
                planet: p,
                predictedTroops: predictedState.owner === p.owner ? predictedState.troops : 0,
                // In late game, just removing planets is valuable
                value: this.api.calculatePlanetValue(p) / (predictedState.troops + 1)
            };
        }).sort((a, b) => b.value - a.value);

        for (const target of attackCandidates) {
            const troopsNeeded = target.predictedTroops + 3; // Smaller safety margin, more risk
            const sourcePlanet = this.findBestSource(myPlanets, target.planet, troopsNeeded);
            if (sourcePlanet) {
                // Send almost everything from the best source.
                const troopsToSend = Math.max(troopsNeeded, sourcePlanet.troops * 0.9);
                return this.makeMove(sourcePlanet.id, target.planet.id, troopsToSend);
            }
        }
        return null;
    }

    /** Final Priority: Consolidate forces from safe backline planets to the frontline. */
    handleConsolidation(myPlanets) {
        if (myPlanets.length < 2) return null;

        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null; // No enemies, no frontline.

        // Find "backline" planets (safe, lots of troops) and "frontline" planets (close to enemy).
        const backlinePlanets = myPlanets.filter(p => {
            const nearestEnemy = this.api.getNearestEnemyPlanet(p);
            // A planet is "backline" if it's far from the action and has excess troops.
            return nearestEnemy && this.api.getDistance(p, nearestEnemy) > 300 && p.troops > 150;
        }).sort((a, b) => b.troops - a.troops);

        const frontlinePlanets = myPlanets.filter(p => {
            const nearestEnemy = this.api.getNearestEnemyPlanet(p);
            // A planet is "frontline" if it's close to the action and could use more troops.
            return nearestEnemy && this.api.getDistance(p, nearestEnemy) < 250 && p.troops < 300;
        }).sort((a, b) => a.troops - b.troops); // Sort by fewest troops first

        if (backlinePlanets.length > 0 && frontlinePlanets.length > 0) {
            const source = backlinePlanets[0]; // The richest backline planet
            const target = frontlinePlanets[0]; // The neediest frontline planet

            if (this.memory.assignedPlanetIds.has(source.id)) return null;

            // Don't send troops if source is also a frontline planet in disguise
            if (source.id === target.id) return null;

            const troopsToSend = source.troops * 0.75;
            return this.makeMove(source.id, target.id, troopsToSend);
        }

        return null;
    }
}