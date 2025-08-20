// ===========================================
// root/javascript/GameConfigManager.js
// ===========================================

import botRegistry from '../bots/index.js';
import { config } from '../config.js';

export default class GameConfigManager {
    constructor() {
        this.gameConfig = {
            players: [],
            planetDensity: config.planetGeneration.density.default,
            batchSize: 1,
            initialGamePace: 1.0,
            isHeadless: false,
            seed: Date.now()
        };
        this.aiOptions = botRegistry.map(bot => ({
            value: bot.value,
            name: bot.name
        }));
        this.playerColors = config.player.colors;
        this.setPlayerCount(config.menuDefaults.playerCount);
    }
    setSeed(seed) {
        this.gameConfig.seed = seed || Date.now();
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
        const { min, max } = config.ui.footerSlider.speed; // <-- Read from config
        if (!isNaN(gamePace) && gamePace >= min && gamePace <= max) { // <-- Use config values
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
    getConfig() { // ensure fresh seed for every new game config request
        if (!this.gameConfig.isReplay) { // unless one is already set for replay
            this.setSeed();
        }
        return { ...this.gameConfig };
    }
    loadConfigForReplay(replayConfig) { // load a specific config for replay
        this.gameConfig = { ...replayConfig, isHeadless: false, isReplay: true };
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