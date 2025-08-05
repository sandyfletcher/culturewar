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
        this.isBatchRunning = false;
        this.gamesRemaining = 0;
        this.currentBatchConfig = null;
        this.batchOverlay = null;
        this.menuBuilder.buildMainMenu();
        this.screenManager.switchToScreen('menu');
    }
    initializeUserIdentity() {
        const storageKey = 'cultureWarUserId';
        let userId = localStorage.getItem(storageKey);
        if (!userId) {
            userId = Math.random().toString(36).substring(2, 7); // generates a short random alphanumeric string
            try {
                localStorage.setItem(storageKey, userId);
            } catch (error) { // if localStorage is disabled, just have a session-based ID as fallback
                console.error('Could not save user ID to localStorage:', error); 
            }
        }
        window.CULTURE_WAR_USER_ID = userId; // make ID globally accessible for other modules
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
        this.currentBatchConfig = { ...config }; // Store a copy of the config
        this.gamesRemaining = this.currentBatchConfig.batchSize;
        this.isBatchRunning = this.gamesRemaining > 1 || this.currentBatchConfig.isHeadless;
        if (this.isBatchRunning) {
            if (this.currentBatchConfig.isHeadless) {
                this.showBatchOverlay();
            }
            this.startNextBatchGame();
        } else {
            this.switchToScreen('game'); // single-game logic
            const hasHumanPlayer = config.players.some(p => p.type === 'human');
            const initialSliderMode = hasHumanPlayer ? 'singleplayer' : 'botbattle';
            this.footerManager.showSlider(initialSliderMode);
            this.game = new Game(config, this.footerManager, this.configManager);
            this.game.timerManager.shouldPauseOnHidden = hasHumanPlayer;
        }
    }
    startNextBatchGame() {
        if (!this.isBatchRunning || this.gamesRemaining <= 0) {
            this.isBatchRunning = false;
            if (this.batchOverlay) this.hideBatchOverlay();
            
            this.menuBuilder.buildStandingsScreen(); // Go to standings after a batch
            this.switchToScreen('menu');
            return;
        }
    
        const gameNumber = this.currentBatchConfig.batchSize - this.gamesRemaining + 1;
        this.updateBatchOverlay(gameNumber);
        this.gamesRemaining--;
        if (!this.currentBatchConfig.isHeadless) {
             this.switchToScreen('game');
        }
        this.footerManager.showSlider('botbattle');
        this.game = new Game(this.currentBatchConfig, this.footerManager, this.configManager);
        this.game.timerManager.shouldPauseOnHidden = false;
    }
    showBatchOverlay() { // methods to manage headless mode UI overlay
        if (this.batchOverlay) return;
        this.batchOverlay = document.createElement('div');
        this.batchOverlay.id = 'batch-overlay';
        this.batchOverlay.innerHTML = `
            <h2>RUNNING SIMULATION</h2>
            <p id="batch-progress-text">Initializing...</p>
            <div class="spinner"></div>
        `;
        document.getElementById('inner-container').appendChild(this.batchOverlay);
    }
    
    updateBatchOverlay(gameNumber) {
        if (!this.batchOverlay) return;
        const progressText = this.batchOverlay.querySelector('#batch-progress-text');
        if (progressText) {
            progressText.textContent = `Running Game ${gameNumber} of ${this.currentBatchConfig.batchSize}`;
        }
    }
    
    hideBatchOverlay() {
        if (this.batchOverlay) {
            this.batchOverlay.remove();
            this.batchOverlay = null;
        }
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
}

const menuManager = new MenuManager();