// ===========================================================
// root/javascript/MenuManager.js
// ===========================================================

import GameConfigManager from './GameConfigManager.js';
import MenuBuilder from './MenuBuilder.js';
import GameOverScreen from './GameOverScreen.js';
import FooterManager from './FooterManager.js';
import StatsTracker from './StatsTracker.js';
import eventManager from './EventManager.js';

export default class MenuManager {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.initializeUserIdentity(); // Create or load a persistent user ID.
        this.configManager = new GameConfigManager();
        this.footerManager = new FooterManager();
        this.statsTracker = new StatsTracker();
        this.menuBuilder = new MenuBuilder(
            this.uiManager.getMenuScreenElement(),
            this.configManager,
            this.startGame.bind(this),
            this.statsTracker
        );
        this.gameOverScreen = new GameOverScreen(this.uiManager.getInnerContainerElement());
        this.isBatchRunning = false;
        this.gamesRemaining = 0;
        this.currentBatchConfig = null;

        this.menuBuilder.buildMainMenu();
        eventManager.emit('screen-changed', 'menu');

        eventManager.on('show-game-over', (data) => this.showGameOver(data.stats, data.onPlayAgain, data.onBackToMenu));
        eventManager.on('game-ended', () => this.onGameEnd());
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
        // Instead of a global, this could be passed to modules that need it,
        // or they could request it from a central App/Session manager.
        // For now, we'll just store it and not expose it globally.
        this.userId = userId;
    }

    switchToScreen(screenName) {
        eventManager.emit('screen-changed', screenName);

        if (screenName === 'menu') {
            if (this.footerManager.sliderContainer) {
                this.footerManager.revertToDefault();
            }
        }
    }

    showGameOver(stats, onPlayAgain, onBackToMenu) {
        const backToMenuHandler = () => {
            this.gameOverScreen.remove();
            if (onBackToMenu) {
                onBackToMenu();
            }
        };
        this.footerManager.showBackButton(backToMenuHandler, '< MENUS');
        this.gameOverScreen.show(stats, onPlayAgain);
    }

    startGame() {
        const config = this.configManager.getConfig();
        this.currentBatchConfig = { ...config }; // Store a copy of the config
        this.gamesRemaining = this.currentBatchConfig.batchSize;
        this.isBatchRunning = this.gamesRemaining > 1 || this.currentBatchConfig.isHeadless;

        if (this.isBatchRunning) {
            if (this.currentBatchConfig.isHeadless) {
                eventManager.emit('show-batch-overlay');
            }
            this.startNextBatchGame();
        } else {
            this.switchToScreen('game');
            const hasHumanPlayer = config.players.some(p => p.type === 'human');
            const initialSliderMode = hasHumanPlayer ? 'singleplayer' : 'botbattle';
            this.footerManager.showSlider(initialSliderMode);

        config.userId = this.userId;
            eventManager.emit('start-game', {
                config: config,
                footerManager: this.footerManager,
                configManager: this.configManager
            });
        }
    }

    startNextBatchGame() {
        if (!this.isBatchRunning || this.gamesRemaining <= 0) {
            this.isBatchRunning = false;
            eventManager.emit('hide-batch-overlay');

            this.menuBuilder.buildStandingsScreen(); // Go to standings after a batch
            this.switchToScreen('menu');
            return;
        }

        const gameNumber = this.currentBatchConfig.batchSize - this.gamesRemaining + 1;
        eventManager.emit('update-batch-overlay', gameNumber, this.currentBatchConfig.batchSize);
        this.gamesRemaining--;

        if (!this.currentBatchConfig.isHeadless) {
            this.switchToScreen('game');
        }
        this.footerManager.showSlider('botbattle');

        this.currentBatchConfig.userId = this.userId;
        eventManager.emit('start-game', {
            config: this.currentBatchConfig,
            footerManager: this.footerManager,
            configManager: this.configManager,
            isBatchGame: true
        });
    }

    onGameEnd() {
        if (this.isBatchRunning) {
            this.startNextBatchGame();
        }
    }

    getGameConfig() {
        return this.configManager.getConfig();
    }
}