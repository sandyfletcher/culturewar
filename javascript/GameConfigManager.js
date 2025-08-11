// ===========================================
// root/javascript/GameConfigManager.js
// ===========================================

import botRegistry from './bots/index.js';
import { config } from './config.js';

export default class GameConfigManager {
    constructor() {
        this.gameConfig = {
            players: [],
            planetDensity: config.planetGeneration.density.default,
            batchSize: 1,
            initialGamePace: 1.0,
            isHeadless: false
        };
        this.aiOptions = botRegistry.map(bot => ({
            value: bot.value,
            name: bot.name
        }));
        this.playerColors = config.player.colors;
        this.setPlayerCount(config.menuDefaults.playerCount);
    }
    setBatchSize(size) {
        const batchSize = parseInt(size, 10);
        if (!isNaN(batchSize) && batchSize >= 1 && batchSize <= 100) {
            this.gameConfig.batchSize = batchSize;
        }
    }
    // setter for game pace
    setInitialGamePace(pace) {
        const gamePace = parseFloat(pace);
        if (!isNaN(gamePace) && gamePace >= 0.1 && gamePace <= 4.0) {
            this.gameConfig.initialGamePace = gamePace;
        }
    }
    // setter for headless mode
    setHeadlessMode(isHeadless) {
        this.gameConfig.isHeadless = !!isHeadless; // Coerce to boolean
    }
    setPlayerCount(count) {
        const newPlayers = [];
        const availableBots = this.aiOptions.map(opt => opt.value);
        for (let i = 0; i < count; i++) {
            const playerId = `player${i + 1}`;
            if (this.gameConfig.players[i]) {
                newPlayers.push({ ...this.gameConfig.players[i], id: playerId });
            } else {
                const randomBotIndex = Math.floor(Math.random() * availableBots.length);
                const randomAIController = availableBots[randomBotIndex];
                newPlayers.push({ id: playerId, type: 'bot', aiController: randomAIController });
            }
        }
        this.gameConfig.players = newPlayers;
    }
    updatePlayerConfig(index, settings) {
        if (this.gameConfig.players[index]) {
            const current = this.gameConfig.players[index];
            this.gameConfig.players[index] = { ...current, ...settings };
        }
    }
    setPlanetDensity(density) {
        this.gameConfig.planetDensity = parseFloat(density);
    }
    getConfig() {
        return this.gameConfig;
    }
    getAIOptions() {
        return this.aiOptions;
    }
    getPlayerColors() {
        return this.playerColors;
    }
    getPlayerDisplayName(playerData, playersConfigArray, getNickname = false) {
        const configPlayer = playersConfigArray.find(p => p.id === playerData.id);
        if (configPlayer?.type === 'human') {
            return getNickname ? 'PLAYER' : 'Player';
        }
        if (getNickname) {
            return playerData.aiController || 'BOT';
        } else {
            const aiOption = botRegistry.find(bot => bot.value === playerData.aiController);
            return aiOption ? aiOption.name : 'Unknown Bot';
        }
    }
}