class GameConfigManager {
    constructor() {
        this.gameConfig = {
            gameMode: 'singleplayer',
            playerCount: 2,
            aiTypes: ['TiffanySpuckler'],
            botBattleCount: 2,
            planetDensity: 1.0
        };
        
        // AI Types reference data
        this.aiOptions = [
            { value: 'TiffanySpuckler', name: 'TiffanySpuckler' },
            { value: 'HeatherSpuckler', name: 'HeatherSpuckler' },
            { value: 'CodySpuckler', name: 'CodySpuckler' },
            { value: 'DylanSpuckler', name: 'DylanSpuckler' },
            { value: 'DermotSpuckler', name: 'DermotSpuckler' },
            { value: 'JordanSpuckler', name: 'JordanSpuckler' },
            { value: 'TaylorSpuckler', name: 'TaylorSpuckler' },
            { value: 'BrittanySpuckler', name: 'BrittanySpuckler' },
            { value: 'WesleySpuckler', name: 'WesleySpuckler' },
            { value: 'RumerSpuckler', name: 'RumerSpuckler' },
            { value: 'ScoutSpuckler', name: 'ScoutSpuckler' },

            { value: 'ZoeSpuckler', name: 'ZoeSpuckler' },
            { value: 'ChloeSpuckler', name: 'ChloeSpuckler' },

            { value: 'MorganSpuckler', name: 'MorganSpuckler' },
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