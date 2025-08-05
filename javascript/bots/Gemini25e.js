// ===========================================================
// root/javascript/bots/Gemini25e.js
// ===========================================================

import BaseBot from './BaseBot.js';

export default class Gemini25e extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.DEFENSIVE_BUFFER = 10;
        this.ATTACK_TROOP_PERCENTAGE = 0.80;
        this.CONSOLIDATION_TROOP_PERCENTAGE = 0.60;
        this.CONSOLIDATION_FULL_THRESHOLD = 0.8;
        this.CONSOLIDATION_SAFE_DISTANCE = 350;

        this.memory.phase = 'EARLY';
        this.memory.strongestOpponent = null;
        this.memory.lastOpponentCheck = 0;

        const gameDuration = this.api.getGameDuration();
        this.memory.earlyGameEndTime = gameDuration * 0.33;
        this.memory.midGameEndTime = gameDuration * 0.66;
    }

    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        this.updateGamePhase();
        this.updateStrongestOpponent();

        const defenseMove = this.handleDefense(myPlanets);
        if (defenseMove) return defenseMove;

        const offenseMove = this.handleOffense(myPlanets);
        if (offenseMove) return offenseMove;

        const consolidationMove = this.handleConsolidation(myPlanets);
        if (consolidationMove) return consolidationMove;

        return null;
    }
    // ... (other functions are fine) ...
    updateGamePhase() {
        const elapsedTime = this.api.getElapsedTime();
        if (elapsedTime < this.memory.earlyGameEndTime) this.memory.phase = 'EARLY';
        else if (elapsedTime < this.memory.midGameEndTime) this.memory.phase = 'MID';
        else this.memory.phase = 'LATE';
    }

    updateStrongestOpponent() {
        const now = this.api.getElapsedTime();
        if (now - this.memory.lastOpponentCheck < 5) {
            if (this.memory.strongestOpponent && !this.api.isPlayerActive(this.memory.strongestOpponent)) {
                this.memory.strongestOpponent = null;
            }
            return;
        }
        this.memory.lastOpponentCheck = now;

        let maxProduction = -1;
        let strongest = null;
        for (const opponentId of this.api.getOpponentIds()) {
            if (!this.api.isPlayerActive(opponentId)) continue;
            const production = this.api.getPlayerTotalProduction(opponentId);
            if (production > maxProduction) {
                maxProduction = production;
                strongest = opponentId;
            }
        }
        this.memory.strongestOpponent = strongest;
    }

    handleDefense(myPlanets) {
        let bestPlanetToSave = null;
        let highestValue = -1;
        let troopsNeededForBestSave = 0;

        for (const myPlanet of myPlanets) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            if (incomingAttacks.length === 0) continue;

            const totalAttackForce = incomingAttacks.reduce((sum, m) => sum + m.amount, 0);
            const friendlyForces = myPlanet.troops + this.api.getIncomingReinforcements(myPlanet).reduce((sum, m) => sum + m.amount, 0);

            if (friendlyForces < totalAttackForce) {
                const value = this.api.calculatePlanetValue(myPlanet);
                if (value > highestValue) {
                    highestValue = value;
                    bestPlanetToSave = myPlanet;
                    troopsNeededForBestSave = Math.ceil(totalAttackForce - friendlyForces) + 1;
                }
            }
        }

        if (bestPlanetToSave) {
            let bestReinforcer = null;
            let minDistance = Infinity;
            for (const p of myPlanets) {
                if (p === bestPlanetToSave) continue;
                if (p.troops < troopsNeededForBestSave + this.DEFENSIVE_BUFFER) continue;
                if (this.api.getIncomingAttacks(p).length > 0) continue;

                const distance = this.api.getDistance(p, bestPlanetToSave);
                if (distance < minDistance) {
                    minDistance = distance;
                    bestReinforcer = p;
                }
            }
            if (bestReinforcer) {
                return { from: bestReinforcer, to: bestPlanetToSave, troops: troopsNeededForBestSave };
            }
        }
        return null;
    }
    
    handleOffense(myPlanets) {
        let targets = [];
        const neutrals = this.api.getNeutralPlanets();
        const enemies = this.api.getEnemyPlanets();

        if (this.memory.phase === 'EARLY') targets = neutrals;
        else if (this.memory.phase === 'MID') targets = neutrals.concat(enemies);
        else {
            targets = this.memory.strongestOpponent ?
                enemies.filter(p => p.owner === this.memory.strongestOpponent) :
                enemies;
            if (targets.length === 0) targets = enemies;
            targets.push(...neutrals.filter(p => this.api.calculatePlanetValue(p) > 80));
        }

        if (targets.length === 0) return null;

        let bestAttack = { roi: -1, from: null, to: null, troops: 0 };
        const potentialAttackers = [...myPlanets].sort((a, b) => b.troops - a.troops);

        for (const source of potentialAttackers) {
            if (source.troops < this.DEFENSIVE_BUFFER * 2) continue;

            for (const target of targets) {
                const travelTime = this.api.getTravelTime(source, target);
                // *** UPDATED: Use the superior predictPlanetState function ***
                const predictedState = this.api.predictPlanetState(target, travelTime);
                
                // Skip if we predict we will already own it.
                if (predictedState.owner === this.playerId) continue;

                const troopsNeeded = Math.ceil(predictedState.troops) + 1;
                const troopsToSend = Math.floor(source.troops * this.ATTACK_TROOP_PERCENTAGE);

                if (troopsToSend > troopsNeeded) {
                    const value = this.api.calculatePlanetValue(target);
                    const cost = troopsNeeded + (travelTime * 0.5);
                    const roi = value / cost;

                    if (roi > bestAttack.roi) {
                        bestAttack = { roi, from: source, to: target, troops: troopsToSend };
                    }
                }
            }
        }

        if (bestAttack.from) {
            return { from: bestAttack.from, to: bestAttack.to, troops: bestAttack.troops };
        }
        return null;
    }

    handleConsolidation(myPlanets) {
        if (myPlanets.length <= 1) return null;

        const maxTroops = this.api.getMaxPlanetTroops();
        let bestSource = null;
        const allEnemies = this.api.getEnemyPlanets();

        const potentialSources = myPlanets.filter(p => {
            if (p.troops <= maxTroops * this.CONSOLIDATION_FULL_THRESHOLD) return false;
            const nearestEnemy = this.api.findNearestPlanet(p, allEnemies);
            return !nearestEnemy || this.api.getDistance(p, nearestEnemy) > this.CONSOLIDATION_SAFE_DISTANCE;
        });

        if (potentialSources.length > 0) {
            bestSource = potentialSources.sort((a, b) => b.troops - a.troops)[0];
        }

        if (bestSource) {
            let bestTarget = null;
            let maxScore = -1;
            for (const p of myPlanets) {
                if (p === bestSource || p.troops >= maxTroops * this.CONSOLIDATION_FULL_THRESHOLD) continue;
                const value = this.api.calculatePlanetValue(p);
                if (value > maxScore) {
                    maxScore = value;
                    bestTarget = p;
                }
            }

            if (bestTarget) {
                return {
                    from: bestSource,
                    to: bestTarget,
                    troops: Math.floor(bestSource.troops * this.CONSOLIDATION_TROOP_PERCENTAGE)
                };
            }
        }
        return null;
    }
}