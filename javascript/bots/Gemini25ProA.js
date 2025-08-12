// =============================================
// root/javascript/bots/Gemini25ProA.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * VanguardAI employs a dynamic, multi-phase strategy that adapts its priorities based on the game's progression.
 * 
 * It operates on a strict priority system, ensuring survival before seeking opportunities.
 * 1.  **Defense:** Immediately reinforces any planet facing a lethal attack it can save.
 * 2.  **Offense:** Seeks high-value, cost-effective attacks on enemy planets to cripple their production.
 * 3.  **Expansion:** Captures valuable neutral planets to grow its own economic base, especially in the early game.
 * 4.  **Consolidation:** Redistributes troops from safe, overstocked planets to strategically important frontline positions.
 * 
 * The bot uses the `predictPlanetState` API to calculate the precise number of troops for missions, minimizing waste. Its evaluation of "value" considers not just a planet's production but also its strategic context, such as targeting the strongest opponent in the mid-game to maintain a competitive balance.
 */
export default class Gemini25ProA extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            // Self-managed cooldown to prevent wasting computation on turns where no action can be taken.
            actionCooldown: 0,
            // Configuration parameters for the bot's behavior.
            config: {
                // How many extra troops to send on an attack to be safe.
                ATTACK_BUFFER: 3,
                // How many extra troops to send for defense.
                DEFENSE_BUFFER: 2,
                // The minimum troops to leave on a planet after sending a fleet.
                MIN_GARRISON: 1,
                // Don't send fleets from a planet if it has fewer than this many troops (unless it's an emergency).
                MIN_SOURCE_TROOPS: 15,
                // Percentage of troops to send when consolidating.
                CONSOLIDATION_PERCENT: 0.6,
                // How close to the end of the game to switch to "final moments" logic.
                LATE_GAME_THRESHOLD: 45, // seconds remaining
            }
        };
    }

    /**
     * This method is called by the game engine every turn.
     * @param {number} dt - The time elapsed since the last decision, in game seconds.
     * @returns {object|null} A decision object or null.
     */
    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left, nothing to do.
        }

        // The core logic is a priority queue of actions. Try each one in order.
        let decision = null;
        
        // 1. Defend planets that are about to be lost.
        decision = this.findDefensiveMove(myPlanets);
        if (decision) {
            this.setCooldown();
            return decision;
        }

        // 2. Launch an offensive attack against an enemy.
        decision = this.findOffensiveMove(myPlanets);
        if (decision) {
            this.setCooldown();
            return decision;
        }

        // 3. Expand to neutral planets.
        decision = this.findExpansionMove(myPlanets);
        if (decision) {
            this.setCooldown();
            return decision;
        }

        // 4. Consolidate forces by moving troops to the front lines.
        decision = this.findConsolidationMove(myPlanets);
        if (decision) {
            this.setCooldown();
            return decision;
        }
        
        return null;
    }

    /**
     * Sets the action cooldown to prevent the bot from acting too frequently.
     */
    setCooldown() {
        this.memory.actionCooldown = this.api.getDecisionCooldown();
    }
    
    /**
     * Priority 1: Identifies critical threats to owned planets and attempts to reinforce them.
     * @param {Planet[]} myPlanets - A list of the bot's currently owned planets.
     * @returns {object|null} A decision object for a defensive reinforcement, or null if none is needed/possible.
     */
    findDefensiveMove(myPlanets) {
        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            // Predict the state of the planet right when the first attack hits.
            const firstAttackArrivalTime = Math.min(...incomingAttacks.map(f => f.duration));
            const predictedState = this.api.predictPlanetState(myPlanet, firstAttackArrivalTime);

            // If we are predicted to lose the planet, we need help.
            if (predictedState.owner !== this.playerId && predictedState.troops > 0) {
                const troopsNeeded = predictedState.troops + this.memory.config.DEFENSE_BUFFER;

                // Find the best planet to send reinforcements from.
                const potentialReinforcements = myPlanets
                    .filter(p => p.id !== myPlanet.id && p.troops > troopsNeeded)
                    .map(p => ({
                        planet: p,
                        travelTime: this.api.getTravelTime(p, myPlanet)
                    }))
                    // Reinforcements must arrive BEFORE the attack lands.
                    .filter(p => p.travelTime < firstAttackArrivalTime)
                    .sort((a, b) => a.travelTime - b.travelTime); // Closest first

                if (potentialReinforcements.length > 0) {
                    const source = potentialReinforcements[0].planet;
                    return { fromId: source.id, toId: myPlanet.id, troops: Math.ceil(troopsNeeded) };
                }
            }
        }
        return null;
    }

    /**
     * Priority 2: Finds the most valuable and cost-effective attack against an enemy planet.
     * @param {Planet[]} myPlanets - A list of the bot's currently owned planets.
     * @returns {object|null} A decision object for an attack, or null.
     */
    findOffensiveMove(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;

        const potentialAttacks = this.getPotentialActions(myPlanets, enemyPlanets);
        if (potentialAttacks.length === 0) return null;

        // Add a strategic bonus for attacking the strongest opponent during mid-game.
        const strongestOpponent = this.findStrongestOpponent();
        if (this.api.getGamePhase() === 'MID' && strongestOpponent) {
            potentialAttacks.forEach(attack => {
                if (attack.target.owner === strongestOpponent.id) {
                    attack.score *= 1.5; // Prioritize targets owned by the leader.
                }
            });
        }
        
        // Late game desperation: if we are losing, focus on any small planet to win by count.
        const timeRemaining = this.api.getGameDuration() - this.api.getElapsedTime();
        const myStats = this.api.getPlayerStats(this.playerId);
        if (timeRemaining < this.memory.config.LATE_GAME_THRESHOLD && strongestOpponent && myStats.planetCount < strongestOpponent.planetCount) {
             potentialAttacks.forEach(attack => {
                // Prioritize cheap, fast captures over big, slow ones.
                attack.score = (1 / attack.troopsNeeded) * (1 / attack.travelTime);
            });
        }

        potentialAttacks.sort((a, b) => b.score - a.score); // Highest score first.
        const bestAttack = potentialAttacks[0];

        return { fromId: bestAttack.source.id, toId: bestAttack.target.id, troops: bestAttack.troopsNeeded };
    }

    /**
     * Priority 3: Finds the best neutral planet to capture for expansion.
     * @param {Planet[]} myPlanets - A list of the bot's currently owned planets.
     * @returns {object|null} A decision object for expansion, or null.
     */
    findExpansionMove(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return null;

        const potentialExpansions = this.getPotentialActions(myPlanets, neutralPlanets);
        if (potentialExpansions.length === 0) return null;

        // In the early game, expansion is paramount. Give it a scoring boost.
        if (this.api.getGamePhase() === 'EARLY') {
            potentialExpansions.forEach(p => p.score *= 2.0);
        }

        potentialExpansions.sort((a, b) => b.score - a.score);
        const bestExpansion = potentialExpansions[0];

        return { fromId: bestExpansion.source.id, toId: bestExpansion.target.id, troops: bestExpansion.troopsNeeded };
    }
    
    /**
     * Priority 4: Redistributes forces from safe backline planets to frontline planets.
     * @param {Planet[]} myPlanets - A list of the bot's currently owned planets.
     * @returns {object|null} A decision object for troop consolidation, or null.
     */
    findConsolidationMove(myPlanets) {
        if (myPlanets.length < 2 || this.api.getEnemyPlanets().length === 0) return null;

        // Identify frontline (near enemies) and backline (safe) planets.
        const frontlinePlanets = myPlanets.filter(p => this.api.getNearestEnemyPlanet(p) !== null);
        const backlinePlanets = myPlanets.filter(p => frontlinePlanets.every(fp => fp.id !== p.id));
        
        if (frontlinePlanets.length === 0 || backlinePlanets.length === 0) return null;
        
        // Find the most over-stocked backline planet.
        backlinePlanets.sort((a, b) => b.troops - a.troops);
        const source = backlinePlanets[0];

        if (source.troops < this.memory.config.MIN_SOURCE_TROOPS * 2) return null; // Only move from very safe planets.

        // Find the nearest frontline planet to reinforce.
        const target = this.api.findNearestPlanet(source, frontlinePlanets);
        if (!target) return null;

        const troopsToSend = Math.floor(source.troops * this.memory.config.CONSOLIDATION_PERCENT);
        
        // Ensure we are not stripping the source planet bare.
        if (source.troops - troopsToSend < this.memory.config.MIN_GARRISON) {
            return null;
        }

        return { fromId: source.id, toId: target.id, troops: troopsToSend };
    }
    
    /**
     * Generic helper to evaluate and score potential actions (attacks or expansions).
     * @param {Planet[]} sources - The list of planets to send from.
     * @param {Planet[]} targets - The list of planets to capture.
     * @returns {Array} A sorted list of scored, viable actions.
     */
    getPotentialActions(sources, targets) {
        const actions = [];
        const myOutgoingFleets = this.api.getFleetsByOwner(this.playerId);

        // Calculate troops already committed from each of my planets.
        const reservedTroops = {};
        for(const fleet of myOutgoingFleets) {
            reservedTroops[fleet.from.id] = (reservedTroops[fleet.from.id] || 0) + fleet.amount;
        }

        for (const target of targets) {
            // Find the best source planet to attack this target.
            let bestSource = null;
            let bestTravelTime = Infinity;
            
            for(const source of sources) {
                const availableTroops = source.troops - (reservedTroops[source.id] || 0);
                if (availableTroops < this.memory.config.MIN_SOURCE_TROOPS) continue;

                const travelTime = this.api.getTravelTime(source, target);
                if (travelTime < bestTravelTime) {
                    bestTravelTime = travelTime;
                    bestSource = source;
                }
            }
            
            if (!bestSource) continue;

            // Calculate troops needed with precision.
            const predictedState = this.api.predictPlanetState(target, bestTravelTime);
            const troopsNeeded = Math.ceil(predictedState.troops + this.memory.config.ATTACK_BUFFER);

            const availableTroops = bestSource.troops - (reservedTroops[bestSource.id] || 0);
            
            // Can we afford this attack?
            if (availableTroops > troopsNeeded + this.memory.config.MIN_GARRISON) {
                // Score the action: higher value and lower cost (troops + time) is better.
                const value = this.api.calculatePlanetValue(target);
                const cost = troopsNeeded + bestTravelTime;
                const score = value / cost;

                actions.push({
                    source: bestSource,
                    target: target,
                    troopsNeeded: troopsNeeded,
                    travelTime: bestTravelTime,
                    score: score
                });
            }
        }
        return actions;
    }
    
    /**
     * Finds the opponent with the highest strength (troops + production).
     * @returns {object|null} The stats object of the strongest opponent, or null.
     */
    findStrongestOpponent() {
        const opponentIds = this.api.getOpponentIds();
        if (opponentIds.length === 0) return null;

        const opponentStats = opponentIds
            .map(id => this.api.getPlayerStats(id))
            .filter(stats => stats.isActive);
            
        if (opponentStats.length === 0) return null;

        // A simple strength score: total troops plus 10 seconds worth of production.
        opponentStats.forEach(stats => {
            stats.strength = stats.totalTroops + (stats.totalProduction * 10);
        });

        opponentStats.sort((a, b) => b.strength - a.strength);
        return opponentStats[0];
    }
}