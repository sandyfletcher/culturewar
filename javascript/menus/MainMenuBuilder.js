import MenuBuilderBase from '../MenuBuilderBase.js';

class MainMenuBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        const menuContainer = this.createMenuContainer();
        // Create game mode buttons
        const gameModeContainer = document.createElement('div');
        gameModeContainer.className = 'game-mode-container';
        // Define all main menu options
        const options = [
            { 
                id: 'instructions', 
                name: 'INSTRUCTIONS', 
                description: 'how to play the game',
                available: true,
                handler: () => this.parentBuilder.buildInstructionsScreen()
            },
            { 
                id: 'botbattle', 
                name: 'BATTLEBOTS', 
                description: 'AI against AI',
                available: true,
                handler: () => this.parentBuilder.buildGameSetup('botbattle')
            },
            { 
                id: 'singleplayer', 
                name: 'SINGLE PLAYER', 
                description: 'You against AI',
                available: true,
                handler: () => this.parentBuilder.buildGameSetup('singleplayer')
            },
        ];
        // Create and append each button
        options.forEach(option => {
            const modeButton = document.createElement('div');
            modeButton.className = 'game-mode-button';
            modeButton.dataset.mode = option.id;
            if (!option.available) {
                modeButton.classList.add('coming-soon');
            }
            modeButton.innerHTML = `
                <h3>${option.name}</h3>
                <p>${option.description}</p>
                ${option.available ? '' : '<span class="badge">SOON</span>'}
            `;
            if (option.available && option.handler) {
                modeButton.addEventListener('click', option.handler);
            }
            gameModeContainer.appendChild(modeButton);
        });
        menuContainer.appendChild(gameModeContainer);
        return menuContainer;
    }
}

export default MainMenuBuilder;