import { Planet, TroopMovement } from './assets/javascript/PlanetAndTroops.js';
import InputHandler from './assets/javascript/InputHandlerModule.js';
import Renderer from './assets/javascript/RendererModule.js';
import GameState from './assets/javascript/GameStateCheck.js';
import PlayersController from './assets/javascript/PlayersController.js';
import PlanetGeneration from './assets/javascript/PlanetGeneratorModule.js';
import TroopTracker from './assets/javascript/TroopTracker.js';
import TimerManager from './assets/javascript/TimerManager.js';

class Game {
    constructor(playerCount = 2, aiTypes = [], botBattleMode = false, footerManager = null) {
        console.log(`Game Launched: Bot Battle? ${botBattleMode}, playerCount: ${playerCount}, players: ${aiTypes.map(p => `${p}`).join(' ')}`);
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d'); 
        this.resize();
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 100);
        });
        this.aiTypes = aiTypes;
        this.botBattleMode = botBattleMode;
        this.playerCount = playerCount;
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
        this.playersController = new PlayersController(this, playerCount, this.aiTypes, botBattleMode);
        this.inputHandler = botBattleMode ? null : new InputHandler(this, this.footerManager);
        this.renderer = new Renderer(this);
        this.gameState = new GameState(this);
        this.troopTracker = new TroopTracker(this);
        this.planetGenerator = new PlanetGeneration(this);
        const config = window.menuManager.getGameConfig();
        if (config && config.planetDensity !== undefined) {
            this.planetGenerator.setPlanetDensity(config.planetDensity);
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
        if (this.botBattleMode && this.footerManager) {
            speedMultiplier = this.footerManager.getSpeedMultiplier();
            dt *= speedMultiplier;
        }
        this.timerManager.update(speedMultiplier);
        this.gameState.update(dt);
        if (this.gameOver) return;
        this.updatePlanets(dt);
        this.updateTroopMovements(dt);
        this.playersController.updateAIPlayers(dt);
        this.troopTracker.update();
    }
    updatePlanets(dt) {
        const humanPlayers = this.playersController.getHumanPlayers();
        const humanPlayerId = humanPlayers.length > 0 ? humanPlayers[0].id : null;
        for (const planet of this.planets) {
            planet.update(dt);
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
                this.processTroopArrival(movement);
                this.troopMovements.splice(i, 1);
                this.gameState.checkWinConditions(this.timerManager.getTimeRemaining());
            }
        }
    }
    processTroopArrival(movement) {
        const targetPlanet = movement.to;
        if (targetPlanet.owner === movement.owner) { // reinforcing
            targetPlanet.troops += movement.amount;
        } else { // attacking
            const previousTroops = targetPlanet.troops;
            targetPlanet.troops -= movement.amount;
            const defenderLosses = Math.min(previousTroops, movement.amount); // calculate troops lost (both sides)
            const attackerLosses = targetPlanet.troops < 0 ? 0 : movement.amount;
            this.gameState.incrementTroopsLost(defenderLosses); // track losses for statistics
            this.gameState.incrementTroopsLost(attackerLosses);
            if (targetPlanet.troops < 0) { // capture planet if troops < 0
                targetPlanet.owner = movement.owner;
                targetPlanet.troops = Math.abs(targetPlanet.troops);
                this.gameState.incrementPlanetsConquered(); // update game state for statistics
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