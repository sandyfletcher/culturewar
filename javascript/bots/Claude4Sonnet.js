// =============================================
// root/javascript/bots/Claude4Sonnet.js
// =============================================

import BaseBot from './BaseBot.js';

export default class Claude4Sonnet extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        // Strategic constants
        this.EARLY_GAME_THRESHOLD = 60; // seconds
        this.MID_GAME_THRESHOLD = 180; // seconds
        this.MINIMUM_DEFENSE_RATIO = 0.3; // Keep 30% of troops for defense
        this.EXPANSION_TROOP_THRESHOLD = 15; // Min troops before expanding
        this.ATTACK_SUCCESS_MARGIN = 1.2; // Attack with 20% more troops than needed
        this.THREAT_RESPONSE_THRESHOLD = 20; // React to threats above this level
        this.CONSOLIDATION_DISTANCE = 200; // Prefer targets within this distance during mid-game
        // Memory initialization
        this.memory = {
            lastDecisionTime: 0,
            targetPriorities: new Map(),
            failedAttacks: new Set(),
            enemyStrengthHistory: [],
            phaseTransitionTime: 0
        };
    }
    makeDecision(dt) {
        const currentTime = this.api.getElapsedTime();
        // Determine current game phase
        const gamePhase = this.determineGamePhase(currentTime);
        // Update strategic memory
        this.updateStrategicMemory(currentTime);
        // Get current situation assessment
        const situation = this.assessSituation();
        // Make decision based on phase and situation
        switch (gamePhase) {
            case 'early':
                return this.makeEarlyGameDecision(situation);
            case 'mid':
                return this.makeMidGameDecision(situation);
            case 'late':
                return this.makeLateGameDecision(situation);
            default:
                return null;
        }
    }
    determineGamePhase(currentTime) {
        if (currentTime < this.EARLY_GAME_THRESHOLD) return 'early';
        if (currentTime < this.MID_GAME_THRESHOLD) return 'mid';
        return 'late';
    }
    assessSituation() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const neutralPlanets = this.api.getNeutralPlanets();
        const myTotalTroops = this.api.getMyTotalTroops();
        const myProduction = this.api.getMyTotalProduction();
        // Calculate relative strength vs all opponents
        let totalEnemyTroops = 0;
        let totalEnemyProduction = 0;
        for (const playerId of this.api.getOpponentIds()) {
            if (this.api.isPlayerActive(playerId)) {
                totalEnemyTroops += this.api.getPlayerTotalTroops(playerId);
                totalEnemyProduction += this.api.getPlayerTotalProduction(playerId);
            }
        }
        const troopRatio = totalEnemyTroops > 0 ? myTotalTroops / totalEnemyTroops : 2.0;
        const productionRatio = totalEnemyProduction > 0 ? myProduction / totalEnemyProduction : 2.0;
        // Identify threats and opportunities
        const threatenedPlanets = myPlanets.filter(p => this.api.calculateThreat(p) > this.THREAT_RESPONSE_THRESHOLD);
        const vulnerableTargets = this.identifyVulnerableTargets(enemyPlanets.concat(neutralPlanets));
        return {
            myPlanets,
            enemyPlanets,
            neutralPlanets,
            myTotalTroops,
            myProduction,
            troopRatio,
            productionRatio,
            threatenedPlanets,
            vulnerableTargets,
            isWinning: troopRatio > 1.2 && productionRatio > 1.1,
            isLosing: troopRatio < 0.8 || productionRatio < 0.9
        };
    }
    makeEarlyGameDecision(situation) {
        // Early game: Focus on rapid expansion and securing key neutral planets
        // Priority 1: Defend against immediate threats
        const defenseAction = this.handleDefense(situation);
        if (defenseAction) return defenseAction;
        // Priority 2: Secure high-value neutral planets quickly
        const expansionAction = this.handleEarlyExpansion(situation);
        if (expansionAction) return expansionAction;
        // Priority 3: Opportunistic attacks on weak enemies
        return this.handleOpportunisticAttack(situation);
    }
    makeMidGameDecision(situation) {
        // Mid game: Consolidate territory and build up strength
        // Priority 1: Critical defense
        const defenseAction = this.handleDefense(situation);
        if (defenseAction) return defenseAction;
        // Priority 2: Consolidate nearby territories
        const consolidationAction = this.handleConsolidation(situation);
        if (consolidationAction) return consolidationAction;
        // Priority 3: Strategic expansion
        const expansionAction = this.handleStrategicExpansion(situation);
        if (expansionAction) return expansionAction;
        return null;
    }
    makeLateGameDecision(situation) {
        // Late game: Push for victory or survive until time runs out
        if (situation.isWinning) {
            // Aggressive push for total victory
            const finishingAction = this.handleFinishingMove(situation);
            if (finishingAction) return finishingAction;
        } else if (situation.isLosing) {
            // Desperate defensive measures and counterattacks
            const desperateAction = this.handleDesperateDefense(situation);
            if (desperateAction) return desperateAction;
        }
        // Standard late-game behavior
        const defenseAction = this.handleDefense(situation);
        if (defenseAction) return defenseAction;
        return this.handleStrategicAttack(situation);
    }
    handleDefense(situation) {
        // Find the most threatened planet that we can actually defend
        const mostThreatened = situation.threatenedPlanets
            .sort((a, b) => this.api.calculateThreat(b) - this.api.calculateThreat(a))[0];
        if (!mostThreatened) return null;
        const incomingAttacks = this.api.getIncomingAttacks(mostThreatened);
        const totalIncomingTroops = incomingAttacks.reduce((sum, attack) => sum + attack.amount, 0);
        if (totalIncomingTroops === 0) return null;
        // Calculate troops needed for defense (with safety margin)
        const currentDefense = mostThreatened.troops + this.api.getIncomingReinforcements(mostThreatened).reduce((sum, r) => sum + r.amount, 0);
        const troopsNeeded = Math.ceil((totalIncomingTroops - currentDefense) * 1.1);
        if (troopsNeeded <= 0) return null;
        // Find the best planet to send reinforcements from
        const reinforcementSource = this.findBestReinforcementSource(mostThreatened, troopsNeeded);
        if (reinforcementSource && reinforcementSource.availableTroops >= troopsNeeded) {
            return {
                from: reinforcementSource.planet,
                to: mostThreatened,
                troops: troopsNeeded
            };
        }
        return null;
    }
    handleEarlyExpansion(situation) {
        // Target the most valuable neutral planets that we can capture
        const viableTargets = situation.neutralPlanets
            .filter(planet => {
                const nearestMyPlanet = this.api.findNearestPlanet(planet, situation.myPlanets);
                if (!nearestMyPlanet) return false;
                const troopsNeeded = Math.ceil(planet.troops * this.ATTACK_SUCCESS_MARGIN);
                const availableTroops = Math.floor(nearestMyPlanet.troops * (1 - this.MINIMUM_DEFENSE_RATIO));
                return availableTroops >= troopsNeeded && availableTroops >= this.EXPANSION_TROOP_THRESHOLD;
            })
            .map(planet => ({
                planet,
                value: this.api.calculatePlanetValue(planet),
                nearestSource: this.api.findNearestPlanet(planet, situation.myPlanets)
            }))
            .sort((a, b) => b.value - a.value);
        if (viableTargets.length > 0) {
            const target = viableTargets[0];
            const troopsToSend = Math.ceil(target.planet.troops * this.ATTACK_SUCCESS_MARGIN);
            return {
                from: target.nearestSource,
                to: target.planet,
                troops: troopsToSend
            };
        }
        return null;
    }
    handleConsolidation(situation) {
        // Focus on capturing nearby territories to create stronger clusters
        const consolidationTargets = situation.enemyPlanets.concat(situation.neutralPlanets)
            .filter(planet => {
                const nearestMyPlanet = this.api.findNearestPlanet(planet, situation.myPlanets);
                return nearestMyPlanet && this.api.getDistance(nearestMyPlanet, planet) <= this.CONSOLIDATION_DISTANCE;
            })
            .map(planet => ({
                planet,
                source: this.api.findNearestPlanet(planet, situation.myPlanets),
                value: this.calculateConsolidationValue(planet, situation.myPlanets)
            }))
            .filter(target => {
                const troopsNeeded = Math.ceil(this.api.estimateTroopsAtArrival(target.source, target.planet) * this.ATTACK_SUCCESS_MARGIN);
                const availableTroops = Math.floor(target.source.troops * (1 - this.MINIMUM_DEFENSE_RATIO));
                return availableTroops >= troopsNeeded;
            })
            .sort((a, b) => b.value - a.value);
        if (consolidationTargets.length > 0) {
            const target = consolidationTargets[0];
            const troopsNeeded = Math.ceil(this.api.estimateTroopsAtArrival(target.source, target.planet) * this.ATTACK_SUCCESS_MARGIN);
            return {
                from: target.source,
                to: target.planet,
                troops: troopsNeeded
            };
        }
        return null;
    }
    handleStrategicExpansion(situation) {
        // Similar to early expansion but with more strategic considerations
        return this.handleEarlyExpansion(situation);
    }
    handleFinishingMove(situation) {
        // When winning, focus on eliminating the strongest remaining opponent
        const strongestOpponent = this.findStrongestOpponent();
        if (!strongestOpponent) return this.handleOpportunisticAttack(situation);
        const opponentPlanets = situation.enemyPlanets.filter(p => p.owner === strongestOpponent);
        const weakestOpponentPlanet = opponentPlanets
            .sort((a, b) => a.troops - b.troops)[0];
        if (weakestOpponentPlanet) {
            const attackSource = this.findBestAttackSource(weakestOpponentPlanet, situation.myPlanets);
            if (attackSource) {
                const troopsNeeded = Math.ceil(this.api.estimateTroopsAtArrival(attackSource, weakestOpponentPlanet) * this.ATTACK_SUCCESS_MARGIN);
                const availableTroops = Math.floor(attackSource.troops * 0.8); // More aggressive when winning
                if (availableTroops >= troopsNeeded) {
                    return {
                        from: attackSource,
                        to: weakestOpponentPlanet,
                        troops: troopsNeeded
                    };
                }
            }
        }
        return this.handleOpportunisticAttack(situation);
    }
    handleDesperateDefense(situation) {
        // When losing, make risky moves to try to turn the tide
        const defenseAction = this.handleDefense(situation);
        if (defenseAction) return defenseAction;
        // Look for high-risk, high-reward attacks
        const desperateTargets = situation.vulnerableTargets
            .filter(target => this.api.calculatePlanetValue(target.planet) > 50) // High-value only
            .sort((a, b) => b.value - a.value);
        if (desperateTargets.length > 0) {
            const target = desperateTargets[0];
            const troopsNeeded = Math.ceil(this.api.estimateTroopsAtArrival(target.source, target.planet) * 1.1); // Lower margin
            const availableTroops = Math.floor(target.source.troops * 0.8); // More aggressive
            if (availableTroops >= troopsNeeded) {
                return {
                    from: target.source,
                    to: target.planet,
                    troops: troopsNeeded
                };
            }
        }
        return null;
    }
    handleOpportunisticAttack(situation) {
        if (situation.vulnerableTargets.length === 0) return null;
        const bestTarget = situation.vulnerableTargets[0];
        const troopsNeeded = Math.ceil(this.api.estimateTroopsAtArrival(bestTarget.source, bestTarget.planet) * this.ATTACK_SUCCESS_MARGIN);
        return {
            from: bestTarget.source,
            to: bestTarget.planet,
            troops: troopsNeeded
        };
    }
    handleStrategicAttack(situation) {
        // Look for strategic attacks that improve our position
        return this.handleOpportunisticAttack(situation);
    }
    identifyVulnerableTargets(planets) {
        const myPlanets = this.api.getMyPlanets();
        return planets
            .map(planet => {
                const nearestMyPlanet = this.api.findNearestPlanet(planet, myPlanets);
                if (!nearestMyPlanet) return null;
                const troopsNeeded = Math.ceil(this.api.estimateTroopsAtArrival(nearestMyPlanet, planet) * this.ATTACK_SUCCESS_MARGIN);
                const availableTroops = Math.floor(nearestMyPlanet.troops * (1 - this.MINIMUM_DEFENSE_RATIO));
                if (availableTroops < troopsNeeded) return null;
                return {
                    planet,
                    source: nearestMyPlanet,
                    value: this.api.calculatePlanetValue(planet),
                    cost: troopsNeeded,
                    efficiency: this.api.calculatePlanetValue(planet) / troopsNeeded
                };
            })
            .filter(target => target !== null)
            .sort((a, b) => b.efficiency - a.efficiency);
    }
    findBestAttackSource(targetPlanet, sourcePlanets) {
        return sourcePlanets
            .filter(planet => {
                const threat = this.api.calculateThreat(planet);
                return threat < this.THREAT_RESPONSE_THRESHOLD; // Don't attack from threatened planets
            })
            .sort((a, b) => {
                const distanceA = this.api.getDistance(a, targetPlanet);
                const distanceB = this.api.getDistance(b, targetPlanet);
                return distanceA - distanceB; // Prefer closer planets
            })[0] || null;
    }
    findBestReinforcementSource(targetPlanet, troopsNeeded) {
        const myPlanets = this.api.getMyPlanets().filter(p => p !== targetPlanet);
        let bestSource = null;
        let bestScore = 0;
        for (const planet of myPlanets) {
            const availableTroops = Math.floor(planet.troops * (1 - this.MINIMUM_DEFENSE_RATIO));
            if (availableTroops < troopsNeeded) continue;
            const distance = this.api.getDistance(planet, targetPlanet);
            const threat = this.api.calculateThreat(planet);
            // Score based on available troops and proximity, penalized by threat
            const score = availableTroops / (distance + 1) - threat;
            if (score > bestScore) {
                bestScore = score;
                bestSource = { planet, availableTroops };
            }
        }
        return bestSource;
    }
    calculateConsolidationValue(planet, myPlanets) {
        const baseValue = this.api.calculatePlanetValue(planet);
        // Bonus for planets that connect our territories
        const nearbyMyPlanets = myPlanets.filter(p => this.api.getDistance(p, planet) <= this.CONSOLIDATION_DISTANCE);
        const connectivityBonus = nearbyMyPlanets.length * 10;
        return baseValue + connectivityBonus;
    }
    findStrongestOpponent() {
        const opponents = this.api.getOpponentIds().filter(id => this.api.isPlayerActive(id));
        if (opponents.length === 0) return null;
        return opponents.reduce((strongest, current) => {
            const currentStrength = this.api.getPlayerTotalTroops(current) + this.api.getPlayerTotalProduction(current) * 10;
            const strongestStrength = this.api.getPlayerTotalTroops(strongest) + this.api.getPlayerTotalProduction(strongest) * 10;
            return currentStrength > strongestStrength ? current : strongest;
        });
    }
    updateStrategicMemory(currentTime) {
        // Track enemy strength over time for trend analysis
        const totalEnemyStrength = this.api.getOpponentIds()
            .filter(id => this.api.isPlayerActive(id))
            .reduce((sum, id) => sum + this.api.getPlayerTotalTroops(id) + this.api.getPlayerTotalProduction(id) * 5, 0);
        this.memory.enemyStrengthHistory.push({
            time: currentTime,
            strength: totalEnemyStrength
        });
        // Keep only recent history (last 60 seconds)
        this.memory.enemyStrengthHistory = this.memory.enemyStrengthHistory
            .filter(entry => currentTime - entry.time <= 60);
        this.memory.lastDecisionTime = currentTime;
    }
}