// ===========================================
// root/game.js
// ===========================================

import Planet from './javascript/Planet.js';
import TroopMovement from './javascript/TroopMovement.js';
import InputHandler from './javascript/InputHandlerModule.js';
import Renderer from './javascript/RendererModule.js';
import GameState from './javascript/GameStateCheck.js';
import PlayersController from './javascript/PlayersController.js';
import PlanetGeneration from './javascript/PlanetGeneratorModule.js';
import TroopTracker from './javascript/TroopTracker.js';
import TimerManager from './javascript/TimerManager.js';

export default class Game {
    constructor(gameConfig, footerManager = null) {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d'); 
        this.resize();
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 100);
        });
        this.config = gameConfig;
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
        this.humanPlayerIds = this.config.players.filter(p => p.type === 'human').map(p => p.id); // determine which players are human from config
        this.playersController = new PlayersController(this, this.config);
        this.inputHandler = this.humanPlayerIds.length > 0 ? new InputHandler(this, this.footerManager, this.humanPlayerIds) : null; // InputHandler is created only if there are human players
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
        const rawDt = (now - this.gameState.lastUpdate) / 1000; // 'rawDt' is unscaled time delta
        this.gameState.lastUpdate = now;
        let speedMultiplier = 1.0;
        if (this.footerManager && this.footerManager.mode === 'speed') { // footer slider can exist in "human" games if human is eliminated
            speedMultiplier = this.footerManager.getSpeedMultiplier();
        }
        this.timerManager.update(speedMultiplier);
        this.gameState.update(rawDt, speedMultiplier); // pass rawDt for accurate stat calculations
        if (this.gameOver) return;
        const gameDt = rawDt * speedMultiplier; // calculate a scaled delta time for all game logic that should be affected by speed
        this.updatePlanets(gameDt); // update planets and troop movements with new 'gameDt' so they respect game speed
        this.updateTroopMovements(gameDt);
        this.playersController.updateAIPlayers(gameDt); // doesn't use dt, but we pass for consistency
        this.troopTracker.update();
    }
    updatePlanets(dt) {
        const activePlayerIds = this.gameState.activePlayers; // get set of currently active players from game state
        for (const planet of this.planets) {
            planet.update(dt);
            if (planet.selected && !activePlayerIds.has(planet.owner)) { // an active player is one who still has planets or troops
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
            targetPlanet.troops += movement.amount; // reinforcement, add troops
        } else { // attack, time for battle!
            const defenderTroops = targetPlanet.troops;
            const attackerTroops = movement.amount;
            targetPlanet.troops -= attackerTroops;
            if (targetPlanet.troops < 0) { // attacker wins
                const attackerLosses = defenderTroops; // attackers lose as many as defenders had
                const defenderLosses = defenderTroops; // all defenders are lost
                this.gameState.incrementTroopsLost(attackerLosses);
                this.gameState.incrementTroopsLost(defenderLosses);
                targetPlanet.owner = movement.owner;
                targetPlanet.troops = Math.abs(targetPlanet.troops); // remaining attacker troops
                this.gameState.incrementPlanetsConquered();
            } else { // defender wins (or it's a draw and defender holds)
                const attackerLosses = attackerTroops; // all attackers are lost
                const defenderLosses = attackerTroops; // defenders lose as many as attackers sent
                this.gameState.incrementTroopsLost(attackerLosses);
                this.gameState.incrementTroopsLost(defenderLosses);
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