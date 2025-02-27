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
    constructor(playerCount = 2, aiTypes = [], botBattleMode = false) {
        console.log('Game starting with:', { playerCount, aiTypes, botBattleMode });
        // Setup canvas
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Store AI configuration
        this.aiTypes = aiTypes;
        
        // Store bot battle mode flag
        this.botBattleMode = botBattleMode;
        
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
        this.playerManager = new PlayerManager(this, playerCount, this.aiTypes, botBattleMode);
        this.inputHandler = botBattleMode ? null : new InputHandler(this);
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
        // Clear any existing planets
        this.planets = [];
        
        if (this.botBattleMode) {
            // In bot battle mode, all players are AI
            this.generateBotBattlePlanets(playerCount);
        } else {
            // Regular mode with human player
            const humanPlayer = this.playerManager.getHumanPlayers()[0].id;
            const aiPlayers = this.playerManager.getAIPlayers().map(player => player.id);
            
            // Generate starting planet positions based on player count
            this.generatePlayerPlanets(humanPlayer, aiPlayers, playerCount);
        }
        
        // Generate neutral planets
        this.generateNeutralPlanets();
    }
    
    generateBotBattlePlanets(botCount) {
        // Get all bot player IDs
        const botPlayers = this.playerManager.getAIPlayers().map(player => player.id);
        
        // Calculate positions based on canvas dimensions
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Position bots evenly around the map
        for (let i = 0; i < botCount; i++) {
            // Calculate position in a circular pattern
            const angle = (i / botCount) * Math.PI * 2;
            const radius = Math.min(width, height) * 0.35;
            
            const x = width / 2 + Math.cos(angle) * radius;
            const y = height / 2 + Math.sin(angle) * radius;
            
            const botPlanet = new Planet(
                x,
                y,
                PLANET_CONFIG.STARTING_PLANET_SIZE,
                PLANET_CONFIG.STARTING_TROOPS,
                botPlayers[i],
                this
            );
            
            this.planets.push(botPlanet);
        }
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
        // In bot battle mode, no human player exists
        const humanPlayers = this.playerManager.getHumanPlayers();
        const humanPlayerId = humanPlayers.length > 0 ? humanPlayers[0].id : null;
        
        for (const planet of this.planets) {
            planet.update(dt);
            
            // If a planet changes ownership, it should not remain selected
            if (planet.selected && (humanPlayerId === null || planet.owner !== humanPlayerId)) {
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
                
                // Check win conditions after troop movements
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
                
                // Update game state for statistics
                this.gameState.incrementPlanetsConquered();
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

export default Game;