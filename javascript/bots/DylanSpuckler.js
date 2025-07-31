// assets/javascript/bots/DylanSpuckler.js
import BaseBot from './BaseBot.js';

export default class DylanSpuckler extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);

        this.gameStartTime = Date.now();
        this.decisionCooldown = 1.0; // Decision timers (seconds)
        this.minDecisionTime = 0.8;
        this.maxDecisionTime = 1.5;
        this.threatAssessmentCooldown = 0.5; // Analysis cooldowns
        this.strategyUpdateCooldown = 3.0;
        this.currentStrategy = 'balanced'; // Strategy state
        this.threats = [];
        this.gamePhase = 'early'; // early, mid, late
        this.recentTargets = new Map(); // Memory of recent actions to prevent thrashing
        this.recentSources = new Map();
        this.config = {
            reserveTroopPercentage: 0.3,
            minTroopsForAttack: 15,
            expansionWeight: 1.2,
            defenseWeight: 1.0,
            attackWeight: 0.9,
            earlyGameExpansionBonus: 1.5,
            midGameAttackBonus: 1.3,
            lateGameAttackBonus: 1.8,
            targetMemoryTime: 5
        };
    }
    makeDecision() {
        const dt = 1/60; // Approximate time delta assuming 60fps
        this.decisionCooldown -= dt;
        this.threatAssessmentCooldown -= dt;
        this.strategyUpdateCooldown -= dt;
        this.cleanupRecentMemory();
        this.updateGamePhase();
        if (this.threatAssessmentCooldown <= 0) {
            this.assessThreats();
            this.threatAssessmentCooldown = 0.5;
        }
        if (this.strategyUpdateCooldown <= 0) {
            this.updateStrategy();
            this.strategyUpdateCooldown = 3.0;
        }
        if (this.decisionCooldown > 0) return null;
        this.decisionCooldown = this.minDecisionTime + Math.random() * (this.maxDecisionTime - this.minDecisionTime);
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        let decision = this.makeDefensiveDecision(myPlanets);
        if (decision) {
             if (decision.troops > 0) this.recordAction(decision.from, decision.to);
             return decision;
        }
        switch (this.currentStrategy) {
            case 'expansion':
                decision = this.makeExpansionDecision(myPlanets);
                break;
            case 'attack':
                decision = this.makeAttackDecision(myPlanets);
                if (!decision) decision = this.makeExpansionDecision(myPlanets);
                break;
            case 'defense': // Defensive decision is already prioritized above the switch
                decision = this.makeExpansionDecision(myPlanets); // Fallback to expansion
                break;
            case 'balanced':
            default:
                decision = this.makeBalancedDecision(myPlanets);
                break;
        }
        if (!decision) decision = this.makeOpportunisticDecision(myPlanets);
        if (decision && decision.troops > 0) this.recordAction(decision.from, decision.to);
        return decision;
    }
    cleanupRecentMemory() {
        const now = Date.now();
        const expirationTime = this.config.targetMemoryTime * 1000;
        for (const [id, timestamp] of this.recentTargets.entries()) {
            if (now - timestamp > expirationTime) this.recentTargets.delete(id);
        }
        for (const [id, timestamp] of this.recentSources.entries()) {
            if (now - timestamp > expirationTime) this.recentSources.delete(id);
        }
    }
    recordAction(source, target) {
        const now = Date.now();
        this.recentSources.set(`${source.x},${source.y}`, now);
        this.recentTargets.set(`${target.x},${target.y}`, now);
    }
    wasRecentlyUsed(planet, asSource = true) {
        const id = `${planet.x},${planet.y}`;
        return asSource ? this.recentSources.has(id) : this.recentTargets.has(id);
    }
    updateGamePhase() {
        const gameTime = (Date.now() - this.gameStartTime) / 1000;
        const totalPlanets = this.api.getAllPlanets().length;
        const occupiedPlanets = totalPlanets - this.api.getNeutralPlanets().length;
        const occupationPercentage = occupiedPlanets / totalPlanets;
        if (gameTime < 60 && occupationPercentage < 0.5) this.gamePhase = 'early';
        else if (gameTime < 180 || occupationPercentage < 0.8) this.gamePhase = 'mid';
        else this.gamePhase = 'late';
    }
    updateStrategy() {
        const myTroops = this.api.getMyTotalTroops();
        const opponentIds = this.api.getOpponentIds();
        let strongestEnemyTroops = 0;
        opponentIds.forEach(id => {
            const enemyTroops = this.api.getPlayerTotalTroops(id);
            if (enemyTroops > strongestEnemyTroops) strongestEnemyTroops = enemyTroops;
        });
        let expansionValue = this.config.expansionWeight;
        let attackValue = this.config.attackWeight;
        let defenseValue = this.config.defenseWeight;
        if (this.gamePhase === 'early') expansionValue *= this.config.earlyGameExpansionBonus;
        else if (this.gamePhase === 'mid') attackValue *= this.config.midGameAttackBonus;
        else if (this.gamePhase === 'late') {
            attackValue *= this.config.lateGameAttackBonus;
            if (myTroops > strongestEnemyTroops * 1.5) attackValue *= 1.5;
        }
        if (this.threats.length > 0) defenseValue *= 1.5;
        if (this.api.getNeutralPlanets().length > 3) expansionValue *= 1.2;
        const strategies = [
            { name: 'expansion', value: expansionValue },
            { name: 'attack', value: attackValue },
            { name: 'defense', value: defenseValue },
            { name: 'balanced', value: (expansionValue + attackValue + defenseValue) / 3 }
        ];
        this.currentStrategy = strategies.sort((a, b) => b.value - a.value)[0].name;
    }
    assessThreats() {
        this.threats = [];
        const myPlanets = this.api.getMyPlanets();
        for (const myPlanet of myPlanets) {
            const incoming = this.api.getIncomingAttacks(myPlanet);
            if(incoming.length > 0) {
                 const totalThreat = incoming.reduce((sum, m) => sum + m.amount, 0);
                 if (totalThreat > myPlanet.troops) {
                     this.threats.push({ targetPlanet: myPlanet, troopCount: totalThreat, priority: 1.0 });
                 }
            }
        }
        this.threats.sort((a, b) => b.priority - a.priority);
    }
    makeBalancedDecision(myPlanets) {
        const possibleMoves = [];
        for (const source of myPlanets) {
            if (source.troops < this.config.minTroopsForAttack || this.wasRecentlyUsed(source, true)) continue;
            this.api.getNeutralPlanets().forEach(target => { // Expansion targets
                if (this.wasRecentlyUsed(target, false)) return;
                const troopsNeeded = Math.ceil(target.troops * 1.2);
                if (source.troops > troopsNeeded + this.getReserveTroops(source)) {
                    const score = this.calculateMoveScore(source, target, 'expansion');
                    possibleMoves.push({ from: source, to: target, troops: troopsNeeded, score });
                }
            });
            this.api.getEnemyPlanets().forEach(target => { // Attack targets
                if (this.wasRecentlyUsed(target, false)) return;
                const troopsNeeded = Math.ceil(this.api.estimateTroopsAtArrival(source, target) * 1.2);
                if (source.troops > troopsNeeded + this.getReserveTroops(source)) {
                    const score = this.calculateMoveScore(source, target, 'attack');
                    possibleMoves.push({ from: source, to: target, troops: troopsNeeded, score });
                }
            });
            myPlanets.forEach(target => { // Reinforcement targets
                if (source === target || target.troops > source.troops * 0.7 || this.wasRecentlyUsed(target, false)) return;
                const troopsToSend = Math.floor((source.troops - this.getReserveTroops(source)) * 0.6);
                if (troopsToSend > 10) {
                    const score = this.calculateMoveScore(source, target, 'reinforce');
                    possibleMoves.push({ from: source, to: target, troops: troopsToSend, score });
                }
            });
        }
        if (possibleMoves.length > 0) {
            possibleMoves.sort((a, b) => b.score - a.score);
            return possibleMoves[0];
        }
        return null;
    }
    calculateMoveScore(source, target, moveType) {
        let score = 0;
        const distance = this.api.getDistance(source, target);
        const distanceFactor = 100 / (distance + 50);
        score = this.api.calculatePlanetValue(target) * distanceFactor;
        switch (moveType) {
            case 'expansion':
                score *= this.config.expansionWeight;
                if (this.gamePhase === 'early') score *= this.config.earlyGameExpansionBonus;
                break;
            case 'attack':
                score *= this.config.attackWeight;
                if (this.gamePhase === 'mid') score *= this.config.midGameAttackBonus;
                if (this.gamePhase === 'late') score *= this.config.lateGameAttackBonus;
                break;
            case 'reinforce':
                score *= this.config.defenseWeight * (1 + this.api.calculateThreat(target) / (target.troops + 1));
                break;
        }
        if (this.api.calculateThreat(source) > source.troops * 0.5) score *= 0.7;
        return score;
    }
    makeDefensiveDecision(myPlanets) {
        if (this.threats.length === 0) return null;
        
        const threat = this.threats[0];
        const targetPlanet = threat.targetPlanet;
        
        const possibleReinforcements = myPlanets.filter(p => p !== targetPlanet && p.troops > 15 && !this.wasRecentlyUsed(p, true));
        if (possibleReinforcements.length === 0) return null;
        
        possibleReinforcements.sort((a, b) => this.api.getDistance(a, targetPlanet) - this.api.getDistance(b, targetPlanet));
        
        const reinforcer = possibleReinforcements[0];
        const troopsToSend = Math.min(Math.ceil(threat.troopCount * 1.2), reinforcer.troops - this.getReserveTroops(reinforcer));
        
        if (troopsToSend > 10) {
            return { from: reinforcer, to: targetPlanet, troops: troopsToSend };
        }
        return null;
    }
    makeExpansionDecision(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return null;
        const neutralTargets = [];
        for (const neutral of neutralPlanets) {
            if (this.wasRecentlyUsed(neutral, false)) continue;
            const viableSources = myPlanets.filter(p => p.troops > neutral.troops * 1.2 + this.getReserveTroops(p) && !this.wasRecentlyUsed(p, true));
            if (viableSources.length > 0) {
                const source = this.api.findNearestPlanet(neutral, viableSources);
                const distance = this.api.getDistance(source, neutral);
                const score = this.api.calculatePlanetValue(neutral) / (distance + 1);
                neutralTargets.push({ planet: neutral, source, score, troopsNeeded: Math.ceil(neutral.troops * 1.2) });
            }
        }
        if (neutralTargets.length === 0) return null;
        neutralTargets.sort((a, b) => b.score - a.score);
        const bestTarget = neutralTargets[0];
        return { from: bestTarget.source, to: bestTarget.planet, troops: bestTarget.troopsNeeded };
    }
    makeAttackDecision(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;
        const attackTargets = [];
        for (const enemy of enemyPlanets) {
            if (this.wasRecentlyUsed(enemy, false)) continue;
            const viableSources = myPlanets.filter(p => p.troops > this.api.estimateTroopsAtArrival(p, enemy) * 1.5 + this.getReserveTroops(p) && !this.wasRecentlyUsed(p, true));
            if (viableSources.length > 0) {
                const source = viableSources.sort((a,b) => b.troops - a.troops)[0];
                const distance = this.api.getDistance(source, enemy);
                const score = (this.api.calculatePlanetValue(enemy) * (source.troops / (enemy.troops + 1))) / (distance + 1);
                attackTargets.push({ planet: enemy, source, score, troopsNeeded: Math.ceil(this.api.estimateTroopsAtArrival(source, enemy) * 1.5) });
            }
        }
        if (attackTargets.length === 0) return null;
        attackTargets.sort((a, b) => b.score - a.score);
        const bestTarget = attackTargets[0];
        return { from: bestTarget.source, to: bestTarget.planet, troops: bestTarget.troopsNeeded };
    }
    makeOpportunisticDecision(myPlanets) {
        const planetsWithExcess = myPlanets.filter(p => p.troops > 30 && !this.wasRecentlyUsed(p, true));
        if (planetsWithExcess.length === 0) return null;
        const sourcePlanet = planetsWithExcess.sort((a,b) => b.troops - a.troops)[0];
        const allTargets = this.api.getEnemyPlanets().concat(this.api.getNeutralPlanets()).filter(p => !this.wasRecentlyUsed(p, false));
        if (allTargets.length === 0) return null;
        const scoredTargets = allTargets.map(target => {
            const troopsNeeded = Math.ceil(target.troops * (target.owner === 'neutral' ? 1.2 : 1.5));
            if (sourcePlanet.troops <= troopsNeeded + this.getReserveTroops(sourcePlanet)) {
                return { target, score: -1, troopsNeeded };
            }
            const distance = this.api.getDistance(sourcePlanet, target);
            const score = this.api.calculatePlanetValue(target) / (distance + 1);
            return { target, score, troopsNeeded };
        }).filter(t => t.score > 0);
        if (scoredTargets.length === 0) return null;
        scoredTargets.sort((a, b) => b.score - a.score);
        const bestOption = scoredTargets[0];
        return { from: sourcePlanet, to: bestOption.target, troops: bestOption.troopsNeeded };
    }
    getReserveTroops(planet) {
        const baseReserve = this.config.reserveTroopPercentage * planet.troops;
        const sizeBonus = planet.size * 0.5;
        const centralityBonus = this.api.calculateCentrality(planet) * 5;
        return Math.ceil(baseReserve + sizeBonus + centralityBonus);
    }
}