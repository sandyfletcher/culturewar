import MenuBuilderBase from '../MenuBuilderBase.js';

class MainMenuBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        const menuContainer = this.createMenuContainer();
        const gameModeContainer = document.createElement('div');
        gameModeContainer.className = 'game-mode-container';
        
        // MODIFIED: This array now defines the final 4-button main menu.
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
                id: 'creategame',
                name: 'CREATE GAME',
                description: 'configure and start a new game',
                handler: () => this.parentBuilder.buildGameSetup()
            },
            { 
                id: 'standings', 
                name: 'STANDINGS', 
                description: 'view bot rankings (coming soon)',
                handler: () => this.parentBuilder.buildStandingsScreen()
            },
        ];
        
        options.forEach(option => {
            const modeButton = document.createElement('div');
            modeButton.className = 'game-mode-button';
            modeButton.dataset.mode = option.id;
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

export default MainMenuBuilder;