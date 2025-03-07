// Claude's first run with the GameUtilities interfaceBot personality: "The Calculated Expansionist"
// Called itself the "The Calculated Expansionist"
// Strategic, methodical, always seeking optimal battlefield control
// Assigned Zoe Spuckler

import GameUtilities from '../GameUtilities.js';

class ZoeSpuckler {
    constructor(game, playerId) {
        this.game = game;
        this.playerId = playerId;
        
        // Bot personality: "The Calculated Expansionist"
        // Strategic, methodical, always seeking optimal battlefield control
        this.personality = {
            name: "Calculated Expansionist",
            description: "Methodical strategist who balances aggressive expansion with calculated defense"
        };
    }

    makeDecision(gameState) {
        // Core decision-making logic
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        // If no planets, something went wrong
        if (ownedPlanets.length === 0) return null;

        // Prioritize strategies based on current game state
        const expansionTarget = this.findBestExpansionTarget();
        const defenseTarget = this.assessDefensiveNeeds();
        const attackTarget = this.findBestAttackTarget();

        // Decision priority: 
        // 1. Defense if critically threatened
        // 2. Expansion if safe
        // 3. Attack weakest enemy
        if (defenseTarget) {
            return defenseTarget;
        }

        if (expansionTarget) {
            return expansionTarget;
        }

        if (attackTarget) {
            return attackTarget;
        }

        return null;
    }

    findBestExpansionTarget() {
        // Identify neutral planets for strategic expansion
        const expansionTargets = GameUtilities.findExpansionTargets(this.game, this.playerId);
        
        if (expansionTargets.length === 0) return null;

        // Sort targets by strategic value
        const rankedTargets = expansionTargets
            .map(planet => ({
                planet,
                value: GameUtilities.evaluatePlanetValue(planet),
                distance: this.findClosestOwnedPlanetDistance(planet)
            }))
            .sort((a, b) => b.value.totalValue - a.value.totalValue);

        const bestTarget = rankedTargets[0];
        
        // Find best source planet for expansion
        const sourcePlanet = this.findBestSourcePlanet(bestTarget.planet);

        if (!sourcePlanet) return null;

        // Determine troops to send
        const troopsToSend = GameUtilities.recommendTroopSendAmount(sourcePlanet, bestTarget.planet);

        return {
            from: sourcePlanet,
            to: bestTarget.planet,
            troops: troopsToSend
        };
    }

    findBestAttackTarget() {
        // Find weakest enemy planet
        const weakestEnemyPlanet = GameUtilities.findWeakestEnemyPlanet(this.game, this.playerId);
        
        if (!weakestEnemyPlanet) return null;

        // Find best source planet to attack from
        const sourcePlanet = this.findBestSourcePlanet(weakestEnemyPlanet);

        if (!sourcePlanet) return null;

        // Determine troops to send
        const troopsToSend = GameUtilities.recommendTroopSendAmount(sourcePlanet, weakestEnemyPlanet);

        return {
            from: sourcePlanet,
            to: weakestEnemyPlanet,
            troops: troopsToSend
        };
    }

    assessDefensiveNeeds() {
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        // Check planets with high threat levels
        for (const planet of ownedPlanets) {
            const threatAssessment = GameUtilities.calculatePlanetThreat(this.game, planet, this.playerId);
            
            // If threat is significant and planet is not defensible
            if (threatAssessment.threatLevel > 1.5 && !GameUtilities.isPlanetDefensible(this.game, planet)) {
                // Find a safe planet to reinforce from
                const reinforcementSource = this.findSafeReinforcementSource(planet);
                
                if (reinforcementSource) {
                    const troopsToSend = Math.floor(planet.troops * 0.5);
                    return {
                        from: reinforcementSource,
                        to: planet,
                        troops: troopsToSend
                    };
                }
            }
        }

        return null;
    }

    findBestSourcePlanet(targetPlanet) {
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        // Find closest planet with sufficient troops
        return ownedPlanets.reduce((bestSource, planet) => {
            const distance = GameUtilities.calculateDistance(planet, targetPlanet);
            const troopSendPotential = planet.troops * 0.7;
            
            // Prioritize closer planets with more troops
            if (!bestSource || 
                (distance < GameUtilities.calculateDistance(bestSource, targetPlanet) && 
                 troopSendPotential > bestSource.troops * 0.7)) {
                return planet;
            }
            
            return bestSource;
        }, null);
    }

    findClosestOwnedPlanetDistance(targetPlanet) {
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        return ownedPlanets.reduce((minDistance, planet) => {
            const distance = GameUtilities.calculateDistance(planet, targetPlanet);
            return Math.min(minDistance, distance);
        }, Infinity);
    }

    findSafeReinforcementSource(threatenedPlanet) {
        const ownedPlanets = GameUtilities.getPlanetsOwnedBy(this.game, this.playerId);
        
        return ownedPlanets.find(planet => 
            planet !== threatenedPlanet && 
            planet.troops > 20 && 
            GameUtilities.calculateDistance(planet, threatenedPlanet) < 500
        );
    }
}

export default ZoeSpuckler;