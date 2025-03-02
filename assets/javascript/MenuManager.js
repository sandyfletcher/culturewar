import Game from '../../game.js';
import GameOverScreen from './GameOverScreen.js';

class MenuManager {
    constructor() {
        // DOM references
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.timer = document.getElementById('timer');
        
        // Make MenuManager globally accessible for GameState
        window.menuManager = this;
        
        // Create game over screen instance
        this.gameOverScreen = new GameOverScreen(document.getElementById('inner-container'));
        
        // Track current screen
        this.currentScreen = 'menu';
        
        // AI Types - single source of truth
        this.aiOptions = [
            { value: 'Claude1', name: 'Claude1' },
            { value: 'Claude2', name: 'Claude2' },
            { value: 'Claude3', name: 'Claude3' },
            { value: 'Claude4', name: 'Claude4' },
            { value: 'Claude5', name: 'Claude5' },
            { value: 'Claude6', name: 'Claude6' },
            { value: 'Defensive', name: 'Defensive' },
            { value: 'AGGRESSIVE', name: 'AGGRESSIVE' },
            { value: 'Dummy', name: 'Dummy' },
        ];
        
        // Player colors for AI selection
        this.playerColors = {
            'player1': '#ffff00', // Yellow
            'player2': '#ff0000', // Red
            'player3': '#00ffff', // Cyan
            'player4': '#00ff00', // Green
            'player5': '#ff00ff', // Magenta/Purple
            'player6': '#ff8000', // Orange
        };
        
        // Store configuration from menu selections
        this.gameConfig = {
            gameMode: 'singleplayer', // Default game mode
            playerCount: 2, // Default: 1 human + 1 AI
            aiTypes: ['Claude1'], // Default AI type
            botBattleCount: 2 // Default number of AI players in bot battle
        };
        
        // Initialize the menu
        this.initializeMainMenu();
    }

    // Switch between screens (menu, game, game-over)
    switchToScreen(screenName) {
        // Hide all screens first
        this.menuScreen.style.display = 'none';
        this.gameScreen.style.display = 'none';
        
        // Remove game over screen if it exists
        this.gameOverScreen.remove();
        
        // Update footer based on screen
        const timerElement = document.getElementById('timer');
        if (screenName === 'game') {
            // During game, timer will be updated by GameState
            timerElement.innerHTML = '';
        } else {
            // On menu or game over screens, show site credit with link
            timerElement.innerHTML = '<a href="https://sandyfletcher.ca" target="_blank">site by sandy</a>';
        }
        
        // Show the requested screen
        switch(screenName) {
            case 'menu':
                this.menuScreen.style.display = 'flex';
                // Hide troop tracker when returning to menu
                if (this.game && this.game.troopTracker) {
                    this.game.troopTracker.hideTroopBar();
                }
                break;
            case 'game':
                this.gameScreen.style.display = 'block';
                break;
            case 'gameover':
                // Game over screen is handled separately by GameOverScreen
                // Hide troop tracker when game is over
                if (this.game && this.game.troopTracker) {
                    this.game.troopTracker.hideTroopBar();
                }
                break;
            default:
                console.error('Unknown screen:', screenName);
        }
        
        this.currentScreen = screenName;
    }
    
    // Create and show game over screen with leaderboard
    showGameOver(stats, gameInstance) {
        this.game = gameInstance;
        
        // Update footer to show site credit
        const timerElement = document.getElementById('timer');
        timerElement.innerHTML = '<a href="https://sandyfletcher.ca" target="_blank">site by sandy</a>';
        
        // Hide troop tracker when game is over
        if (gameInstance && gameInstance.troopTracker) {
            gameInstance.troopTracker.hideTroopBar();
        }
        
        // Use the GameOverScreen instance to show the game over screen
        this.gameOverScreen.show(stats, gameInstance);
    }

    // Helper method to format time in MM:SS format
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // Helper method to get friendly display name for players - kept for backward compatibility
    getPlayerDisplayName(player) {
        if (!player.isAI) {
            return 'Player';
        }
        
        // Find the matching AI option to get the display name
        const aiOption = this.aiOptions.find(option => option.value === player.aiController);
        return aiOption ? aiOption.name : player.aiController;
    }
    
    // Initialize the main menu with game mode selection
    initializeMainMenu() {
        const menuContainer = this.getOrCreateMenuContainer();
        
        // Clear existing menu
        menuContainer.innerHTML = '';
        
        // Create game mode buttons
        const gameModes = [
            { id: 'botbattle', name: 'BOT BATTLE', description: 'Pit AI against each other' },
            { id: 'singleplayer', name: 'SINGLE PLAYER', description: 'Battle the AI' },
            { id: 'multiplayer', name: 'MULTIPLAYER', description: 'Battle other humans' }
        ];
        
        const gameModeContainer = document.createElement('div');
        gameModeContainer.className = 'game-mode-container';
        
        gameModes.forEach(mode => {
            const modeButton = document.createElement('div');
            modeButton.className = 'game-mode-button';
            modeButton.dataset.mode = mode.id;
            
            // Bot Battle is now available, Single Player is available, but Multiplayer isn't
            const isAvailable = mode.id === 'singleplayer' || mode.id === 'botbattle';
            if (!isAvailable) {
                modeButton.classList.add('coming-soon');
            }
            
            modeButton.innerHTML = `
                <h3>${mode.name}</h3>
                <p>${mode.description}</p>
                ${isAvailable ? '' : '<span class="badge">COMING SOON</span>'}
            `;
            
            modeButton.addEventListener('click', () => {
                if (isAvailable) {
                    this.gameConfig.gameMode = mode.id;
                    this.showGameSetup(mode.id);
                }
            });
            
            gameModeContainer.appendChild(modeButton);
        });
        
        menuContainer.appendChild(gameModeContainer);
    }
    
    // Helper to get or create menu container
    getOrCreateMenuContainer() {
        let menuContainer = document.querySelector('#menu-screen .menu-container');
        if (!menuContainer) {
            menuContainer = document.createElement('div');
            menuContainer.className = 'menu-container';
            this.menuScreen.appendChild(menuContainer);
        }
        return menuContainer;
    }
    
    // Show game setup screen based on selected mode
    showGameSetup(gameMode) {
        const menuContainer = this.getOrCreateMenuContainer();
        
        // Clear existing menu
        menuContainer.innerHTML = '';
        
        // Add back button styled like a menu button
        const backButton = document.createElement('button');
        backButton.className = 'menu-button back-button';
        backButton.textContent = '← BACK';
        backButton.addEventListener('click', () => {
            this.initializeMainMenu();
        });
        menuContainer.appendChild(backButton);
        
        // Create appropriate setup form based on game mode
        switch(gameMode) {
            case 'singleplayer':
                this.createGameSetup(menuContainer, 1, 5, 'OPPONENTS', 'START GAME', false);
                break;
            case 'botbattle':
                this.createGameSetup(menuContainer, 2, 6, 'NUMBER OF BOTS', 'START BATTLE', true);
                break;
            case 'multiplayer':
                // Multiplayer setup would go here when implemented
                break;
        }
    }
    
    // Unified game setup for both singleplayer and bot battle
    createGameSetup(menuContainer, minCount, maxCount, countLabel, startButtonText, isBotBattle) {
        const setupForm = document.createElement('div');
        setupForm.className = 'setup-form';
        
        // Create a container for the header part (title and player count selection)
        const headerContainer = document.createElement('div');
        headerContainer.className = 'setup-header';
        
        // Count selection title
        const countLabelElement = document.createElement('h2');
        countLabelElement.textContent = countLabel;
        countLabelElement.className = 'setup-title';
        headerContainer.appendChild(countLabelElement);
        
        // Count selection circles
        const countSelect = document.createElement('div');
        countSelect.className = 'player-count-select';
        
        for (let i = minCount; i <= maxCount; i++) {
            const countButton = document.createElement('button');
            countButton.className = 'count-button';
            countButton.textContent = i;
            countButton.dataset.count = i;
            countButton.setAttribute('aria-label', `${i} ${isBotBattle ? 'bots' : 'opponent' + (i > 1 ? 's' : '')}`);
            countButton.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.count-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Add active class to clicked button
                countButton.classList.add('active');
                
                // Store count in config
                if (isBotBattle) {
                    this.gameConfig.botBattleCount = parseInt(i);
                } else {
                    this.gameConfig.playerCount = parseInt(i) + 1; // +1 for human player
                }
                
                // Update AI selectors
                this.updateEntitySelectors(i, isBotBattle);
            });
            
            // Set default selected
            if (i === minCount) {
                countButton.classList.add('active');
            }
            
            countSelect.appendChild(countButton);
        }
        
        headerContainer.appendChild(countSelect);
        setupForm.appendChild(headerContainer);
        
        // AI/Bot selection container
        const selectionContainer = document.createElement('div');
        selectionContainer.className = 'setup-section ai-selection-container';
        selectionContainer.id = isBotBattle ? 'bot-selection' : 'ai-selection';
        setupForm.appendChild(selectionContainer);
        
        // Bottom button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'setup-buttons';
        
        // Back button
        const backButton = document.createElement('button');
        backButton.className = 'menu-button back-button';
        backButton.textContent = '← BACK';
        backButton.addEventListener('click', () => {
            this.initializeMainMenu();
        });
        buttonContainer.appendChild(backButton);
        
        // Start button
        const startButton = document.createElement('button');
        startButton.className = 'menu-button start-game';
        startButton.textContent = startButtonText;
        startButton.addEventListener('click', () => {
            const count = document.querySelector('.count-button.active').dataset.count;
            
            // Collect AI types
            const aiTypes = [];
            for (let i = 1; i <= count; i++) {
                const selector = document.querySelector(`#${isBotBattle ? 'bot' : 'ai'}-type-${i}`);
                aiTypes.push(selector.value);
            }
            
            // Update config
            this.gameConfig.aiTypes = aiTypes;
            this.gameConfig.playerCount = isBotBattle ? parseInt(count) : parseInt(count) + 1;
            
            // Start the game
            this.startGame();
        });
        
        buttonContainer.appendChild(startButton);
        setupForm.appendChild(buttonContainer);
        
        // Remove the back button we initially added outside the form
        const oldBackButton = menuContainer.querySelector('.back-button');
        if (oldBackButton) {
            oldBackButton.remove();
        }
        
        menuContainer.appendChild(setupForm);
        
        // Initialize selectors with default count
        this.updateEntitySelectors(minCount, isBotBattle);
    }

    // Unified method to update AI/Bot selectors
    updateEntitySelectors(count, isBotBattle) {
        const selectionId = isBotBattle ? 'bot-selection' : 'ai-selection';
        const selectionContainer = document.getElementById(selectionId);
        selectionContainer.innerHTML = '';
        
        // Create a container for the selectors
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'ai-selectors-container';
        
        // Add a small title for the selectors
        const selectorsTitle = document.createElement('h3');
        selectorsTitle.textContent = isBotBattle ? 'BOT TYPES' : 'OPPONENT TYPES';
        selectorsTitle.className = 'selectors-title';
        selectorsContainer.appendChild(selectorsTitle);
        
        for (let i = 1; i <= count; i++) {
            const container = document.createElement('div');
            container.className = 'ai-selector';
            
            // Create unique ID for the select element
            const selectId = `${isBotBattle ? 'bot' : 'ai'}-type-${i}`;
            
            // Create colored circle with number instead of text label
            const playerNumber = isBotBattle ? i : i;
            const playerColor = this.playerColors[`player${playerNumber}`];
            
            const circleLabel = document.createElement('div');
            circleLabel.className = 'player-circle';
            circleLabel.style.backgroundColor = playerColor;
            circleLabel.innerHTML = `<span>${playerNumber}</span>`;
            
            container.appendChild(circleLabel);
            
            const selector = document.createElement('select');
            selector.id = selectId;
            selector.name = selectId;
            selector.setAttribute('aria-label', isBotBattle ? 
                `Bot ${i} type` : 
                `Opponent ${i} difficulty`);
            
            // Add AI options from the central aiOptions array
            this.aiOptions.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.name;
                selector.appendChild(option);
            });
            
            container.appendChild(selector);
            selectorsContainer.appendChild(container);
        }
        
        selectionContainer.appendChild(selectorsContainer);
    }

    // Start a new game with current configuration
    startGame() {
        // Hide menu and show game
        this.menuScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
        
        // Create new Game instance with the current configuration
        switch(this.gameConfig.gameMode) {
            case 'singleplayer':
                new Game(this.gameConfig.playerCount, this.gameConfig.aiTypes);
                break;
            case 'botbattle':
                new Game(this.gameConfig.botBattleCount, this.gameConfig.aiTypes, true);
                break;
            case 'multiplayer':
                // Handle multiplayer mode when implemented
                break;
        }
    }
    
    // Get current game configuration
    getGameConfig() {
        return this.gameConfig;
    }
}

// Initialize menu when the script loads
const menuManager = new MenuManager();

export default MenuManager;