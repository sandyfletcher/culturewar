// ===========================================
// root/javascript/UIManager.js
// ===========================================

import eventManager from './EventManager.js';
import GameOverScreen from './GameOverScreen.js';
import TournamentOverlay from './TournamentOverlay.js';
import TournamentCompleteScreen from './TournamentCompleteScreen.js';

export default class UIManager {
    constructor(configManager, menuManager) {
        this.screenContainer = document.getElementById('screen-container');
        this.overlayContainer = document.getElementById('overlay-container');
        this.headerTitle = document.querySelector('header h1');
        this.screens = {
            'menu': document.getElementById('menu-screen'),
            'game': document.getElementById('game-screen'),
            'gameOver': new GameOverScreen(document.getElementById('game-over-screen'), configManager, menuManager),
            'tournamentComplete': new TournamentCompleteScreen(document.getElementById('tournament-complete-screen'))
        };
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
        Object.values(this.screens).forEach(screen => { // hide all screens
            const el = screen.container || screen; // handle both components and raw elements
            el.style.display = 'none';
        });
        const target = this.screens[screenName];
        if (!target) {
            console.error(`Screen "${screenName}" not found!`);
            return;
        }
        const targetElement = target.container || target; // get actual root DOM element for target screen
        if (targetElement.id === 'game-screen' || // make that root element visible, and check ID to apply correct CSS
            targetElement.id === 'game-over-screen' ||
            targetElement.id === 'tournament-complete-screen' ||
            targetElement.id === 'menu-screen') {
            targetElement.style.display = 'flex';
        } else {
            targetElement.style.display = 'block'; // fallback for other potential screens
        }
        if (target.show) { // if it's a component with a .show method, call it to populate content
            target.show(data.payload, data.onPlayAgain, data.onReturn);
        }
    }
    showOverlay(overlayName, data = {}) {
        const target = this.overlays[overlayName];
        if (!target) return;
        if (target.show) { // component
            target.show(data);
        } else { // simple DOM element
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
        if (target.hide) {
            target.hide();
        } else {
            target.style.display = 'none';
        }
    }
}