// ===========================================================
// root/javascript/MenuManager.js
// ===========================================================

import ScreenManager from './ScreenManager.js';
import GameConfigManager from './GameConfigManager.js';
import MenuBuilder from './MenuBuilder.js';
import GameOverScreen from './GameOverScreen.js';
import FooterManager from './FooterManager.js';
import Game from './game.js';
import StatsTracker from './StatsTracker.js';
import eventManager from './EventManager.js';

export default class MenuManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.initializeUserIdentity(); // create or load persistent user ID
        this.screenManager = new ScreenManager();
        this.configManager = new GameConfigManager();
        this.footerManager = new FooterManager();
        this.statsTracker = new StatsTracker();
        this.menuBuilder = new MenuBuilder(
            this.uiManager.getMenuScreenElement(),
            this.screenManager,
            this.configManager,
            this // pass MenuManager instance to builder
        );
        this.game = null;
        this.gameOverScreen = new GameOverScreen(
            this.uiManager.getInnerContainerElement(),
            this.configManager,
            this
        );
        this.isBatchRunning = false;
        this.gamesRemaining = 0;
        this.totalGamesInBatch = 0;
        this.currentBatchConfig = null;
        eventManager.on('confirm-action', this.handleConfirmAction.bind(this)); // listen for confirmation dialog requests from other modules
        eventManager.on('human-players-eliminated', () => { // listen for all human players eliminated to update UI
            if (this.game && !this.game.gameOver && this.footerManager.mode === 'troop') {
                this.footerManager.switchToSpeedMode();
                this.game.timerManager.shouldPauseOnHidden = false;
            }
        });
        this.menuBuilder.buildMainMenu();
        this.screenManager.switchToScreen('menu');
    }
    handleConfirmAction({ message, onConfirm }) {
        if (window.confirm(message)) {
            onConfirm();
        }
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
        eventManager.emit('screen-changed', screenName);
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
        this.currentBatchConfig = { ...config }; // store a copy of config
        this.gamesRemaining = this.currentBatchConfig.batchSize;
        this.totalGamesInBatch = this.currentBatchConfig.batchSize;
        this.isBatchRunning = this.gamesRemaining > 1 || this.currentBatchConfig.isHeadless;
        if (this.isBatchRunning) {
            if (this.currentBatchConfig.isHeadless) {
                eventManager.emit('show-batch-overlay');
            }
            this.startNextBatchGame();
        } else {
            this.switchToScreen('game'); // single-game logic
            const hasHumanPlayer = config.players.some(p => p.type === 'human');
            const initialSliderMode = hasHumanPlayer ? 'singleplayer' : 'botbattle';
            this.footerManager.showSlider(initialSliderMode);
            this.game = new Game(
                config,
                this.footerManager,
                this.configManager,
                this,
                this.statsTracker,
                this.uiManager.getInnerContainerElement(),
                this.uiManager.getCanvasElement()
            );
            this.game.timerManager.shouldPauseOnHidden = hasHumanPlayer;
        }
    }
    startNextBatchGame() {
        if (!this.isBatchRunning || this.gamesRemaining <= 0) {
            this.isBatchRunning = false;
            eventManager.emit('hide-batch-overlay');
            this.menuBuilder.buildStandingsScreen(); // go to standings after a batch
            this.switchToScreen('menu');
            return;
        }
        const gameNumber = this.totalGamesInBatch - this.gamesRemaining + 1;
        eventManager.emit('update-batch-overlay', { gameNumber, totalGames: this.totalGamesInBatch }); // pass a single object as event data payload
        this.gamesRemaining--;
        if (!this.currentBatchConfig.isHeadless) {
            this.switchToScreen('game');
        }
        this.footerManager.showSlider('botbattle');
        this.game = new Game(
            this.currentBatchConfig,
            this.footerManager,
            this.configManager,
            this,
            this.statsTracker,
            this.uiManager.getInnerContainerElement(),
            this.uiManager.getCanvasElement()
        );
        this.game.timerManager.shouldPauseOnHidden = false;
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