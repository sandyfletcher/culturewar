// =============================================
// root/javascript/bots/Gemini25ProC.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * StardustCrusader employs a dynamic, priority-driven strategy that adapts its behavior across different game phases to dominate the battlefield.
 * It prioritizes critical defense, then calculated offensive strikes against the strongest opponent, followed by intelligent expansion to high-value planets, and finally, internal troop consolidation to maximize efficiency and prepare for future conflicts.
 */
export default class Gemini25ProC extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // Custom memory to track state, missions, and configuration.
        this.memory = {
            actionCooldown: 0,
            // Tracks ongoing missions to prevent redundant fleet dispatches.
            // Format: { targetPlanetId: { fromId: string, arrivalTime: number } }
            activeMissions: {},
            // Tweakable parameters for strategy
            config: {
                GARRISON_BUFFER: 10, // Minimum troops to leave on a planet after sending a fleet.
                ATTACK_TROOP_MULTIPLIER: 1.1, // Send 110% of required troops for an attack.
                CONSOLIDATION_THRESHOLD: 0.75, // Consolidate planets that are >75% of max capacity.
                MIN_TROOPS_FOR_ACTION: 25, // Minimum troops a planet must have to initiate an action.
            },
        };
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

        this._pruneActiveMissions();

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // Surrender gracefully.
        }

        // --- The core decision-making priority queue ---
        
        // 1. Defend planets in critical danger.
        const defensiveMove = this._handleDefense(myPlanets);
        if (defensiveMove) return this._makeMove(defensiveMove);

        // 2. Launch strategic offensive attacks.
        const offensiveMove = this._handleOffense(myPlanets);
        if (offensiveMove) return this._makeMove(offensiveMove);

        // 3. Expand to valuable neutral planets.
        const expansionMove = this._handleExpansion(myPlanets);
        if (expansionMove) return this._makeMove(expansionMove);

        // 4. Consolidate forces to prepare for future actions.
        const consolidationMove = this._handleConsolidation(myPlanets);
        if (consolidationMove) return this._makeMove(consolidationMove);

        return null; // No valid action found.
    }

    // =============================================
    // INTERNAL HELPER & STRATEGY METHODS
    // =============================================

    /**
     * Executes a move, sets the cooldown, and records the mission.
     * @param {object} move - The move object { fromId, toId, troops }.
     * @returns {object} The formatted move object for the game engine.
     */
    _makeMove(move) {
        const fromPlanet = this.api.getPlanetById(move.fromId);
        const toPlanet = this.api.getPlanetById(move.toId);
        const travelTime = this.api.getTravelTime(fromPlanet, toPlanet);
        
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        this.memory.activeMissions[move.toId] = {
            fromId: move.fromId,
            arrivalTime: this.api.getElapsedTime() + travelTime,
        };
        
        return {
            fromId: move.fromId,
            toId: move.toId,
            troops: move.troops
        };
    }

    /**
     * Removes completed or obsolete missions from memory.
     */
    _pruneActiveMissions() {
        const currentTime = this.api.getElapsedTime();
        for (const targetId in this.memory.activeMissions) {
            if (this.memory.activeMissions[targetId].arrivalTime < currentTime) {
                delete this.memory.activeMissions[targetId];
            }
        }
    }

    /**
     * Priority 1: Defend planets under immediate threat.
     */
    _handleDefense(myPlanets) {
        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            // Find the arrival time of the last and largest attacking fleet
            const lastAttack = incomingAttacks.reduce((latest, current) => current.duration > latest.duration ? current : latest, incomingAttacks[0]);
            const arrivalTime = lastAttack.duration;

            const predictedState = this.api.predictPlanetState(myPlanet, arrivalTime);

            // If we are predicted to lose the planet
            if (predictedState.owner !== this.playerId) {
                const troopsNeeded = Math.ceil(predictedState.troops) + 1;
                const reinforcements = this._findReinforcementSource(myPlanet, troopsNeeded, myPlanets);
                if (reinforcements) {
                    return {
                        fromId: reinforcements.id,
                        toId: myPlanet.id,
                        troops: troopsNeeded
                    };
                }
            }
        }
        return null;
    }
    
    /**
     * Priority 2: Find and execute the most valuable offensive move.
     */
    _handleOffense(myPlanets) {
        const potentialTargets = this._getOffensiveTargets();
        if (potentialTargets.length === 0) return null;

        let bestAttack = null;
        let highestScore = -Infinity;
        
        // Find the best planet to attack FROM for EACH potential target
        for (const target of potentialTargets) {
            const source = this._findBestSourceForAttack(target, myPlanets);
            if (!source) continue;

            const travelTime = this.api.getTravelTime(source, target);
            const predictedState = this.api.predictPlanetState(target, travelTime);

            // We only need to send troops if the planet won't be ours already
            if (predictedState.owner === this.playerId) continue;

            const troopsNeeded = Math.ceil(predictedState.troops * this.memory.config.ATTACK_TROOP_MULTIPLIER) + 1;
            
            if (source.troops > troopsNeeded + this.memory.config.GARRISON_BUFFER) {
                const score = this._evaluatePlanetValue(target) / (troopsNeeded * travelTime); // Value per troop-second
                if (score > highestScore) {
                    highestScore = score;
                    bestAttack = {
                        fromId: source.id,
                        toId: target.id,
                        troops: troopsNeeded,
                    };
                }
            }
        }
        return bestAttack;
    }

    /**
     * Priority 3: Expand to the most valuable neutral planet.
     */
    _handleExpansion(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets()
            .filter(p => !this.memory.activeMissions[p.id])
            .sort((a, b) => this._evaluatePlanetValue(b) - this._evaluatePlanetValue(a));

        if (neutralPlanets.length === 0) return null;

        for (const target of neutralPlanets) {
            const troopsNeeded = Math.ceil(target.troops) + 1;
            const source = this._findBestSourceForAttack(target, myPlanets);

            if (source && source.troops > troopsNeeded + this.memory.config.GARRISON_BUFFER) {
                 return {
                    fromId: source.id,
                    toId: target.id,
                    troops: troopsNeeded
                };
            }
        }
        return null;
    }

    /**
     * Priority 4: Consolidate troops from safe backline planets to frontline planets.
     */
    _handleConsolidation(myPlanets) {
        const myStrength = this.api.getMyStrengthRatio();
        // Only consolidate if we are not in a desperate situation
        if (myStrength < 0.8 && this.api.getGamePhase() !== 'LATE') return null;

        const overstockedPlanets = myPlanets.filter(p =>
            p.troops > 999 * this.memory.config.CONSOLIDATION_THRESHOLD
        );
        if (overstockedPlanets.length === 0) return null;

        const potentialDestinations = myPlanets
            .filter(p => p.troops < 500 && this.api.calculateThreat(p) > 0) // Frontline planets
            .sort((a,b) => this.api.calculateThreat(b) - this.api.calculateThreat(a)); // Reinforce most threatened first
        
        if (potentialDestinations.length === 0) return null;
        
        const source = overstockedPlanets.sort((a,b) => b.troops - a.troops)[0]; // Richest planet sends
        const destination = potentialDestinations[0];

        // Don't send to self
        if (source.id === destination.id) return null;

        const troopsToSend = Math.floor(source.troops - (999 * this.memory.config.CONSOLIDATION_THRESHOLD));
        return {
            fromId: source.id,
            toId: destination.id,
            troops: troopsToSend
        };
    }
    
    // --- UTILITY METHODS ---

    /**
     * Evaluates the strategic value of a planet.
     * High production and central location are prized.
     */
    _evaluatePlanetValue(planet) {
        const productionValue = planet.productionRate * 20; // Production is key
        const centralityValue = this.api.getPlanetCentrality(planet) * 10; // Centrality is good
        return productionValue + centralityValue;
    }

    /**
     * Identifies the best targets for an offensive attack, focusing on the strongest opponent in mid/late game.
     */
    _getOffensiveTargets() {
        let enemyPlanets = this.api.getEnemyPlanets().filter(p => !this.memory.activeMissions[p.id]);
        const gamePhase = this.api.getGamePhase();

        if (gamePhase === 'MID' || gamePhase === 'LATE') {
            const opponents = this.api.getOpponentIds()
                .map(id => this.api.getPlayerStats(id))
                .filter(p => p.isActive)
                .sort((a, b) => b.totalProduction - a.totalProduction); // Target highest production player

            if (opponents.length > 0) {
                const primaryThreatId = opponents[0].id;
                const primaryTargets = enemyPlanets.filter(p => p.owner === primaryThreatId);
                // If we have targets from the main threat, focus on them. Otherwise, attack anyone.
                if (primaryTargets.length > 0) {
                    return primaryTargets;
                }
            }
        }
        return enemyPlanets;
    }

    /**
     * Finds the best of my planets to launch an attack FROM against a specific target.
     * Prefers planets with sufficient troops that are close to the target.
     */
    _findBestSourceForAttack(target, myPlanets) {
        const potentialSources = myPlanets.filter(p =>
            p.troops > this.memory.config.MIN_TROOPS_FOR_ACTION &&
            p.id !== target.id &&
            !Object.values(this.memory.activeMissions).some(m => m.fromId === p.id) // Not already tasked
        );

        if (potentialSources.length === 0) return null;

        // Sort by proximity to the target
        potentialSources.sort((a, b) => this.api.getDistance(a, target) - this.api.getDistance(b, target));

        return potentialSources[0]; // Return the closest valid source
    }

    /**
     * Finds a friendly planet to send reinforcements from.
     * @param {Planet} planetToSave - The planet that needs help.
     * @param {number} troopsNeeded - The number of troops required.
     * @param {Planet[]} myPlanets - The list of my available planets.
     */
    _findReinforcementSource(planetToSave, troopsNeeded, myPlanets) {
        const potentialSources = myPlanets.filter(p =>
            p.id !== planetToSave.id &&
            p.troops > troopsNeeded + this.memory.config.GARRISON_BUFFER &&
            !Object.values(this.memory.activeMissions).some(m => m.fromId === p.id)
        );

        if (potentialSources.length === 0) return null;

        // Find the closest planet that can help
        potentialSources.sort((a, b) => this.api.getDistance(a, planetToSave) - this.api.getDistance(b, planetToSave));

        return potentialSources[0];
    }
}