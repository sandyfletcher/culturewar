// ===========================================
// root/javascript/UIManager.js
// ===========================================

import eventManager from './EventManager.js';

export default class UIManager {
    constructor() {
        this.batchOverlay = null;
        this.innerContainer = document.getElementById('inner-container');
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.canvas = document.getElementById('game-canvas');

        eventManager.on('show-batch-overlay', () => this.showBatchOverlay());
        eventManager.on('update-batch-overlay', (gameNumber, totalGames) => this.updateBatchOverlay(gameNumber, totalGames));
        eventManager.on('hide-batch-overlay', () => this.hideBatchOverlay());
        eventManager.on('screen-changed', (screenName) => this.switchToScreen(screenName));
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
            progressText.textContent = `Running Game ${gameNumber} of ${totalGames}`;
        }
    }

    hideBatchOverlay() {
        if (this.batchOverlay) {
            this.batchOverlay.remove();
            this.batchOverlay = null;
        }
    }
}
