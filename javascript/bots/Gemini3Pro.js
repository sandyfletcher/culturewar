// =============================================
// root/javascript/bots/Gemini3Pro.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * NexusPrime: A predictive, utility-based AI.
 * 
 * STRATEGY:
 * 1. Predictive Defense: Uses `predictPlanetState` to detect future losses and reinforces immediately.
 * 2. ROI Expansion: Scores targets based on (Production Gain / Travel Time / Troops Cost).
 * 3. Supply Chain: Automatically offloads troops from safe, high-population planets to the front lines to avoid the 999 cap.
 */

export default class Gemini3Pro extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        this.memory.actionCooldown = 0;
    }

    /**
     * Main decision loop.
     * @param {number} dt - Time elapsed scaled by game speed.
     */
    makeDecision(dt) {
        // 1. Handle Cooldown
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        // 2. Data Gathering
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        
        // We can only make ONE move. We must find the BEST move.
        let bestMove = null;

        // --- PRIORITY 1: CRITICAL DEFENSE ---
        // Check if any of my planets are going to be captured.
        // We look ahead up to 10 seconds or the arrival of the last incoming fleet.
        bestMove = this.findEmergencyDefense(myPlanets);
        
        // --- PRIORITY 2: OFFENSIVE SCORING ---
        // If no emergency, look for the highest ROI attack (Neutral or Enemy).
        if (!bestMove) {
            bestMove = this.findBestAttack(myPlanets, neutralPlanets, enemyPlanets);
        }

        // --- PRIORITY 3: LOGISTICS (Avoiding Cap) ---
        // If no good attacks, check if any planet is dangerously full (>800) and move troops forward.
        if (!bestMove) {
            bestMove = this.manageLogistics(myPlanets, enemyPlanets);
        }

        // 3. Execution
        if (bestMove) {
            // Set cooldown based on game rules
            this.memory.actionCooldown = this.api.getDecisionCooldown();
            return {
                fromId: bestMove.fromId,
                toId: bestMove.toId,
                troops: Math.floor(bestMove.troops)
            };
        }

        return null;
    }

    /**
     * Scans owned planets to see if any will change ownership to an enemy in the future.
     * If so, attempts to find a neighbor to reinforce it.
     */
    findEmergencyDefense(myPlanets) {
        for (const planet of myPlanets) {
            // Look at incoming attacks to determine a relevant time horizon
            const incoming = this.api.getIncomingAttacks(planet);
            if (incoming.length === 0) continue;

            // Find the latest arrival time
            const lastArrival = Math.max(...incoming.map(f => f.duration));
            
            // Predict state right after the last fleet hits
            const futureState = this.api.predictPlanetState(planet, lastArrival + 0.1);

            // If the prediction says it won't be ours, we need help.
            if (futureState.owner !== this.playerId) {
                const deficit = futureState.troops; // This will be the enemy troops remaining
                const safetyBuffer = 10;
                const needed = deficit + safetyBuffer;

                // Find a source
                const source = this.findBestSourceForTarget(myPlanets, planet, needed, true); // true = exclude the target itself
                
                if (source) {
                    return {
                        fromId: source.id,
                        toId: planet.id,
                        troops: needed
                    };
                }
            }
        }
        return null;
    }

    /**
     * Evaluates all possible attacks on Neutrals and Enemies.
     * Uses a utility function: Value / (Cost * Time).
     */
    findBestAttack(myPlanets, neutralPlanets, enemyPlanets) {
        let bestScore = -Infinity;
        let bestAction = null;
        
        const targets = [...neutralPlanets, ...enemyPlanets];

        // Optimization: Don't iterate n^2 if n is huge. 
        // For now, iterate all because map sizes are usually reasonable.
        
        for (const target of targets) {
            // Calculate Distance & Time from a "Centroid" of my planets to filter hopeless targets early? 
            // No, strict calculation is better for accuracy.

            // Filter: Don't attack if we have incoming fleets that will already conquer it.
            const myIncoming = this.api.getIncomingReinforcements(target); // "Reinforcements" counts my fleets to ANY target
            const alreadyWinning = myIncoming.length > 0; // Simplification: if we sent something, assume we calculated correctly previously.
            if (alreadyWinning) continue;

            // Find best single planet to launch this attack
            // We need to know the travel time to calculate the predicted cost.
            // This is a chicken-egg problem (need source to get time, need time to get cost).
            // Solution: Iterate my planets, calculate specific score for that pair.
            
            for (const source of myPlanets) {
                if (source.troops < 15) continue; // Don't use empty planets

                const dist = this.api.getDistance(source, target);
                const travelTime = this.api.getTravelTime(source, target);
                
                // PREDICT: How many troops will be there when we arrive?
                const predictedState = this.api.predictPlanetState(target, travelTime);
                let troopsNeeded = predictedState.troops + 1; // +1 to win
                
                // Safety buffer
                troopsNeeded += 5;

                // If target is enemy, prediction accounts for their production.
                // If target is neutral, prediction accounts for nothing (static), which is fine.
                
                // Check affordability
                if (source.troops > troopsNeeded) {
                    let score = 0;
                    
                    // --- SCORING FORMULA ---
                    
                    // 1. Production Value
                    const prodValue = target.productionRate * 100; 
                    
                    // 2. Cost Penalty (Troops spent)
                    const costPenalty = troopsNeeded * 1.5;

                    // 3. Time Penalty (Distance)
                    // We penalize distance heavily because time = lost production opportunity
                    const timePenalty = travelTime * 5;

                    if (target.owner === 'neutral') {
                        // Neutral logic: High production, low cost is king.
                        score = prodValue - costPenalty - timePenalty;
                    } else {
                        // Enemy logic: taking an enemy planet is worth double (I gain +X, they lose -X).
                        // Also, attacking enemies forces them to react.
                        score = (prodValue * 2.5) - costPenalty - timePenalty;
                        
                        // Bonus: Attack if they are weak (low troops relative to prod)
                        if (target.troops < 10) score += 50;
                    }

                    // Update Best
                    if (score > bestScore) {
                        bestScore = score;
                        bestAction = {
                            fromId: source.id,
                            toId: target.id,
                            troops: troopsNeeded
                        };
                    }
                }
            }
        }

        // Threshold: Don't make negative utility moves just because they are the "best" of a bad bunch.
        if (bestScore > 10) {
            return bestAction;
        }
        
        return null;
    }

    /**
     * Logistics: If a planet is full, move troops to a planet closer to the enemy.
     */
    manageLogistics(myPlanets, enemyPlanets) {
        // Sort my planets by troop count descending
        const fullPlanets = myPlanets.filter(p => p.troops > 800); // Capacity is 999
        
        if (fullPlanets.length === 0) return null;
        
        // Pick the fullest
        const source = fullPlanets.reduce((prev, current) => (prev.troops > current.troops) ? prev : current);

        // Find a destination: A friendly planet that is NOT full and is closer to the enemy center of mass
        const enemyCenter = this.getCenterOfMass(enemyPlanets);
        
        if (!enemyCenter) return null; // No enemies left?

        const myDistToEnemy = this.api.getDistance(source, enemyCenter);
        
        let bestDest = null;
        let bestImprovement = -Infinity;

        for (const p of myPlanets) {
            if (p.id === source.id) continue;
            if (p.troops > 700) continue; // Don't clog other high planets

            const distToEnemy = this.api.getDistance(p, enemyCenter);
            
            // We want a planet that is closer to the enemy than we are
            const improvement = myDistToEnemy - distToEnemy;
            
            if (improvement > 0 && improvement > bestImprovement) {
                bestImprovement = improvement;
                bestDest = p;
            }
        }

        if (bestDest) {
            return {
                fromId: source.id,
                toId: bestDest.id,
                troops: source.troops - 100 // Keep a garrison, send the bulk
            };
        }

        return null;
    }

    /**
     * Helper: Find a source planet that can afford 'amount' troops.
     * Prefers closest source to minimize travel time.
     */
    findBestSourceForTarget(myPlanets, targetPlanet, amount, excludeTarget = false) {
        let bestSource = null;
        let minTime = Infinity;

        for (const p of myPlanets) {
            if (excludeTarget && p.id === targetPlanet.id) continue;
            if (p.troops > amount) {
                const time = this.api.getTravelTime(p, targetPlanet);
                if (time < minTime) {
                    minTime = time;
                    bestSource = p;
                }
            }
        }
        return bestSource;
    }

    /**
     * Helper: Calculates the average X/Y of a list of planets.
     * Used to find where the "front line" is.
     */
    getCenterOfMass(planets) {
        if (planets.length === 0) return null;
        let sumX = 0, sumY = 0;
        for (const p of planets) {
            sumX += p.x;
            sumY += p.y;
        }
        return {
            x: sumX / planets.length,
            y: sumY / planets.length
        };
    }
}