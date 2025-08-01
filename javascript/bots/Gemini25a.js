// ===========================================
// root/javascript/bots/Gemini25a.js
// ===========================================

import BaseBot from './BaseBot.js';

export default class Gemini25a extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        this.config = {
            minTroopsForAction: 10,
            captureBuffer: 3,
            riskAversion: 1.5,
            reinforcementUrgency: 2.0,
        };
    }
    makeDecision(dt) {
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null;
        }
        const possibleMoves = [];
        const allTargets = this.api.getAllPlanets().filter(p => p.owner !== this.api.playerId);
        for (const source of myPlanets) {
            if (source.troops < this.config.minTroopsForAction) {
                continue;
            }
            for (const target of allTargets) {
                const move = this.evaluateMove(source, target);
                if (move) {
                    possibleMoves.push(move);
                }
            }
            for (const otherOwned of myPlanets) {
                if (source === otherOwned) continue;
                const move = this.evaluateMove(source, otherOwned, true);
                if(move){
                    possibleMoves.push(move);
                }
            }
        }
        if (possibleMoves.length === 0) {
            return null;
        }
        possibleMoves.sort((a, b) => b.score - a.score);
        const bestMove = possibleMoves[0];
        if (bestMove.from.troops > bestMove.troops && bestMove.troops > 0) {
            return bestMove;
        }
        return null;
    }
    evaluateMove(source, target, isReinforcement = false) {
        let troopsToSend;
        let moveValue;
        if (isReinforcement) {
            const threatLevel = this.api.calculateThreat(target);
            if (threatLevel < target.troops * 0.5) return null;
            troopsToSend = Math.min(Math.floor(source.troops / 2), Math.ceil(threatLevel));
            moveValue = (threatLevel / (target.troops + 1)) * this.config.reinforcementUrgency;
        } else {
            const troopsAtArrival = this.api.estimateTroopsAtArrival(source, target);
            troopsToSend = Math.ceil(troopsAtArrival) + this.config.captureBuffer;
            if (source.troops <= troopsToSend) {
                return null;
            }
            moveValue = this.api.calculatePlanetValue(target);
        }
        const distanceCost = this.api.getDistance(source, target);
        const sourceRisk = this.api.calculateThreat(source) * this.config.riskAversion;
        const troopCost = troopsToSend;
        const totalCost = distanceCost + sourceRisk + troopCost;
        if (totalCost === 0) return null;
        const score = moveValue / totalCost;
        return {
            from: source,
            to: target,
            troops: troopsToSend,
            score: score
        };
    }
}