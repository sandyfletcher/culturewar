// assets/javascript/GameConfigManager.js

import botRegistry from './bots/index.js';
import { config } from './config.js';

class GameConfigManager {
    constructor() {
        // MODIFIED: This object is now much simpler. The obsolete properties that
        // caused the error have been removed.
        this.gameConfig = {
            players: [], // This will be populated by setPlayerCount()
            planetDensity: config.planetGeneration.density.default
        };
        
        // We only need the 'name' and 'value' for the UI dropdowns.
        this.aiOptions = botRegistry.map(bot => ({
            value: bot.value,
            name: bot.name
        }));
        
        this.playerColors = config.player.colors;

        // Initialize with a default game setup (e.g., 2 players).
        this.setPlayerCount(config.menuDefaults.playerCount);
    }

    // NEW: Central method to set the total number of players.
    // Resizes the players array, preserving existing settings where possible.
    setPlayerCount(count) {
        const newPlayers = [];
        const defaultAI = config.player.defaultAIValue;

        for (let i = 0; i < count; i++) {
            const playerId = `player${i + 1}`;
            // If a player already exists at this index, keep their settings.
            if (this.gameConfig.players[i]) {
                newPlayers.push({ ...this.gameConfig.players[i], id: playerId });
            } else {
                // Otherwise, create a default player configuration.
                // Default: P1 is Human, others are Bots.
                if (i === 0) {
                    newPlayers.push({ id: playerId, type: 'human' });
                } else {
                    newPlayers.push({ id: playerId, type: 'bot', aiController: defaultAI });
                }
            }
        }
        this.gameConfig.players = newPlayers;
    }

    // NEW: Updates a specific player's configuration.
    updatePlayerConfig(index, settings) {
        if (this.gameConfig.players[index]) {
            // Merge new settings. For example, if type changes to 'human',
            // aiController will be removed implicitly if not in `settings`.
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

    // MODIFIED: Now gets display name based on the `players` array from a running game instance.
    getPlayerDisplayName(playerData, gameInstance) {
        // The `playerData` can be from the game instance's controller.
        const configPlayer = gameInstance.config.players.find(p => p.id === playerData.id);

        if (configPlayer?.type === 'human') {
            return 'Player';
        }

        // Find the matching AI option to get the display name.
        const aiOption = this.aiOptions.find(option => option.value === playerData.aiController);
        return aiOption ? aiOption.name : playerData.aiController;
    }
}

export default GameConfigManager;