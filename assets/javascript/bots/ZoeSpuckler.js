// Given the GameUtilities interface, Claude initially wrote a bot it called "The Calculated Expansionist"
// It was the worst performing bot because it rapid-fired fractions of a troop at neutral planets
// Other bots would sweep in, steal their work, and take over the home planet
// I explained the problem to give it another shot:
// Assigned Zoe Spuckler

import GameUtilities from '../GameUtilities.js';

class ZoeSpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        
        // Bot personality: "The Calculated Expansionist"
        this.personality = {
            name: "Calculated Expansionist",
            description: "Methodical strategist who balances aggressive expansion with calculated defense"
        };
        
        // Decision-making parameters
        this.lastActionTime = 0;
        this.actionCooldown = 2000; // 2 seconds cooldown
        this.minTroopsToSend = 5; // Minimum troops to ever send
        this.capturePadding = 3; // Extra troops to send beyond minimum
        this.threatThreshold = 1.5; // Threat level that triggers defensive actions
        this.defenseReserveFactor = 0.3; // Portion of troops to keep for defense
        this.productionEstimationFactor = 1; // Seconds of production to account for
        
        // Movement speed (px/second)
        this.troopMovementSpeed = 150;
    }

    makeDecision(gameState) {
        // Update game state
        this.game = gameState;
        
        // Rate limit decisions
        const currentTime = Date.now();
        if (currentTime - this.lastActionTime < this.actionCooldown) {
            return null;
        }
        
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        // If no planets, nothing to do
        if (ownedPlanets.length === 0) return null;

        // Prioritize strategies based on current game state
        const defenseTarget = this.assessDefensiveNeeds();
        const expansionTarget = this.findBestExpansionTarget();
        const attackTarget = this.findBestAttackTarget();

        // Decision priority hierarchy
        let decision = null;
        
        if (defenseTarget) {
            decision = defenseTarget;
        } else if (expansionTarget) {
            decision = expansionTarget;
        } else if (attackTarget) {
            decision = attackTarget;
        }
        
        // Validate the decision before executing
        if (decision && decision.troops >= this.minTroopsToSend) {
            this.lastActionTime = currentTime;
            return decision;
        }
        
        return null;
    }

    findBestExpansionTarget() {
        // Get expansion targets (neutral planets we might want to capture)
        const neutralPlanets = GameUtilities.getNeutralPlanets(this.game);
        if (neutralPlanets.length === 0) return null;
        
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        // Rank neutral planets by strategic value
        const rankedTargets = neutralPlanets.map(planet => {
            // Find closest owned planet
            const closestOwned = ownedPlanets.reduce((closest, ownedPlanet) => {
                const distance = GameUtilities.calculateDistance(planet, ownedPlanet);
                return (!closest || distance < closest.distance) 
                    ? { planet: ownedPlanet, distance } 
                    : closest;
            }, null);
            
            if (!closestOwned) return null;
            
            // Calculate travel time
            const travelTime = closestOwned.distance / this.troopMovementSpeed;
            
            // Evaluate strategic value
            const valueAssessment = GameUtilities.evaluatePlanetValue(planet);
            
            // Calculate required troops (accounting for any production)
            const requiredTroops = planet.troops + this.capturePadding;
            
            // Adjust value based on distance (prefer closer planets)
            const adjustedValue = valueAssessment.totalValue / (1 + closestOwned.distance/500);
            
            return {
                planet,
                sourcePlanet: closestOwned.planet,
                requiredTroops,
                value: adjustedValue,
                distance: closestOwned.distance
            };
        }).filter(target => target !== null);
        
        // Sort by adjusted value (higher is better)
        rankedTargets.sort((a, b) => b.value - a.value);
        
        // Find best viable target (one we can actually capture)
        for (const target of rankedTargets) {
            const availableTroops = Math.floor(target.sourcePlanet.troops * (1 - this.defenseReserveFactor));
            
            if (availableTroops >= target.requiredTroops) {
                return {
                    from: target.sourcePlanet,
                    to: target.planet,
                    troops: target.requiredTroops
                };
            }
        }
        
        return null;
    }

    findBestAttackTarget() {
        const enemyPlanets = GameUtilities.getEnemyPlanets(this.game, this.playerId);
        if (enemyPlanets.length === 0) return null;
        
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        // Rank enemy planets by attack attractiveness
        const attackTargets = enemyPlanets.map(planet => {
            // Find closest owned planet with sufficient troops
            const viableSources = ownedPlanets.filter(ownedPlanet => {
                const availableTroops = Math.floor(ownedPlanet.troops * (1 - this.defenseReserveFactor));
                return availableTroops > this.minTroopsToSend;
            });
            
            if (viableSources.length === 0) return null;
            
            // Find closest viable source
            const bestSource = viableSources.reduce((best, source) => {
                const distance = GameUtilities.calculateDistance(source, planet);
                return (!best || distance < GameUtilities.calculateDistance(best, planet)) 
                    ? source : best;
            }, null);
            
            // Calculate travel time 
            const travelTime = GameUtilities.calculateDistance(bestSource, planet) / this.troopMovementSpeed;
            
            // Estimate troops at arrival (accounting for production)
            const estimatedTroopsAtArrival = planet.troops + 
                (planet.productionRate * travelTime * this.productionEstimationFactor);
            
            // Required troops with padding
            const requiredTroops = Math.ceil(estimatedTroopsAtArrival) + this.capturePadding;
            
            // Calculate strategic value
            const valueAssessment = GameUtilities.evaluatePlanetValue(planet);
            
            return {
                planet,
                sourcePlanet: bestSource,
                requiredTroops,
                value: valueAssessment.totalValue,
                distance: GameUtilities.calculateDistance(bestSource, planet)
            };
        }).filter(target => target !== null);
        
        // Sort by lowest required troops (easiest to capture)
        attackTargets.sort((a, b) => {
            // First sort by whether we have enough troops to capture
            const aCanCapture = a.sourcePlanet.troops * (1 - this.defenseReserveFactor) >= a.requiredTroops;
            const bCanCapture = b.sourcePlanet.troops * (1 - this.defenseReserveFactor) >= b.requiredTroops;
            
            if (aCanCapture && !bCanCapture) return -1;
            if (!aCanCapture && bCanCapture) return 1;
            
            // Then sort by value-to-cost ratio
            const aRatio = a.value / a.requiredTroops;
            const bRatio = b.value / b.requiredTroops;
            return bRatio - aRatio;
        });
        
        // Select best viable target
        for (const target of attackTargets) {
            const availableTroops = Math.floor(target.sourcePlanet.troops * (1 - this.defenseReserveFactor));
            
            if (availableTroops >= target.requiredTroops) {
                return {
                    from: target.sourcePlanet,
                    to: target.planet,
                    troops: target.requiredTroops
                };
            }
        }
        
        return null;
    }

    assessDefensiveNeeds() {
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        const enemyPlanets = GameUtilities.getEnemyPlanets(this.game, this.playerId);
        
        // If no enemies, no need for defense
        if (enemyPlanets.length === 0) return null;
        
        // Find most threatened planet
        const threatenedPlanets = ownedPlanets.map(planet => {
            const threatAssessment = GameUtilities.calculatePlanetThreat(this.game, planet, this.playerId);
            return {
                planet,
                threat: threatAssessment.threatLevel,
                enemyTroops: threatAssessment.totalEnemyTroops
            };
        }).filter(data => data.threat > this.threatThreshold);
        
        // Sort by threat level (highest first)
        threatenedPlanets.sort((a, b) => b.threat - a.threat);
        
        if (threatenedPlanets.length === 0) return null;
        
        const mostThreatened = threatenedPlanets[0];
        
        // Find a safe planet to reinforce from
        const safeOwnedPlanets = ownedPlanets.filter(planet => 
            planet !== mostThreatened.planet && 
            GameUtilities.calculatePlanetThreat(this.game, planet, this.playerId).threatLevel < 1.0
        );
        
        if (safeOwnedPlanets.length === 0) return null;
        
        // Sort by distance (closest first)
        safeOwnedPlanets.sort((a, b) => 
            GameUtilities.calculateDistance(a, mostThreatened.planet) - 
            GameUtilities.calculateDistance(b, mostThreatened.planet)
        );
        
        // Find closest safe planet with sufficient troops
        for (const safePlanet of safeOwnedPlanets) {
            const availableTroops = Math.floor(safePlanet.troops * (1 - this.defenseReserveFactor));
            const troopsToSend = Math.max(this.minTroopsToSend, Math.min(availableTroops, mostThreatened.enemyTroops));
            
            if (troopsToSend >= this.minTroopsToSend) {
                return {
                    from: safePlanet,
                    to: mostThreatened.planet,
                    troops: troopsToSend
                };
            }
        }
        
        return null;
    }
}

export default ZoeSpuckler;