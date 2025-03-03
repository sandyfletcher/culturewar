import Claude1 from './AI bots/Claude11.js';
import Claude2 from './AI bots/Claude22.js';
import Claude3 from './AI bots/Claude33.js';
import Claude4 from './AI bots/Claude44.js';
import Claude5 from './AI bots/Claude5.js';
import Claude6 from './AI bots/Claude6.js';
import Dummy from './AI bots/Dummy.js';
import Defensive from './AI bots/Defensive.js';
import AGGRESSIVE from './AI bots/AGGRESSIVE.js';

import Gemini1 from './AI bots/Gemini1.js';
import Gemini2 from './AI bots/Gemini2.js';
import GeminiExample from './AI bots/GeminiExample.js';




export default class PlayersController {
    constructor(game, playerCount = 2, aiTypes = [], botBattleMode = false) {
        this.game = game;
        this.players = [];
        this.playerCount = playerCount;
        this.aiTypes = aiTypes;
        this.botBattleMode = botBattleMode;
        this.aiControllers = {};
        
        // Player colors
        this.playerColors = {
            'player1': '#ffff00', // Yellow
            'player2': '#ff0000', // Red
            'player3': '#00ffff', // Cyan
            'player4': '#00ff00', // Green
            'player5': '#ff00ff', // Magenta/Purple
            'player6': '#ff8000', // Orange
            'neutral': '#ffffff'  // White
        };
        
        // Available AI types
        this.availableAITypes = {
            'claude1': Claude1,
            'claude2': Claude2,
            'claude3': Claude3,
            'claude4': Claude4,
            'Claude5': Claude5,
            'Claude6': Claude6,
            'defensive': Defensive,
            'AGGRESSIVE': AGGRESSIVE,
            'dummy': Dummy,
            'Gemini1': Gemini1,
            'Gemini2': Gemini2,
            'GeminiExample': GeminiExample,
        };
        
        // Initialize players and AI controllers
        this.initializePlayers();
        this.initializeAIControllers();
    }
    
    initializePlayers() {
        // Clear existing players
        this.players = [];
        
        if (this.botBattleMode) {
            // Create all AI players for bot battle mode
            for (let i = 0; i < this.playerCount; i++) {
                const playerId = `player${i + 1}`;
                const aiType = this.aiTypes[i] || 'claude1'; // Default to claude1 if not specified
                
                this.players.push({
                    id: playerId,
                    color: this.playerColors[playerId],
                    isAI: true,
                    aiController: aiType
                });
            }
        } else {
            // Create human player
            this.players.push({
                id: 'player1',
                color: this.playerColors['player1'],
                isAI: false,
                aiController: null
            });
            
            // Create AI players with selected AI types
            for (let i = 0; i < this.playerCount - 1; i++) {
                const playerId = `player${i + 2}`;
                const aiType = this.aiTypes[i] || 'claude1'; // Default to claude1 if not specified
                
                this.players.push({
                    id: playerId,
                    color: this.playerColors[playerId],
                    isAI: true,
                    aiController: aiType
                });
            }
        }
    }
    
    initializeAIControllers() {
        // Clear existing controllers
        this.aiControllers = {};
        
        // Create AI controllers for each AI player
        const aiPlayers = this.getAIPlayers();
        
        for (const player of aiPlayers) {
            // Get the AI class based on the specified type
            const AIClass = this.availableAITypes[player.aiController] || this.availableAITypes['claude1'];
            this.aiControllers[player.id] = new AIClass(this.game, player.id);
        }
    }
    
    updateAIPlayers(dt) {
        // Let each AI make decisions
        for (const playerId in this.aiControllers) {
            // Skip if player is eliminated
            if (!this.hasPlayerPlanets(playerId) && 
                !this.hasPlayerTroopsInMovement(playerId)) {
                continue;
            }
            
            const aiController = this.aiControllers[playerId];
            const aiDecision = aiController.makeDecision({
                planets: this.game.planets,
                troopMovements: this.game.troopMovements
            });

            if (aiDecision) {
                // Execute the AI's decision by sending troops
                this.game.sendTroops(
                    aiDecision.from,
                    aiDecision.to,
                    aiDecision.troops
                );
            }
        }
    }
    
    // Player information methods
    getPlayerById(playerId) {
        return this.players.find(player => player.id === playerId);
    }
    
    getPlayerColor(playerId) {
        return this.playerColors[playerId] || this.playerColors['neutral'];
    }
    
    getHumanPlayers() {
        return this.players.filter(player => !player.isAI);
    }
    
    getAIPlayers() {
        return this.players.filter(player => player.isAI);
    }
    
    isPlayerHuman(playerId) {
        const player = this.getPlayerById(playerId);
        return player && !player.isAI;
    }
    
    getNextPlayer(currentPlayerId) {
        const currentIndex = this.players.findIndex(player => player.id === currentPlayerId);
        if (currentIndex === -1) return this.players[0].id;
        
        const nextIndex = (currentIndex + 1) % this.players.length;
        return this.players[nextIndex].id;
    }
    
    // For win conditions
    hasPlayerPlanets(playerId) {
        return this.game.planets.some(planet => planet.owner === playerId);
    }
    
    hasPlayerTroopsInMovement(playerId) {
        return this.game.troopMovements.some(movement => movement.owner === playerId);
    }
    
    calculateTotalTroops(playerId) {
        // Sum troops from planets
        const planetTroops = this.game.planets
            .filter(planet => planet.owner === playerId)
            .reduce((total, planet) => total + planet.troops, 0);
        
        // Sum troops from movements
        const movementTroops = this.game.troopMovements
            .filter(movement => movement.owner === playerId)
            .reduce((total, movement) => total + movement.amount, 0);
        
        return planetTroops + movementTroops;
    }
    
    getPlayerStats() {
        const stats = [];
        
        for (const player of this.players) {
            stats.push({
                id: player.id,
                troops: this.calculateTotalTroops(player.id),
                planets: this.game.planets.filter(planet => planet.owner === player.id).length,
                isActive: this.hasPlayerPlanets(player.id) || this.hasPlayerTroopsInMovement(player.id)
            });
        }
        
        // Add neutral stats
        stats.push({
            id: 'neutral',
            troops: this.calculateTotalTroops('neutral'),
            planets: this.game.planets.filter(planet => planet.owner === 'neutral').length
        });
        
        return stats;
    }
    
    getWinningPlayer() {
        const activePlayerStats = this.getPlayerStats()
            .filter(stats => stats.id !== 'neutral')
            .sort((a, b) => b.troops - a.troops);
        
        // If only one player is active, they are the winner
        const activePlayers = activePlayerStats.filter(stats => stats.isActive);
        if (activePlayers.length === 1) {
            return activePlayers[0].id;
        }
        
        // Otherwise, player with most troops is winning
        return activePlayerStats[0].id;
    }
}