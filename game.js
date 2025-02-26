import { Planet, TroopMovement } from './assets/javascript/entities.js';
import InputHandler from './assets/javascript/inputhandler.js';
import Renderer from './assets/javascript/renderer.js';
import GameState from './assets/javascript/gamestate.js';
import PlayerManager from './assets/javascript/playermanager.js';
import AIManager from './assets/javascript/ai-manager.js';

// Game configuration constants
const PLANET_CONFIG = {
    MIN_DISTANCE: 80,
    MAX_ATTEMPTS: 100,
    NEUTRAL_COUNT: 8,
    MIN_SIZE: 15,
    MAX_SIZE_VARIATION: 20,
    STARTING_PLANET_SIZE: 30,
    STARTING_TROOPS: 30
};

class Game {
    constructor(playerCount = 2, aiTypes = []) {
        // Setup canvas
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Store AI configuration
        this.aiTypes = aiTypes;
        
        // Implement debounced resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 100);
        });
        
        // Game entities
        this.planets = [];
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.mousePos = { x: 0, y: 0 };
        
        // Reference to entity constructors for other modules
        this.Planet = Planet;
        this.TroopMovement = TroopMovement;
        
        // Game state
        this.gameOver = false;
        
        // Initialize modules in correct order
        this.playerManager = new PlayerManager(this, playerCount, this.aiTypes);
        this.inputHandler = new InputHandler(this);
        this.renderer = new Renderer(this);
        this.gameState = new GameState(this);
        this.aiManager = new AIManager(this);
        
        // Initialize game
        this.generatePlanets(playerCount);
        this.gameLoop();
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    // Clear all planet selections
    clearSelection() {
        for (const planet of this.planets) {
            planet.selected = false;
        }
        this.selectedPlanets = [];
    }
    
    generatePlanets(playerCount) {
        // Get player IDs
        const humanPlayer = this.playerManager.getHumanPlayers()[0].id;
        const aiPlayers = this.playerManager.getAIPlayers().map(player => player.id);
        
        // Generate starting planet positions based on player count
        this.generatePlayerPlanets(humanPlayer, aiPlayers, playerCount);
        
        // Generate neutral planets
        this.generateNeutralPlanets();
    }
    
    generatePlayerPlanets(humanPlayer, aiPlayers, playerCount) {
        // Calculate positions based on canvas dimensions for better adaptability
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Player's starting planet - lower left quadrant
        const playerPlanet = new Planet(
            width * 0.2,
            height * 0.8,
            PLANET_CONFIG.STARTING_PLANET_SIZE,
            PLANET_CONFIG.STARTING_TROOPS,
            humanPlayer,
            this
        );
        this.planets.push(playerPlanet);

        // AI starting planets
        for (let i = 0; i < aiPlayers.length; i++) {
            let position;
            
            // Position AI planets based on player count
            if (playerCount === 2) {
                // 2 players: AI in upper right
                position = { x: width * 0.8, y: height * 0.2 };
            } else if (playerCount === 3) {
                // 3 players: AIs in upper right and lower right
                position = (i === 0) 
                    ? { x: width * 0.8, y: height * 0.2 } 
                    : { x: width * 0.8, y: height * 0.8 };
            } else if (playerCount === 4) {
                // Add support for 4 players in preparation for multiplayer
                const positions = [
                    { x: width * 0.8, y: height * 0.2 },
                    { x: width * 0.2, y: height * 0.2 },
                    { x: width * 0.8, y: height * 0.8 }
                ];
                position = positions[i % positions.length];
            }
            
            const aiPlanet = new Planet(
                position.x,
                position.y,
                PLANET_CONFIG.STARTING_PLANET_SIZE,
                PLANET_CONFIG.STARTING_TROOPS,
                aiPlayers[i],
                this
            );
            this.planets.push(aiPlanet);
        }
    }
    
    generateNeutralPlanets() {
        for (let i = 0; i < PLANET_CONFIG.NEUTRAL_COUNT; i++) {
            let attempts = 0;
            let valid = false;
            
            while (!valid && attempts < PLANET_CONFIG.MAX_ATTEMPTS) {
                const size = PLANET_CONFIG.MIN_SIZE + Math.random() * PLANET_CONFIG.MAX_SIZE_VARIATION;
                const x = size + Math.random() * (this.canvas.width - size * 2);
                const y = size + Math.random() * (this.canvas.height - size * 2);
                
                valid = this.isValidPlanetPosition(x, y, size);
                
                if (valid) {
                    // Each neutral planet starts with troops proportional to its size
                    const startingTroops = Math.floor(size / 3);
                    this.planets.push(new Planet(x, y, size, startingTroops, 'neutral', this));
                    break;
                }
                attempts++;
            }
        }
    }

    isValidPlanetPosition(x, y, size) {
        for (const planet of this.planets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < PLANET_CONFIG.MIN_DISTANCE) {
                return false;
            }
        }
        return true;
    }
    
    update() {
        if (this.gameOver) return;

        const now = Date.now();
        const dt = (now - this.gameState.lastUpdate) / 1000; // Convert to seconds
        this.gameState.lastUpdate = now;

        // Update game state (timer, win conditions)
        this.gameState.update(dt);
        
        // If game is now over, stop updating
        if (this.gameOver) return;

        // Update planet troops
        this.updatePlanets(dt);

        // Update troop movements
        this.updateTroopMovements(dt);

        // Let AI make decisions
        this.aiManager.updateAIs(dt);
    }
    
    updatePlanets(dt) {
        const humanPlayerId = this.playerManager.getHumanPlayers()[0].id;
        
        for (const planet of this.planets) {
            planet.update(dt);
            
            // If a planet changes ownership, it should not remain selected
            if (planet.selected && planet.owner !== humanPlayerId) {
                planet.selected = false;
                this.selectedPlanets = this.selectedPlanets.filter(p => p !== planet);
            }
        }
    }
    
    updateTroopMovements(dt) {
        for (let i = this.troopMovements.length - 1; i >= 0; i--) {
            const movement = this.troopMovements[i];
            if (movement.update(dt)) {
                // Troops have arrived
                this.processTroopArrival(movement);
                this.troopMovements.splice(i, 1);
                
                // After troop movements complete, check win conditions again
                this.gameState.checkWinConditions();
            }
        }
    }
    
    processTroopArrival(movement) {
        const targetPlanet = movement.to;
        if (targetPlanet.owner === movement.owner) {
            // Reinforcing owned planet
            targetPlanet.troops += movement.amount;
        } else {
            // Attacking enemy planet
            targetPlanet.troops -= movement.amount;
            if (targetPlanet.troops < 0) {
                // Capture planet if troops < 0
                targetPlanet.owner = movement.owner;
                targetPlanet.troops = Math.abs(targetPlanet.troops);
            }
        }
    }
    
    gameLoop() {
        this.update();
        this.renderer.draw();
        if (!this.gameOver) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Initialize the game menu
function initializeGameMenu() {
    const menuScreen = document.getElementById('menu-screen');
    const gameScreen = document.getElementById('game-screen');
    
    // Create menu container if it doesn't exist
    let menuContainer = document.querySelector('#menu-screen .menu-container');
    if (!menuContainer) {
        menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        menuScreen.appendChild(menuContainer);
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
            
            // Show AI selection based on player count
            updateAISelectors(i);
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
    
    // AI selection slots will be added dynamically
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
        
        // Start the game with selected configuration
        menuScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        
        new Game(totalPlayers, aiTypes);
    });
    
    setupForm.appendChild(startButton);
    menuContainer.appendChild(setupForm);
    
    // Initialize AI selectors with default 1 opponent
    updateAISelectors(1);
    
// Modify only the AI selection part in the initializeGameMenu function
function updateAISelectors(opponentCount) {
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
            { value: 'dummy', name: 'Big Dummy)' },
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
}

// Initialize menu when the script loads
initializeGameMenu();

export default Game;