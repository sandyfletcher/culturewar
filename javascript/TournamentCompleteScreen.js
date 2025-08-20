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
                <h2>CHAMPION: ${championName.toUpperCase()}</h2>
                <div class="game-over-buttons"> 
                    <button id="play-again-button">WATCH FINAL</button>
                    <button id="tournament-return-button">RETURN TO MENU</button>
                </div>
            </div>
        `;
        const replayButton = this.container.querySelector('#play-again-button');
        const returnButton = this.container.querySelector('#tournament-return-button');
        if (finalMatchConfig && replayButton) {
            replayButton.addEventListener('click', onReplay, { once: true });
        } else if (replayButton) {
            replayButton.disabled = true;
            replayButton.textContent = 'FINAL NOT AVAILABLE';
        }
        if (returnButton) {
            returnButton.addEventListener('click', onReturn, { once: true });
        }
    }
    hide() {
        this.container.style.display = 'none';
    }
}