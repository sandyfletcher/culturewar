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
        
        // MODIFIED: All options now lead to a more specific screen or are consolidated.
        const options = [
            { 
                id: 'creategame', // NEW ID
                name: 'CREATE GAME', // NEW NAME
                description: 'configure and start a new game',
                available: true,
                handler: () => this.parentBuilder.buildGameSetup() // MODIFIED: No argument needed.
            },
            { 
                id: 'instructions', 
                name: 'INSTRUCTIONS', 
                description: 'how to play the game',
                available: true,
                handler: () => this.parentBuilder.buildInstructionsScreen()
            },
            { 
                id: 'botbattle', 
                name: 'SPECTATE', // Changed from BATTLEBOTS for clarity
                description: 'watch AI battle each other',
                available: true,
                handler: () => {
                    // NEW: A shortcut to a bot-only game setup.
                    this.configManager.setPlayerCount(config.menuDefaults.playerCountRange[0]);
                    this.configManager.gameConfig.players.forEach((_, index) => {
                        this.configManager.updatePlayerConfig(index, { type: 'bot' });
                    });
                    this.parentBuilder.buildGameSetup();
                }
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