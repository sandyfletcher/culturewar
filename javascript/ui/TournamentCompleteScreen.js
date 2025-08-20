import botRegistry from '../bots/index.js';

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
                    <button class="menu-button -solid -yellow" id="replay-final-button">WATCH FINAL</button>
                    <button class="menu-button -solid -grey" id="return-to-menu-button">RETURN TO MENU</button>
                </div>
            </div>
        `;
        const replayButton = this.container.querySelector('#replay-final-button');
        const returnButton = this.container.querySelector('#return-to-menu-button');
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