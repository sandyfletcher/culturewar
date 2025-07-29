// assets/javascript/GameConfigManager.js

import botRegistry from './bots/index.js';

class GameConfigManager {
    constructor() {
        this.gameConfig = {
            gameMode: 'singleplayer',
            playerCount: 2,
            aiTypes: ['TiffanySpuckler'],
            botBattleCount: 2,
            planetDensity: 1.0
        };
        
        // We only need the 'name' and 'value' for the UI dropdowns.
        // The .map() function creates a new array with just the data we need.
        this.aiOptions = botRegistry.map(bot => ({
            value: bot.value,
            name: bot.name
        }));
        
        this.playerColors = {
            'player1': '#ffff00', // Yellow
            'player2': '#ff0000', // Red
            'player3': '#00ffff', // Cyan
            'player4': '#00ff00', // Green
            'player5': '#ff00ff', // Magenta/Purple
            'player6': '#ff8000', // Orange
        };
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