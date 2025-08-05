// ===========================================
// root/javascript/bots/Gemini25c.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Gemini25c extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.currentState = 'EXPANDING';
        this.grudgeMap = new Map();
        this.lastStateCheck = 0;
        this.config = {
            stateCheckInterval: 1.5,
            grudgeDecayFactor: 0.998,
            defenseThreatRatio: 0.7,
            consolidationReserve: 0.25,
            attackOverwhelmFactor: 1.15,
        };
    }
    makeDecision(dt) {
        this.lastStateCheck -= dt;
        if (this.lastStateCheck <= 0) {
            this.updateGrudgeMap();
            this.updateCurrentState();
            this.lastStateCheck = this.config.stateCheckInterval;
        }
        for (const [playerId, grudge] of this.grudgeMap.entries()) {
            this.grudgeMap.set(playerId, grudge * this.config.grudgeDecayFactor);
        }
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        const defenseMove = this.executeDefensiveMove(myPlanets);
        if (defenseMove) return defenseMove;
        
        switch (this.currentState) {
            case 'EXPANDING':
                return this.executeExpandingMove(myPlanets);
            case 'CONSOLIDATING':
                return this.executeConsolidatingMove(myPlanets);
            case 'ATTACKING':
                return this.executeAttackingMove(myPlanets);
            default:
                return null;
        }
    }
    // ... (other functions remain the same) ...
    updateCurrentState() {
        const myPower = this.api.getMyTotalTroops();
        const opponents = this.api.getOpponentIds();
        const strongestOpponent = opponents.reduce((max, id) => Math.max(max, this.api.getPlayerTotalTroops(id)), 0);
        const neutralPlanetsCount = this.api.getNeutralPlanets().length;
        const previousState = this.currentState;
        
        if (myPower < strongestOpponent * 0.8) {
            this.currentState = 'CONSOLIDATING';
        } else if (neutralPlanetsCount > 2) {
             this.currentState = 'EXPANDING';
        } else if (myPower > strongestOpponent * 1.1) {
            this.currentState = 'ATTACKING';
        } else {
            this.currentState = 'CONSOLIDATING';
        }
    }

    updateGrudgeMap() {
        for (const myPlanet of this.api.getMyPlanets()) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            for (const attack of incomingAttacks) {
                const currentGrudge = this.grudgeMap.get(attack.owner) || 0;
                this.grudgeMap.set(attack.owner, currentGrudge + attack.amount);
            }
        }
    }
    
    executeDefensiveMove(myPlanets) {
        let mostThreatened = null;
        let highestThreatRatio = 0;
        for (const myPlanet of myPlanets) {
            const incoming = this.api.getIncomingAttacks(myPlanet).reduce((sum, m) => sum + m.amount, 0);
            if (incoming > 0) {
                const threatRatio = incoming / (myPlanet.troops + 1);
                if (threatRatio > highestThreatRatio && incoming > myPlanet.troops * this.config.defenseThreatRatio) {
                    highestThreatRatio = threatRatio;
                    mostThreatened = myPlanet;
                }
            }
        }
        if (mostThreatened) {
            const troopsToSave = mostThreatened.troops;
            const incomingAttackers = highestThreatRatio * troopsToSave;
            const reinforcementNeeded = Math.ceil(incomingAttackers - troopsToSave) + 5;
            const potentialSavers = myPlanets.filter(p => p !== mostThreatened && p.troops > 10);
            if (potentialSavers.length > 0) {
                const sourcePlanet = this.api.findNearestPlanet(mostThreatened, potentialSavers);
                const troopsToSend = Math.min(Math.floor(sourcePlanet.troops * 0.8), reinforcementNeeded);
                if (troopsToSend > 0) {
                    return { from: sourcePlanet, to: mostThreatened, troops: troopsToSend };
                }
            }
        }
        return null;
    }

    executeExpandingMove(myPlanets) {
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return this.executeConsolidatingMove(myPlanets);

        const targets = neutralPlanets.map(p => ({
            planet: p,
            score: this.api.calculatePlanetValue(p) / (p.troops + 5)
        })).sort((a, b) => b.score - a.score);
        for (const target of targets) {
            const troopsRequired = target.planet.troops + 3;
            const sourcePlanet = this.api.findNearestPlanet(target.planet, myPlanets.filter(p => p.troops > troopsRequired));
            if (sourcePlanet) {
                return { from: sourcePlanet, to: target.planet, troops: troopsRequired };
            }
        }
        return null;
    }

    executeConsolidatingMove(myPlanets) {
        if (myPlanets.length < 2) return null;
        const borderPlanets = myPlanets.filter(p => this.api.getEnemyPlanets().some(e => this.api.getDistance(p, e) < 400));
        if (borderPlanets.length === 0) return null;
        const mostVulnerableBorder = borderPlanets.map(p => ({
            planet: p,
            threatScore: this.api.calculateThreat(p) / (p.troops + 1)
        }))
        .sort((a,b) => b.threatScore - a.threatScore)[0];
        if (!mostVulnerableBorder) return null;
        const corePlanets = myPlanets.filter(p => !borderPlanets.includes(p) && p.troops > 20);
        if (corePlanets.length === 0) return null;
        const strongestCore = corePlanets.sort((a, b) => b.troops - a.troops)[0];
        if (strongestCore && strongestCore !== mostVulnerableBorder.planet) {
            const troopsToSend = Math.floor(strongestCore.troops * (1 - this.config.consolidationReserve));
            if (troopsToSend > 0) {
                return { from: strongestCore, to: mostVulnerableBorder.planet, troops: troopsToSend };
            }
        }
        return null;
    }
    
    executeAttackingMove(myPlanets) {
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;

        // Iterate through all possible source and target combinations to find the best attack
        let bestMove = null;
        let bestScore = -Infinity;

        const potentialAttackers = myPlanets.filter(p => p.troops > 20);

        for (const source of potentialAttackers) {
            for (const target of enemyPlanets) {
                const travelTime = this.api.getTravelTime(source, target);
                // *** UPDATED: Use the superior predictPlanetState function ***
                const predictedState = this.api.predictPlanetState(target, travelTime);

                // Don't attack if we predict we will own it
                if (predictedState.owner === this.playerId) continue;

                const troopsRequired = Math.ceil(predictedState.troops * this.config.attackOverwhelmFactor);
                
                if (source.troops > troopsRequired) {
                    const grudge = this.grudgeMap.get(target.owner) || 1.0;
                    const value = this.api.calculatePlanetValue(target);
                    // A simple score: value of planet (with grudge) minus the cost of sending troops
                    const score = (value * (1 + grudge / 100)) - troopsRequired;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMove = { from: source, to: target, troops: troopsRequired };
                    }
                }
            }
        }
        return bestMove;
    }
}