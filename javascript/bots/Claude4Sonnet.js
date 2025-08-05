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
            ...this.memory, // Keep base memory structure
            lastDecisionTime: 0,
            targetPriorities: new Map(),
            failedAttacks: new Set(),
            enemyStrengthHistory: [],
            phaseTransitionTime: 0
        };
    }
    makeDecision(dt) {
        const currentTime = this.api.getElapsedTime();
        const gamePhase = this.determineGamePhase(currentTime);
        this.updateStrategicMemory(currentTime);
        const situation = this.assessSituation();
        
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
        
        const strengthRatio = this.api.getMyStrengthRatio();
        
        const threatenedPlanets = myPlanets.filter(p => this.api.calculateThreat(p) > this.THREAT_RESPONSE_THRESHOLD);
        const vulnerableTargets = this.identifyVulnerableTargets(enemyPlanets.concat(neutralPlanets));

        return {
            myPlanets, enemyPlanets, neutralPlanets,
            myTotalTroops, myProduction,
            strengthRatio,
            threatenedPlanets, vulnerableTargets,
            isWinning: strengthRatio > 1.2,
            isLosing: strengthRatio < 0.8
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
        const totalIncomingTroops = this.api.getIncomingAttacks(mostThreatened).reduce((sum, attack) => sum + attack.amount, 0);
        if (totalIncomingTroops === 0) return null;
        const currentDefense = mostThreatened.troops + this.api.getIncomingReinforcements(mostThreatened).reduce((sum, r) => sum + r.amount, 0);
        const troopsNeeded = Math.ceil((totalIncomingTroops - currentDefense) * 1.1);
        if (troopsNeeded <= 0) return null;
        const reinforcementSource = this.findBestReinforcementSource(mostThreatened, troopsNeeded, situation.myPlanets);
        if (reinforcementSource && reinforcementSource.availableTroops >= troopsNeeded) {
            return { from: reinforcementSource.planet, to: mostThreatened, troops: troopsNeeded };
        }
        return null;
    }
    findBestReinforcementSource(targetPlanet, troopsNeeded, myPlanets) {
        let bestSource = null;
        let bestScore = -Infinity;
        for (const planet of myPlanets) {
            if (planet.id === targetPlanet.id) continue;

            const availableTroops = Math.floor(planet.troops * (1 - this.MINIMUM_DEFENSE_RATIO));
            if (availableTroops < troopsNeeded) continue;
            
            const distance = this.api.getDistance(planet, targetPlanet);
            const threat = this.api.calculateThreat(planet);
            const score = availableTroops / (distance + 1) - threat;
            if (score > bestScore) {
                bestScore = score;
                bestSource = { planet, availableTroops };
            }
        }
        return bestSource;
    }
    identifyVulnerableTargets(planets) {
        const myPlanets = this.api.getMyPlanets();
        return planets
            .map(planet => {
                const nearestMyPlanet = this.api.findNearestPlanet(planet, myPlanets);
                if (!nearestMyPlanet) return null;
                const travelTime = this.api.getTravelTime(nearestMyPlanet, planet);
                const predictedState = this.api.predictPlanetState(planet, travelTime);
                if (predictedState.owner === this.playerId) return null;
                const troopsNeeded = Math.ceil(predictedState.troops * this.ATTACK_SUCCESS_MARGIN);
                const availableTroops = Math.floor(nearestMyPlanet.troops * (1 - this.MINIMUM_DEFENSE_RATIO));
                if (availableTroops < troopsNeeded) return null;
                const value = this.api.calculatePlanetValue(planet);
                return {
                    planet,
                    source: nearestMyPlanet,
                    value: value,
                    cost: troopsNeeded,
                    efficiency: value / (troopsNeeded + 1)
                };
            })
            .filter(target => target !== null)
            .sort((a, b) => b.efficiency - a.efficiency);
    }
    handleConsolidation(situation) {
        // Find the best attack that helps consolidate territory
        const attack = this.handleStrategicAttack(situation);
        if (attack && this.api.getDistance(attack.from, attack.to) < this.CONSOLIDATION_DISTANCE) {
            return attack;
        }
        // Or, move troops from a safe backline planet to a valuable frontline one
        const safePlanets = situation.myPlanets.filter(p => this.api.calculateThreat(p) < 5 && p.troops > 50);
        if (safePlanets.length === 0) return null;
        const frontLinePlanets = situation.myPlanets.filter(p => this.api.calculateThreat(p) > 5);
        if (frontLinePlanets.length === 0) return null;
        const source = safePlanets.sort((a,b) => b.troops - a.troops)[0];
        const target = frontLinePlanets.sort((a,b) => this.api.calculatePlanetValue(b) - this.api.calculatePlanetValue(a))[0];
        if (source && target && source.id !== target.id) {
            return { from: source, to: target, troops: Math.floor(source.troops * 0.5) };
        }
        return null;
    }
    handleStrategicAttack(situation) {
        if (situation.vulnerableTargets.length === 0) return null;
        const bestTarget = situation.vulnerableTargets[0];
        // The troops needed is already calculated correctly in identifyVulnerableTargets
        return {
            from: bestTarget.source,
            to: bestTarget.planet,
            troops: bestTarget.cost
        };
    }
    // Other handlers just call the main ones.
    handleEarlyExpansion(situation) { return this.handleStrategicAttack(situation); }
    handleStrategicExpansion(situation) { return this.handleStrategicAttack(situation); }
    handleOpportunisticAttack(situation) { return this.handleStrategicAttack(situation); }
    handleFinishingMove(situation) { return this.handleStrategicAttack(situation); }
    handleDesperateDefense(situation) { 
        const defense = this.handleDefense(situation);
        return defense ? defense : this.handleStrategicAttack(situation);
    }
    updateStrategicMemory(currentTime) {
        this.memory.lastDecisionTime = currentTime;
    }
}