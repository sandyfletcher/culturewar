// ===========================================
// root/javascript/UIManager.js
// ===========================================

import eventManager from './EventManager.js';
import botRegistry from './bots/index.js';

export default class UIManager {
    constructor() {
        this.batchOverlay = null;
        this.innerContainer = document.getElementById('inner-container');
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.canvas = document.getElementById('game-canvas');
        this.tournamentOverlay = document.getElementById('tournament-overlay');
        this.tournamentCompleteScreen = document.getElementById('tournament-complete-screen');
        eventManager.on('show-batch-overlay', () => this.showBatchOverlay());
        eventManager.on('update-batch-overlay', ({ gameNumber, totalGames }) => this.updateBatchOverlay(gameNumber, totalGames));
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
            progressText.textContent = `Game ${gameNumber} of ${totalGames}`;
        }
    }
    hideBatchOverlay() {
        if (this.batchOverlay) {
            this.batchOverlay.remove();
            this.batchOverlay = null;
        }
    }
    showTournamentOverlay(bracketData) {
        this.tournamentOverlay.style.display = 'flex';
        this.tournamentOverlay.innerHTML = `
            <h2>TOURNAMENT IN PROGRESS</h2>
            <p id="tournament-status">Initializing bracket...</p>
            <div id="tournament-bracket-container" class="tournament-bracket"></div>
        `;
        this.renderBracket(bracketData);
    }
    updateTournamentStatus(status) {
        const statusEl = document.getElementById('tournament-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }
    hideTournamentOverlay() {
        this.tournamentOverlay.style.display = 'none';
    }
    renderBracket(bracketData) {
        const container = document.getElementById('tournament-bracket-container');
        if (!container) return;
        container.innerHTML = '';
        const maxPlayersInRound = Math.max(...bracketData.map(round => round.length));
        bracketData.forEach((round, roundIndex) => {
            const roundEl = document.createElement('div');
            roundEl.className = 'bracket-round';
            for (let i = 0; i < round.length; i += 2) {
                const matchEl = document.createElement('div');
                matchEl.className = 'bracket-match';
                const p1 = round[i];
                const p2 = round[i + 1];
                const winner = bracketData[roundIndex + 1]?.find(winner => winner.aiController === p1.aiController || (p2 && winner.aiController === p2.aiController));
                matchEl.innerHTML += this.renderPlayer(p1, winner, p2);
                matchEl.innerHTML += p2 ? this.renderPlayer(p2, winner, p1) : `<div class="bracket-player tbd">(BYE)</div>`;
                
                roundEl.appendChild(matchEl);
            }
            container.appendChild(roundEl);
        });
    }
    renderPlayer(player, winner, opponent) {
        if (!player) return `<div class="bracket-player tbd">TBD</div>`;
        let className = 'bracket-player';
        if (winner) {
            if (winner.aiController === player.aiController) {
                className += ' winner';
            } else if (opponent) {
                className += ' loser';
            }
        }
        const botInfo = botRegistry.find(b => b.value === player.aiController);
        const displayName = botInfo ? botInfo.name : player.aiController;
        return `<div class="${className}">${displayName}</div>`;
    }
    showTournamentCompleteScreen(champion, onWatchReplay, onBackToMenu) {
        const botInfo = botRegistry.find(b => b.value === champion.aiController);
        const championName = botInfo ? botInfo.name : champion.aiController;
        this.tournamentCompleteScreen.innerHTML = `
            <h1>CHAMPION</h1>
            <h2>${championName}</h2>
            <div class="tournament-complete-buttons">
                <button id="watch-final-replay-button" class="menu-button">WATCH FINAL</button>
                <button id="tournament-back-to-menu-button" class="menu-button">MAIN MENU</button>
            </div>
        `;
        this.tournamentCompleteScreen.style.display = 'flex';
        document.getElementById('watch-final-replay-button').addEventListener('click', onWatchReplay, { once: true });
        document.getElementById('tournament-back-to-menu-button').addEventListener('click', onBackToMenu, { once: true });
    }
    hideTournamentCompleteScreen() {
        this.tournamentCompleteScreen.style.display = 'none';
        this.tournamentCompleteScreen.innerHTML = '';
    }
}