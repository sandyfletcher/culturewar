// assets/javascript/MenuManager.js

import ScreenManager from './ScreenManager.js';
import GameConfigManager from './GameConfigManager.js';
import MenuBuilder from './MenuBuilder.js';
import GameOverScreen from './GameOverScreen.js';
import FooterManager from './FooterManager.js';
import Game from '../game.js';

class MenuManager {
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
            // MODIFIED: When switching to the menu screen, we don't know *which* menu
            // we're showing yet. The builder will handle the footer. We just need
            // to make sure the slider is gone.
            if (this.footerManager.sliderContainer) {
                 this.footerManager.revertToDefault();
            }
        }
    }
    
    showGameOver(stats, gameInstance) {
        this.game = gameInstance;
        if (gameInstance && gameInstance.troopTracker) {
            gameInstance.troopTracker.hideTroopBar();
        }
        // MODIFIED: Revert to the default footer text on the game over screen.
        this.footerManager.revertToDefault();
        this.gameOverScreen.show(stats, gameInstance);
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

// Initialize menu when the script loads
const menuManager = new MenuManager();

export default MenuManager;