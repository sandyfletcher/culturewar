// ===========================================
// root/javascript/ui/UIManager.js
// ===========================================

import eventManager from '../EventManager.js';
import GameOverScreen from './GameOverScreen.js';
import TournamentOverlay from './TournamentOverlay.js';
import TournamentCompleteScreen from './TournamentCompleteScreen.js';
import BatchOverlay from './BatchScreen.js';

export default class UIManager {
    constructor(configManager, menuManager) {
        this.viewContainer = document.getElementById('view-container');
        this.headerTitle = document.querySelector('header h1');
        this.views = {
            'menu': { element: document.getElementById('menu-screen'), show: () => this.views.menu.element.style.display = 'flex', hide: () => this.views.menu.element.style.display = 'none' },
            'game': { element: document.getElementById('game-screen'), show: () => this.views.game.element.style.display = 'flex', hide: () => this.views.game.element.style.display = 'none' },
            'gameOver': new GameOverScreen(document.getElementById('game-over-screen'), configManager, menuManager),
            'tournamentComplete': new TournamentCompleteScreen(document.getElementById('tournament-complete-screen')),
            'tournamentProgress': new TournamentOverlay(document.getElementById('tournament-overlay')),
            'batchProgress': new BatchOverlay(document.getElementById('batch-overlay')),
        };
        Object.values(this.views).forEach(view => view.hide()); // initial setup hides all views
        eventManager.on('screen-changed', (viewName) => this.showView(viewName));
    }
    setHeaderTitle(title) {
        if (this.headerTitle) {
            this.headerTitle.textContent = title.toUpperCase();
        }
    }
    getMenuScreenElement() {
        return this.views.menu.element;
    }
    getInnerContainerElement() {
        return document.getElementById('inner-container');
    }
    getCanvasElement() {
        return document.getElementById('game-canvas');
    }
    showView(viewName, data = {}) {
        Object.values(this.views).forEach(view => view.hide());
        const target = this.views[viewName];
        if (!target) {
            console.error(`Screen "${screenName}" not found!`);
            return;
        }
        if (target.show) {
            target.show(data.payload, data.onPlayAgain, data.onReturn);
        }
    }
    updateView(viewName, data = {}) {
        const target = this.views[viewName];
        if (target && target.update) {
            target.update(data);
        }
    }
}