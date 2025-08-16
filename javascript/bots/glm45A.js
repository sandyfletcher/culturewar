// =============================================
// root/javascript/bots/glm45A.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * GalconChampion: A strategic bot that adapts its approach based on game phase,
 * prioritizing economic growth in early game, balanced aggression in mid game,
 * and focused assaults in late game.
 */

export default class glm45A extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            // Track which planets we've targeted to avoid overcommitment
            targetedPlanets: new Set(),
            // Track our strategic focus
            focus: 'expansion', // 'expansion', 'aggression', 'consolidation'
            // Track the strongest opponent
            strongestOpponent: null,
            // Track recent actions for better decision making
            recentActions: [],
            // Planet value cache for performance
            planetValues: new Map(),
            // Last evaluation timestamp
            lastEvaluationTime: 0
        };
    }

    /**
     * Main decision method called by the game engine
     */
    makeDecision(dt) {
        // Check if we're on cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left
        }

        // Update game phase and strategic focus
        this.updateStrategy();

        // Find the best possible action
        const decision = this.findBestAction(myPlanets);
        
        if (decision) {
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            this.memory.recentActions.push({
                time: this.api.getElapsedTime(),
                action: decision
            });
            // Keep only recent actions
            if (this.memory.recentActions.length > 10) {
                this.memory.recentActions.shift();
            }
            return decision;
        }

        return null;
    }

    /**
     * Update our strategic focus based on game phase and current state
     */
    updateStrategy() {
        const phase = this.api.getGamePhase();
        const myStats = this.api.getPlayerStats(this.playerId);
        const opponentIds = this.api.getOpponentIds();
        
        // Find the strongest opponent
        let strongestOpponent = null;
        let maxStrength = 0;
        
        for (const oppId of opponentIds) {
            const oppStats = this.api.getPlayerStats(oppId);
            if (oppStats.isActive && oppStats.totalTroops > maxStrength) {
                maxStrength = oppStats.totalTroops;
                strongestOpponent = oppId;
            }
        }
        
        this.memory.strongestOpponent = strongestOpponent;
        
        // Adjust strategy based on game phase and strength
        const strengthRatio = this.api.getMyStrengthRatio();
        
        if (phase === 'EARLY') {
            // Early game: focus on expansion
            this.memory.focus = 'expansion';
        } else if (phase === 'MID') {
            // Mid game: balance between expansion and aggression
            this.memory.focus = strengthRatio > 1.0 ? 'aggression' : 'expansion';
        } else { // LATE
            // Late game: all in on aggression if strong, consolidate if weak
            this.memory.focus = strengthRatio > 1.2 ? 'aggression' : 'consolidation';
        }
    }

    /**
     * Find the best action to take based on current strategy
     */
    findBestAction(myPlanets) {
        // Get all possible targets
        const neutralPlanets = this.api.getNeutralPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        
        // Remove planets we've already targeted
        const availableNeutral = neutralPlanets.filter(p => !this.memory.targetedPlanets.has(p.id));
        const availableEnemy = enemyPlanets.filter(p => !this.memory.targetedPlanets.has(p.id));
        
        // Evaluate all possible moves
        let bestMove = null;
        let bestScore = -Infinity;
        
        // Consider expansion moves (to neutral planets)
        if (this.memory.focus === 'expansion' && availableNeutral.length > 0) {
            for (const planet of myPlanets) {
                for (const target of availableNeutral) {
                    const move = this.evaluateExpansionMove(planet, target);
                    if (move.score > bestScore) {
                        bestScore = move.score;
                        bestMove = move;
                    }
                }
            }
        }
        
        // Consider aggression moves (to enemy planets)
        if ((this.memory.focus === 'aggression' || this.memory.focus === 'consolidation') && availableEnemy.length > 0) {
            for (const planet of myPlanets) {
                for (const target of availableEnemy) {
                    const move = this.evaluateAggressionMove(planet, target);
                    if (move.score > bestScore) {
                        bestScore = move.score;
                        bestMove = move;
                    }
                }
            }
        }
        
        // Consider reinforcement moves (to our own planets under threat)
        if (this.memory.focus === 'consolidation') {
            for (const planet of myPlanets) {
                for (const target of myPlanets) {
                    if (planet.id !== target.id) {
                        const move = this.evaluateReinforcementMove(planet, target);
                        if (move.score > bestScore) {
                            bestScore = move.score;
                            bestMove = move;
                        }
                    }
                }
            }
        }
        
        // If we found a good move, mark the target as targeted
        if (bestMove) {
            this.memory.targetedPlanets.add(bestMove.toId);
            // Clean up old targeted planets
            if (this.memory.targetedPlanets.size > 10) {
                const oldestTarget = this.memory.targetedPlanets.values().next().value;
                this.memory.targetedPlanets.delete(oldestTarget);
            }
        }
        
        return bestMove;
    }

    /**
     * Evaluate an expansion move to a neutral planet
     */
    evaluateExpansionMove(fromPlanet, toPlanet) {
        // Calculate planet value if not cached
        if (!this.memory.planetValues.has(toPlanet.id)) {
            const value = this.api.calculatePlanetValue(toPlanet) * (1 + toPlanet.productionRate * 0.5);
            this.memory.planetValues.set(toPlanet.id, value);
        }
        
        const planetValue = this.memory.planetValues.get(toPlanet.id);
        const distance = this.api.getDistance(fromPlanet, toPlanet);
        
        // Calculate how many troops we need to send
        // We want to send enough to conquer but leave some defense
        const requiredTroops = Math.min(toPlanet.troops + 5, Math.floor(fromPlanet.troops * 0.7));
        
        // If we don't have enough troops, this move is not viable
        if (requiredTroops > fromPlanet.troops || requiredTroops < 1) {
            return { score: -Infinity, fromId: fromPlanet.id, toId: toPlanet.id, troops: 0 };
        }
        
        // Calculate the score
        // Higher planet value is better
        // Shorter distance is better
        // Having more troops than required is good
        const troopRatio = fromPlanet.troops / requiredTroops;
        const score = (planetValue * 10) / distance + troopRatio;
        
        return {
            score,
            fromId: fromPlanet.id,
            toId: toPlanet.id,
            troops: requiredTroops
        };
    }

    /**
     * Evaluate an aggression move to an enemy planet
     */
    evaluateAggressionMove(fromPlanet, toPlanet) {
        // Predict the state of the target planet when our fleet arrives
        const timeToArrival = this.api.getTravelTime(fromPlanet, toPlanet);
        const predictedState = this.api.predictPlanetState(toPlanet, timeToArrival);
        
        // If we can predict the planet will be ours by then, don't attack
        if (predictedState.owner === this.playerId) {
            return { score: -Infinity, fromId: fromPlanet.id, toId: toPlanet.id, troops: 0 };
        }
        
        // Calculate how many troops we need to send
        // We need to overcome the predicted defending troops plus a buffer
        const requiredTroops = predictedState.troops + 10;
        
        // If we don't have enough troops, this move is not viable
        if (requiredTroops > fromPlanet.troops || requiredTroops < 1) {
            return { score: -Infinity, fromId: fromPlanet.id, toId: toPlanet.id, troops: 0 };
        }
        
        // Calculate the score
        // Planet value is important
        // Threat reduction is valuable (especially for strong opponents)
        // Surprise factor (attacking when enemy is weak) is good
        
        const planetValue = this.api.calculatePlanetValue(toPlanet);
        const threatReduction = this.api.calculateThreat(toPlanet);
        const isStronghold = this.memory.strongestOpponent && toPlanet.owner === this.memory.strongestOpponent;
        
        let score = planetValue * 15 / this.api.getDistance(fromPlanet, toPlanet) + threatReduction;
        
        // Bonus for attacking strongholds of strong opponents
        if (isStronghold) {
            score *= 2;
        }
        
        // Check if this planet is already under attack by us
        const isAlreadyTargeted = this.memory.recentActions.some(action => 
            action.action.toId === toPlanet.id && 
            this.api.getElapsedTime() - action.time < 10
        );
        
        // Don't overcommit to the same planet
        if (isAlreadyTargeted) {
            score *= 0.5;
        }
        
        return {
            score,
            fromId: fromPlanet.id,
            toId: toPlanet.id,
            troops: Math.min(requiredTroops, Math.floor(fromPlanet.troops * 0.8)) // Don't send more than 80%
        };
    }

    /**
     * Evaluate a reinforcement move to our own planet
     */
    evaluateReinforcementMove(fromPlanet, toPlanet) {
        // Check if the target is under threat
        const incomingAttacks = this.api.getIncomingAttacks(toPlanet);
        const threat = incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        
        // If there's no threat, don't reinforce
        if (threat === 0) {
            return { score: -Infinity, fromId: fromPlanet.id, toId: toPlanet.id, troops: 0 };
        }
        
        // Predict the state of the target planet when reinforcements arrive
        const timeToArrival = this.api.getTravelTime(fromPlanet, toPlanet);
        const predictedState = this.api.predictPlanetState(toPlanet, timeToArrival);
        
        // Calculate how many troops we need to send
        // We need to overcome the predicted threat plus a buffer
        const requiredTroops = Math.max(0, threat - predictedState.troops) + 10;
        
        // If we don't have enough troops, this move is not viable
        if (requiredTroops > fromPlanet.troops || requiredTroops < 1) {
            return { score: -Infinity, fromId: fromPlanet.id, toId: toPlanet.id, troops: 0 };
        }
        
        // Calculate the score
        // Saving a high-value planet is important
        // Shorter distance is better
        // Having more troops than required is good
        
        const planetValue = this.api.calculatePlanetValue(toPlanet);
        const distance = this.api.getDistance(fromPlanet, toPlanet);
        const troopRatio = fromPlanet.troops / requiredTroops;
        
        const score = (planetValue * 20) / distance + troopRatio;
        
        return {
            score,
            fromId: fromPlanet.id,
            toId: toPlanet.id,
            troops: requiredTroops
        };
    }
}