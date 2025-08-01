// ===========================================
// root/javascript/PlayersController.js
// ===========================================

import botRegistry from './bots/index.js';
import { config } from './config.js';

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
        this.aiDecisionCooldown = 0;
        this.nextAiToActIndex = 0;
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
                this.aiControllers[player.id] = new AIClass(this.game, player.id);
            } else {
                console.error(`AI type "${player.aiController}" not found in registry!`);
            }
        }
    }
    updateAIPlayers(dt) {
        this.aiDecisionCooldown -= dt;
        if (this.aiDecisionCooldown > 0) {
            return;
        }
        const activeAiIds = this.getAIPlayers()
            .map(p => p.id)
            .filter(id => this.game.gameState.activePlayers.has(id));
        if (activeAiIds.length === 0) {
            return;
        }
        this.aiDecisionCooldown = config.ai.globalDecisionCooldown;
        this.nextAiToActIndex = this.nextAiToActIndex % activeAiIds.length;
        const botIdToAct = activeAiIds[this.nextAiToActIndex];
        const aiController = this.aiControllers[botIdToAct];
        if (aiController) {
            const aiDecision = aiController.makeDecision(dt);
            if (aiDecision) {
                this.game.sendTroops(
                    aiDecision.from,
                    aiDecision.to,
                    aiDecision.troops
                );
            }
        }
        this.nextAiToActIndex++;
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