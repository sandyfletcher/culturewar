// ===========================================
// root/javascript/TournamentOverlay.js
// ===========================================

import botRegistry from './bots/index.js';

export default class TournamentOverlay {
    constructor(overlayElement, completeScreenElement) {
        this.overlayElement = overlayElement;
        this.lastBracketData = null; // cache last bracket state for animations
    }
    show(bracketData) { // shows and renders tournament bracket overlay
        this.overlayElement.style.display = 'flex';
        if (!this.lastBracketData) { // if first time showing, populate initial HTML structure
            this.overlayElement.innerHTML = `
                <h2>TOURNAMENT IN PROGRESS</h2>
                <p id="tournament-status">Initializing bracket...</p>
                <div id="tournament-bracket-container">
                    <div id="bracket-wings-container">
                        <div id="bracket-top-wing"></div>
                        <div id="bracket-final-wing"></div>
                        <div id="bracket-bottom-wing"></div>
                    </div>
                    <svg id="tournament-svg-connectors"></svg>
                </div>
            `;
        }
        this.renderBracket(bracketData);
        this.lastBracketData = JSON.parse(JSON.stringify(bracketData)); // deep copy for comparison
    }
    hide() {
        this.overlayElement.style.display = 'none';
        this.lastBracketData = null;
    }
    updateStatus(status) {
        const statusEl = this.overlayElement.querySelector('#tournament-status'); // use a more robust selector in case element isn't there yet
        if (statusEl) {
            statusEl.textContent = status;
        }
    }
    createMatchElement(id, p1, p2, winner, roundIndex, matchIndex, playerIndexOffset) {
        const matchEl = document.createElement('div');
        matchEl.className = 'bracket-match';
        matchEl.id = id;
        matchEl.appendChild(this.renderPlayer(p1, winner, p2, roundIndex, matchIndex, playerIndexOffset));
        const vs = document.createElement('div');
        vs.className = 'vs-separator';
        vs.textContent = 'vs';
        matchEl.appendChild(vs);
        if (p2 !== undefined) {
            matchEl.appendChild(this.renderPlayer(p2, winner, p1, roundIndex, matchIndex, playerIndexOffset + 1));
        } else {
            matchEl.appendChild(this.renderPlayer(null, null, null, 0, 0, 0));
        }
        return matchEl;
    }
    renderBracket(bracketData) {
        const topWing = this.overlayElement.querySelector('#bracket-top-wing');
        const bottomWing = this.overlayElement.querySelector('#bracket-bottom-wing');
        const finalWing = this.overlayElement.querySelector('#bracket-final-wing');
        if (!topWing || !bottomWing || !finalWing) return;
        topWing.innerHTML = '';
        bottomWing.innerHTML = '';
        finalWing.innerHTML = '';
        const totalRounds = bracketData.length;
        if (totalRounds < 1) return;
        const finalRoundIndex = totalRounds > 1 ? totalRounds - 2 : 0;
        const championRoundIndex = totalRounds > 1 ? totalRounds - 1 : 0;
        for (let roundIndex = 0; roundIndex < finalRoundIndex; roundIndex++) {
            const roundData = bracketData[roundIndex];
            const midpoint = Math.ceil(roundData.length / 2);
            const topRoundEl = document.createElement('div');
            topRoundEl.className = 'bracket-round';
            topRoundEl.id = `round-top-${roundIndex}`;
            const bottomRoundEl = document.createElement('div');
            bottomRoundEl.className = 'bracket-round';
            bottomRoundEl.id = `round-bottom-${roundIndex}`;
            for (let i = 0; i < midpoint; i += 2) {
                const matchIndex = i / 2;
                const p1 = roundData[i];
                const p2 = roundData[i + 1];
                const winner = bracketData[roundIndex + 1]?.[matchIndex];
                const matchEl = this.createMatchElement(`match-top-${roundIndex}-${matchIndex}`, p1, p2, winner, roundIndex, matchIndex, 0);
                topRoundEl.appendChild(matchEl);
            }
            for (let i = midpoint; i < roundData.length; i += 2) {
                const matchIndex = (i - midpoint) / 2;
                const p1 = roundData[i];
                const p2 = roundData[i + 1];
                const winner = bracketData[roundIndex + 1]?.[Math.floor(midpoint/2) + matchIndex];
                const matchEl = this.createMatchElement(`match-bottom-${roundIndex}-${matchIndex}`, p1, p2, winner, roundIndex, matchIndex + midpoint / 2, 0);
                bottomRoundEl.appendChild(matchEl);
            }
            if (topRoundEl.hasChildNodes()) topWing.appendChild(topRoundEl);
            if (bottomRoundEl.hasChildNodes()) bottomWing.appendChild(bottomRoundEl);
        }
        const finalRoundEl = document.createElement('div');
        finalRoundEl.className = 'bracket-round';
        finalRoundEl.id = `round-final-${finalRoundIndex}`;
        const finalMatchData = bracketData[finalRoundIndex];
        const championData = bracketData[championRoundIndex]?.[0];
        if (finalMatchData && finalMatchData.length >= 1) {
            const p1 = finalMatchData[0];
            const p2 = finalMatchData[1];
            const finalMatchEl = this.createMatchElement(`match-final`, p1, p2, championData, finalRoundIndex, 0, 0);
            finalRoundEl.appendChild(finalMatchEl);
        }
        if (championData) {
            const championRoundEl = document.createElement('div');
            championRoundEl.className = 'bracket-round';
            championRoundEl.id = 'round-champion';
            const championEl = document.createElement('div');
            championEl.className = 'bracket-player winner player-wins-animation';
            championEl.textContent = championData.aiController;
            const matchWrapper = document.createElement('div');
            matchWrapper.className = 'bracket-match';
            matchWrapper.style.border = '2px solid #ffcc00';
            matchWrapper.appendChild(championEl);
            championRoundEl.appendChild(matchWrapper);
            finalWing.appendChild(championRoundEl);
        }
        if (finalRoundEl.hasChildNodes()) finalWing.insertBefore(finalRoundEl, finalWing.firstChild);
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
            const oldWinner = this.lastBracketData?.[roundIndex + 1]?.[matchIndex];
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
        playerEl.textContent = player.aiController;
        return playerEl;
    }
    _drawConnectors(bracketData) {
        const svg = this.overlayElement.querySelector('#tournament-svg-connectors');
        const container = this.overlayElement.querySelector('#tournament-bracket-container');
        if (!svg || !container) return;

        svg.innerHTML = '';
        const containerRect = container.getBoundingClientRect();
        const finalRoundIndex = bracketData.length > 1 ? bracketData.length - 2 : 0;
        const drawPath = (startX, startY, endX, endY) => {
            const midY = startY + (endY - startY) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`);
            path.setAttribute('stroke', '#666');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            svg.appendChild(path);
        };
        const connectWing = (wing, isTopWing) => {
            for (let roundIndex = 0; roundIndex < finalRoundIndex; roundIndex++) {
                const roundEl = this.overlayElement.querySelector(`#round-${wing}-${roundIndex}`);
                if (!roundEl) continue;
                const matchesInRound = roundEl.querySelectorAll('.bracket-match');
                matchesInRound.forEach((matchEl, matchIndex) => {
                    let nextMatchEl;
                    if (roundIndex < finalRoundIndex - 1) {
                        const nextMatchIndex = Math.floor(matchIndex / 2);
                        nextMatchEl = this.overlayElement.querySelector(`#match-${wing}-${roundIndex + 1}-${nextMatchIndex}`);
                    } else {
                        nextMatchEl = this.overlayElement.querySelector(`#match-final`);
                    }
                    if (!nextMatchEl) return;
                    const startRect = matchEl.getBoundingClientRect();
                    const endRect = nextMatchEl.getBoundingClientRect();
                    const startX = startRect.left + startRect.width / 2 - containerRect.left;
                    const endX = endRect.left + endRect.width / 2 - containerRect.left;
                    let startY, endY;
                    if (isTopWing) {
                        startY = startRect.bottom - containerRect.top;
                        endY = endRect.top - containerRect.top;
                    } else {
                        startY = startRect.top - containerRect.top;
                        endY = endRect.bottom - containerRect.top;
                    }
                    drawPath(startX, startY, endX, endY);
                });
            }
        };
        connectWing('top', true);
        connectWing('bottom', false);
        const finalMatchEl = this.overlayElement.querySelector('#match-final');
        const championRoundEl = this.overlayElement.querySelector('#round-champion .bracket-match');
        if (finalMatchEl && championRoundEl) {
            const startRect = finalMatchEl.getBoundingClientRect();
            const endRect = championRoundEl.getBoundingClientRect();
            const startX = startRect.left + startRect.width / 2 - containerRect.left;
            const startY = startRect.bottom - containerRect.top;
            const endX = endRect.left + endRect.width / 2 - containerRect.left;
            const endY = endRect.top - containerRect.top;
            drawPath(startX, startY, endX, endY); // use same pathing for consistency
        }
    }
}