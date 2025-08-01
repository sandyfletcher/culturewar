// ===========================================================
// root/javascript/MenuManager.js
// ===========================================================

import ScreenManager from './ScreenManager.js';
import GameConfigManager from './GameConfigManager.js';
import MenuBuilder from './MenuBuilder.js';
import GameOverScreen from './GameOverScreen.js';
import FooterManager from './FooterManager.js';
import Game from '../game.js';

export default class MenuManager {
    constructor() {
        this.screenManager = new ScreenManager();
        this.configManager = new GameConfigManager();
        this.footerManager = new FooterManager();
        this.menuBuilder = new MenuBuilder(
            document.getElementById('menu-screen'),
            this.screenManager,
            this.configManager
        );
        window.menuManager = this;
        this.game = null;
        this.gameOverScreen = new GameOverScreen(document.getElementById('inner-container'));
        this.menuBuilder.buildMainMenu();
        this.screenManager.switchToScreen('menu');
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
        this.footerManager.showBackButton(onBackToMenu, '< MENUS');
        this.gameOverScreen.show(stats, gameInstance, onPlayAgain);
    }
    startGame() {
        const config = this.configManager.getConfig();
        this.switchToScreen('game');
        const hasHumanPlayer = config.players.some(p => p.type === 'human');
        const initialSliderMode = hasHumanPlayer ? 'singleplayer' : 'botbattle';
        this.footerManager.showSlider(initialSliderMode);
        this.game = new Game(config, this.footerManager);
    }
    getGameConfig() {
        return this.configManager.getConfig();
    }
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    getPlayerDisplayName(playerData, gameInstance) {
        return this.configManager.getPlayerDisplayName(playerData, gameInstance);
    }
}

const menuManager = new MenuManager(); // initialize menu on script load