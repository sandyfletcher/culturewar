// ===========================================
// root/javascript/TournamentOverlay.js (NEW FILE)
// ===========================================

import botRegistry from './bots/index.js';

export default class TournamentOverlay {
    constructor(overlayElement, completeScreenElement) {
        this.overlayElement = overlayElement;
        this.completeScreenElement = completeScreenElement;
        this.lastBracketData = null; // Cache last bracket state for animations
    }

    /**
     * Shows and renders the tournament bracket overlay.
     * @param {Array} bracketData - The data structure representing the bracket.
     */
    show(bracketData) {
        this.overlayElement.style.display = 'flex';
        // If this is the first time showing, populate the initial HTML structure.
        if (!this.lastBracketData) {
            this.overlayElement.innerHTML = `
                <h2>TOURNAMENT IN PROGRESS</h2>
                <p id="tournament-status">Initializing bracket...</p>
                <div id="tournament-bracket-container">
                    <div id="bracket-html-content" class="tournament-bracket"></div>
                    <svg id="tournament-svg-connectors"></svg>
                </div>
            `;
        }
        this.renderBracket(bracketData);
        this.lastBracketData = JSON.parse(JSON.stringify(bracketData)); // Deep copy for comparison
    }

    /**
     * Hides the tournament bracket overlay and resets its state.
     */
    hide() {
        this.overlayElement.style.display = 'none';
        this.lastBracketData = null;
    }

    /**
     * Updates the status text within the tournament overlay.
     * @param {string} status - The text to display.
     */
    updateStatus(status) {
        // Use a more robust selector in case the element isn't there yet.
        const statusEl = this.overlayElement.querySelector('#tournament-status');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }

    /**
     * Builds and displays the tournament completion screen.
     * @param {object} champion - The winning player's data.
     * @param {object} finalMatchConfig - The config for the final match, used for the replay.
     * @param {function} onReplay - Callback for the "Watch Final" button.
     * @param {function} onReturn - Callback for the "Return to Menu" button.
     */
    showCompleteScreen(champion, finalMatchConfig, onReplay, onReturn) {
        const botInfo = botRegistry.find(b => b.value === champion.aiController);
        const championName = botInfo ? botInfo.name : champion.aiController;

        this.completeScreenElement.innerHTML = `
            <div id="game-over-screen">
                <h1>TOURNAMENT COMPLETE</h1>
                <h2 style="color: #ffff00;">CHAMPION: ${championName.toUpperCase()}</h2>
                <div class="game-over-buttons" style="margin-top: 4rem; flex-direction: column; gap: 1.5rem;">
                    <button id="tournament-replay-button" class="game-mode-button primary-action"><h3>WATCH FINAL MATCH</h3></button>
                    <button id="tournament-return-button" class="game-mode-button"><h3>RETURN TO MENU</h3></button>
                </div>
            </div>
        `;

        const replayButton = this.completeScreenElement.querySelector('#tournament-replay-button');
        const returnButton = this.completeScreenElement.querySelector('#tournament-return-button');

        if (finalMatchConfig && replayButton) {
            replayButton.addEventListener('click', onReplay, { once: true });
        } else if (replayButton) {
            replayButton.disabled = true;
            replayButton.innerHTML = '<h3>FINAL NOT AVAILABLE</h3>';
        }

        if (returnButton) {
            returnButton.addEventListener('click', onReturn, { once: true });
        }

        this.completeScreenElement.style.display = 'flex';
    }

    /**
     * Hides the tournament completion screen.
     */
    hideCompleteScreen() {
        this.completeScreenElement.style.display = 'none';
    }

    // --- Private Rendering Methods ---

    renderBracket(bracketData) {
        const container = this.overlayElement.querySelector('#bracket-html-content');
        if (!container) return;

        container.innerHTML = ''; // Clear previous render
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
                if (animate) playerEl.classList.add('player-wins-animation');
            } else if (opponent) {
                className += ' loser';
                if (animate) playerEl.classList.add('player-loses-animation');
            }
        }
        playerEl.className = className;

        const botInfo = botRegistry.find(b => b.value === player.aiController);
        playerEl.textContent = botInfo ? botInfo.name : player.aiController;
        return playerEl;
    }

    _drawConnectors(bracketData) {
        const svg = this.overlayElement.querySelector('#tournament-svg-connectors');
        const container = this.overlayElement.querySelector('#tournament-bracket-container');
        if (!svg || !container) return;

        svg.innerHTML = '';
        const containerRect = container.getBoundingClientRect();

        for (let roundIndex = 0; roundIndex < bracketData.length - 1; roundIndex++) {
            const currentRoundEl = this.overlayElement.querySelector(`#round-${roundIndex}`);
            const nextRoundEl = this.overlayElement.querySelector(`#round-${roundIndex + 1}`);
            if (!currentRoundEl || !nextRoundEl) continue;

            for (let matchIndex = 0; matchIndex < bracketData[roundIndex].length / 2; matchIndex++) {
                const matchEl = this.overlayElement.querySelector(`#match-${roundIndex}-${matchIndex}`);
                if (!matchEl) continue;

                const nextMatchIndex = Math.floor(matchIndex / 2);
                const nextMatchEl = this.overlayElement.querySelector(`#match-${roundIndex + 1}-${nextMatchIndex}`);
                if (!nextMatchEl) continue;

                const startRect = matchEl.getBoundingClientRect();
                const endRect = nextMatchEl.getBoundingClientRect();

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