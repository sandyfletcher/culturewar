// ===========================================
// root/javascript/menus/MainMenuBuilder.js
// ===========================================

import MenuBuilderBase from '../MenuBuilderBase.js';

export default class MainMenuBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        window.menuManager.footerManager.showDefault(); // when main menu is built, ensure footer is set to default
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
                id: 'combatants', 
                name: 'COMBATANTS', 
                description: 'view the available AI bots',
                handler: () => this.parentBuilder.buildCombatantsScreen()
            },
            { 
                id: 'standings', 
                name: 'STANDINGS', 
                description: 'view bot rankings (coming soon)',
                handler: () => this.parentBuilder.buildStandingsScreen()
            },
            { 
                id: 'creategame',
                name: 'CREATE GAME',
                description: 'configure and start a new game',
                handler: () => this.parentBuilder.buildGameSetup(),
                primary: true 
            },
        ];
        options.forEach(option => {
            const modeButton = document.createElement('div');
            modeButton.className = 'game-mode-button';
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