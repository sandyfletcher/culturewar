import ScreenManager from './ScreenManager.js';
import GameConfigManager from './GameConfigManager.js';
import MenuBuilder from './MenuBuilder.js';
import GameOverScreen from './GameOverScreen.js';
import FooterManager from './FooterManager.js'; // Import the new manager
import Game from '../../../game.js';

class MenuManager {
    constructor() {
        // Initialize components
        this.screenManager = new ScreenManager();
        this.configManager = new GameConfigManager();
        this.footerManager = new FooterManager(); // Instantiate the footer manager
        this.menuBuilder = new MenuBuilder(
            document.getElementById('menu-screen'),
            this.screenManager,
            this.configManager
        );
        
        // Make MenuManager globally accessible for GameState
        window.menuManager = this;
        
        // Game instance reference
        this.game = null;
        
        // Initialize game over screen
        this.gameOverScreen = new GameOverScreen(document.getElementById('inner-container'));
        
        // Build initial menu
        this.menuBuilder.buildMainMenu();
        this.screenManager.switchToScreen('menu');
    }
    
    // Switch between screens (menu, game, game-over)
    switchToScreen(screenName) {
        this.screenManager.switchToScreen(screenName);
        
        // Additional screen-specific logic
        if (screenName === 'game') {
            // Show troop tracker when switching to game
            if (this.game && this.game.troopTracker) {
                this.game.troopTracker.showTroopBar();
            }
        } else if (screenName === 'menu') {
            // Hide troop tracker when returning to menu
            if (this.game && this.game.troopTracker) {
                this.game.troopTracker.hideTroopBar();
            }
            // ** NEW: Hide the slider and restore the default footer **
            this.footerManager.hideSlider();
        }
    }
    
    // Create and show game over screen with leaderboard
    showGameOver(stats, gameInstance) {
        this.game = gameInstance;
        
        // Hide troop tracker when game is over
        if (gameInstance && gameInstance.troopTracker) {
            gameInstance.troopTracker.hideTroopBar();
        }

        // ** NEW: Hide the slider on the game over screen **
        this.footerManager.hideSlider();
        
        // Use the GameOverScreen instance to show the game over screen
        this.gameOverScreen.show(stats, gameInstance);
    }
    
    startGame() {
        // Get the current configuration
        const config = this.configManager.getConfig();
        
        // Switch to game screen
        this.switchToScreen('game');
        
        // ** NEW: Show the slider, passing in the current game mode **
        this.footerManager.showSlider(config.gameMode);
        
        // Create new Game instance with the current configuration
        if (config.gameMode === 'singleplayer') {
            this.game = new Game(config.playerCount, config.aiTypes);
        } else if (config.gameMode === 'botbattle') {
            this.game = new Game(config.botBattleCount, config.aiTypes, true);
        }
    }
    
    // Add this method to fix the GameOverScreen error
    getGameConfig() {
        return this.configManager.getConfig();
    }
    
    // Helper method to format time in MM:SS format
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Delegated methods to ConfigManager
    getPlayerDisplayName(player) {
        return this.configManager.getPlayerDisplayName(player);
    }
}

// Initialize menu when the script loads
const menuManager = new MenuManager();

export default MenuManager;