// =============================================
// root/javascript/bots/Gemini25ProD.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * CerebrumAI is a strategic bot that wins by building a superior economy and then executing precise, coordinated attacks.
 * It operates on a hierarchical decision system: Defend threatened planets first, then seek opportunistic offensive strikes, 
 * then expand to valuable neutral planets, and finally consolidate forces during lulls in combat. Its behavior adapts 
 * to the game's phase, prioritizing rapid expansion early and aggressive, targeted assaults later on.
 */
export default class Gemini25ProD extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // this.memory is a persistent object you can use to store data between turns.
        this.memory.actionCooldown = 0;
        this.memory.assignedMissions = new Set(); // Tracks planets already tasked with a move this turn.
        this.memory.assignedTargets = new Set(); // Tracks targets that are already being attacked.
    }

    /**
     * This method is called by the game engine when it's your turn.
     * @param {number} dt - The time elapsed since the last turn, scaled by game speed.
     * @returns {object|null} A decision object or null to take no action.
     */
    makeDecision(dt) {
        // Optimization: If we're on cooldown, don't waste CPU cycles.
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // Reset per-turn memory
        this.memory.assignedMissions.clear();
        this.memory.assignedTargets.clear();

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets left, surrender.
        }
        
        const gamePhase = this.api.getGamePhase();

        // The core decision-making hierarchy.
        // It tries to find the best possible move in order of priority.
        let move = null;

        // 1. Defend planets under immediate threat.
        move = this._findDefensiveMove(myPlanets);
        if (move) return this._finalizeMove(move);

        // 2. Execute strategic offensive maneuvers.
        move = this._findOffensiveMove(myPlanets, gamePhase);
        if (move) return this._finalizeMove(move);
        
        // 3. Expand to valuable neutral planets.
        move = this._findExpansionMove(myPlanets);
        if (move) return this._finalizeMove(move);

        // 4. Consolidate forces, moving troops from safe backline planets to the front.
        move = this._findConsolidationMove(myPlanets);
        if (move) return this._finalizeMove(move);

        // If no other action is taken, return null.
        return null;
    }

    /**
     * Finds and executes a defensive move to save a planet under attack.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @returns {object|null} A move object or null.
     */
    _findDefensiveMove(myPlanets) {
        const threatenedPlanets = myPlanets
            .map(p => {
                const incomingAttacks = this.api.getIncomingAttacks(p);
                if (incomingAttacks.length === 0) return null;

                const firstAttack = incomingAttacks.sort((a, b) => a.duration - b.duration)[0];
                const arrivalTime = firstAttack.duration;
                const predictedState = this.api.predictPlanetState(p, arrivalTime);

                if (predictedState.owner !== this.playerId) {
                    const troopDeficit = (predictedState.enemyTroops - predictedState.myTroops) + 5; // +5 for a safety buffer
                    return { planet: p, deficit: troopDeficit, timeToImpact: arrivalTime };
                }
                return null;
            })
            .filter(t => t !== null)
            .sort((a, b) => a.timeToImpact - b.timeToImpact); // Prioritize most imminent threats

        for (const threat of threatenedPlanets) {
            const potentialReinforcers = myPlanets
                .filter(p => p.id !== threat.planet.id && !this.memory.assignedMissions.has(p.id))
                .map(p => ({
                    planet: p,
                    travelTime: this.api.getTravelTime(p, threat.planet),
                    availableTroops: p.troops
                }))
                .filter(r => r.travelTime < threat.timeToImpact && r.availableTroops > threat.deficit)
                .sort((a, b) => a.travelTime - b.travelTime); // Closest reinforcer first

            if (potentialReinforcers.length > 0) {
                const reinforcer = potentialReinforcers[0];
                return {
                    fromId: reinforcer.planet.id,
                    toId: threat.planet.id,
                    troops: Math.ceil(threat.deficit)
                };
            }
        }
        return null;
    }

    /**
     * Finds and executes a smart offensive move against an enemy planet.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @param {string} gamePhase - The current game phase.
     * @returns {object|null} A move object or null.
     */
    _findOffensiveMove(myPlanets, gamePhase) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;

        const potentialTargets = enemyPlanets
            .filter(p => !this.memory.assignedTargets.has(p.id))
            .map(p => ({
                planet: p,
                value: this.api.calculatePlanetValue(p) // Value based on size, production, centrality
            }))
            .sort((a, b) => b.value - a.value); // Target most valuable planets first

        for (const target of potentialTargets) {
            const potentialAttackers = myPlanets
                .filter(p => !this.memory.assignedMissions.has(p.id))
                .sort((a, b) => this.api.getDistance(a, target.planet) - this.api.getDistance(b, target.planet)); // Closest first

            for (const attacker of potentialAttackers) {
                const travelTime = this.api.getTravelTime(attacker, target.planet);
                const predictedState = this.api.predictPlanetState(target.planet, travelTime);
                const requiredTroops = Math.ceil(predictedState.troops) + 5; // Safety buffer

                // Leave a small garrison behind
                const troopsToLeave = gamePhase === 'EARLY' ? 5 : 15;
                const availableAttackers = attacker.troops - troopsToLeave;
                
                if (availableAttackers > requiredTroops) {
                    // Send just enough troops to conquer
                    return {
                        fromId: attacker.id,
                        toId: target.planet.id,
                        troops: requiredTroops
                    };
                }
            }
        }
        return null;
    }

    /**
     * Finds and executes an expansion move to a neutral planet.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @returns {object|null} A move object or null.
     */
    _findExpansionMove(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return null;

        const potentialTargets = neutralPlanets
            .filter(p => !this.memory.assignedTargets.has(p.id))
            .map(p => ({
                planet: p,
                // Value is high production and proximity.
                value: p.productionRate / (this.api.getDistance(this._getCentroid(myPlanets), p) || 1)
            }))
            .sort((a, b) => b.value - a.value);

        for (const target of potentialTargets) {
            const requiredTroops = target.planet.troops + 2; // Need just enough to capture
            const bestSource = myPlanets
                .filter(p => !this.memory.assignedMissions.has(p.id) && p.troops > requiredTroops)
                .sort((a, b) => this.api.getDistance(a, target.planet) - this.api.getDistance(b, target.planet))[0];

            if (bestSource) {
                return {
                    fromId: bestSource.id,
                    toId: target.planet.id,
                    troops: requiredTroops
                };
            }
        }
        return null;
    }

    /**
     * Finds and executes a consolidation move to rebalance forces.
     * @param {Array<Planet>} myPlanets - A list of the bot's planets.
     * @returns {object|null} A move object or null.
     */
    _findConsolidationMove(myPlanets) {
        if (myPlanets.length < 2) return null;

        const enemyCentroid = this._getCentroid(this.api.getEnemyPlanets());
        if (!enemyCentroid) return null; // No enemies to consolidate against

        // Identify frontline (close to enemy) and backline (far from enemy) planets
        const frontlinePlanets = myPlanets.sort((a, b) => 
            this.api.getDistance(a, enemyCentroid) - this.api.getDistance(b, enemyCentroid));
            
        const backlinePlanets = [...frontlinePlanets].reverse();

        const source = backlinePlanets.find(p => 
            p.troops > 300 && // Only move from well-stocked planets
            !this.memory.assignedMissions.has(p.id)
        );
        
        if (source) {
            const destination = frontlinePlanets.find(p => 
                p.id !== source.id && 
                p.troops < 200 // Only reinforce planets that need it
            );

            if (destination) {
                const troopsToSend = Math.floor(source.troops * 0.5); // Send half the troops
                return {
                    fromId: source.id,
                    toId: destination.id,
                    troops: troopsToSend
                };
            }
        }
        return null;
    }

    /**
     * Helper to calculate the geometric center of a list of planets.
     * @param {Array<Planet>} planets - A list of planets.
     * @returns {{x: number, y: number}|null} The centroid coordinates.
     */
    _getCentroid(planets) {
        if (planets.length === 0) return null;
        const total = planets.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: total.x / planets.length, y: total.y / planets.length };
    }

    /**
     * Finalizes a move by setting the cooldown and updating mission tracking.
     * @param {object} move - The move object to be returned.
     * @returns {object} The finalized move object.
     */
    _finalizeMove(move) {
        this.memory.actionCooldown = this.api.getDecisionCooldown();
        this.memory.assignedMissions.add(move.fromId);
        this.memory.assignedTargets.add(move.toId);
        return move;
    }
}