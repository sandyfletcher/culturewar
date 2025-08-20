// ===========================================================
// root/javascript/MenuManager.js
// ===========================================================

import GameConfigManager from './GameConfigManager.js';
import MenuBuilder from './MenuBuilder.js';
import FooterManager from './FooterManager.js';
import Game from './game.js';
import StatsTracker from './StatsTracker.js';
import eventManager from './EventManager.js';
import TournamentManager from './TournamentManager.js';
import ReplayManager from './ReplayManager.js';
import UIManager from './UIManager.js';

export default class MenuManager {
    constructor() {
        this.initializeUserIdentity(); // create or load persistent user ID
        this.configManager = new GameConfigManager();
        this.uiManager = new UIManager(this.configManager, this);
        this.footerManager = new FooterManager();
        this.statsTracker = new StatsTracker();
        this.replayManager = new ReplayManager();
        this.tournament = null;
        this.game = null;
        this.menuBuilder = new MenuBuilder(
            this.uiManager.getMenuScreenElement(),
            null, // ScreenManager is removed from architecture
            this.configManager,
            this // pass this MenuManager instance to builder
        );
        this.isBatchRunning = false;
        this.gamesRemaining = 0;
        this.totalGamesInBatch = 0;
        this.currentBatchConfig = null;
        // --- Event Listeners ---
        eventManager.on('confirm-action', this.handleConfirmAction.bind(this));
        eventManager.on('screen-changed', this.handleScreenChange.bind(this));
        eventManager.on('human-players-eliminated', () => {
            if (this.game && !this.game.gameOver && this.footerManager.mode === 'troop') {
                this.footerManager.switchToSpeedMode();
                this.game.timerManager.shouldPauseOnHidden = false;
            }
        });
        this.menuBuilder.buildMainMenu(); // initialize first screen
        eventManager.emit('screen-changed', 'menu');
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
    handleScreenChange(screenName) {
        if (screenName === 'game') {
            if (this.game && this.game.troopTracker) {
                this.game.troopTracker.showTroopBar();
            }
        } else { // for any non-game screen (menu, game-over, etc.)
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
        this.uiManager.setHeaderTitle('BATTLE COMPLETE');
        this.handleScreenChange('gameOver'); // Manually trigger side-effects
        const backToMenuHandler = () => {
            if (onBackToMenu) onBackToMenu();
        };
        this.footerManager.showBackButton(backToMenuHandler, '< MENUS');
        this.uiManager.showView('gameOver', { 
            payload: { stats, gameInstance }, 
            onPlayAgain, 
            onReturn: onBackToMenu 
        });
    }
    startGame() {
        const config = this.configManager.getConfig();
        this.currentBatchConfig = { ...config };
        this.gamesRemaining = this.currentBatchConfig.batchSize;
        this.totalGamesInBatch = this.currentBatchConfig.batchSize;
        this.isBatchRunning = this.gamesRemaining > 1 || this.currentBatchConfig.isHeadless;
        if (this.isBatchRunning) {
            if (this.currentBatchConfig.isHeadless) {
                this.uiManager.showView('batchProgress');
            }
            this.startNextBatchGame();
        } else {
            this._startSingleGame(config);
        }
    }
    _startSingleGame(config) {
        eventManager.emit('screen-changed', 'game');
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
    startReplay(replayConfig) {
        this.configManager.loadConfigForReplay(replayConfig);
        const config = this.configManager.getConfig();
        this._startSingleGame(config);
    }
    startTournament(participants) {
        this.tournament = new TournamentManager(participants, this);
        this.tournament.start();
    }
    startTournamentGame(config) { // tournament games are headless, don't need UI setup
        this.game = new Game(
            config,
            null, // No footer manager for tournament games
            this.configManager,
            this,
            this.statsTracker,
            this.uiManager.getInnerContainerElement(),
            this.uiManager.getCanvasElement()
        );
    }
    showTournamentUI(bracket) {
        this.uiManager.showView('tournamentProgress', { payload: bracket });
    }
    updateTournamentStatus(status) {
        this.uiManager.views.tournamentProgress.updateStatus(status);
    }
    showTournamentCompleteScreen(champion, finalMatchConfig) {
        this.tournament = null;
        const onReplay = () => this.startReplay(finalMatchConfig);
        const onReturn = () => {
            this.menuBuilder.buildMainMenu();
            eventManager.emit('screen-changed', 'menu');
        };
        this.uiManager.setHeaderTitle('TOURNAMENT COMPLETE');
        this.handleScreenChange('tournamentComplete'); // manually trigger side-effects like hiding the troop bar
        this.uiManager.showView('tournamentComplete', {
            payload: { champion, finalMatchConfig },
            onReplay,
            onReturn
        });
        this.footerManager.showBackButton(onReturn, '< MENUS');
    }
    startNextBatchGame() {
        if (!this.isBatchRunning || this.gamesRemaining <= 0) {
            this.isBatchRunning = false;
            this.menuBuilder.buildStandingsScreen();
            eventManager.emit('screen-changed', 'menu');
            return;
        }
        const gameNumber = this.totalGamesInBatch - this.gamesRemaining + 1;
        this.uiManager.updateView('batchProgress', { gameNumber, totalGames: this.totalGamesInBatch });
        this.gamesRemaining--;
        if (!this.currentBatchConfig.isHeadless) {
            eventManager.emit('screen-changed', 'game');
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
}