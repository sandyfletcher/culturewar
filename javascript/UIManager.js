// ===========================================
// root/javascript/UIManager.js
// ===========================================

import eventManager from './EventManager.js';
import TournamentOverlay from './TournamentOverlay.js'; // Import the new class

export default class UIManager {
    constructor() {
        this.batchOverlay = null;
        this.innerContainer = document.getElementById('inner-container');
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.canvas = document.getElementById('game-canvas');
        this.headerTitle = document.querySelector('header h1');

        // Instantiate the tournament overlay manager
        this.tournamentOverlay = new TournamentOverlay(
            document.getElementById('tournament-overlay'),
            document.getElementById('tournament-complete-screen')
        );

        eventManager.on('show-batch-overlay', () => this.showBatchOverlay());
        eventManager.on('update-batch-overlay', ({ gameNumber, totalGames }) => this.updateBatchOverlay(gameNumber, totalGames));
        eventManager.on('hide-batch-overlay', () => this.hideBatchOverlay());
        eventManager.on('screen-changed', (screenName) => this.switchToScreen(screenName));
    }
    setHeaderTitle(title) {
        if (this.headerTitle) {
            this.headerTitle.textContent = title.toUpperCase();
        }
    }
    getMenuScreenElement() {
        return this.menuScreen;
    }
    getInnerContainerElement() {
        return this.innerContainer;
    }
    getCanvasElement() {
        return this.canvas;
    }
    switchToScreen(screenName) {
        if (screenName === 'menu') {
            this.menuScreen.style.display = 'block';
            this.gameScreen.style.display = 'none';
        } else if (screenName === 'game') {
            this.menuScreen.style.display = 'none';
            this.gameScreen.style.display = 'block';
        }
    }
    showBatchOverlay() {
        if (this.batchOverlay) return;
        this.batchOverlay = document.createElement('div');
        this.batchOverlay.id = 'batch-overlay';
        this.batchOverlay.innerHTML = `
            <h2>RUNNING SIMULATION</h2>
            <p id="batch-progress-text">Initializing...</p>
            <div class="spinner"></div>
        `;
        this.innerContainer.appendChild(this.batchOverlay);
    }
    updateBatchOverlay(gameNumber, totalGames) {
        if (!this.batchOverlay) return;
        const progressText = this.batchOverlay.querySelector('#batch-progress-text');
        if (progressText) {
            progressText.textContent = `Game ${gameNumber} of ${totalGames}`;
        }
    }
    hideBatchOverlay() {
        if (this.batchOverlay) {
            this.batchOverlay.remove();
            this.batchOverlay = null;
        }
    }

    // --- Tournament Methods (Delegation) ---
    showTournamentOverlay(bracketData) {
        this.tournamentOverlay.show(bracketData);
    }
    updateTournamentStatus(status) {
        this.tournamentOverlay.updateStatus(status);
    }
    hideTournamentOverlay() {
        this.tournamentOverlay.hide();
    }
    showTournamentCompleteScreen(champion, finalMatchConfig, onReplay, onReturn) {
        this.tournamentOverlay.showCompleteScreen(champion, finalMatchConfig, onReplay, onReturn);
    }
}