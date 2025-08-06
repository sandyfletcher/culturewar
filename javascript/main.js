// ===========================================
// root/javascript/main.js
// ===========================================

import eventManager from './EventManager.js';
import Game from './game.js';
import MenuManager from './MenuManager.js';
import UIManager from './UIManager.js';

class App {
    constructor() {
        this.game = null;
        this.uiManager = new UIManager();
        this.menuManager = new MenuManager(this.uiManager);
        this.setupEventListeners();
    }

    setupEventListeners() {
        eventManager.on('start-game', (data) => {
            const { config, footerManager, configManager, isBatchGame } = data;

            this.game = new Game(config, footerManager, configManager, this.uiManager.getInnerContainerElement(), this.uiManager.getCanvasElement());

            // Configure game instance based on context
            const hasHumanPlayer = config.players.some(p => p.type === 'human');
            this.game.timerManager.shouldPauseOnHidden = hasHumanPlayer && !isBatchGame;
        });
    }
}

new App();
