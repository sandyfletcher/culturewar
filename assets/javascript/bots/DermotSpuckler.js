import GameAPI from '../GameAPI.js';

export default class DermotSpuckler {
    constructor(game, playerId) {
        this.api = new GameAPI(game, playerId);
        this.playerId = playerId;
        this.decisionCooldown = 0;
        this.targetPlanetIds = new Set();
        this.threatAssessmentCooldown = 0;
        this.threatMap = {};
        this.lastGameState = { myPlanets: 0, enemyPlanets: 0, neutralPlanets: 0, myTroops: 0 };
        this.strategy = "balanced";
        this.randomFactor = 0.1;
    }

    makeDecision() {
        this.decisionCooldown -= 0.05;
        if (this.decisionCooldown > 0) return null;
        this.decisionCooldown = 0.5 + Math.random() * 0.5;
        
        this.cleanupTargetList(this.api.getAllPlanets());
        
        this.threatAssessmentCooldown -= 0.05;
        if (this.threatAssessmentCooldown <= 0) {
            this.updateThreatMap();
            this.threatAssessmentCooldown = 3;
            this.updateStrategy();
        }
        
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        
        switch (this.strategy) {
            case "aggressive": return this.aggressiveStrategy(myPlanets);
            case "defensive": return this.defensiveStrategy(myPlanets);
            default: return this.balancedStrategy(myPlanets);
        }
    }
    
    updateStrategy() {
        const myPlanets = this.api.getMyPlanets();
        const enemyPlanets = this.api.getEnemyPlanets();
        const totalPlanets = this.api.getAllPlanets().length;
        const myTroopCount = this.api.getMyTotalTroops();
        
        const currentState = {
            myPlanets: myPlanets.length,
            enemyPlanets: enemyPlanets.length,
            myTroops: myTroopCount
        };
        
        const myPlanetPercentage = myPlanets.length / totalPlanets;
        
        if (myPlanetPercentage > 0.6) {
            this.strategy = "aggressive";
        } else if (currentState.myPlanets < this.lastGameState.myPlanets || this.isUnderHeavyAttack()) {
            this.strategy = "defensive";
        } else {
            this.strategy = "balanced";
        }
        
        this.lastGameState = currentState;
    }
    
    isUnderHeavyAttack() {
        let totalIncomingTroops = 0;
        for(const planet of this.api.getMyPlanets()){
            totalIncomingTroops += this.api.getIncomingAttacks(planet).reduce((sum, m) => sum + m.amount, 0);
        }
        return totalIncomingTroops > this.api.getMyTotalTroops() * 0.3;
    }
    
    aggressiveStrategy(myPlanets) {
        const targetPlanet = this.findBestTargetPlanet(myPlanets, true);
        if (!targetPlanet) return null;
        
        const sourcePlanet = this.findBestSourcePlanet(myPlanets, targetPlanet, 0.7);
        if (!sourcePlanet) return null;
        
        const troopsToSend = this.calculateTroopsToSend(sourcePlanet, targetPlanet, 0.7);
        if (troopsToSend > 0) {
            return { from: sourcePlanet, to: targetPlanet, troops: Math.floor(troopsToSend) };
        }
        return null;
    }
    
    defensiveStrategy(myPlanets) {
        const planetNeedingReinforcement = this.findPlanetNeedingReinforcement(myPlanets);
        if (planetNeedingReinforcement) {
            const sourcePlanet = this.findBestSourcePlanet(myPlanets.filter(p => p !== planetNeedingReinforcement), planetNeedingReinforcement, 0.4);
            if (sourcePlanet) {
                const troopsToSend = this.calculateTroopsToSend(sourcePlanet, planetNeedingReinforcement, 0.5);
                return { from: sourcePlanet, to: planetNeedingReinforcement, troops: Math.floor(troopsToSend) };
            }
        }
        
        const targetPlanet = this.findBestTargetPlanet(myPlanets, false);
        if (!targetPlanet) return null;
        
        const sourcePlanet = this.findBestSourcePlanet(myPlanets, targetPlanet, 0.5);
        if (!sourcePlanet) return null;
        
        const troopsToSend = this.calculateTroopsToSend(sourcePlanet, targetPlanet, 0.5);
        if (troopsToSend > 0) {
            return { from: sourcePlanet, to: targetPlanet, troops: Math.floor(troopsToSend) };
        }
        return null;
    }
    
    balancedStrategy(myPlanets) {
        if (Math.random() < 0.3) {
            const reinforcementMove = this.defensiveStrategy(myPlanets);
            if(reinforcementMove) return reinforcementMove;
        }
        
        const targetPlanet = this.findBestTargetPlanet(myPlanets, false);
        if (!targetPlanet) return null;
        
        const sourcePlanet = this.findBestSourcePlanet(myPlanets, targetPlanet, 0.6);
        if (!sourcePlanet) return null;
        
        const troopsToSend = this.calculateTroopsToSend(sourcePlanet, targetPlanet, 0.6);
        if(troopsToSend > 0) {
            return { from: sourcePlanet, to: targetPlanet, troops: Math.floor(troopsToSend) };
        }
        return null;
    }
    
    findPlanetNeedingReinforcement(myPlanets) {
        for (const planet of myPlanets) {
            const totalIncomingTroops = this.api.getIncomingAttacks(planet).reduce((sum, attack) => sum + attack.amount, 0);
            if (totalIncomingTroops > planet.troops) return planet;
        }

        const frontierPlanets = myPlanets.filter(p => (this.threatMap[this.getPlanetId(p)] || 0) > 0.6);
        if (frontierPlanets.length > 0) {
            return frontierPlanets.sort((a, b) => (a.troops / this.threatMap[this.getPlanetId(a)]) - (b.troops / this.threatMap[this.getPlanetId(b)]))[0];
        }
        
        return null;
    }
    
    findBestTargetPlanet(myPlanets, preferAggressive) {
        const nonOwnedPlanets = this.api.getEnemyPlanets().concat(this.api.getNeutralPlanets());
        if (nonOwnedPlanets.length === 0) return null;
        
        const scoredTargets = nonOwnedPlanets.map(planet => {
            if (this.targetPlanetIds.has(this.getPlanetId(planet))) {
                return { planet, score: -Infinity };
            }
            
            let score = this.api.calculatePlanetValue(planet);
            const closestDistance = Math.min(...myPlanets.map(myPlanet => this.api.getDistance(myPlanet, planet)));
            score -= closestDistance * 0.5;
            
            if (planet.owner === 'neutral') score += 20;
            else {
                score -= planet.troops * 0.5;
                if (preferAggressive) score += 30;
                else score -= 20;
            }
            
            return { planet, score };
        });
        
        scoredTargets.sort((a, b) => b.score - a.score);
        return scoredTargets.length > 0 && scoredTargets[0].score > 0 ? scoredTargets[0].planet : null;
    }
    
    findBestSourcePlanet(myPlanets, targetPlanet, maxTroopPercentage) {
        const scoredSources = myPlanets.map(planet => {
            if (planet.troops < 10) return { planet, score: -Infinity };
            
            let score = 0;
            const distance = this.api.getDistance(planet, targetPlanet);
            score -= distance * 0.5;
            
            const availableTroops = planet.troops * maxTroopPercentage;
            score += availableTroops * 0.3;
            
            const threatLevel = this.threatMap[this.getPlanetId(planet)] || 0;
            score -= threatLevel * 100;
            
            const totalIncomingAttackTroops = this.api.getIncomingAttacks(planet).reduce((sum, attack) => sum + attack.amount, 0);
            if (totalIncomingAttackTroops > 0) score -= totalIncomingAttackTroops * 2;
            
            return { planet, score };
        });
        
        scoredSources.sort((a, b) => b.score - a.score);
        return scoredSources.length > 0 && scoredSources[0].score > 0 ? scoredSources[0].planet : null;
    }
    
    calculateTroopsToSend(sourcePlanet, targetPlanet, maxPercentage) {
        let troopsNeeded = 0;
        
        if (targetPlanet.owner === 'neutral') {
            troopsNeeded = targetPlanet.troops + 5;
        } else if (targetPlanet.owner !== this.playerId) {
            const troopsAtArrival = this.api.estimateTroopsAtArrival(sourcePlanet, targetPlanet);
            troopsNeeded = Math.ceil(troopsAtArrival * 1.1) + 5;
        } else { // Reinforcing
            const threatLevel = this.threatMap[this.getPlanetId(targetPlanet)] || 0;
            troopsNeeded = Math.ceil(threatLevel * 50);
        }
        
        const maxTroops = Math.floor(sourcePlanet.troops * maxPercentage);
        return Math.max(10, Math.min(maxTroops, troopsNeeded));
    }
    
    updateThreatMap() {
        this.threatMap = {};
        const allPlanets = this.api.getAllPlanets();

        for (const planet of allPlanets) {
            const planetId = this.getPlanetId(planet);
            if (planet.owner === this.playerId) {
                this.threatMap[planetId] = this.api.calculateThreat(planet) / (planet.troops + 1); // Normalize threat
            } else {
                this.threatMap[planetId] = this.api.calculatePlanetValue(planet); // For others, it's value
            }
        }
    }
    
    getPlanetId(planet) { return `${planet.x},${planet.y}`; }
    
    cleanupTargetList(planets) {
        const existingPlanetIds = new Set(planets.map(p => this.getPlanetId(p)));
        for (const targetId of this.targetPlanetIds) {
            if (!existingPlanetIds.has(targetId)) this.targetPlanetIds.delete(targetId);
        }
    }
}