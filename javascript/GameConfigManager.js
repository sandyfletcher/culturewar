// ===========================================
// root/javascript/GameConfigManager.js
// ===========================================

import botRegistry from './bots/index.js';
import { config } from './config.js';

export default class GameConfigManager {
    constructor() {
        this.gameConfig = {
            players: [], // will be populated by setPlayerCount()
            planetDensity: config.planetGeneration.density.default
        };
        this.aiOptions = botRegistry.map(bot => ({ // only need 'name' and 'value' for UI dropdowns
            value: bot.value,
            name: bot.name
        }));
        this.playerColors = config.player.colors;
        this.setPlayerCount(config.menuDefaults.playerCount); // initialize default game setup
    }
    setPlayerCount(count) { // central method to set total number of players, resizing players array to preserve existing settings where possible
        const newPlayers = [];
        // Get all available AI controller values from the options
        const availableBots = this.aiOptions.map(opt => opt.value);
        for (let i = 0; i < count; i++) {
            const playerId = `player${i + 1}`;
            if (this.gameConfig.players[i]) { // if a player already exists at this index, keep their settings
                newPlayers.push({ ...this.gameConfig.players[i], id: playerId });
            } else { // otherwise, create a default player configuration with a random bot
                const randomBotIndex = Math.floor(Math.random() * availableBots.length);
                const randomAIController = availableBots[randomBotIndex];
                newPlayers.push({ id: playerId, type: 'bot', aiController: randomAIController });
            }
        }
        this.gameConfig.players = newPlayers;
    }
    updatePlayerConfig(index, settings) { // updates a specific player's configuration
        if (this.gameConfig.players[index]) {
            const current = this.gameConfig.players[index]; // merge new settings. For example, if type changes to 'human', aiController will be removed implicitly if not in `settings`.
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
    getPlayerDisplayName(playerData, gameInstance, getNickname = false) { // gets display name based on the `players` array from a running game instance
        const configPlayer = gameInstance.config.players.find(p => p.id === playerData.id); // `playerData` can be from game instance's controller
        if (configPlayer?.type === 'human') {
            return getNickname ? 'PLAYER' : 'Player';
        }
        // For bots
        if (getNickname) {
            return playerData.aiController || 'BOT'; // 'value'/'nickname' is aiController string itself
        } else {
            const aiOption = botRegistry.find(bot => bot.value === playerData.aiController); // full display name comes from bot registry
            return aiOption ? aiOption.name : 'Unknown Bot';
        }
    }
}