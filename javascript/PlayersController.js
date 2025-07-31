// assets/javascript/PlayersController.js

import botRegistry from './bots/index.js';
import { config } from './config.js'; // <-- IMPORT THE NEW CONFIG

export default class PlayersController {
    constructor(game, playerCount = 2, aiTypes = [], botBattleMode = false) {
        this.game = game;
        this.players = [];
        this.playerCount = playerCount;
        this.aiTypes = aiTypes;
        this.botBattleMode = botBattleMode;
        this.aiControllers = {};
        // Get player colors and default AI from the config file
        this.playerColors = config.player.colors;
        this.defaultAIName = config.player.defaultAIValue;

        this.availableAITypes = new Map(
            botRegistry.map(bot => [bot.value, bot.class])
        );
        this.initializePlayers();
        this.initializeAIControllers();
    }
    initializePlayers() {
        this.players = []; // clear any existing players
        if (this.botBattleMode) {
            for (let i = 0; i < this.playerCount; i++) { // create AI players
                const playerId = `player${i + 1}`;
                const aiType = this.aiTypes[i] || this.defaultAIName; // Use default from config
                this.players.push({
                    id: playerId,
                    color: this.playerColors[playerId],
                    isAI: true,
                    aiController: aiType
                });
            }
        } else {
            this.players.push({ // create human player
                id: 'player1',
                color: this.playerColors['player1'],
                isAI: false,
                aiController: null
            });
            for (let i = 0; i < this.playerCount - 1; i++) { // create AI players with selected AI types
                const playerId = `player${i + 2}`;
                const aiType = this.aiTypes[i] || this.defaultAIName; // Use default from config
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
        this.aiControllers = {}; // clear existing controllers
        const aiPlayers = this.getAIPlayers(); // Create AI controllers for each AI player
        for (const player of aiPlayers) {
            const AIClass = this.availableAITypes.get(player.aiController) || this.availableAITypes.get(this.defaultAIName); // Fallback
            if (AIClass) { // Get the AI class directly from our Ma
                this.aiControllers[player.id] = new AIClass(this.game, player.id); // The AI now receives the game and its own ID to instantiate the API
            } else {
                console.error(`AI type "${player.aiController}" not found in registry!`);
            }
        }
    }
    updateAIPlayers(dt) {
        for (const playerId in this.aiControllers) { // Let each AI make decisions
            if (!this.hasPlayerPlanets(playerId) && !this.hasPlayerTroopsInMovement(playerId)) { // Skip if player is eliminated
                continue;
            }
            const aiController = this.aiControllers[playerId];
            const aiDecision = aiController.makeDecision();
            if (aiDecision) {
                this.game.sendTroops( // Execute the AI's decision by sending troops
                    aiDecision.from,
                    aiDecision.to,
                    aiDecision.troops
                );
            }
        }
    }
    getPlayerById(playerId) { // Player information methods
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
    hasPlayerPlanets(playerId) { // win conditions
        return this.game.planets.some(planet => planet.owner === playerId);
    }
    hasPlayerTroopsInMovement(playerId) {
        return this.game.troopMovements.some(movement => movement.owner === playerId);
    }
    calculateTotalTroops(playerId) {
        const planetTroops = this.game.planets // Sum troops from planets
            .filter(planet => planet.owner === playerId)
            .reduce((total, planet) => total + planet.troops, 0);
        const movementTroops = this.game.troopMovements // Sum troops from movements
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
        stats.push({ // Add neutral stats
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
        const activePlayers = activePlayerStats.filter(stats => stats.isActive); // If only one player is active, they are the winner
        if (activePlayers.length === 1) {
            return activePlayers[0].id;
        }
        return activePlayerStats[0].id; // Otherwise, player with most troops is winning
    }
}