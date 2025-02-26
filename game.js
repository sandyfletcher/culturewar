import { Planet, TroopMovement } from './entities.js';
import InputHandler from './inputhandler.js';
import Renderer from './renderer.js';
import GameState from './gamestate.js';
import PlayerManager from './playermanager.js';
import AIManager from './ai-manager.js';

class Game {
    constructor(playerCount = 2) {
        // Setup canvas
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Game entities
        this.planets = [];
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.mousePos = { x: 0, y: 0 };
        
        // Reference to entity constructors for other modules
        this.Planet = Planet;
        this.TroopMovement = TroopMovement;
        
        // Debug log setup
        this.setupDebugLog();
        
        // Game state
        this.gameOver = false;
        
        // Initialize modules in correct order
        this.playerManager = new PlayerManager(this, playerCount);
        this.inputHandler = new InputHandler(this);
        this.renderer = new Renderer(this);
        this.gameState = new GameState(this);
        this.aiManager = new AIManager(this);
        
        // Initialize game
        this.generatePlanets(playerCount);
        this.gameLoop();
        
        console.log(`Game initialized with ${playerCount} players`);
    }
    
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    
    setupDebugLog() {
        this.debugLog = document.createElement('div');
        this.debugLog.id = 'debug-log';
        this.debugLog.style.position = 'absolute';
        this.debugLog.style.top = '50px';
        this.debugLog.style.left = '10px';
        this.debugLog.style.color = '#fff';
        this.debugLog.style.fontSize = '10px';
        this.debugLog.style.fontFamily = 'monospace';
        this.debugLog.style.textAlign = 'left';
        this.debugLog.style.pointerEvents = 'none';
        document.getElementById('game-screen').appendChild(this.debugLog);
    }
    
    // Debug logging function
    log(message) {
        console.log(message);
        // Logging to DOM disabled
    }
    
    // Clear all planet selections
    clearSelection() {
        for (const planet of this.planets) {
            planet.selected = false;
        }
        this.selectedPlanets = [];
    }
    
    generatePlanets(playerCount) {
        const humanPlayer = this.playerManager.getHumanPlayers()[0].id;
        const aiPlayers = this.playerManager.getAIPlayers().map(player => player.id);
        
        // Player's starting planet
        const playerPlanet = new Planet(
            this.canvas.width * 0.2,
            this.canvas.height * 0.8,
            30,
            30,
            humanPlayer,
            this
        );
        this.planets.push(playerPlanet);

        // AI starting planets
        for (let i = 0; i < aiPlayers.length; i++) {
            let x, y;
            
            // Position AI planets based on player count
            if (playerCount === 2) {
                x = this.canvas.width * 0.8;
                y = this.canvas.height * 0.2;
            } else if (playerCount === 3) {
                if (i === 0) {
                    x = this.canvas.width * 0.8;
                    y = this.canvas.height * 0.2;
                } else {
                    x = this.canvas.width * 0.8;
                    y = this.canvas.height * 0.8;
                }
            }
            
            const aiPlanet = new Planet(
                x,
                y,
                30,
                30,
                aiPlayers[i],
                this
            );
            this.planets.push(aiPlanet);
        }

        // Generate neutral planets
        for (let i = 0; i < 8; i++) {
            let attempts = 0;
            let valid = false;
            
            while (!valid && attempts < 100) {
                const size = 15 + Math.random() * 20;
                const x = size + Math.random() * (this.canvas.width - size * 2);
                const y = size + Math.random() * (this.canvas.height - size * 2);
                
                valid = this.isValidPlanetPosition(x, y, size);
                
                if (valid) {
                    this.planets.push(new Planet(x, y, size, 10, 'neutral', this));
                    break;
                }
                attempts++;
            }
        }
    }

    isValidPlanetPosition(x, y, size) {
        const minDistance = 80; // Minimum distance between planet centers
        
        for (const planet of this.planets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
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
        for (const planet of this.planets) {
            planet.update(dt);
            
            // If a planet changes ownership, it should not remain selected
            if (planet.selected && planet.owner !== this.playerManager.getHumanPlayers()[0].id) {
                planet.selected = false;
                this.selectedPlanets = this.selectedPlanets.filter(p => p !== planet);
            }
        }

        // Update troop movements
        for (let i = this.troopMovements.length - 1; i >= 0; i--) {
            const movement = this.troopMovements[i];
            if (movement.update(dt)) {
                // Troops have arrived
                const targetPlanet = movement.to;
                if (targetPlanet.owner === movement.owner) {
                    targetPlanet.troops += movement.amount;
                } else {
                    targetPlanet.troops -= movement.amount;
                    if (targetPlanet.troops < 0) {
                        targetPlanet.owner = movement.owner;
                        targetPlanet.troops = Math.abs(targetPlanet.troops);
                    }
                }
                this.troopMovements.splice(i, 1);
                
                // After troop movements complete, check win conditions again
                this.gameState.checkWinConditions();
            }
        }

        // Let AI make decisions
        this.aiManager.updateAIs(dt);
    }
    
    gameLoop() {
        this.update();
        this.renderer.draw();
        if (!this.gameOver) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Remove the previously added buttons if they exist
const removeButtonIfExists = (id) => {
    const button = document.getElementById(id);
    if (button) button.remove();
};

removeButtonIfExists('two-player-button');
removeButtonIfExists('three-player-button');

// Initialize game when the Begin button is clicked
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const menuContainer = document.querySelector('#menu-screen .menu-container');

// If menu container doesn't exist, create it
if (!menuContainer) {
    const newMenuContainer = document.createElement('div');
    newMenuContainer.className = 'menu-container';
    menuScreen.appendChild(newMenuContainer);
}

const container = menuContainer || document.querySelector('#menu-screen .menu-container');

// Create buttons for game modes
const twoPlayerButton = document.createElement('button');
twoPlayerButton.id = 'two-player-button';
twoPlayerButton.className = 'menu-button';
twoPlayerButton.textContent = '2 PLAYER MODE';

const threePlayerButton = document.createElement('button');
threePlayerButton.id = 'three-player-button';
threePlayerButton.className = 'menu-button';
threePlayerButton.textContent = '3 PLAYER MODE';

// Add buttons to the container
container.appendChild(twoPlayerButton);
container.appendChild(threePlayerButton);

// Add event listeners
twoPlayerButton.addEventListener('click', () => {
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    new Game(2); // Pass player count to constructor
});

threePlayerButton.addEventListener('click', () => {
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    new Game(3); // Pass player count to constructor
});

// For backward compatibility, handle the begin button if it exists
const beginButton = document.getElementById('begin-button');
if (beginButton) {
    beginButton.addEventListener('click', () => {
        menuScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        new Game(2); // Default to 2-player mode
    });
}

export default Game;