// ===========================================================
// root/javascript/MenuManager.js
// ===========================================================

import ScreenManager from './ScreenManager.js';
import GameConfigManager from './GameConfigManager.js';
import MenuBuilder from './MenuBuilder.js';
import GameOverScreen from './GameOverScreen.js';
import FooterManager from './FooterManager.js';
import Game from '../game.js';
import StatsTracker from './StatsTracker.js';

export default class MenuManager {
    constructor() {
        this.initializeUserIdentity(); // Create or load a persistent user ID.
        this.screenManager = new ScreenManager();
        this.configManager = new GameConfigManager();
        this.footerManager = new FooterManager();
        this.statsTracker = new StatsTracker();
        this.menuBuilder = new MenuBuilder(
            document.getElementById('menu-screen'),
            this.screenManager,
            this.configManager
        );
        window.menuManager = this;
        this.game = null;
        this.gameOverScreen = new GameOverScreen(document.getElementById('inner-container'));

        // NEW: Properties for batch mode
        this.isBatchRunning = false;
        this.gamesRemaining = 0;
        this.currentBatchConfig = null;

        this.menuBuilder.buildMainMenu();
        this.screenManager.switchToScreen('menu');
    }

    initializeUserIdentity() {
        const storageKey = 'cultureWarUserId';
        let userId = localStorage.getItem(storageKey);
        if (!userId) {
            // Generates a short, random alphanumeric string like "a1b2c"
            userId = Math.random().toString(36).substring(2, 7);
            try {
                localStorage.setItem(storageKey, userId);
            } catch (error) {
                console.error('Could not save user ID to localStorage:', error);
                // If localStorage is disabled (e.g., private browsing),
                // we'll just have a session-based ID. This is a graceful fallback.
            }
        }
        // Make the ID globally accessible for other modules like GameOverScreen
        window.CULTURE_WAR_USER_ID = userId;
    }

    switchToScreen(screenName) {
        this.screenManager.switchToScreen(screenName);
        if (screenName === 'game') {
            if (this.game && this.game.troopTracker) {
                this.game.troopTracker.showTroopBar();
            }
        } else if (screenName === 'menu') {
            if (this.game && this.game.troopTracker) {
                this.game.troopTracker.hideTroopBar();
            }
            if (this.footerManager.sliderContainer) {
                this.footerManager.revertToDefault();
            }
        }
    }
    showGameOver(stats, gameInstance, onPlayAgain, onBackToMenu) {
        this.game = gameInstance;
        if (gameInstance && gameInstance.troopTracker) {
            gameInstance.troopTracker.hideTroopBar();
        }
        const backToMenuHandler = () => {
            this.gameOverScreen.remove();
            if (onBackToMenu) {
                onBackToMenu();
            }
        };
        this.footerManager.showBackButton(backToMenuHandler, '< MENUS');
        this.gameOverScreen.show(stats, gameInstance, onPlayAgain);
    }
    startGame() {
        const config = this.configManager.getConfig();
        // MODIFIED: Check for batch mode
        if (config.batchSize > 1) {
            this.isBatchRunning = true;
            this.gamesRemaining = config.batchSize;
            this.currentBatchConfig = { ...config }; // Store a copy of the config for the batch
            console.log(`Starting batch of ${this.gamesRemaining} games.`);
            this.startNextBatchGame();
        } else {
            // Original single-game logic
            this.isBatchRunning = false;
            this.switchToScreen('game');
            const hasHumanPlayer = config.players.some(p => p.type === 'human');
            const initialSliderMode = hasHumanPlayer ? 'singleplayer' : 'botbattle';
            this.footerManager.showSlider(initialSliderMode);
            this.game = new Game(config, this.footerManager);
            this.game.timerManager.shouldPauseOnHidden = hasHumanPlayer;
        }
    }

    // NEW: Method to handle starting the next game in a batch
    startNextBatchGame() {
        if (!this.isBatchRunning || this.gamesRemaining <= 0) {
            this.isBatchRunning = false;
            console.log("Batch complete. Returning to main menu.");
            // When the batch is done, go back to the main menu
            this.menuBuilder.buildMainMenu();
            this.switchToScreen('menu');
            return;
        }

        console.log(`--- Starting Game ${this.currentBatchConfig.batchSize - this.gamesRemaining + 1} of ${this.currentBatchConfig.batchSize} ---`);
        this.gamesRemaining--;

        this.switchToScreen('game');
        // A batch run should never have a human, so we can hardcode some things
        this.footerManager.showSlider('botbattle');
        this.game = new Game(this.currentBatchConfig, this.footerManager);
        this.game.timerManager.shouldPauseOnHidden = false; // Never pause during a batch
    }

    getGameConfig() {
        return this.configManager.getConfig();
    }
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    getPlayerDisplayName(playerData, gameInstance, getNickname = false) {
        return this.configManager.getPlayerDisplayName(playerData, gameInstance, getNickname);
    }
}

const menuManager = new MenuManager(); // initialize menu on script load