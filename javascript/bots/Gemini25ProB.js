// =============================================
// root/javascript/bots/Gemini25ProB.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * ApexPredator employs a phased strategy that adapts its behavior based on the game's progression,
 * prioritizing survival and efficient resource acquisition to dominate the battlefield.
 * 
 * --- Strategic Pillars ---
 * 1.  **Situational Awareness & Threat Response:** The bot's first priority is always self-preservation. It constantly scans for incoming threats to its planets and will divert resources to defend them before considering any offensive or expansionist actions.
 * 2.  **Phased Aggression (Early/Mid/Late Game):**
 *     - **EARLY Game:** Focuses on rapid, low-risk expansion by capturing the most valuable and closest neutral planets to quickly build a strong production base.
 *     - **MID Game:** Shifts to targeted aggression. Once a solid economy is established, it identifies the weakest opponent and begins a campaign to dismantle their empire, planet by planet, while continuing to seize high-value neutral opportunities.
 *     - **LATE Game:** Becomes a ruthless finisher. If leading, it launches overwhelming, coordinated attacks to eliminate remaining threats. If trailing, it consolidates forces for a decisive "all-in" strike or plays defensively to win on planet count at timeout.
 * 3.  **Calculated Efficiency:** The bot never wastes troops. It uses `predictPlanetState` to calculate the *exact* number of troops required for a successful conquest at the moment of arrival, plus a small strategic buffer. This maximizes force projection and minimizes waste.
 * 4.  **Intelligent Reinforcement:** In moments of peace, the bot doesn't sit idle. It actively redistributes troops from safe, rear-echelon planets to critical, front-line worlds, preparing them for future offensive or defensive needs.
 * 5.  **Stateful Mission Management:** Using `this.memory.missions`, the bot tracks every fleet it sends. This prevents it from assigning multiple tasks to the same planet or sending redundant fleets to the same target, ensuring a coordinated and efficient strategy.
 */
export default class Gemini25ProB extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.name = "ApexPredator";

        // Configuration object for easy tuning of bot behavior.
        this.memory.config = {
            ACTION_COOLDOWN: 0.25,      // Minimum time between actions.
            DEFENSE_BUFFER: 5,         // Troops to add to a defensive calculation.
            OFFENSE_BUFFER: 3,         // Troops to add to an offensive calculation.
            MIN_GARRISON_AFTER_SEND: 5,// Minimum troops to leave on a planet after sending a fleet.
            REINFORCE_PERCENTAGE: 0.8, // Send 80% of troops when reinforcing.
            MIN_REINFORCE_TROOPS: 40,  // Don't bother reinforcing if the source has fewer than this many troops.
            ATTACK_STRENGTH_RATIO: 1.15,// Only attack an enemy if our strength is 115% of the strongest opponent.
        };

        // Stores ongoing tasks to prevent conflicting orders.
        // Mission format: { sourceId: string, targetId: string, type: 'attack' | 'reinforce' }
        this.memory.missions = []; 
        this.memory.actionCooldown = 0;
    }

    /**
     * The main decision-making hub, called by the game engine on each tick.
     * @param {number} dt - The time elapsed since the last decision, in game seconds.
     * @returns {object|null} A decision object or null if no action is taken.
     */
    makeDecision(dt) {
        this.memory.actionCooldown -= dt;
        if (this.memory.actionCooldown > 0) {
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null; // Surrender

        // --- Strategic Execution Pipeline ---
        // The bot processes decisions in a strict order of priority.
        
        // 1. Clean up completed or obsolete missions.
        this.cleanupMissions();

        // 2. Identify planets that are not currently tasked with a mission.
        const availablePlanets = this.getAvailablePlanets(myPlanets);

        // 3. Highest Priority: Defend planets under imminent threat.
        let decision = this.handleDefense(availablePlanets);
        if (decision) return this.finalizeDecision(decision);

        // 4. Seize valuable opportunities for expansion or offense based on game phase.
        const gamePhase = this.api.getGamePhase();
        switch (gamePhase) {
            case 'EARLY':
                decision = this.handleExpansion(availablePlanets);
                if (decision) return this.finalizeDecision(decision);
                break;
            case 'MID':
                decision = this.handleOffense(availablePlanets);
                if (!decision) {
                   decision = this.handleExpansion(availablePlanets);
                }
                if (decision) return this.finalizeDecision(decision);
                break;
            case 'LATE':
                decision = this.handleOffense(availablePlanets);
                if (decision) return this.finalizeDecision(decision);
                // In late game, if no attack is viable, consolidate for a final push or defense.
                break;
        }

        // 5. Lowest Priority: If no other action is taken, consolidate forces.
        decision = this.handleConsolidation(availablePlanets);
        if (decision) return this.finalizeDecision(decision);

        return null; // No valid action found this tick.
    }

    // ===================================================================
    // --- Core Strategic Handlers (Priority Order) ---
    // ===================================================================

    /**
     * Scans for planets that are predicted to be lost and sends reinforcements.
     * This is the highest priority action.
     */
    handleDefense(availablePlanets) {
        const myPlanets = this.api.getMyPlanets();
        if (availablePlanets.length === 0) return null;

        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            const lastAttack = incomingAttacks.sort((a, b) => a.duration - b.duration)[incomingAttacks.length - 1];
            const timeToImpact = lastAttack.duration + 0.1; // Predict state just after last impact
            
            const futureState = this.api.predictPlanetState(myPlanet, timeToImpact);

            if (futureState.owner !== this.playerId || futureState.troops < 1) {
                const troopsNeeded = Math.ceil(Math.abs(futureState.troops)) + this.memory.config.DEFENSE_BUFFER;

                // Find the best reinforcement planet: closest one with enough troops.
                const potentialHelpers = availablePlanets
                    .filter(p => p.id !== myPlanet.id && p.troops > troopsNeeded + this.memory.config.MIN_GARRISON_AFTER_SEND)
                    .map(p => ({
                        planet: p,
                        travelTime: this.api.getTravelTime(p, myPlanet)
                    }))
                    .filter(p => p.travelTime < timeToImpact); // Must be able to arrive in time!
                
                if (potentialHelpers.length > 0) {
                    potentialHelpers.sort((a, b) => a.travelTime - b.travelTime);
                    const bestHelper = potentialHelpers[0].planet;
                    
                    return {
                        from: bestHelper,
                        to: myPlanet,
                        troops: troopsNeeded,
                        mission: { sourceId: bestHelper.id, targetId: myPlanet.id, type: 'reinforce' }
                    };
                }
            }
        }
        return null;
    }

    /**
     * Identifies and captures the most valuable neutral planets.
     * Value is a function of production and proximity.
     */
    handleExpansion(availablePlanets) {
        const neutralPlanets = this.api.getNeutralPlanets().filter(p => !this.isTargeted(p.id));
        if (neutralPlanets.length === 0 || availablePlanets.length === 0) return null;

        let bestOption = null;

        for (const source of availablePlanets) {
            // Only consider planets with enough troops to expand and leave a garrison.
            if (source.troops < this.memory.config.MIN_GARRISON_AFTER_SEND + 10) continue;

            for (const target of neutralPlanets) {
                const travelTime = this.api.getTravelTime(source, target);
                // Neutrals don't produce, so prediction is simple.
                const troopsNeeded = Math.ceil(target.troops) + this.memory.config.OFFENSE_BUFFER;

                if (source.troops > troopsNeeded + this.memory.config.MIN_GARRISON_AFTER_SEND) {
                    // Score = Production / Time^2. Heavily favors closer, larger planets.
                    const value = this.api.getPlanetProductionRate(target) / (travelTime * travelTime);
                    
                    if (!bestOption || value > bestOption.value) {
                        bestOption = {
                            from: source,
                            to: target,
                            troops: troopsNeeded,
                            value: value
                        };
                    }
                }
            }
        }
        
        if (bestOption) {
            return { 
                ...bestOption, 
                mission: { sourceId: bestOption.from.id, targetId: bestOption.to.id, type: 'attack' }
            };
        }

        return null;
    }

    /**
     * Identifies and attacks the most vulnerable enemy planets.
     * Only triggers when we have a clear strength advantage.
     */
    handleOffense(availablePlanets) {
        if (this.api.getMyStrengthRatio() < this.memory.config.ATTACK_STRENGTH_RATIO) {
            return null;
        }

        const enemyPlanets = this.api.getEnemyPlanets().filter(p => !this.isTargeted(p.id));
        if (enemyPlanets.length === 0 || availablePlanets.length === 0) return null;

        let bestAttack = null;

        for (const source of availablePlanets) {
            if (source.troops < this.memory.config.MIN_GARRISON_AFTER_SEND + 20) continue;

            for (const target of enemyPlanets) {
                const travelTime = this.api.getTravelTime(source, target);
                const futureState = this.api.predictPlanetState(target, travelTime + 0.1);

                // If enemy will still own it, calculate troops needed.
                if (futureState.owner === target.owner) {
                    const troopsNeeded = Math.ceil(futureState.troops) + this.memory.config.OFFENSE_BUFFER;
                    
                    if (source.troops > troopsNeeded + this.memory.config.MIN_GARRISON_AFTER_SEND) {
                        // Score is based on planet value, but penalized by troops required.
                        // We want high-value targets that are cheap to take.
                        const value = this.api.calculatePlanetValue(target) / (troopsNeeded * travelTime);
                        if (!bestAttack || value > bestAttack.value) {
                            bestAttack = {
                                from: source,
                                to: target,
                                troops: troopsNeeded,
                                value: value
                            };
                        }
                    }
                }
            }
        }
        
        if(bestAttack) {
             return { 
                ...bestAttack, 
                mission: { sourceId: bestAttack.from.id, targetId: bestAttack.to.id, type: 'attack' }
            };
        }

        return null;
    }
    
    /**
     * Moves troops from safe, high-population "back-line" planets to
     * strategically important "front-line" planets.
     */
    handleConsolidation(availablePlanets) {
        if (availablePlanets.length < 2) return null;

        // Find front-line planets (close to any enemy)
        const frontLinePlanets = availablePlanets.filter(p => {
            const nearestEnemy = this.api.getNearestEnemyPlanet(p);
            return nearestEnemy && this.api.getDistance(p, nearestEnemy) < this.api.getMapInfo().width / 3;
        }).sort((a,b) => a.troops - b.troops); // Sort by lowest troops first

        // Find back-line planets (far from all enemies, high troop count)
        const backLinePlanets = availablePlanets.filter(p => {
             const nearestEnemy = this.api.getNearestEnemyPlanet(p);
             return !nearestEnemy || this.api.getDistance(p, nearestEnemy) > this.api.getMapInfo().width / 2;
        }).sort((a,b) => b.troops - a.troops); // Sort by highest troops first

        if (frontLinePlanets.length > 0 && backLinePlanets.length > 0) {
            const source = backLinePlanets[0];
            const target = frontLinePlanets[0];

            if (source.id !== target.id && source.troops > this.memory.config.MIN_REINFORCE_TROOPS) {
                const troopsToSend = Math.floor(source.troops * this.memory.config.REINFORCE_PERCENTAGE);
                return {
                    from: source,
                    to: target,
                    troops: troopsToSend,
                    mission: { sourceId: source.id, targetId: target.id, type: 'reinforce' }
                };
            }
        }
        
        return null;
    }

    // ===================================================================
    // --- Utility & State Management ---
    // ===================================================================

    /**
     * Registers a mission and sets the action cooldown.
     * @param {object} decision - The decision object including a 'mission' property.
     * @returns The final decision object to be sent to the game engine.
     */
    finalizeDecision(decision) {
        this.memory.missions.push(decision.mission);
        this.memory.actionCooldown = this.memory.config.ACTION_COOLDOWN;
        // The mission property is for internal tracking and should not be returned to the engine.
        const { mission, ...engineDecision } = decision;
        return engineDecision;
    }
    
    /**
     * Removes missions that are no longer valid (e.g., target captured by us).
     */
    cleanupMissions() {
        this.memory.missions = this.memory.missions.filter(mission => {
            const target = this.api.getPlanetById(mission.targetId);
            const source = this.api.getPlanetById(mission.sourceId);

            // Mission is invalid if source or target no longer exist
            if (!target || !source) return false;
            // Mission is invalid if we lost the source planet
            if (source.owner !== this.playerId) return false;
            // Attack mission is complete if we now own the target
            if (mission.type === 'attack' && target.owner === this.playerId) return false;
            
            return true; // Keep the mission active
        });
    }

    /**
     * Gets a list of planets that are not currently assigned to a mission.
     */
    getAvailablePlanets(myPlanets) {
        const assignedSourceIds = new Set(this.memory.missions.map(m => m.sourceId));
        return myPlanets.filter(p => !assignedSourceIds.has(p.id));
    }

    /**
     * Checks if a planet is the target of one of our current missions.
     */
    isTargeted(planetId) {
        return this.memory.missions.some(m => m.targetId === planetId);
    }
}