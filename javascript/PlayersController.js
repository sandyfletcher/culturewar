// ===========================================
// root/javascript/PlayersController.js
// ===========================================

import botRegistry from './bots/index.js';
import { config } from './config.js';
import GameAPI from './GameAPI.js';

export default class PlayersController {
    constructor(game, gameConfig) {
        this.game = game;
        this.config = gameConfig;
        this.players = [];
        this.aiControllers = {};
        this.playerColors = config.player.colors;
        this.defaultAIName = config.player.defaultAIValue;
        this.availableAITypes = new Map(
            botRegistry.map(bot => [bot.value, bot.class])
        );
        this.initializePlayers();
        this.initializeAIControllers();
    }
    initializePlayers() {
        this.players = [];
        for (const playerConfig of this.config.players) {
            this.players.push({
                id: playerConfig.id,
                color: this.playerColors[playerConfig.id],
                isAI: playerConfig.type === 'bot',
                aiController: playerConfig.aiController || null
            });
        }
    }
    initializeAIControllers() {
        this.aiControllers = {};
        const aiPlayers = this.getAIPlayers();
        for (const player of aiPlayers) {
            const AIClass = this.availableAITypes.get(player.aiController) || this.availableAITypes.get(this.defaultAIName);
            if (AIClass) {
                const gameApiForBot = new GameAPI(this.game, player.id);
                this.aiControllers[player.id] = new AIClass(gameApiForBot, player.id);
            } else {
                console.error(`AI type "${player.aiController}" not found in registry!`);
            }
        }
    }
    updateAIPlayers(dt) {
        const activeAiPlayers = this.getAIPlayers()
        .filter(p => this.game.gameState.activePlayers.has(p.id));
        if (activeAiPlayers.length === 0) {
            return;
        }
        // On every game update, iterate through all active bots.
        for (const player of activeAiPlayers) {
            const aiController = this.aiControllers[player.id];
            if (!aiController) continue;
            // Each bot has its own personal cooldown timer.
            // If the bot is on cooldown, decrement the timer and skip its turn.
            if (aiController.memory.actionCooldown > 0) {
                aiController.memory.actionCooldown -= dt;
                continue; // <<< This bot is on cooldown, check the next one.
            }
            // If the cooldown is finished, the bot can make a decision.
            const aiDecision = aiController.makeDecision(dt);
            // If the bot chooses to act...
            if (aiDecision) {
                // ...execute the action...
                this.game.sendTroops(
                    aiDecision.from,
                    aiDecision.to,
                    aiDecision.troops
                );
                // ...and reset ITS OWN cooldown. This doesn't affect other bots.
                aiController.memory.actionCooldown = config.ai.globalDecisionCooldown;
                // An action was taken. The 'return' statement that was here has been
                // removed to allow other AIs to act in the same game update frame,
                // creating a more simultaneous feel.
            }
        }
    }
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
    hasPlayerPlanets(playerId) {
        return this.game.planets.some(planet => planet.owner === playerId);
    }
    hasPlayerTroopsInMovement(playerId) {
        return this.game.troopMovements.some(movement => movement.owner === playerId);
    }
    calculateTotalTroops(playerId) {
        const planetTroops = this.game.planets
            .filter(planet => planet.owner === playerId)
            .reduce((total, planet) => total + planet.troops, 0);
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
        const activePlayers = activePlayerStats.filter(stats => stats.isActive);
        if (activePlayers.length === 1) {
            return activePlayers[0].id;
        }
        return activePlayerStats[0].id;
    }
}