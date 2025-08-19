// ===========================================
// root/javascript/UIManager.js
// ===========================================

import eventManager from './EventManager.js';
import GameOverScreen from './GameOverScreen.js';
import TournamentOverlay from './TournamentOverlay.js';
import TournamentCompleteScreen from './TournamentCompleteScreen.js';

export default class UIManager {
    constructor(configManager, menuManager) {
        // Main Containers
        this.screenContainer = document.getElementById('screen-container');
        this.overlayContainer = document.getElementById('overlay-container');
        this.headerTitle = document.querySelector('header h1');
        // Screen Components & Elements
        this.screens = {
            'menu': document.getElementById('menu-screen'),
            'game': document.getElementById('game-screen'),
            'gameOver': new GameOverScreen(document.getElementById('game-over-screen'), configManager, menuManager),
            'tournamentComplete': new TournamentCompleteScreen(document.getElementById('tournament-complete-screen'))
        };
        // Overlay Components & Elements
        this.overlays = {
            'tournament': new TournamentOverlay(document.getElementById('tournament-overlay')),
            'batch': document.getElementById('batch-overlay')
        };
        eventManager.on('screen-changed', (screenName) => this.showScreen(screenName));
    }
    setHeaderTitle(title) {
        if (this.headerTitle) {
            this.headerTitle.textContent = title.toUpperCase();
        }
    }
    getMenuScreenElement() {
        return this.screens.menu;
    }
    getInnerContainerElement() {
        return document.getElementById('inner-container');
    }
    getCanvasElement() {
        return document.getElementById('game-canvas');
    }
    showScreen(screenName, data = {}) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            const el = screen.container || screen; // Handle both components and raw elements
            el.style.display = 'none';
        });
        const target = this.screens[screenName];
        if (!target) {
            console.error(`Screen "${screenName}" not found!`);
            return;
        }
        // Show the target screen
        if (target.show) { // It's a component with a show method
            target.show(data.payload, data.onPlayAgain, data.onReturn);
        } else { // It's a simple DOM element
            target.style.display = 'block';
        }
    }
    // --- Overlay Management ---
    showOverlay(overlayName, data = {}) {
        const target = this.overlays[overlayName];
        if (!target) return;

        if (target.show) { // It's a component
            target.show(data);
        } else { // It's a simple DOM element
            target.style.display = 'flex';
        }
    }
    updateOverlay(overlayName, data = {}) {
        const target = this.overlays[overlayName];
        if (!target) return;
        if (overlayName === 'batch') {
             const progressText = target.querySelector('#batch-progress-text');
             if(progressText) progressText.textContent = `Game ${data.gameNumber} of ${data.totalGames}`;
        }
        if (overlayName === 'tournament') {
             if(target.updateStatus) target.updateStatus(data.status);
        }
    }
    hideOverlay(overlayName) {
        const target = this.overlays[overlayName];
        if (!target) return;
        if (target.hide) { // It's a component
            target.hide();
        } else { // It's a simple DOM element
            target.style.display = 'none';
        }
    }
}