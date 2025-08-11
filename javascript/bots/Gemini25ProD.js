// =============================================
// root/javascript/bots/Gemini25ProD.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * NexusAI employs an adaptive, three-phase strategy focusing on aggressive expansion, strategic targeting, and intelligent consolidation.
 * 
 * CORE STRATEGIC PILLARS:
 * 1. Phased Aggression: The bot's behavior changes with the game phase. It prioritizes rapid neutral expansion early on, shifts to crippling the strongest opponent in the mid-game, and aims for either a decisive final blow or a secure points-victory in the late game.
 * 2. Predictive Warfare: It heavily relies on the `predictPlanetState` API function to calculate the precise number of troops for attacks and defensive reinforcements, minimizing waste and maximizing efficiency.
 * 3. Centralized Force: The bot identifies "frontline" and "backline" planets, continuously funnelling troops from safer, less productive planets to strategically important staging grounds near the enemy, ensuring concentrated power for both offense and defense.
 * 4. Threat-Based Prioritization: The decision-making process is a strict hierarchy. Urgent defensive maneuvers to save its own planets will always take precedence over any offensive or consolidation actions.
 */
export default class Gemini25ProD extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.name = "NexusAI";

        // Configuration for easy tuning of the bot's behavior.
        this.config = {
            ACTION_COOLDOWN: 0.1,
            DEFENSIVE_RESERVE_TROOPS: 5,
            ATTACK_BUFFER_TROOPS: 3,
            MID_LATE_RESERVE_FACTOR: 0.2, // Keep 20% of troops on planet for defense
            MIN_ATTACK_FLEET: 2,
            CONSOLIDATION_INTERVAL: 5, // Check for consolidation every 5 seconds
        };
        
        // Memory to persist state across decision ticks.
        this.memory = {
            actionCooldown: 0,
            lastConsolidationTime: -1,
            missions: {}, // Tracks planets assigned to a task { targetId: { fromId, troops } }
        };
    }

    /**
     * Main decision-making function, called every game tick.
     * @param {number} dt - Time elapsed since the last call.
     * @returns {object|null} A decision object or null for no action.
     */
    makeDecision(dt) {
        this.memory.actionCooldown -= dt;
        if (this.memory.actionCooldown > 0) {
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left
        }

        this._updateMissions();

        // --- Decision Pipeline (Priority Order) ---

        // 1. Defend planets in imminent danger.
        const defensiveMove = this._findDefensiveMove(myPlanets);
        if (defensiveMove) {
            return this._executeDecision(defensiveMove);
        }

        // 2. Execute phase-based offensive strategies.
        const gamePhase = this.api.getGamePhase();
        let offensiveMove;

        if (gamePhase === 'EARLY') {
            offensiveMove = this._findExpansionMove(myPlanets);
        } else { // MID or LATE
            offensiveMove = this._findStrategicAttack(myPlanets);
        }

        if (offensiveMove) {
            return this._executeDecision(offensiveMove);
        }
        
        // 3. Consolidate forces if no urgent/offensive moves are available.
        const elapsedTime = this.api.getElapsedTime();
        if (elapsedTime > this.memory.lastConsolidationTime + this.config.CONSOLIDATION_INTERVAL) {
            this.memory.lastConsolidationTime = elapsedTime;
            const consolidationMove = this._findConsolidationMove(myPlanets);
            if (consolidationMove) {
                return this._executeDecision(consolidationMove);
            }
        }

        return null;
    }
    
    /**
     * Finalizes and records a decision, then sets the cooldown.
     * @param {object} decision - The decision object {from, to, troops}.
     * @returns {object} The same decision object.
     */
    _executeDecision(decision) {
        this.memory.actionCooldown = this.config.ACTION_COOLDOWN;
        this.memory.missions[decision.to.id] = { fromId: decision.from.id, troops: decision.troops };
        return decision;
    }
    
    /**
     * Cleans up completed missions from memory by checking which fleets are still active.
     */
    _updateMissions() {
        const myFleets = this.api.getFleetsByOwner(this.playerId);
        const activeTargetIds = new Set(myFleets.map(f => f.to.id));
        
        for (const targetId in this.memory.missions) {
            if (!activeTargetIds.has(targetId)) {
                delete this.memory.missions[targetId];
            }
        }
    }

    /**
     * Finds the most critical defensive reinforcement needed.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @returns {object|null} A decision object or null.
     */
    _findDefensiveMove(myPlanets) {
        let bestSave = null;
        let highestValueSaved = -1;

        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;
            
            // Predict the state at the time the first enemy fleet arrives.
            const firstAttack = incomingAttacks.sort((a, b) => a.duration - b.duration)[0];
            const timeToImpact = firstAttack.duration;
            const prediction = this.api.predictPlanetState(myPlanet, timeToImpact);

            if (prediction.owner !== this.playerId) {
                const troopsNeeded = Math.ceil(prediction.troops) + 1;
                
                // Find the best planet to send reinforcements from.
                const potentialSavers = myPlanets
                    .filter(p => p.id !== myPlanet.id && p.troops > troopsNeeded)
                    .map(p => ({ planet: p, travelTime: this.api.getTravelTime(p, myPlanet) }))
                    .filter(p => p.travelTime < timeToImpact); // Must arrive in time!
                
                if (potentialSavers.length > 0) {
                    // Choose the closest savior.
                    const bestSaver = potentialSavers.sort((a, b) => a.travelTime - b.travelTime)[0];
                    const planetValue = this.api.calculatePlanetValue(myPlanet);

                    if (planetValue > highestValueSaved) {
                        highestValueSaved = planetValue;
                        bestSave = {
                            from: bestSaver.planet,
                            to: myPlanet,
                            troops: troopsNeeded
                        };
                    }
                }
            }
        }
        return bestSave;
    }

    /**
     * Finds the best neutral planet to capture during the early game.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @returns {object|null} A decision object or null.
     */
    _findExpansionMove(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets().filter(p => !this.memory.missions[p.id]);
        if (neutralPlanets.length === 0) return null;

        let bestTarget = null;
        let bestSource = null;
        let bestScore = -Infinity;

        // Find sources that aren't already tasked
        const availableSources = myPlanets.filter(mp => !Object.values(this.memory.missions).some(m => m.fromId === mp.id));
        if (availableSources.length === 0) return null;

        for (const target of neutralPlanets) {
            const troopsNeeded = Math.ceil(target.troops) + 1;
            
            // Find the closest available planet that can take it.
            const source = this.api.findNearestPlanet(
                target,
                availableSources.filter(s => s.troops > troopsNeeded)
            );
            
            if (source) {
                const travelTime = this.api.getTravelTime(source, target);
                // Score prioritizes high production and close proximity.
                const score = target.productionRate / (travelTime + 1);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                    bestSource = source;
                }
            }
        }

        if (bestTarget && bestSource) {
            return {
                from: bestSource,
                to: bestTarget,
                troops: Math.ceil(bestTarget.troops) + 1
            };
        }
        return null;
    }

    /**
     * Finds the best enemy planet to attack, focusing on the strongest opponent.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @returns {object|null} A decision object or null.
     */
    _findStrategicAttack(myPlanets) {
        const strongestOpponent = this._getStrongestOpponent();
        if (!strongestOpponent) return null;

        const enemyPlanets = this.api.getEnemyPlanets()
            .filter(p => p.owner === strongestOpponent.id && !this.memory.missions[p.id]);

        if (enemyPlanets.length === 0) return null;

        let bestAttack = null;
        let bestScore = -Infinity;

        const potentialAttackers = myPlanets.filter(mp => !Object.values(this.memory.missions).some(m => m.fromId === mp.id));
        if (potentialAttackers.length === 0) return null;

        for (const target of enemyPlanets) {
            const source = this.api.findNearestPlanet(target, potentialAttackers);
            if (!source) continue;

            const travelTime = this.api.getTravelTime(source, target);
            const prediction = this.api.predictPlanetState(target, travelTime);

            if (prediction.owner === this.playerId) continue;

            const troopsNeeded = Math.ceil(prediction.troops) + this.config.ATTACK_BUFFER_TROOPS;
            const reserve = Math.ceil(source.troops * this.config.MID_LATE_RESERVE_FACTOR);
            
            if (source.troops > troopsNeeded + reserve && troopsNeeded >= this.config.MIN_ATTACK_FLEET) {
                // Score prioritizes high-value, weakly-defended planets.
                const score = this.api.calculatePlanetValue(target) / (prediction.troops + travelTime + 1);
                if (score > bestScore) {
                    bestScore = score;
                    bestAttack = { from: source, to: target, troops: troopsNeeded };
                }
            }
        }

        return bestAttack;
    }
    
    /**
     * Moves troops from safe backline planets to frontline staging areas.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @returns {object|null} A decision object or null.
     */
    _findConsolidationMove(myPlanets) {
        if (myPlanets.length < 2) return null;

        // Sort planets by their proximity to the nearest enemy. Closer = Frontline.
        const sortedPlanets = myPlanets.map(p => {
            const nearestEnemy = this.api.getNearestEnemyPlanet(p);
            const distance = nearestEnemy ? this.api.getDistance(p, nearestEnemy) : Infinity;
            return { planet: p, distanceToEnemy: distance };
        }).sort((a, b) => a.distanceToEnemy - b.distanceToEnemy);
        
        const frontline = sortedPlanets[0];
        if (this.memory.missions[frontline.planet.id]) return null;

        // Find a safe, well-stocked backline planet to send troops from.
        const backlineCandidates = sortedPlanets
            .slice(Math.floor(sortedPlanets.length / 2)) // Only consider planets in the safer half
            .filter(p => p.planet.id !== frontline.planet.id && 
                         p.planet.troops > 20 &&
                         !Object.values(this.memory.missions).some(m => m.fromId === p.planet.id)
            )
            .sort((a, b) => b.planet.troops - a.planet.troops); // Prioritize those with most troops

        if (backlineCandidates.length > 0) {
            const donor = backlineCandidates[0];
            const troopsToSend = Math.floor(donor.planet.troops - this.config.DEFENSIVE_RESERVE_TROOPS);

            if (troopsToSend >= this.config.MIN_ATTACK_FLEET) {
                return {
                    from: donor.planet,
                    to: frontline.planet,
                    troops: troopsToSend
                };
            }
        }

        return null;
    }

    /**
     * Identifies the strongest opponent based on total production.
     * @returns {object|null} The stats object of the strongest opponent.
     */
    _getStrongestOpponent() {
        const opponentIds = this.api.getOpponentIds();
        if (opponentIds.length === 0) return null;
        
        const opponentStats = opponentIds
            .map(id => this.api.getPlayerStats(id))
            .filter(stats => stats && stats.isActive);
            
        if(opponentStats.length === 0) return null;

        // Production is the best measure of long-term threat.
        return opponentStats.sort((a, b) => b.totalProduction - a.totalProduction)[0];
    }
}