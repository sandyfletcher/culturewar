// menu-manager.js
import Game from './game.js';

class MenuManager {
    constructor() {
        // DOM references
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.timer = document.getElementById('timer');
        
        // Make MenuManager globally accessible for GameState
        window.menuManager = this;
        
        // Track current screen
        this.currentScreen = 'menu';
        
        // Store configuration from menu selections
        this.gameConfig = {
            playerCount: 2, // Default: 1 human + 1 AI
            aiTypes: ['claude1'] // Default AI type
        };
        
        // Initialize the menu
        this.initializeGameMenu();
    }

    // Switch between screens (menu, game, game-over)
    switchToScreen(screenName) {
        // Hide all screens first
        this.menuScreen.style.display = 'none';
        this.gameScreen.style.display = 'none';
        
        // Show the requested screen
        switch(screenName) {
            case 'menu':
                this.menuScreen.style.display = 'flex';
                if (this.timer) this.timer.textContent = 'Select Game Mode';
                break;
            case 'game':
                this.gameScreen.style.display = 'block';
                break;
            case 'gameover':
                // Game over screen is handled separately
                break;
            default:
                console.error('Unknown screen:', screenName);
        }
        
        this.currentScreen = screenName;
    }
    
    // Create and show game over screen
    showGameOver(stats) {
        // Remove existing game over screen if it exists
        const existingScreen = document.getElementById('game-over-screen');
        if (existingScreen) {
            existingScreen.remove();
        }
        
        // Create new game over screen
        const gameOverScreen = document.createElement('div');
        gameOverScreen.id = 'game-over-screen';
        
        // Create content based on game stats
        const isPlayerWinner = stats.playerWon;
        const winner = isPlayerWinner ? 'Player' : 'AI';
        
        gameOverScreen.innerHTML = `
            <h1>${isPlayerWinner ? 'VICTORY!' : 'DEFEAT'}</h1>
            <h2>${winner} has conquered the galaxy</h2>
            <h3>GAME STATISTICS</h3>
            <ul>
                <li>Time played: ${Math.floor(stats.time / 60)}:${(stats.time % 60).toString().padStart(2, '0')}</li>
                <li>Planets conquered: ${stats.planetsConquered || 0}</li>
                <li>Troops sent: ${stats.troopsSent || 0}</li>
                <li>Troops lost: ${stats.troopsLost || 0}</li>
            </ul>
            <button id="play-again-button" class="menu-button">PLAY AGAIN</button>
        `;
        
        // Add to document
        document.getElementById('game-container').appendChild(gameOverScreen);
        
        // Add event listener for play again button
        document.getElementById('play-again-button').addEventListener('click', () => {
            gameOverScreen.remove();
            this.switchToScreen('menu');
        });
    }
    
    // Initialize the game menu
    initializeGameMenu() {
        // Create menu container if it doesn't exist
        let menuContainer = document.querySelector('#menu-screen .menu-container');
        if (!menuContainer) {
            menuContainer = document.createElement('div');
            menuContainer.className = 'menu-container';
            this.menuScreen.appendChild(menuContainer);
        }
        
        // Clear existing menu
        menuContainer.innerHTML = '';
        
        // Create game setup form
        const setupForm = document.createElement('div');
        setupForm.className = 'setup-form';
        
        // Player count selection
        const playerCountContainer = document.createElement('div');
        playerCountContainer.className = 'setup-section';
        
        const playerCountLabel = document.createElement('h2');
        playerCountLabel.textContent = 'OPPONENTS';
        playerCountContainer.appendChild(playerCountLabel);
        
        const playerCountSelect = document.createElement('div');
        playerCountSelect.className = 'player-count-select';
        
        for (let i = 1; i <= 3; i++) {
            const countButton = document.createElement('button');
            countButton.className = 'count-button';
            countButton.textContent = i;
            countButton.dataset.count = i;
            countButton.setAttribute('aria-label', `${i} opponent${i > 1 ? 's' : ''}`);
            countButton.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.count-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Add active class to clicked button
                countButton.classList.add('active');
                
                // Store player count in config
                this.gameConfig.playerCount = parseInt(i) + 1; // +1 for human player
                
                // Update AI selectors
                this.updateAISelectors(i);
            });
            
            // Default to 1 opponent
            if (i === 1) {
                countButton.classList.add('active');
            }
            
            playerCountSelect.appendChild(countButton);
        }
        
        playerCountContainer.appendChild(playerCountSelect);
        setupForm.appendChild(playerCountContainer);
        
        // AI selection container
        const aiSelectionContainer = document.createElement('div');
        aiSelectionContainer.className = 'setup-section';
        aiSelectionContainer.id = 'ai-selection';
        
        setupForm.appendChild(aiSelectionContainer);
        
        // Start game button
        const startButton = document.createElement('button');
        startButton.className = 'menu-button start-game';
        startButton.textContent = 'START GAME';
        startButton.addEventListener('click', () => {
            const opponentCount = document.querySelector('.count-button.active').dataset.count;
            const totalPlayers = parseInt(opponentCount) + 1; // +1 for human player
            
            // Collect AI types for each opponent
            const aiTypes = [];
            for (let i = 1; i <= opponentCount; i++) {
                const aiSelector = document.querySelector(`#ai-type-${i}`);
                aiTypes.push(aiSelector.value);
            }
            
            // Update config
            this.gameConfig.aiTypes = aiTypes;
            this.gameConfig.playerCount = totalPlayers;
            
            // Start the game
            this.startGame();
        });
        
        setupForm.appendChild(startButton);
        menuContainer.appendChild(setupForm);
        
        // Initialize AI selectors with default 1 opponent
        this.updateAISelectors(1);
    }
    
    // Update AI selectors based on opponent count
    updateAISelectors(opponentCount) {
        const aiSelection = document.getElementById('ai-selection');
        aiSelection.innerHTML = '';
        
        // Create a container for the AI selectors
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'ai-selectors-container';
        aiSelection.appendChild(selectorsContainer);
        
        for (let i = 1; i <= opponentCount; i++) {
            const aiContainer = document.createElement('div');
            aiContainer.className = 'ai-selector';
            
            // Create unique ID for the select element
            const selectId = `ai-type-${i}`;
            
            const aiLabel = document.createElement('label');
            aiLabel.htmlFor = selectId;
            aiContainer.appendChild(aiLabel);
            
            const aiSelector = document.createElement('select');
            aiSelector.id = selectId;
            aiSelector.name = selectId;
            aiSelector.setAttribute('aria-label', `Opponent ${i} difficulty`);
            
            // Add AI options with extended list
            const aiTypes = [
                { value: 'claude1', name: 'Claude I' },
                { value: 'claude2', name: 'Claude II' },
                { value: 'claude1a', name: 'Claude III ' },
                { value: 'claude2a', name: 'Claude IV' },
                { value: 'defensive', name: 'Defensive' },
                { value: 'dummy', name: 'Big Dummy' },
                { value: 'advanced', name: 'Claude 0' }
            ];
            
            aiTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.name;
                aiSelector.appendChild(option);
            });
            
            aiContainer.appendChild(aiSelector);
            selectorsContainer.appendChild(aiContainer);
        }
    }
    
    // Start a new game with current configuration
    startGame() {
        // Hide menu and show game
        this.menuScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
        
        // Create new Game instance with the current configuration
        new Game(this.gameConfig.playerCount, this.gameConfig.aiTypes);
    }
    
    // Get current game configuration
    getGameConfig() {
        return this.gameConfig;
    }
}

// Initialize menu when the script loads
const menuManager = new MenuManager();

export default MenuManager;