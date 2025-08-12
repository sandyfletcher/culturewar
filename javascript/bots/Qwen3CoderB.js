// =============================================
// root/javascript/bots/Qwen3CoderB.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * Dominator: A strategic bot that focuses on controlling key planets,
 * efficient expansion, and adaptive tactics based on game phase.
 * Core strategy: Expand early, consolidate mid-game, and dominate late-game.
 */

export default class Qwen3CoderB extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory = {
            actionCooldown: 0,
            missions: new Map(), // Track ongoing missions
            targets: new Set(),  // Track targeted planets
            expansionPhase: true,
            gameTime: 0
        };
    }

    /**
     * Main decision-making method called by the game engine.
     * @param {number} dt - Time elapsed since last turn, scaled by game speed.
     * @returns {object|null} Decision object or null for no action.
     */
    makeDecision(dt) {
        // Handle cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // Update game time
        this.memory.gameTime = this.api.getElapsedTime();

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }

        // Update expansion phase status
        this.memory.expansionPhase = this.api.getGamePhase() === 'EARLY';

        // Process completed missions
        this._updateMissions();

        // Get all possible actions and pick the best one
        const decision = this._findBestAction();

        if (decision) {
            // Record the mission
            if (!this.memory.missions.has(decision.fromId)) {
                this.memory.missions.set(decision.fromId, []);
            }
            this.memory.missions.get(decision.fromId).push({
                targetId: decision.toId,
                troops: decision.troops,
                time: this.memory.gameTime
            });
            
            // Add target to our tracking
            this.memory.targets.add(decision.toId);
            
            // Set cooldown
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return decision;
        }

        return null;
    }

    /**
     * Update ongoing missions, removing completed ones
     */
    _updateMissions() {
        const currentTime = this.memory.gameTime;
        for (const [planetId, missions] of this.memory.missions.entries()) {
            // Remove missions older than 30 seconds (assume they've landed)
            const validMissions = missions.filter(m => 
                currentTime - m.time < 30
            );
            
            if (validMissions.length === 0) {
                this.memory.missions.delete(planetId);
                // Also remove from targets if no other missions target it
                let targetStillActive = false;
                for (const missionsList of this.memory.missions.values()) {
                    if (missionsList.some(m => m.targetId === planetId)) {
                        targetStillActive = true;
                        break;
                    }
                }
                if (!targetStillActive) {
                    this.memory.targets.delete(planetId);
                }
            } else {
                this.memory.missions.set(planetId, validMissions);
            }
        }
    }

    /**
     * Find the best action based on current game state
     * @returns {object|null} Decision object or null
     */
    _findBestAction() {
        // Prioritize defending planets under attack
        const defenseAction = this._findDefenseAction();
        if (defenseAction) return defenseAction;

        // Find expansion opportunities
        const expansionAction = this._findExpansionAction();
        if (expansionAction) return expansionAction;

        // Look for strategic attacks
        const attackAction = this._findAttackAction();
        if (attackAction) return attackAction;

        // Consolidate forces if nothing else to do
        const consolidationAction = this._findConsolidationAction();
        if (consolidationAction) return consolidationAction;

        return null;
    }

    /**
     * Find defensive actions for planets under threat
     * @returns {object|null} Decision object or null
     */
    _findDefenseAction() {
        const myPlanets = this.api.getMyPlanets();
        
        for (const planet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(planet);
            
            if (incomingAttacks.length > 0) {
                // Calculate total incoming attack force
                const totalAttackForce = incomingAttacks.reduce(
                    (sum, attack) => sum + attack.amount, 0
                );
                
                // If we're going to lose the planet, abandon it
                if (totalAttackForce >= planet.troops) {
                    // Try to evacuate to a nearby friendly planet
                    const friendlyPlanets = this.api.getMyPlanets()
                        .filter(p => p.id !== planet.id);
                    
                    if (friendlyPlanets.length > 0) {
                        const nearestFriendly = this.api.findNearestPlanet(
                            planet, friendlyPlanets
                        );
                        
                        if (nearestFriendly && planet.troops > 10) {
                            return {
                                fromId: planet.id,
                                toId: nearestFriendly.id,
                                troops: Math.floor(planet.troops * 0.8)
                            };
                        }
                    }
                } 
                // Otherwise, reinforce the planet
                else {
                    const reinforcementNeeded = totalAttackForce - planet.troops * 0.5;
                    if (reinforcementNeeded > 0) {
                        // Find a nearby friendly planet to send reinforcements
                        const friendlyPlanets = this.api.getMyPlanets()
                            .filter(p => p.id !== planet.id && p.troops > reinforcementNeeded + 20);
                        
                        if (friendlyPlanets.length > 0) {
                            const nearestFriendly = this.api.findNearestPlanet(
                                planet, friendlyPlanets
                            );
                            
                            if (nearestFriendly) {
                                return {
                                    fromId: nearestFriendly.id,
                                    toId: planet.id,
                                    troops: Math.min(
                                        Math.floor(reinforcementNeeded * 1.2),
                                        Math.floor(nearestFriendly.troops * 0.7)
                                    )
                                };
                            }
                        }
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * Find expansion opportunities to neutral planets
     * @returns {object|null} Decision object or null
     */
    _findExpansionAction() {
        if (!this.memory.expansionPhase) return null;

        const myPlanets = this.api.getMyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets()
            .filter(p => !this.memory.targets.has(p.id));
        
        if (neutralPlanets.length === 0) return null;

        // Score neutral planets based on value and proximity
        const scoredPlanets = neutralPlanets.map(planet => {
            // Calculate value (production rate, size, centrality)
            const value = this.api.calculatePlanetValue(planet);
            
            // Find nearest of our planets
            const nearestOurs = this.api.findNearestPlanet(planet, myPlanets);
            const distance = nearestOurs ? this.api.getDistance(planet, nearestOurs) : Infinity;
            
            // Score based on value/distance ratio
            const score = value / (distance + 1);
            
            return { planet, score, nearestOurs, distance };
        }).filter(item => item.nearestOurs && item.nearestOurs.troops > 20);

        // Sort by score
        scoredPlanets.sort((a, b) => b.score - a.score);

        // Try to expand to the best targets
        for (const target of scoredPlanets) {
            const { planet, nearestOurs, distance } = target;
            
            // Predict planet state when our fleet arrives
            const travelTime = this.api.getTravelTime(nearestOurs, planet);
            const predictedState = this.api.predictPlanetState(planet, travelTime);
            
            // Only expand if we predict we can take it
            if (predictedState.owner === 'neutral' && predictedState.troops < nearestOurs.troops * 0.8) {
                const neededTroops = Math.min(
                    Math.floor(predictedState.troops * 1.1) + 5,
                    Math.floor(nearestOurs.troops * 0.7)
                );
                
                if (neededTroops > 10 && nearestOurs.troops > neededTroops + 10) {
                    return {
                        fromId: nearestOurs.id,
                        toId: planet.id,
                        troops: neededTroops
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Find strategic attacks on enemy planets
     * @returns {object|null} Decision object or null
     */
    _findAttackAction() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets()
            .filter(p => !this.memory.targets.has(p.id));
        
        if (enemyPlanets.length === 0) return null;

        // Get our strength ratio to decide aggression level
        const strengthRatio = this.api.getMyStrengthRatio();
        const isStrong = strengthRatio > 1.2;
        const isWinning = strengthRatio > 2.0;

        // Score enemy planets based on strategic value
        const scoredTargets = enemyPlanets.map(planet => {
            // Calculate strategic value
            let value = this.api.calculatePlanetValue(planet);
            
            // Bonus for high production planets
            value += planet.productionRate * 5;
            
            // Bonus for isolated planets (easier to conquer)
            const nearbyEnemies = this.api.getEnemyPlanets()
                .filter(p => this.api.getDistance(p, planet) < 100)
                .length;
            value += (5 - nearbyEnemies) * 3; // More value for isolated planets
            
            // Find our nearest planet
            const nearestOurs = this.api.findNearestPlanet(planet, myPlanets);
            const distance = nearestOurs ? this.api.getDistance(planet, nearestOurs) : Infinity;
            
            // Adjust score based on distance and our strength
            const distanceFactor = isStrong ? 1 : 2; // Strong bots can reach further
            const score = value / (distance + 1) ** distanceFactor;
            
            return { planet, score, value, nearestOurs, distance };
        })
        .filter(item => item.nearestOurs && item.nearestOurs.troops > 30)
        .sort((a, b) => b.score - a.score);

        // Try attacks in order of priority
        for (const target of scoredTargets) {
            const { planet, nearestOurs, value } = target;
            
            // Predict state when our fleet arrives
            const travelTime = this.api.getTravelTime(nearestOurs, planet);
            const predictedState = this.api.predictPlanetState(planet, travelTime);
            
            // Only attack if we think we can win
            if (predictedState.owner !== this.playerId) {
                let neededTroops;
                
                if (isWinning) {
                    // If we're winning, be aggressive
                    neededTroops = Math.floor(predictedState.troops * 1.3) + 10;
                } else {
                    // Conservative attack
                    neededTroops = Math.floor(predictedState.troops * 1.1) + 5;
                }
                
                // Check if we have enough troops
                if (nearestOurs.troops > neededTroops + 20) {
                    return {
                        fromId: nearestOurs.id,
                        toId: planet.id,
                        troops: Math.min(
                            neededTroops,
                            Math.floor(nearestOurs.troops * 0.8)
                        )
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Find consolidation opportunities (move troops between own planets)
     * @returns {object|null} Decision object or null
     */
    _findConsolidationAction() {
        const myPlanets = this.api.getMyPlanets();
        
        // In late game, consolidate toward center
        if (this.api.getGamePhase() === 'LATE') {
            const mapInfo = this.api.getMapInfo();
            const center = { x: mapInfo.width / 2, y: mapInfo.height / 2 };
            
            // Find planets far from center with excess troops
            const fringePlanets = myPlanets
                .filter(p => {
                    const distToCenter = Math.sqrt(
                        Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2)
                    );
                    return distToCenter > Math.min(mapInfo.width, mapInfo.height) * 0.3;
                })
                .filter(p => p.troops > 100);
            
            if (fringePlanets.length > 0) {
                const source = fringePlanets[0];
                
                // Find nearest central planet
                const centralPlanets = myPlanets
                    .filter(p => p.id !== source.id)
                    .map(p => {
                        const distToCenter = Math.sqrt(
                            Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2)
                        );
                        return { planet: p, distance: distToCenter };
                    })
                    .sort((a, b) => a.distance - b.distance);
                
                if (centralPlanets.length > 0) {
                    const target = centralPlanets[0].planet;
                    
                    if (source.troops > 50) {
                        return {
                            fromId: source.id,
                            toId: target.id,
                            troops: Math.floor(source.troops * 0.4)
                        };
                    }
                }
            }
        }
        
        // Move excess troops from overpopulated planets to underpopulated ones
        const overpopulated = myPlanets.filter(p => p.troops > p.size * 20 && p.troops > 100);
        
        if (overpopulated.length > 0) {
            const source = overpopulated[0];
            const underpopulated = myPlanets
                .filter(p => p.id !== source.id && p.troops < p.size * 10)
                .sort((a, b) => a.troops - b.troops);
            
            if (underpopulated.length > 0) {
                const target = underpopulated[0];
                
                return {
                    fromId: source.id,
                    toId: target.id,
                    troops: Math.floor(source.troops * 0.3)
                };
            }
        }
        
        return null;
    }
}