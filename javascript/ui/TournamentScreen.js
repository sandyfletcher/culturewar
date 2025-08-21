// ===========================================
// root/javascript/TournamentScreen.js
// ===========================================

export default class TournamentScreen {
    constructor(element) {
        this.element = element;
        this.onSimulate = null;
        this.onWatch = null;
    }
    show(bracketData) {
        if (!bracketData) return; // Guard clause
        this.element.innerHTML = `
            <div class="tournament-hub-container">
                <div class="tournament-bracket-container">
                    <div id="tournament-bracket" class="tournament-bracket"></div>
                </div>
                <div id="tournament-controls" class="tournament-controls" style="display: none;"></div>
                <div id="tournament-podium" class="tournament-podium" style="display: none;"></div>
            </div>
        `;
        this._renderBracket(bracketData);
        this.element.style.display = 'flex';
    }
    hide() {
        this.element.style.display = 'none';
        this.element.innerHTML = '';
    }
    _renderBracket(bracketData) {
        if (!bracketData) return; // Guard clause
        const bracketContainer = this.element.querySelector('#tournament-bracket');
        bracketContainer.innerHTML = '';
        const numRounds = bracketData.length;
        const roundElements = bracketData.map((round, i) => {
            const roundEl = document.createElement('div');
            roundEl.className = 'bracket-round-column';
            roundEl.id = `round-col-${i}`;
            return roundEl;
        });
        bracketData.forEach((round, roundIndex) => {
            // Create match elements for all but the final winner "round"
            if (roundIndex < numRounds - 1) { 
                for (let i = 0; i < round.length; i += 2) {
                    const matchIndex = i / 2;
                    const p1 = round[i];
                    const p2 = round[i + 1];
                    const winner = bracketData[roundIndex + 1]?.[matchIndex];
                    const matchEl = document.createElement('div');
                    matchEl.className = 'bracket-match';
                    matchEl.id = `match-${roundIndex}-${matchIndex}`;
                    const p1_text = p1 ? p1.aiController : 'TBD';
                    const p2_text = p2 ? p2.aiController : 'BYE';
                    const winner_class = winner && winner.aiController === p1_text ? 'winner' : '';
                    const winner_class_p2 = winner && winner.aiController === p2_text ? 'winner' : '';
                    const loser_class = winner && winner.aiController !== p1_text && p2 ? 'loser' : '';
                    const loser_class_p2 = winner && winner.aiController !== p2_text && p1 ? 'loser' : '';
                    matchEl.innerHTML = `
                        <div class="bracket-player ${!p1 ? 'tbd' : ''} ${winner_class} ${loser_class}">${p1_text}</div>
                        <div class="vs-separator">vs</div>
                        <div class="bracket-player ${!p2 ? 'tbd' : ''} ${winner_class_p2} ${loser_class_p2}">${p2_text}</div>
                    `;
                    roundElements[roundIndex].appendChild(matchEl);
                }
            } else { // Render final winner
                const champion = round[0];
                if(champion) {
                    const winnerEl = document.createElement('div');
                    winnerEl.className = 'bracket-match';
                    winnerEl.innerHTML = `<div class="bracket-player winner">${champion.aiController}</div>`;
                    roundElements[roundIndex].appendChild(winnerEl);
                }
            }
        });
        roundElements.forEach(el => bracketContainer.appendChild(el));
    }
    prepareNextMatch(p1, p2, roundIndex, matchIndex, onSimulate, onWatch) {
        document.querySelectorAll('.bracket-match.next-match').forEach(el => el.classList.remove('next-match'));
        const matchEl = this.element.querySelector(`#match-${roundIndex}-${matchIndex}`);
        if(matchEl) {
            matchEl.classList.add('next-match');
            matchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const controlsContainer = this.element.querySelector('#tournament-controls');
        controlsContainer.style.display = 'block';
        controlsContainer.innerHTML = `
            <h3>UP NEXT:</h3>
            <p class="match-players">${p1.aiController} vs ${p2.aiController}</p>
            <div class="button-group">
                <button id="simulate-match-btn" class="menu-button -solid -cyan">SIMULATE</button>
                <button id="watch-match-btn" class="menu-button -solid -yellow">WATCH</button>
            </div>
        `;
        this.element.querySelector('#simulate-match-btn').onclick = onSimulate;
        this.element.querySelector('#watch-match-btn').onclick = onWatch;
    }
    updateBracket(winner, loser, roundIndex, matchIndex, fullBracketData) {
        const controlsContainer = this.element.querySelector('#tournament-controls');
        controlsContainer.style.display = 'none';
        // Re-render the entire bracket to correctly show winner/loser states and propagation
        this._renderBracket(fullBracketData);
        // Animate the winner propagating
        const nextRoundIndex = roundIndex + 1;
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextMatchEl = this.element.querySelector(`#match-${nextRoundIndex}-${nextMatchIndex}`);
        if (nextMatchEl) {
            const winningPlayerEl = Array.from(nextMatchEl.querySelectorAll('.bracket-player')).find(el => el.textContent === winner.aiController);
            if (winningPlayerEl) {
                winningPlayerEl.classList.add('winner-propagation-animation');
            }
        }
    }
    showPodium(champion, runnerUp, onReplay, onReturn) {
        const bracketContainer = this.element.querySelector('.tournament-bracket-container');
        const controlsContainer = this.element.querySelector('#tournament-controls');
        const podiumContainer = this.element.querySelector('#tournament-podium');
        if(bracketContainer) bracketContainer.style.display = 'none';
        if(controlsContainer) controlsContainer.style.display = 'none';
        podiumContainer.style.display = 'flex';
        podiumContainer.innerHTML = `
            <div class="podium-spot champion">
                <h2>CHAMPION</h2>
                <p>${champion.aiController}</p>
            </div>
            <div class="podium-spot runner-up">
                <h2>Runner-Up</h2>
                <p>${runnerUp ? runnerUp.aiController : 'N/A'}</p>
            </div>
            <div class="podium-actions">
                <button id="replay-final-btn" class="menu-button -solid -yellow">WATCH FINAL</button>
                <button id="return-menu-btn" class="menu-button -solid -grey">RETURN TO MENU</button>
            </div>
        `;
        this.element.querySelector('#replay-final-btn').onclick = onReplay;
        this.element.querySelector('#return-menu-btn').onclick = onReturn;
    }
}