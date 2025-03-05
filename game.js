import { Planet, TroopMovement } from './assets/javascript/PlanetAndTroops.js';
import InputHandler from './assets/javascript/InputHandlerModule.js';
import Renderer from './assets/javascript/RendererModule.js';
import GameState from './assets/javascript/GameStateCheck.js';
import PlayersController from './assets/javascript/PlayersController.js';
import PlanetGeneration from './assets/javascript/PlanetGeneratorModule.js';
import TroopTracker from './assets/javascript/TroopTracker.js';

class Game {
    constructor(playerCount = 2, aiTypes = [], botBattleMode = false) {
        console.log(`Game Launched: Bot Battle? ${botBattleMode}, playerCount: ${playerCount}, players: ${aiTypes.map(p => `${p}`).join(' ')}`);
        // Setup canvas
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d'); 
        this.resize();
        // Implement debounced resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 100);
        });
        // Store game configuration
        this.aiTypes = aiTypes;
        this.botBattleMode = botBattleMode;
        this.playerCount = playerCount;
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
        this.playersController = new PlayersController(this, playerCount, this.aiTypes, botBattleMode);
        this.inputHandler = botBattleMode ? null : new InputHandler(this);
        this.renderer = new Renderer(this);
        this.gameState = new GameState(this);
        this.troopTracker = new TroopTracker(this);
        this.planetGenerator = new PlanetGeneration(this);

        const config = menuManager.getGameConfig();
        if (config && config.planetDensity !== undefined) {
            this.planetGenerator.setPlanetDensity(config.planetDensity);
        }
        // Initialize game
        this.initializeGame();
        this.gameLoop();
    }
    // Fit canvas to container
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    // Initialize game components
    initializeGame() {
        this.planets = this.planetGenerator.generatePlanets();
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.gameOver = false;
        this.troopTracker.showTroopBar();
    }
    // Clear all planet selections
    clearSelection() {
        for (const planet of this.planets) {
            planet.selected = false;
        }
        this.selectedPlanets = [];
    }
    // Game state updating
    update() {
        if (this.gameOver) return;
        // Setting "dt" variable to 1 second
        const now = Date.now();
        const dt = (now - this.gameState.lastUpdate) / 1000;
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
        this.playersController.updateAIPlayers(dt);
        // Update troop tracker
        this.troopTracker.update();
    }
    // Update planet status
    updatePlanets(dt) {
        // In bot battle mode, no human player exists
        const humanPlayers = this.playersController.getHumanPlayers();
        const humanPlayerId = humanPlayers.length > 0 ? humanPlayers[0].id : null;
        for (const planet of this.planets) {
            planet.update(dt);
            // If a planet changes ownership, deselect
            if (planet.selected && (humanPlayerId === null || planet.owner !== humanPlayerId)) {
                planet.selected = false;
                this.selectedPlanets = this.selectedPlanets.filter(p => p !== planet);
            }
        }
    }
    // Track troop location
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
    // Battle / reinforcement math
    processTroopArrival(movement) {
        const targetPlanet = movement.to;
        if (targetPlanet.owner === movement.owner) {
            // Reinforcing owned planet
            targetPlanet.troops += movement.amount;
        } else {
            // Attacking enemy planet
            const previousTroops = targetPlanet.troops;
            targetPlanet.troops -= movement.amount;
            // Calculate troops lost (from both sides)
            const defenderLosses = Math.min(previousTroops, movement.amount);
            const attackerLosses = targetPlanet.troops < 0 ? 0 : movement.amount;
            // Track troops lost for statistics
            this.gameState.incrementTroopsLost(defenderLosses);
            this.gameState.incrementTroopsLost(attackerLosses);
            // Capture planet if troops < 0
            if (targetPlanet.troops < 0) {
                targetPlanet.owner = movement.owner;
                targetPlanet.troops = Math.abs(targetPlanet.troops);
                // Update game state for statistics
                this.gameState.incrementPlanetsConquered();
            }
        }
    }
    // Create a new troop movement
    sendTroops(fromPlanet, toPlanet, amount) {
        const movement = new TroopMovement(
            fromPlanet,
            toPlanet,
            amount,
            fromPlanet.owner,
            this
        );
        // Reduce troops from source planet
        fromPlanet.troops -= amount;
        // Track troops sent for statistics
        this.gameState.incrementTroopsSent(amount);
        // Add movement to the game
        this.troopMovements.push(movement);
    }
    // Loop to update game state and visuals
    gameLoop() {
        this.update();
        this.renderer.draw();
        if (!this.gameOver) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

export default Game;