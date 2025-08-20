// ===========================================
// root/javascript/menus/MainMenuBuilder.js (MODIFIED)
// ===========================================

import MenuBuilderBase from './MenuBuilderBase.js';

export default class MainMenuBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        this.menuManager.uiManager.setHeaderTitle('CULTURE WAR');
        this.menuManager.footerManager.showDefault(); // when main menu is built, ensure footer is set to default
        const menuContainer = this.createMenuContainer();
        const gameModeContainer = document.createElement('div');
        gameModeContainer.className = 'game-mode-container';
        const options = [
            { 
                id: 'instructions', 
                name: 'INSTRUCTIONS', 
                description: 'how to play the game',
                handler: () => this.parentBuilder.buildInstructionsScreen()
            },
            {
                id: 'replays',
                name: 'REPLAYS',
                description: 'watch saved matches',
                handler: () => this.parentBuilder.buildReplaysScreen()
            },
            { 
                id: 'standings', 
                name: 'STANDINGS', 
                description: 'track bot rankings',
                handler: () => this.parentBuilder.buildStandingsScreen()
            },
            { 
                id: 'creategame',
                name: 'CREATE GAME',
                description: 'configure and start game',
                handler: () => this.parentBuilder.buildGameSetup(),
                primary: true 
            },
            {
                id: 'tournament',
                name: 'CREATE TOURNAMENT',
                description: 'pit bots against each other',
                handler: () => this.parentBuilder.buildTournamentSetup()
            },
        ];
        options.forEach(option => {
            const modeButton = document.createElement('div');
            modeButton.className = 'mode-button';
            modeButton.dataset.mode = option.id;
            if (option.primary) {
                modeButton.classList.add('primary-action');
            }
            modeButton.innerHTML = `
                <h3>${option.name}</h3>
                <p>${option.description}</p>
            `;
            modeButton.addEventListener('click', option.handler);
            gameModeContainer.appendChild(modeButton);
        });
        menuContainer.appendChild(gameModeContainer);
        return menuContainer;
    }
}