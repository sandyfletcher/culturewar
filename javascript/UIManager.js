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
        this.lastBracketData = null; // cache last bracket state for animations
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
    getTournamentCompleteScreenElement() {
        return this.tournamentCompleteScreen;
    }
    showTournamentCompleteScreen() {
        if (this.tournamentCompleteScreen) {
            this.tournamentCompleteScreen.style.display = 'flex';
        }
    }
    hideTournamentCompleteScreen() {
        if (this.tournamentCompleteScreen) {
            this.tournamentCompleteScreen.style.display = 'none';
        }
    }
    showTournamentOverlay(bracketData) {
        this.tournamentOverlay.style.display = 'flex';
        if (!this.lastBracketData) { // first time showing
            this.tournamentOverlay.innerHTML = `
                <h2>TOURNAMENT IN PROGRESS</h2>
                <p id="tournament-status">Initializing bracket...</p>
                <div id="tournament-bracket-container">
                    <div id="bracket-html-content" class="tournament-bracket"></div>
                    <svg id="tournament-svg-connectors"></svg>
                </div>
            `;
        }
        this.renderBracket(bracketData);
        this.lastBracketData = JSON.parse(JSON.stringify(bracketData)); // deep copy for comparison
    }
    updateTournamentStatus(status) {
        const statusEl = document.getElementById('tournament-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }
    hideTournamentOverlay() {
        this.tournamentOverlay.style.display = 'none';
        this.lastBracketData = null;
    }
    renderBracket(bracketData) {
        const container = document.getElementById('bracket-html-content');
        if (!container) return;
        container.innerHTML = ''; // clear previous render
        bracketData.forEach((round, roundIndex) => {
            const roundEl = document.createElement('div');
            roundEl.className = 'bracket-round';
            roundEl.id = `round-${roundIndex}`;
            for (let i = 0; i < round.length; i += 2) {
                const matchIndex = i / 2;
                const matchEl = document.createElement('div');
                matchEl.className = 'bracket-match';
                matchEl.id = `match-${roundIndex}-${matchIndex}`;
                const p1 = round[i];
                const p2 = round[i + 1];
                const winner = bracketData[roundIndex + 1]?.find(winner => 
                    winner.aiController === p1.aiController || (p2 && winner.aiController === p2.aiController)
                );
                matchEl.innerHTML += `<div class="vs-separator">VS</div>`;
                matchEl.appendChild(this.renderPlayer(p1, winner, p2, roundIndex, matchIndex, 0));
                matchEl.appendChild(this.renderPlayer(p2, winner, p1, roundIndex, matchIndex, 1));
                roundEl.appendChild(matchEl);
            }
            container.appendChild(roundEl);
        });
        requestAnimationFrame(() => this._drawConnectors(bracketData));
    }
    renderPlayer(player, winner, opponent, roundIndex, matchIndex, playerIndex) {
        const playerEl = document.createElement('div');
        playerEl.id = `player-${roundIndex}-${matchIndex}-${playerIndex}`;
        if (!player) {
            playerEl.className = 'bracket-player tbd';
            playerEl.textContent = 'TBD';
            return playerEl;
        }
        let className = 'bracket-player';
        let animate = false;
        if (winner) {
            const oldWinner = this.lastBracketData?.[roundIndex + 1]?.find(w => 
                w.aiController === player.aiController || (opponent && w.aiController === opponent.aiController)
            );
            if (!oldWinner) {
                animate = true;
            }
            if (winner.aiController === player.aiController) {
                className += ' winner';
                if(animate) playerEl.classList.add('player-wins-animation');
            } else if (opponent) {
                className += ' loser';
                if(animate) playerEl.classList.add('player-loses-animation');
            }
        }
        playerEl.className = className;
        const botInfo = botRegistry.find(b => b.value === player.aiController);
        playerEl.textContent = botInfo ? botInfo.name : player.aiController;
        return playerEl;
    }
    _drawConnectors(bracketData) {
        const svg = document.getElementById('tournament-svg-connectors');
        const container = document.getElementById('tournament-bracket-container');
        if (!svg || !container) return;
        svg.innerHTML = '';
        const containerRect = container.getBoundingClientRect();
        for (let roundIndex = 0; roundIndex < bracketData.length - 1; roundIndex++) {
            const currentRoundEl = document.getElementById(`round-${roundIndex}`);
            const nextRoundEl = document.getElementById(`round-${roundIndex + 1}`);
            if (!currentRoundEl || !nextRoundEl) continue;
            for (let matchIndex = 0; matchIndex < bracketData[roundIndex].length / 2; matchIndex++) {
                const matchEl = document.getElementById(`match-${roundIndex}-${matchIndex}`);
                if (!matchEl) continue;
                const nextMatchIndex = Math.floor(matchIndex / 2);
                const nextMatchEl = document.getElementById(`match-${roundIndex + 1}-${nextMatchIndex}`);
                if (!nextMatchEl) continue;
                const startRect = matchEl.getBoundingClientRect();
                const endRect = nextMatchEl.getBoundingClientRect();
                // Points relative to the container, accounting for scroll
                const startX = startRect.right - containerRect.left + container.scrollLeft;
                const startY = startRect.top + startRect.height / 2 - containerRect.top;
                const endX = endRect.left - containerRect.left + container.scrollLeft;
                const endY = endRect.top + endRect.height / 2 - containerRect.top;
                const midX = startX + (endX - startX) / 2;
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`);
                path.setAttribute('stroke', '#666');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                svg.appendChild(path);
            }
        }
    }
}