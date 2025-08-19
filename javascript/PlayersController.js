// ===========================================
// root/javascript/PlayersController.js
// ===========================================

import botRegistry from './bots/index.js';
import { config } from './config.js';
import GameAPI from './GameAPI.js';
import PRNG from './PRNG.js';

export default class PlayersController {
    constructor(game, gameConfig) {
        this.game = game;
        this.config = gameConfig;
        this.prng = new PRNG(this.config.seed);
        this.players = [];
        this.aiControllers = {};
        this.aiCooldowns = {};
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
                this.aiCooldowns[player.id] = config.ai.decisionCooldown * this.prng.next(); // stagger initial actions
            } else {
                console.error(`AI type "${player.aiController}" not found in registry!`);
            }
        }
    }
    updateAIPlayers(dt) {
        const activeAiPlayers = this.getAIPlayers()
            .filter(p => this.game.gameState.activePlayers.has(p.id));
        const currentGameTime = this.game.gameState.elapsedGameTime;
        for (const player of activeAiPlayers) {
            if (this.aiCooldowns[player.id] > currentGameTime) { // is current game time past bot's allowed action time?
                continue; 
            }
            const aiController = this.aiControllers[player.id]; 
            if (!aiController) continue;
            const aiDecision = aiController.makeDecision(dt);
            if (aiDecision) { // only apply cooldown if bot returns a valid action
                const fromPlanet = this.game.planets.find(p => p.id === aiDecision.fromId);
                const toPlanet = this.game.planets.find(p => p.id === aiDecision.toId);
                if (fromPlanet && toPlanet) {
                    this.game.sendTroops(
                        fromPlanet,
                        toPlanet,
                        aiDecision.troops
                    );
                    this.aiCooldowns[player.id] = currentGameTime + config.ai.decisionCooldown; // set next available action time
                } else {
                    console.warn(`Bot ${player.id} returned a decision with an invalid planet ID.`);
                }
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