import DummyAI from './AI bots/dummyai.js';
import AdvancedAI from './AI bots/advancedai.js';
import Claude1 from './AI bots/claude1.js';
import Claude2 from './AI bots/claude2.js';
import Claude1a from './AI bots/claude1a.js';
import Claude2a from './AI bots/claude2a.js';
import DefensiveAI from './AI bots/defensiveAI.js';

export default class AIManager {
    constructor(game) {
        this.game = game;
        this.aiControllers = {};
        this.aiTypes = {
            'claude1': Claude1,
            'claude2': Claude2,
            'claude1a': Claude1a,
            'claude2a': Claude2a,
            'defensive': DefensiveAI,
            'dummy': DummyAI,
            'advanced': AdvancedAI
        };
        this.initializeAIs();
    }
    
    initializeAIs() {
        // Clear existing controllers
        this.aiControllers = {};
        
        // Create AI controllers for each AI player
        const aiPlayers = this.game.playerManager.getAIPlayers();
        
        for (const player of aiPlayers) {
            // Get the AI class based on the specified type
            const AIClass = this.aiTypes[player.aiController] || this.aiTypes['claude1']; 
            this.aiControllers[player.id] = new AIClass(this.game, player.id);
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