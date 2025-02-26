// menu-manager.js
class MenuManager {
    constructor() {
        // DOM references
        this.menuScreen = document.getElementById('menu-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.timer = document.getElementById('timer');
        
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
                this.timer.textContent = 'Select Game Mode';
                break;
            case 'game':
                this.gameScreen.style.display = 'block';
                break;
            case 'gameover':
                this.showGameOverScreen();
                break;
            default:
                console.error('Unknown screen:', screenName);
        }
        
        this.currentScreen = screenName;
    }
    
    // Create and show game over screen
    showGameOverScreen(gameStats = {}) {
        // Remove existing game over screen if it exists
        const existingScreen = document.getElementById('game-over-screen');
        if (existingScreen) {
            existingScreen.remove();
        }
        
        // Create new game over screen
        const gameOverScreen = document.createElement('div');
        gameOverScreen.id = 'game-over-screen';
        
        // Create content based on game stats
        const winner = gameStats.winner || 'Unknown';
        const isPlayerWinner = gameStats.isPlayerWinner || false;
        
        gameOverScreen.innerHTML = `
            <h1>${isPlayerWinner ? 'VICTORY!' : 'DEFEAT'}</h1>
            <h2>${winner} has conquered the galaxy</h2>
            <h3>GAME STATISTICS</h3>
            <ul>
                ${this.generateStatsHTML(gameStats)}
            </ul>
            <button id="play-again-button" class="menu-button">PLAY AGAIN</button>
        `;
        
        // Add to document
        document.body.appendChild(gameOverScreen);
        
        // Add event listener for play again button
        document.getElementById('play-again-button').addEventListener('click', () => {
            gameOverScreen.remove();
            this.switchToScreen('menu');
        });
    }
    
    // Generate HTML for game statistics
    generateStatsHTML(gameStats) {
        if (!gameStats.players) return '<li>No statistics available</li>';
        
        return gameStats.players.map(player => {
            return `<li style="color: ${player.color}">
                ${player.name}: ${player.planets} planets, ${player.troops} troops
            </li>`;
        }).join('');
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
                this.gameConfig.playerCount = i + 1; // +1 for human player
                
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
            // Collect AI types for each opponent
            const aiTypes = [];
            for (let i = 1; i <= this.gameConfig.playerCount - 1; i++) {
                const aiSelector = document.querySelector(`#ai-type-${i}`);
                aiTypes.push(aiSelector.value);
            }
            
            // Update config
            this.gameConfig.aiTypes = aiTypes;
            
            // Switch to game screen
            this.switchToScreen('game');
            
            // Start the game with selected configuration
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
            
            // Add AI options
            const aiTypes = [
                { value: 'claude1', name: 'Claude I' },
                { value: 'claude2', name: 'Claude II' },
                { value: 'claude1a', name: 'Claude III' },
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
        const playerCount = this.gameConfig.playerCount;
        const aiTypes = this.gameConfig.aiTypes;
        
        // Create a new Game instance with the current configuration
        // This assumes Game is available globally
        new Game(playerCount, aiTypes);
    }
    
    // Get current game configuration
    getGameConfig() {
        return this.gameConfig;
    }
}

export default MenuManager;