// ===========================================
// root/javascript/bots/Gemini25d.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Gemini25d extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        // Bot's fixed "personality" or configuration. This doesn't change.
        this.config = {
            stateCheckInterval: 2.0, // Check state every 2 seconds.
            grudgeDecayFactor: 0.998,
            defenseThreatRatio: 0.7,
            consolidationReserve: 0.25,
            attackOverwhelmFactor: 1.15,
        };
        // MODIFIED: All dynamic state now lives in the 'memory' object.
        this.memory = {
            currentState: 'EXPANDING',
            grudgeMap: new Map(),
            nextStateCheckTime: 0, // We'll use a time-based check instead of a countdown.
        };
    }
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        // MODIFIED: Use the new time-based cooldown for state checks.
        // This is more robust than decrementing with 'dt'.
        if (this.api.getElapsedTime() >= this.memory.nextStateCheckTime) {
            this.updateGrudgeMap();
            this.updateCurrentState();
            // Set the time for the next check.
            this.memory.nextStateCheckTime = this.api.getElapsedTime() + this.config.stateCheckInterval;
        }
        // Decay grudge over time.
        for (const [playerId, grudge] of this.memory.grudgeMap.entries()) {
            this.memory.grudgeMap.set(playerId, grudge * this.config.grudgeDecayFactor);
        }
        // #1 Priority: Immediate Defense of critical threats
        const defenseMove = this.executeDefensiveMove(myPlanets);
        if (defenseMove) return defenseMove;
        // 2. Execute primary strategy for the current state.
        switch (this.memory.currentState) {
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
    updateCurrentState() {
        const myPower = this.api.getMyTotalTroops();
        // MODIFIED: Only consider active opponents for a more accurate power assessment.
        const opponents = this.api.getOpponentIds().filter(id => this.api.isPlayerActive(id));
        const strongestOpponentPower = opponents.reduce((max, id) => Math.max(max, this.api.getPlayerTotalTroops(id)), 0);
        const neutralPlanetsCount = this.api.getNeutralPlanets().length;
        const previousState = this.memory.currentState;
        if (myPower < strongestOpponentPower * 0.8) {
            this.memory.currentState = 'CONSOLIDATING';
        } else if (neutralPlanetsCount > 2) {
            this.memory.currentState = 'EXPANDING';
        } else if (myPower > strongestOpponentPower * 1.1) {
            this.memory.currentState = 'ATTACKING';
        } else {
            this.memory.currentState = 'CONSOLIDATING';
        }
        if (this.memory.currentState !== previousState) {
            // Optional: log state changes for debugging.
            // console.log(`${this.playerId} switching from ${previousState} to ${this.memory.currentState}`);
        }
    }
    updateGrudgeMap() {
        for (const myPlanet of this.api.getMyPlanets()) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            for (const attack of incomingAttacks) {
                const currentGrudge = this.memory.grudgeMap.get(attack.owner) || 0;
                this.memory.grudgeMap.set(attack.owner, currentGrudge + attack.amount);
            }
        }
    }
    executeDefensiveMove(myPlanets) {
        let bestReinforcementMove = null;
        let highestUrgency = 0;
        for (const myPlanet of myPlanets) {
            const incomingAttackers = this.api.getIncomingAttacks(myPlanet).reduce((sum, m) => sum + m.amount, 0);
            if (incomingAttackers === 0) continue;
            // NEW LOGIC: Use the new API to account for our own incoming reinforcements!
            const incomingReinforcements = this.api.getIncomingReinforcements(myPlanet).reduce((sum, m) => sum + m.amount, 0);
            // Calculate the net threat. This is much smarter than the old logic.
            const netThreat = incomingAttackers - (myPlanet.troops + incomingReinforcements);
            // If the net threat is positive, we need help.
            if (netThreat > 0) {
                const urgency = netThreat / (myPlanet.troops + 1); // How badly we need help.
                if (urgency > highestUrgency) {
                    const potentialSavers = myPlanets.filter(p => p !== myPlanet && p.troops > 10);
                    if (potentialSavers.length > 0) {
                        const sourcePlanet = this.api.findNearestPlanet(myPlanet, potentialSavers);
                        // Send enough to cover the threat, plus a small buffer.
                        const troopsToSend = Math.min(Math.floor(sourcePlanet.troops * 0.8), netThreat + 5);
                        if (troopsToSend > 0) {
                            highestUrgency = urgency;
                            bestReinforcementMove = { from: sourcePlanet, to: myPlanet, troops: troopsToSend };
                        }
                    }
                }
            }
        }
        return bestReinforcementMove;
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
        })).sort((a,b) => b.threatScore - a.threatScore)[0];
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
        const targets = enemyPlanets.map(p => {
            const grudge = this.memory.grudgeMap.get(p.owner) || 1.0;
            return {
                planet: p,
                // MODIFIED: Use estimateTroopsAtArrival for a more accurate attack calculation.
                score: (this.api.calculatePlanetValue(p) * (1 + grudge / 100)) / (this.api.estimateTroopsAtArrival(myPlanets[0], p) + 10)
            };
        }).sort((a, b) => b.score - a.score);
        for (const target of targets) {
            const troopsRequired = Math.ceil(this.api.estimateTroopsAtArrival(myPlanets[0], target.planet) * this.config.attackOverwhelmFactor);
            const potentialAttackers = myPlanets.filter(p => p.troops > troopsRequired);
            if (potentialAttackers.length > 0) {
                const sourcePlanet = this.api.findNearestPlanet(target.planet, potentialAttackers);
                if (sourcePlanet) {
                    return { from: sourcePlanet, to: target.planet, troops: troopsRequired };
                }
            }
        }
        return null;
    }
}