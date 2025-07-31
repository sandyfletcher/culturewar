import BaseBot from './BaseBot.js';

export default class JordanSpuckler extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        
        this.decisionCooldown = 0;
        this.expansionPhase = true;
        this.threatAssessmentCooldown = 3;
        this.threatLevel = 0;
        this.targetPriorities = [];
        
        this.config = {
            minTroopsToLeave: 5,
            expansionThreshold: 0.6,
            threatThreshold: 0.7,
            decisionInterval: 0.8,
            maxAttackRatio: 0.7,
        };
    }
    
    makeDecision() {
        this.decisionCooldown -= 1/60;
        this.threatAssessmentCooldown -= 1/60;
        
        if (this.decisionCooldown > 0) return null;
        this.decisionCooldown = this.config.decisionInterval;
        
        if (this.threatAssessmentCooldown <= 0) {
            this.assessThreatLevel();
            this.threatAssessmentCooldown = 3;
        }
        
        this.updateStrategy();
        
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        this.updateTargetPriorities();
        
        if (this.expansionPhase && this.threatLevel < this.config.threatThreshold) {
            return this.makeExpansionMove(myPlanets);
        } else {
            return this.makeDefensiveMove(myPlanets);
        }
    }
    
    assessThreatLevel() {
        const myTotalTroops = this.api.getMyTotalTroops();
        if (myTotalTroops === 0) {
            this.threatLevel = 1;
            return;
        }
        
        let enemyTotalTroops = 0;
        this.api.getOpponentIds().forEach(id => {
            enemyTotalTroops += this.api.getPlayerTotalTroops(id);
        });

        let incomingAttackTroops = 0;
        this.api.getMyPlanets().forEach(p => {
            incomingAttackTroops += this.api.getIncomingAttacks(p).reduce((sum, m) => sum + m.amount, 0);
        });

        const troopRatioThreat = enemyTotalTroops / myTotalTroops;
        const incomingThreat = incomingAttackTroops / myTotalTroops;
        
        this.threatLevel = Math.min(1, Math.max(troopRatioThreat, incomingThreat));
    }
    
    updateStrategy() {
        const myPlanetCount = this.api.getMyPlanets().length;
        const totalPlanets = this.api.getAllPlanets().length;
        const planetRatio = myPlanetCount / totalPlanets;
        
        if (planetRatio >= this.config.expansionThreshold || this.threatLevel >= this.config.threatThreshold) {
            this.expansionPhase = false;
        } else {
            this.expansionPhase = true;
        }
    }
    
    updateTargetPriorities() {
        this.targetPriorities = [];
        const myPlanets = this.api.getMyPlanets();
        if(myPlanets.length === 0) return;
        
        const targets = this.api.getEnemyPlanets().concat(this.api.getNeutralPlanets());

        for (const planet of targets) {
            let score = this.api.calculatePlanetValue(planet) - planet.troops;
            if (planet.owner === 'neutral') score += 30;
            
            const sourcePlanet = this.api.findNearestPlanet(planet, myPlanets);
            const distance = this.api.getDistance(sourcePlanet, planet);
            score -= distance * 0.2;
            
            this.targetPriorities.push({ planet, score, sourcePlanet });
        }
        
        this.targetPriorities.sort((a, b) => b.score - a.score);
    }
    
    makeExpansionMove(myPlanets) {
        for (const target of this.targetPriorities) {
            const sourcePlanet = target.sourcePlanet;
            if (!sourcePlanet) continue;
            
            const neededTroops = this.calculateRequiredTroops(target.planet, sourcePlanet);
            const availableTroops = sourcePlanet.troops - this.config.minTroopsToLeave;
            
            if (availableTroops >= neededTroops) {
                const troopsToSend = Math.min(availableTroops, Math.ceil(neededTroops * 1.2), sourcePlanet.troops * this.config.maxAttackRatio);
                if (troopsToSend > 0) return { from: sourcePlanet, to: target.planet, troops: Math.floor(troopsToSend) };
            }
        }
        return this.reinforceFrontline(myPlanets);
    }
    
    makeDefensiveMove(myPlanets) {
        // Find planets needing reinforcement due to incoming attacks
        for (const myPlanet of myPlanets) {
            const incomingTroops = this.api.getIncomingAttacks(myPlanet).reduce((sum, m) => sum + m.amount, 0);
            if (incomingTroops > myPlanet.troops) {
                 const reinforcers = myPlanets.filter(p => p !== myPlanet && p.troops > this.config.minTroopsToLeave * 2);
                 if (reinforcers.length > 0) {
                     const source = this.api.findNearestPlanet(myPlanet, reinforcers);
                     const troopsToSend = Math.floor((source.troops - this.config.minTroopsToLeave) * 0.7);
                     if (troopsToSend > 0) return { from: source, to: myPlanet, troops: troopsToSend };
                 }
            }
        }
        return this.reinforceFrontline(myPlanets);
    }
    
    reinforceFrontline(myPlanets) {
        if (myPlanets.length < 2) return null;
        
        const enemyPlanets = this.api.getEnemyPlanets();
        if (enemyPlanets.length === 0) return null;

        const frontlinePlanets = myPlanets.sort((a,b) => this.api.getDistance(a, this.api.findNearestPlanet(a, enemyPlanets)) - this.api.getDistance(b, this.api.findNearestPlanet(b, enemyPlanets)));
        const weakestFrontline = frontlinePlanets[0];

        const backlinePlanets = myPlanets.filter(p => p !== weakestFrontline && p.troops > this.config.minTroopsToLeave * 3);
        if (backlinePlanets.length === 0) return null;

        const strongestBackline = backlinePlanets.sort((a,b) => b.troops - a.troops)[0];
        const troopsToSend = Math.floor((strongestBackline.troops - this.config.minTroopsToLeave) * 0.6);
        
        if (troopsToSend > 0) {
            return { from: strongestBackline, to: weakestFrontline, troops: troopsToSend };
        }
        return null;
    }

    calculateRequiredTroops(targetPlanet, sourcePlanet) {
        if (targetPlanet.owner === 'neutral') return targetPlanet.troops + 2;
        return this.api.estimateTroopsAtArrival(sourcePlanet, targetPlanet) + 5;
    }
}