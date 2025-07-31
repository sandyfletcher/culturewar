// assets/javascript/GameConfigManager.js

import botRegistry from './bots/index.js';
import { config } from './config.js'; // <-- IMPORT THE NEW CONFIG

class GameConfigManager {
    constructor() {
        // Use the new config file for all default values
        this.gameConfig = {
            gameMode: 'singleplayer',
            playerCount: config.menuDefaults.playerCount,
            aiTypes: [...config.menuDefaults.aiTypes], // Use spread to create a new array
            botBattleCount: config.menuDefaults.botBattleCount,
            planetDensity: config.planetGeneration.density.default
        };
        
        // We only need the 'name' and 'value' for the UI dropdowns.
        // The .map() function creates a new array with just the data we need.
        this.aiOptions = botRegistry.map(bot => ({
            value: bot.value,
            name: bot.name
        }));
        
        // Get player colors directly from the config file
        this.playerColors = config.player.colors;
    }
    
    setGameMode(mode) {
        this.gameConfig.gameMode = mode;
    }
    setPlayerCount(count) {
        this.gameConfig.playerCount = count;
    }
    setBotBattleCount(count) {
        this.gameConfig.botBattleCount = count;
    }
    setAITypes(types) {
        this.gameConfig.aiTypes = types;
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
    getPlayerDisplayName(player) {
        if (!player.isAI) {
            return 'Player';
        }
        // Find the matching AI option to get the display name
        const aiOption = this.aiOptions.find(option => option.value === player.aiController);
        return aiOption ? aiOption.name : player.aiController;
    }
}

export default GameConfigManager;