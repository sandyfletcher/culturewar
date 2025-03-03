// GameConfigManager.js
// Manages game configuration separate from UI concerns

class GameConfigManager {
    constructor() {
        this.gameConfig = {
            gameMode: 'singleplayer',
            playerCount: 2,
            aiTypes: ['Claude1'],
            botBattleCount: 2,
            planetDensity: 1.0
        };
        
        // AI Types reference data
        this.aiOptions = [
            { value: 'Claude1', name: 'Claude1' },
            { value: 'Claude2', name: 'Claude2' },
            { value: 'Claude3', name: 'Claude3' },
            { value: 'Claude4', name: 'Claude4' },
            { value: 'Claude5', name: 'Claude5' },
            { value: 'Claude6', name: 'Claude6' },
            { value: 'Defensive', name: 'Defensive' },
            { value: 'AGGRESSIVE', name: 'AGGRESSIVE' },
            { value: 'Dummy', name: 'Dummy' },
            { value: 'Gemini1', name: 'Gemini1' },
            { value: 'Gemini2', name: 'Gemini2' },
            { value: 'GeminiExample', name: 'GeminiExample' },
        ];
        
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
    
    // Helper method to get friendly display name for players
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