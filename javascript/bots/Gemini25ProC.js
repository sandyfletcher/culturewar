// =============================================
// root/javascript/bots/Gemini25ProC.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * PraetorianAI is a balanced bot that adapts its strategy based on the game phase, focusing on efficient expansion, strong defense, and calculated aggression.
 * 
 * Strategic Pillars:
 * 1.  **Phased Strategy**: The bot's behavior changes from Early, Mid, to Late game.
 *      - EARLY: Rapidly capture the most valuable and closest neutral planets to build a strong production base.
 *      - MID: Fortify the empire, defend key planets, and begin crippling the strongest opponent by attacking their high-value, vulnerable planets.
 *      - LATE: If winning, consolidate and defend to secure a points victory. If losing, launch desperate, all-in attacks to break the enemy's economy.
 * 2.  **Defense First**: The bot's highest priority is to never lose a planet. It uses `predictPlanetState` to foresee threats and sends precisely calculated reinforcements just in time.
 * 3.  **Calculated Offense**: Attacks are not random. The bot targets the strongest enemy, identifies their most valuable and vulnerable planets, and uses `predictPlanetState` to send the exact number of troops needed for a successful conquest, minimizing waste.
 * 4.  **Resource Consolidation**: In moments of peace, the bot will move troops from safe, "back-line" planets to more strategic "front-line" positions, preparing for future offense and defense.
 * 5.  **State Management**: Uses `this.memory.missions` to track outgoing attacks, preventing the bot from over-committing forces or sending multiple fleets to the same target.
 */
export default class Gemini25ProC extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.name = "PraetorianAI";

        // -- Bot Configuration --
        this.memory.actionCooldown = 0;
        this.memory.missions = {}; // Tracks ongoing offensive missions: { targetId: { fromId, troops, launchTime } }
        
        // The minimum number of troops to keep on a planet for defense after sending a fleet.
        this.memory.defenseBuffer = 5; 
        
        // Send 110% of the troops predicted to be needed for an attack, for a safety margin.
        this.memory.attackAggression = 1.1; 
    }

    /**
     * This method is called by the game engine every turn. It contains the bot's main decision-making loop.
     * @param {number} dt - The time elapsed since the last decision, in game seconds.
     * @returns {object|null} A decision object {from, to, troops} or null to do nothing.
     */
    makeDecision(dt) {
        // --- 1. Cooldown & Housekeeping ---
        this.memory.actionCooldown -= dt;
        if (this.memory.actionCooldown > 0) {
            return null;
        }

        this._cleanupCompletedMissions();

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left, nothing to do.
        }

        // --- 2. The Decision-Making Priority Queue ---
        // The bot evaluates actions in order of importance. The first valid action found is taken.
        
        // Priority 1: Defend planets that are predicted to be lost.
        const defenseDecision = this._handleDefense(myPlanets);
        if (defenseDecision) {
            return this._makeDecision(defenseDecision);
        }

        // Priority 2: Execute phase-specific strategic goals (Expansion or Attack).
        const strategicDecision = this._executeStrategicOffense(myPlanets);
        if (strategicDecision) {
            // Track the new mission
            this.memory.missions[strategicDecision.to.id] = {
                fromId: strategicDecision.from.id,
                launchTime: this.api.getElapsedTime()
            };
            return this._makeDecision(strategicDecision);
        }

        // Priority 3: If no urgent threats or good attacks, consolidate forces.
        const consolidationDecision = this._handleConsolidation(myPlanets);
        if (consolidationDecision) {
            return this._makeDecision(consolidationDecision);
        }

        return null; // No suitable action found this turn.
    }

    /**
     * Finalizes and returns a decision object, setting the action cooldown.
     * @param {object} decision - The decision object {from, to, troops}.
     * @returns {object} The finalized decision object.
     */
    _makeDecision(decision) {
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        return decision;
    }

    /**
     * Removes missions from memory if the target has been captured or the mission is stale.
     */
    _cleanupCompletedMissions() {
        const now = this.api.getElapsedTime();
        for (const targetId in this.memory.missions) {
            const mission = this.memory.missions[targetId];
            const targetPlanet = this.api.getPlanetById(targetId);

            // Mission is complete if we now own the target planet.
            // Mission has likely failed if it's old (e.g., 45s) and we still don't own it.
            if (!targetPlanet || targetPlanet.owner === this.playerId || (now - mission.launchTime > 45)) {
                delete this.memory.missions[targetId];
            }
        }
    }

    // ===================================================================================
    // -- STRATEGIC MODULES (Called in order of priority by makeDecision) --
    // ===================================================================================

    /**
     * PRIORITY 1: DEFENSE
     * Identifies any owned planets that are under a lethal threat and sends reinforcements.
     * @param {Array<Planet>} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A reinforcement decision or null.
     */
    _handleDefense(myPlanets) {
        // Create a list of potential reinforcers with their available troops.
        const reinforcerPool = myPlanets.map(p => ({
            planet: p,
            availableTroops: p.troops - this.memory.defenseBuffer
        })).filter(r => r.availableTroops > 0);

        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            // Find the earliest arriving attack to predict the state at that critical moment.
            const firstAttack = incomingAttacks.sort((a, b) => a.duration - b.duration)[0];
            const timeOfImpact = firstAttack.duration;

            // Predict the state 0.1s after the first attack hits.
            const futureState = this.api.predictPlanetState(myPlanet, timeOfImpact + 0.1);

            // If we are predicted to lose the planet, we must act.
            if (futureState.owner !== this.playerId) {
                // `futureState.troops` will be negative, representing the deficit.
                const troopsNeeded = Math.ceil(Math.abs(futureState.troops)) + 1;

                // Find the best planet to send reinforcements from.
                const potentialReinforcers = reinforcerPool
                    .filter(r => r.planet.id !== myPlanet.id) // Can't reinforce from itself
                    .map(r => ({
                        ...r,
                        travelTime: this.api.getTravelTime(r.planet, myPlanet)
                    }))
                    // Must have enough troops AND be able to arrive in time.
                    .filter(r => r.availableTroops >= troopsNeeded && r.travelTime < timeOfImpact);
                
                if (potentialReinforcers.length > 0) {
                    // Choose the closest available reinforcer to minimize travel time.
                    potentialReinforcers.sort((a, b) => a.travelTime - b.travelTime);
                    const bestReinforcer = potentialReinforcers[0];
                    
                    //console.log(`[PraetorianAI] DEFENSE: Sending ${troopsNeeded} from ${bestReinforcer.planet.id} to save ${myPlanet.id}!`);
                    return {
                        from: bestReinforcer.planet,
                        to: myPlanet,
                        troops: troopsNeeded
                    };
                }
            }
        }
        return null; // No defensive action required.
    }

    /**
     * PRIORITY 2: STRATEGIC OFFENSE
     * Executes the primary offensive strategy based on the current game phase.
     * @param {Array<Planet>} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} An attack or expansion decision, or null.
     */
    _executeStrategicOffense(myPlanets) {
        const gamePhase = this.api.getGamePhase();

        if (gamePhase === 'EARLY') {
            return this._findBestExpansionTarget(myPlanets);
        } else {
            return this._findBestAttackTarget(myPlanets);
        }
    }

    /**
     * PRIORITY 3: CONSOLIDATION
     * Moves troops from safe, productive planets to strategic frontline planets.
     * @param {Array<Planet>} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} A troop movement decision or null.
     */
    _handleConsolidation(myPlanets) {
        // Consolidation is a mid-to-late game luxury.
        if (this.api.getGamePhase() === 'EARLY' || myPlanets.length < 2) {
            return null;
        }

        // Find a safe "back-line" planet with a large number of troops.
        const potentialSources = myPlanets
            .filter(p => p.troops > 75 && this.api.calculateThreat(p) < 0.1)
            .sort((a, b) => b.troops - a.troops);

        if (potentialSources.length === 0) return null;
        const sourcePlanet = potentialSources[0];

        // Find a valuable "front-line" planet to reinforce.
        const potentialDests = myPlanets
            .filter(p => p.id !== sourcePlanet.id)
            .sort((a, b) => this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a));

        if (potentialDests.length === 0) return null;
        const destPlanet = potentialDests[0];

        // Only send a significant portion of troops.
        const troopsToSend = Math.floor(sourcePlanet.troops - this.memory.defenseBuffer);
        if (troopsToSend > 20) {
            //console.log(`[PraetorianAI] CONSOLIDATION: Moving ${troopsToSend} troops from ${sourcePlanet.id} to ${destPlanet.id}.`);
            return { from: sourcePlanet, to: destPlanet, troops: troopsToSend };
        }

        return null;
    }


    // ===================================================================================
    // -- OFFENSIVE SUB-MODULES --
    // ===================================================================================

    /**
     * Finds and executes the best expansion move into a neutral planet.
     * @param {Array<Planet>} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} An expansion decision or null.
     */
    _findBestExpansionTarget(myPlanets) {
        const availableNeutrals = this.api.getNeutralPlanets().filter(p => !this.memory.missions[p.id]);
        if (availableNeutrals.length === 0) return null;

        let bestMove = { score: -Infinity, from: null, to: null, troops: 0 };

        for (const source of myPlanets) {
            const availableTroops = source.troops - 1; // Need to leave at least 1 troop
            if (availableTroops <= 0) continue;

            for (const target of availableNeutrals) {
                const troopsNeeded = Math.ceil(target.troops) + 1;
                if (availableTroops >= troopsNeeded) {
                    // Score is based on planet value (production/size) divided by travel time.
                    const travelTime = this.api.getTravelTime(source, target);
                    const score = this.api.calculatePlanetValue(target) / (travelTime + 1);

                    if (score > bestMove.score) {
                        bestMove = { score, from: source, to: target, troops: troopsNeeded };
                    }
                }
            }
        }
        
        if (bestMove.from) {
            //console.log(`[PraetorianAI] EXPANSION: Capturing neutral ${bestMove.to.id} from ${bestMove.from.id}.`);
            return { from: bestMove.from, to: bestMove.to, troops: bestMove.troops };
        }

        return null;
    }

    /**
     * Finds and executes the best attack against an enemy planet.
     * @param {Array<Planet>} myPlanets - A list of all planets owned by the bot.
     * @returns {object|null} An attack decision or null.
     */
    _findBestAttackTarget(myPlanets) {
        const opponentIds = this.api.getOpponentIds().filter(id => this.api.isPlayerActive(id));
        if (opponentIds.length === 0) return null;

        // If late game and we are winning on planets, switch to a defensive hold.
        if (this.api.getGamePhase() === 'LATE' && this.api.getMyStrengthRatio() > 1.2) {
            const myStats = this.api.getPlayerStats(this.playerId);
            const opponentStats = opponentIds.map(id => this.api.getPlayerStats(id));
            const maxOpponentPlanets = Math.max(...opponentStats.map(s => s.planetCount));
            if(myStats.planetCount > maxOpponentPlanets) {
                //console.log(`[PraetorianAI] LATE GAME: Holding planet lead. Defending.`);
                return null;
            }
        }
        
        // Target the strongest opponent based on a weighted score of production and troops.
        const targetPlayerId = opponentIds.map(id => this.api.getPlayerStats(id))
            .sort((a, b) => (b.totalProduction * 2 + b.totalTroops) - (a.totalProduction * 2 + a.totalTroops))[0].id;
        
        const availableTargets = this.api.getEnemyPlanets().filter(p => p.owner === targetPlayerId && !this.memory.missions[p.id]);
        if (availableTargets.length === 0) return null;

        let bestAttack = { score: -Infinity, from: null, to: null, troops: 0 };

        for (const source of myPlanets) {
            const availableTroops = source.troops - this.memory.defenseBuffer;
            if (availableTroops <= 10) continue; // Don't attack with insignificant forces.

            for (const target of availableTargets) {
                const travelTime = this.api.getTravelTime(source, target);
                const futureState = this.api.predictPlanetState(target, travelTime);

                // If a friendly fleet is already going to capture it, don't bother.
                if (futureState.owner === this.playerId) continue;

                const troopsOnArrival = (futureState.owner === target.owner) ? futureState.troops : 0;
                const troopsNeeded = Math.ceil(troopsOnArrival * this.memory.attackAggression) + 1;

                if (availableTroops >= troopsNeeded) {
                    // A good attack targets a valuable planet and costs few troops relative to its value.
                    const score = this.api.calculatePlanetValue(target) / (troopsNeeded + travelTime);
                    if (score > bestAttack.score) {
                        bestAttack = { score, from: source, to: target, troops: troopsNeeded };
                    }
                }
            }
        }

        if (bestAttack.from) {
            //console.log(`[PraetorianAI] ATTACK: Launching strike on ${bestAttack.to.id} from ${bestAttack.from.id}.`);
            return { from: bestAttack.from, to: bestAttack.to, troops: bestAttack.troops };
        }

        return null;
    }
}