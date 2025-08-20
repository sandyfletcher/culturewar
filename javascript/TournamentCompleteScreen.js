import botRegistry from './bots/index.js';

export default class TournamentCompleteScreen {
    constructor(container) {
        this.container = container;
    }
    show(data, onReplay, onReturn) {
        this.container.style.display = 'flex';
        this.container.innerHTML = ''; // clear previous content
        const { champion, finalMatchConfig } = data;
        const botInfo = botRegistry.find(b => b.value === champion.aiController);
        const championName = botInfo ? botInfo.name : champion.aiController;
        this.container.innerHTML = `
            <div class="tournament-complete-content">
                <h1>TOURNAMENT COMPLETE</h1>
                <h2>CHAMPION: ${championName.toUpperCase()}</h2>
                <div class="game-over-buttons tournament-complete-buttons">
                    <button id="tournament-replay-button" class="game-mode-button primary-action"><h3>WATCH FINAL MATCH</h3></button>
                    <button id="tournament-return-button" class="game-mode-button"><h3>RETURN TO MENU</h3></button>
                </div>
            </div>
        `;
        const replayButton = this.container.querySelector('#tournament-replay-button');
        const returnButton = this.container.querySelector('#tournament-return-button');
        if (finalMatchConfig && replayButton) {
            replayButton.addEventListener('click', onReplay, { once: true });
        } else if (replayButton) {
            replayButton.disabled = true;
            replayButton.innerHTML = '<h3>FINAL NOT AVAILABLE</h3>';
        }
        if (returnButton) {
            returnButton.addEventListener('click', onReturn, { once: true });
        }
    }
    hide() {
        this.container.style.display = 'none';
    }
}