import GameAPI from '../GameAPI.js';

/**
 * 
 * After Gemini 2.5 Pro helped me consolidate the Game API files, I gave it a shot at entering the ring
 * It codenamed itself Morgan, I don't think that's one of the siblings so may have to be changed
 * As of yet it's untested, but I like it in theory!
 * 
 * Morgan Spuckler - The Calculated Opportunist
 * 
 * Strategy:
 * Morgan's core logic revolves around calculating a "Return on Investment" (ROI) for every possible move.
 * It favors actions that provide the most strategic value (capturing high-production or centrally-located planets)
 * for the lowest cost (troop investment, distance, and risk to the source planet).
 * It will pivot instantly from attack to defense if reinforcing a key planet becomes the highest-value move.
 */
export default class MorganSpuckler {
    constructor(game, playerId) {
        this.api = new GameAPI(game, playerId);
        this.lastDecisionTime = 0;
        
        // Configuration for Morgan's personality
        this.config = {
            decisionInterval: 750,      // (ms) How often to make a decision.
            minTroopsForAction: 10,     // A planet needs at least this many troops to act.
            captureBuffer: 3,           // Send this many extra troops when attacking.
            riskAversion: 1.5,          // How much to penalize moves from a threatened planet.
            reinforcementUrgency: 2.0,  // How much to prioritize reinforcing a weak planet of our own.
        };
    }

    makeDecision() {
        const now = Date.now();
        if (now - this.lastDecisionTime < this.config.decisionInterval) {
            return null; // Not time to make a decision yet.
        }
        this.lastDecisionTime = now;

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) {
            return null; // No planets, no moves.
        }

        // Generate a list of all possible moves from all our planets.
        const possibleMoves = [];
        const allTargets = this.api.getAllPlanets().filter(p => p.owner !== this.api.playerId);

        for (const source of myPlanets) {
            if (source.troops < this.config.minTroopsForAction) {
                continue;
            }

            // Evaluate attacking/expanding to every other planet
            for (const target of allTargets) {
                const move = this.evaluateMove(source, target);
                if (move) {
                    possibleMoves.push(move);
                }
            }
            
            // Evaluate reinforcing every one of our other planets
            for (const otherOwned of myPlanets) {
                if (source === otherOwned) continue;
                const move = this.evaluateMove(source, otherOwned, true);
                if(move){
                    possibleMoves.push(move);
                }
            }
        }

        if (possibleMoves.length === 0) {
            return null; // No profitable moves found.
        }

        // Sort all possible moves by their calculated score and pick the best one.
        possibleMoves.sort((a, b) => b.score - a.score);
        const bestMove = possibleMoves[0];
        
        // Final check to ensure the move is valid before returning
        if (bestMove.from.troops > bestMove.troops && bestMove.troops > 0) {
            return bestMove;
        }

        return null;
    }

    /**
     * Evaluates a potential move from a source planet to a target planet.
     * @param {Planet} source - The planet to send troops from.
     * @param {Planet} target - The planet to send troops to.
     * @param {boolean} isReinforcement - True if this is a move to a friendly planet.
     * @returns {object|null} A move object with a score, or null if the move is invalid.
     */
    evaluateMove(source, target, isReinforcement = false) {
        let troopsToSend;
        let moveValue;

        if (isReinforcement) {
            // Logic for reinforcing a friendly planet
            const threatLevel = this.api.calculateThreat(target);
            if (threatLevel < target.troops * 0.5) return null; // Don't reinforce planets that are safe

            // Send half of the source's troops, but not more than the threat level requires.
            troopsToSend = Math.min(Math.floor(source.troops / 2), Math.ceil(threatLevel));
            moveValue = (threatLevel / (target.troops + 1)) * this.config.reinforcementUrgency;
        } else {
            // Logic for attacking an enemy or neutral planet
            const troopsAtArrival = this.api.estimateTroopsAtArrival(source, target);
            troopsToSend = Math.ceil(troopsAtArrival) + this.config.captureBuffer;

            // If we can't afford the attack, it's not a valid move.
            if (source.troops <= troopsToSend) {
                return null;
            }
            moveValue = this.api.calculatePlanetValue(target);
        }

        // Calculate the cost/risk of the move
        const distanceCost = this.api.getDistance(source, target);
        const sourceRisk = this.api.calculateThreat(source) * this.config.riskAversion;
        const troopCost = troopsToSend;
        
        const totalCost = distanceCost + sourceRisk + troopCost;
        if (totalCost === 0) return null;

        // The final score is the value gained divided by the total cost.
        const score = moveValue / totalCost;

        return {
            from: source,
            to: target,
            troops: troopsToSend,
            score: score
        };
    }
}