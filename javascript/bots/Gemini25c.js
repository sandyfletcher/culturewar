// ===========================================
// root/javascript/bots/Gemini25c.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Gemini25c extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.name = 'Gemini 2.5 C';
        // --- Bot State & Personality ---
        this.currentState = 'EXPANDING'; // Initial state
        this.grudgeMap = new Map(); // Key: playerId, Value: grudge points
        this.lastStateCheck = 0; // Timer to avoid constant state checks
        // --- Configuration ---
        this.config = {
            stateCheckInterval: 2.0, // Seconds between re-evaluating the overall strategy
            grudgeDecayFactor: 0.995, // Grudge slowly fades over time
            defenseUrgency: 5,       // How strongly to prioritize defending a threatened planet
            consolidationReserve: 0.5, // Percentage of troops to keep on core planets
            attackOverwhelmFactor: 1.2, // Send 120% of the troops needed for a capture
        };
    }
    makeDecision(dt) {
        // --- Update Internal Timers & State ---
        this.lastStateCheck -= dt;
        if (this.lastStateCheck <= 0) {
            this.updateGrudgeMap();
            this.updateCurrentState();
            this.lastStateCheck = this.config.stateCheckInterval;
        }
        // Decay grudge for all opponents
        for (const [playerId, grudge] of this.grudgeMap.entries()) {
            this.grudgeMap.set(playerId, grudge * this.config.grudgeDecayFactor);
        }
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        // --- Execute Action Based on State ---
        // 1. Highest Priority: Immediate Defense
        const defenseMove = this.executeDefensiveMove(myPlanets);
        if (defenseMove) {
            return defenseMove;
        }
        // 2. Execute the primary strategy for the current state
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
    updateCurrentState() { // re-evaluates game and sets bot's overall strategy, a state machine that guides bot's decisions
        const myPower = this.api.getMyTotalTroops();
        const opponents = this.api.getOpponentIds();
        const enemyPower = opponents.reduce((sum, id) => sum + this.api.getPlayerTotalTroops(id), 0);
        const neutralPlanets = this.api.getNeutralPlanets().length;
        const totalPlanets = this.api.getAllPlanets().length;
        // --- State Transition Logic ---
        if (this.currentState === 'EXPANDING' && neutralPlanets / totalPlanets < 0.3) {
            // If most neutral planets are gone, stop expanding and start consolidating
            this.currentState = 'CONSOLIDATING';
        } else if (this.currentState === 'CONSOLIDATING' && myPower > enemyPower * 1.5) {
            // If we have a significant power advantage, switch to attack mode
            this.currentState = 'ATTACKING';
        } else if (this.currentState === 'ATTACKING' && myPower < enemyPower) {
             // If we lose our advantage while attacking, fall back to consolidating
            this.currentState = 'CONSOLIDATING';
        }
    }
    updateGrudgeMap() { // scans for incoming attacks and updates grudge score against attackers, "memory" of bot
        for (const myPlanet of this.api.getMyPlanets()) {
            const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
            for (const attack of incomingAttacks) {
                const currentGrudge = this.grudgeMap.get(attack.owner) || 0;
                // Add grudge based on the size of the attack
                this.grudgeMap.set(attack.owner, currentGrudge + attack.amount);
            }
        }
    }
    executeDefensiveMove(myPlanets) { // overrides all other logic to save a planet under imminent threat
        let mostThreatened = null;
        let highestThreat = 0;
        for (const myPlanet of myPlanets) {
            const incoming = this.api.getIncomingAttacks(myPlanet).reduce((sum, m) => sum + m.amount, 0);
            if (incoming > myPlanet.troops) {
                const threatLevel = incoming - myPlanet.troops;
                if (threatLevel > highestThreat) {
                    highestThreat = threatLevel;
                    mostThreatened = myPlanet;
                }
            }
        }
        if (mostThreatened) {
            // We need to send reinforcements!
            const neededTroops = highestThreat + this.config.defenseUrgency;
            const potentialSavers = myPlanets.filter(p => p !== mostThreatened && p.troops > neededTroops);
            if (potentialSavers.length > 0) {
                const sourcePlanet = this.api.findNearestPlanet(mostThreatened, potentialSavers);
                return { from: sourcePlanet, to: mostThreatened, troops: neededTroops };
            }
        }
        return null;
    }
    executeExpandingMove(myPlanets) { // Early game strategy: Capture valuable neutral planets quickly
        const neutralPlanets = this.api.getNeutralPlanets();
        if (neutralPlanets.length === 0) return null;
        // Find the best neutral planet to capture (high value, low cost)
        const targets = neutralPlanets.map(p => ({
            planet: p,
            score: this.api.calculatePlanetValue(p) / (p.troops + 5)
        })).sort((a, b) => b.score - a.score);
        for (const target of targets) {
            const sourcePlanet = this.api.findNearestPlanet(target.planet, myPlanets);
            if (sourcePlanet && sourcePlanet.troops > target.planet.troops + 3) {
                return { from: sourcePlanet, to: target.planet, troops: target.planet.troops + 3 };
            }
        }
        return null;
    }
    executeConsolidatingMove(myPlanets) { // Mid-game strategy: Strengthen border planets from safe core planets
        if (myPlanets.length < 2) return null;
        // Identify core (safe) and border (exposed) planets
        const borderPlanets = myPlanets.filter(p => this.api.getEnemyPlanets().some(e => this.api.getDistance(p, e) < 350));
        if (borderPlanets.length === 0) borderPlanets.push(...myPlanets); // If all are "safe", all are also "borders"
        const corePlanets = myPlanets.filter(p => !borderPlanets.includes(p) && p.troops > 20);
        if (corePlanets.length === 0) return null; // No troops to spare
        const strongestCore = corePlanets.sort((a, b) => b.troops - a.troops)[0];
        const weakestBorder = borderPlanets.sort((a, b) => a.troops - b.troops)[0];
        if (strongestCore && weakestBorder && strongestCore !== weakestBorder) {
            const troopsToSend = Math.floor(strongestCore.troops * (1 - this.config.consolidationReserve));
            if (troopsToSend > 0) {
                return { from: strongestCore, to: weakestBorder, troops: troopsToSend };
            }
        }
        return null;
    }
    executeAttackingMove(myPlanets) { // Late-game strategy: Attack enemies, prioritizing those with high grudge scores
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;
        // Score potential targets based on value, cost, and GRUDGE
        const targets = enemyPlanets.map(p => {
            const grudge = this.grudgeMap.get(p.owner) || 1.0;
            const value = this.api.calculatePlanetValue(p);
            // Higher grudge makes a target more appealing
            const score = (value * (1 + grudge / 100)) / (p.troops + 10);
            return { planet: p, score: score };
        }).sort((a, b) => b.score - a.score);
        // Find the best target we can actually capture
        for (const target of targets) {
            const troopsRequired = Math.ceil(target.planet.troops * this.config.attackOverwhelmFactor);
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