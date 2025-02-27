import { Planet, TroopMovement } from './assets/javascript/entities.js';
import InputHandler from './assets/javascript/inputhandler.js';
import Renderer from './assets/javascript/renderer.js';
import GameState from './assets/javascript/gamestate.js';
import PlayerManager from './assets/javascript/playermanager.js';
import AIManager from './assets/javascript/ai-manager.js';
import PlanetGenerator from './assets/javascript/PlanetGenerator.js';

class Game {
    constructor(playerCount = 2, aiTypes = [], botBattleMode = false) {
        console.log('Game starting with:', { playerCount, aiTypes, botBattleMode });
        // Setup canvas
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Store game configuration
        this.aiTypes = aiTypes;
        this.botBattleMode = botBattleMode;
        this.playerCount = playerCount;
        
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
        this.planetGenerator = new PlanetGenerator(this);
        
        // Initialize game
        this.initializeGame();
        this.gameLoop();
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Regenerate planets if game is already running
//         if (this.planets.length > 0) {
//             this.initializeGame();
 //        }   HAD TO REMOVE THIS BECAUSE OF A BUG BUT I THINK IT MAY HAVE VALUE IF SOMEONE RESIZES THE SCREEN
    }
    
    initializeGame() {
        // Generate planets
        this.planets = this.planetGenerator.generatePlanets(this.playerCount, this.botBattleMode);
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.gameOver = false;
    }
    
    // Clear all planet selections
    clearSelection() {
        for (const planet of this.planets) {
            planet.selected = false;
        }
        this.selectedPlanets = [];
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
    
    sendTroops(fromPlanet, toPlanet, amount) {
        // Create a new troop movement
        const movement = new TroopMovement(
            fromPlanet,
            toPlanet,
            amount,
            fromPlanet.owner,
            this
        );
        
        // Reduce troops from source planet
        fromPlanet.troops -= amount;
        
        // Add movement to the game
        this.troopMovements.push(movement);
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