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
            this.footerManager.hideSlider();
        }
    }
    
    showGameOver(stats, gameInstance) {
        this.game = gameInstance;
        if (gameInstance && gameInstance.troopTracker) {
            gameInstance.troopTracker.hideTroopBar();
        }
        this.footerManager.hideSlider();
        this.gameOverScreen.show(stats, gameInstance);
    }
    
    // MODIFIED: This is now much simpler.
    startGame() {
        const config = this.configManager.getConfig();
        this.switchToScreen('game');
        
        // NEW: Determine slider mode based on whether any humans are playing.
        const hasHumanPlayer = config.players.some(p => p.type === 'human');
        const initialSliderMode = hasHumanPlayer ? 'singleplayer' : 'botbattle';
        this.footerManager.showSlider(initialSliderMode);
        
        // MODIFIED: Create new Game instance with the unified config object.
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
    
    // MODIFIED: This now needs the gameInstance to look up the correct config.
    getPlayerDisplayName(playerData, gameInstance) {
        return this.configManager.getPlayerDisplayName(playerData, gameInstance);
    }
}

// Initialize menu when the script loads
const menuManager = new MenuManager();

export default MenuManager;