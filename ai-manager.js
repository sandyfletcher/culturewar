import DummyAI from './dummyai.js';
import AdvancedAI from './advancedai.js';
import Claude1 from './claude1.js';
import Claude2 from './claude2.js';

export default class AIManager {
    constructor(game) {
        this.game = game;
        this.aiControllers = {};
        this.initializeAIs();
    }
    
    initializeAIs() {
        // Clear existing controllers
        this.aiControllers = {};
        
        // Create AI controllers for each AI player
        const aiPlayers = this.game.playerManager.getAIPlayers();
        
        for (const player of aiPlayers) {
            if (player.aiController === 'advanced') {
                this.aiControllers[player.id] = new Claude2(this.game, player.id);
            } else {
                this.aiControllers[player.id] = new Claude1(this.game, player.id);
            }
        }
    }
    
    updateAIs(dt) {
        // Let each AI make decisions
        for (const playerId in this.aiControllers) {
            // Skip if player is eliminated
            if (!this.game.playerManager.hasPlayerPlanets(playerId) && 
                !this.game.playerManager.hasPlayerTroopsInMovement(playerId)) {
                continue;
            }
            
            const aiController = this.aiControllers[playerId];
            const aiDecision = aiController.makeDecision({
                planets: this.game.planets,
                troopMovements: this.game.troopMovements
            });

            if (aiDecision) {
                aiDecision.from.troops -= aiDecision.troops;
                this.game.troopMovements.push(new this.game.TroopMovement(
                    aiDecision.from,
                    aiDecision.to,
                    aiDecision.troops,
                    playerId,
                    this.game
                ));
            }
        }
    }
}