import { Planet, TroopMovement } from './javascript/PlanetAndTroops.js';
import InputHandler from './javascript/InputHandlerModule.js';
import Renderer from './javascript/RendererModule.js';
import GameState from './javascript/GameStateCheck.js';
import PlayersController from './javascript/PlayersController.js';
import PlanetGeneration from './javascript/PlanetGeneratorModule.js';
import TroopTracker from './javascript/TroopTracker.js';
import TimerManager from './javascript/TimerManager.js';

class Game {
    // MODIFIED: Constructor now accepts a single config object.
    constructor(gameConfig, footerManager = null) {
        console.log(`Game Launched: Players: ${gameConfig.players.length}`);
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d'); 
        this.resize();
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 100);
        });

        this.config = gameConfig; // MODIFIED: Store the whole config.
        this.footerManager = footerManager;
        
        this.planets = [];
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.mousePos = { x: 0, y: 0 };
        this.Planet = Planet;
        this.TroopMovement = TroopMovement;
        this.timerManager = new TimerManager(this);
        this.isActive = false;
        this.gameOver = false;
        
        // NEW: Determine which players are human from the config.
        this.humanPlayerIds = this.config.players.filter(p => p.type === 'human').map(p => p.id);

        this.playersController = new PlayersController(this, this.config);
        // MODIFIED: InputHandler is created only if there are human players.
        this.inputHandler = this.humanPlayerIds.length > 0 ? new InputHandler(this, this.footerManager, this.humanPlayerIds) : null;
        this.renderer = new Renderer(this);
        this.gameState = new GameState(this);
        this.troopTracker = new TroopTracker(this);
        this.planetGenerator = new PlanetGeneration(this);
        
        if (this.config && this.config.planetDensity !== undefined) {
            this.planetGenerator.setPlanetDensity(this.config.planetDensity);
        }

        this.timerManager.initialize();
        this.isActive = true;
        this.initializeGame();
        this.gameLoop();
    }
    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }
    initializeGame() {
        this.planets = this.planetGenerator.generatePlanets();
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.gameOver = false;
        this.troopTracker.showTroopBar();
    }
    clearSelection() {
        for (const planet of this.planets) {
            planet.selected = false;
        }
        this.selectedPlanets = [];
    }
    update() {
        if (this.gameOver) return;
        const now = Date.now();
        let dt = (now - this.gameState.lastUpdate) / 1000;
        this.gameState.lastUpdate = now;
        let speedMultiplier = 1.0;

        // MODIFIED: The footer slider can now exist even in "human" games (if the human is eliminated).
        if (this.footerManager && this.footerManager.mode === 'speed') {
            speedMultiplier = this.footerManager.getSpeedMultiplier();
        }
        
        this.timerManager.update(speedMultiplier);
        this.gameState.update(dt, speedMultiplier); // Pass speed multiplier for accurate stats
        if (this.gameOver) return;
        this.updatePlanets(dt);
        this.updateTroopMovements(dt);
        this.playersController.updateAIPlayers(dt);
        this.troopTracker.update();
    }
    updatePlanets(dt) {
        for (const planet of this.planets) {
            planet.update(dt);
            // MODIFIED: Deselect planets not owned by any active human player.
            if (planet.selected && !this.humanPlayerIds.includes(planet.owner)) {
                planet.selected = false;
                this.selectedPlanets = this.selectedPlanets.filter(p => p !== planet);
            }
        }
    }
    updateTroopMovements(dt) {
        for (let i = this.troopMovements.length - 1; i >= 0; i--) {
            const movement = this.troopMovements[i];
            if (movement.update(dt)) {
                this.processTroopArrival(movement);
                this.troopMovements.splice(i, 1);
                this.gameState.checkWinConditions(this.timerManager.getTimeRemaining());
            }
        }
    }
    processTroopArrival(movement) {
        const targetPlanet = movement.to;
        if (targetPlanet.owner === movement.owner) {
            targetPlanet.troops += movement.amount;
        } else {
            const previousTroops = targetPlanet.troops;
            targetPlanet.troops -= movement.amount;
            const defenderLosses = Math.min(previousTroops, movement.amount);
            const attackerLosses = targetPlanet.troops < 0 ? 0 : movement.amount;
            this.gameState.incrementTroopsLost(defenderLosses);
            this.gameState.incrementTroopsLost(attackerLosses);
            if (targetPlanet.troops < 0) {
                targetPlanet.owner = movement.owner;
                targetPlanet.troops = Math.abs(targetPlanet.troops);
                this.gameState.incrementPlanetsConquered();
            }
        }
    }
    sendTroops(fromPlanet, toPlanet, amount) {
        const movement = new TroopMovement(
            fromPlanet,
            toPlanet,
            amount,
            fromPlanet.owner,
            this
        );
        fromPlanet.troops -= amount;
        this.gameState.incrementTroopsSent(amount);
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