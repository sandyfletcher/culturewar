// ===========================================
// root/javascript/menus/TournamentSetupBuilder.js
// ===========================================

import MenuBuilderBase from '../MenuBuilderBase.js';
import botRegistry from '../bots/index.js';

export default class TournamentSetupBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
        this.selectedBots = new Set();
    }
    build() {
        this.menuManager.uiManager.setHeaderTitle('CREATE TOURNAMENT');
        this.selectedBots.clear(); // reset bots to ensure clean state
        const menuContainer = this.createMenuContainer();
        menuContainer.innerHTML = `
            <div class="instructions-content">
                <p style="text-align: center; margin-bottom: 1rem;">Select the bots to compete in a single-elimination tournament.</p>
                <div id="tournament-bot-list" class="tournament-bot-list"></div>
                <button id="start-tournament-button" class="menu-button start-game" disabled>START TOURNAMENT</button>
            </div>
        `;
        const botListContainer = menuContainer.querySelector('#tournament-bot-list');
        const startButton = menuContainer.querySelector('#start-tournament-button');
        botRegistry.forEach(bot => {
            const botEntry = document.createElement('div');
            botEntry.className = 'tournament-bot-entry';
            botEntry.innerHTML = `
                <input type="checkbox" id="bot-${bot.value}" data-value="${bot.value}">
                <label for="bot-${bot.value}">${bot.name}</label>
            `;
            botListContainer.appendChild(botEntry);
        });
        botListContainer.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const botValue = e.target.dataset.value;
                if (e.target.checked) {
                    this.selectedBots.add(botValue);
                } else {
                    this.selectedBots.delete(botValue);
                }
                startButton.disabled = this.selectedBots.size < 2;
                startButton.textContent = `START TOURNAMENT (${this.selectedBots.size} bots)`;
            }
        });
        startButton.addEventListener('click', () => {
            const participants = Array.from(this.selectedBots).map(value => {
                return { type: 'bot', aiController: value };
            });
            this.menuManager.startTournament(participants);
        });
        this.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }
}