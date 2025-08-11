// ===========================================
// root/javascript/game.js
// ===========================================

import eventManager from './EventManager.js';
import TroopMovement from './TroopMovement.js';
import InputHandler from './InputHandlerModule.js';
import Renderer from './RendererModule.js';
import GameState from './GameStateCheck.js';
import PlayersController from './PlayersController.js';
import PlanetGeneration from './PlanetGeneratorModule.js';
import TroopTracker from './TroopTracker.js';
import TimerManager from './TimerManager.js';

export default class Game {
    constructor(gameConfig, footerManager = null, configManager = null, menuManager = null, statsTracker = null, innerContainer, canvas) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.innerContainer = innerContainer;
        this.resize();
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resize(), 100);
        });
        this.config = gameConfig;
        this.footerManager = footerManager;
        this.configManager = configManager;
        this.menuManager = menuManager;
        this.statsTracker = statsTracker;
        this.planets = [];
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.mousePos = { x: 0, y: 0 };
        this.timerManager = new TimerManager(this);
        this.isActive = false;
        this.gameOver = false;
        this.humanPlayerIds = this.config.players.filter(p => p.type === 'human').map(p => p.id); // determine which players are human from config
        this.playersController = new PlayersController(this, this.config);
    this.inputHandler = this.humanPlayerIds.length > 0 && !this.config.isHeadless
        ? new InputHandler(this.canvas, this.footerManager, this.humanPlayerIds)
        : null;
        this.renderer = new Renderer(this); // Pass the entire game instance
        this.gameState = new GameState(this);
        this.troopTracker = new TroopTracker(this);
        this.planetGenerator = new PlanetGeneration(this);
        if (this.config && this.config.planetDensity !== undefined) {
            this.planetGenerator.setPlanetDensity(this.config.planetDensity);
        }
        if (this.footerManager && this.footerManager.mode === 'speed' && this.config.initialGamePace) { // set initial game pace if configured
            this.footerManager.setSpeedFromMultiplier(this.config.initialGamePace);
        }
        this.timerManager.initialize();
        this.isActive = true;
        this.initializeGame();
        if (this.config.isHeadless) { // choose game loop based on headless mode
            this.runHeadless();
        } else {
            this.gameLoop();
        }
        eventManager.on('screen-changed', (screenName) => {
            if (screenName === 'game') {
                this.troopTracker.showTroopBar();
            } else if (screenName === 'menu') {
                this.troopTracker.hideTroopBar();
            }
        });
        // Properties for double-click detection
        this.lastClickedPlanet = null;
        this.lastClickTime = 0;
        this.doubleClickTimeThreshold = this.config.doubleClickTimeThreshold || 300; // ms
        // Event listeners for input
        eventManager.on('mouse-moved', (pos) => {
            if (this.gameOver) return;
            this.mousePos = pos;
        });
        eventManager.on('click', (pos) => {
            if (this.gameOver) return;
            this.handleClick(pos);
        });
        eventManager.on('selection-box', (box) => {
            if (this.gameOver) return;
            this.handleSelectionBox(box);
        });
    }
    reportStats(data) {
        if (this.statsTracker) {
            this.statsTracker.report(data);
        }
    }
    handleClick({ x, y }) {
        const clickedPlanet = this.planets.find(planet => planet.containsPoint(x, y));
        if (!clickedPlanet) {
            this.clearSelection();
            return;
        }
        const isHumanPlanet = this.humanPlayerIds.includes(clickedPlanet.owner);
        const now = Date.now();
        if (isHumanPlanet &&
            clickedPlanet === this.lastClickedPlanet &&
            now - this.lastClickTime < this.doubleClickTimeThreshold) {
            this.selectAllPlayerPlanets(clickedPlanet.owner);
            this.lastClickedPlanet = null;
            this.lastClickTime = 0;
            return;
        }
        this.lastClickedPlanet = clickedPlanet;
        this.lastClickTime = now;
        if (this.selectedPlanets.length > 0 && !this.selectedPlanets.includes(clickedPlanet)) {
            if (this.selectedPlanets.every(p => this.humanPlayerIds.includes(p.owner))) {
                const troopPercentage = this.footerManager.getTroopPercentage() / 100;
                for (const sourcePlanet of this.selectedPlanets) {
                    const troopsToSend = Math.floor(sourcePlanet.troops * troopPercentage);
                    if (troopsToSend > 0) {
                        this.sendTroops(sourcePlanet, clickedPlanet, troopsToSend);
                    }
                }
                this.clearSelection();
            }
        } else if (isHumanPlanet) {
            this.clearSelection();
            clickedPlanet.selected = true;
            this.selectedPlanets = [clickedPlanet];
        }
    }
    handleSelectionBox(box) {
        this.clearSelection();
        const planetsInBox = this.planets.filter(planet =>
            this.humanPlayerIds.includes(planet.owner) &&
            planet.x + planet.size >= box.left &&
            planet.x - planet.size <= box.right &&
            planet.y + planet.size >= box.top &&
            planet.y - planet.size <= box.bottom
        );

        if (planetsInBox.length > 0) {
            const ownerToSelect = planetsInBox[0].owner;
            for (const planet of planetsInBox) {
                if (planet.owner === ownerToSelect) {
                    planet.selected = true;
                    this.selectedPlanets.push(planet);
                }
            }
        }
    }
    selectAllPlayerPlanets(playerId) {
        this.clearSelection();
        for (const planet of this.planets) {
            if (planet.owner === playerId) {
                planet.selected = true;
                this.selectedPlanets.push(planet);
            }
        }
    }
    resize() {
        this.canvas.width = this.innerContainer.clientWidth;
        this.canvas.height = this.innerContainer.clientHeight;
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
        const rawDt = (now - this.gameState.lastUpdate) / 1000;
        this.gameState.lastUpdate = now;
        let speedMultiplier = 1.0;
        if (this.config.isHeadless) {
            speedMultiplier = 100.0; // Use a high multiplier for fast simulations
        } else if (this.footerManager && this.footerManager.mode === 'speed') {
            speedMultiplier = this.footerManager.getSpeedMultiplier();
        }
        // Update overall timers and game state based on real-world time elapsed.
        // This should happen once per frame.
        this.timerManager.update(speedMultiplier);
        this.gameState.update(rawDt, speedMultiplier);
        if (this.gameOver) return;
        // --- FIXED-STEP SIMULATION LOOP ---
        // This ensures game logic runs in small, consistent increments, even at high speeds,
        // preventing the "large time step" problem and maintaining simulation accuracy.
        const totalGameDt = rawDt * speedMultiplier;
        const FIXED_TIME_STEP = 1 / 60; // Simulate the game at a consistent 60 ticks per second.
        let accumulator = totalGameDt;
        // Run the simulation logic in a loop until we've "caught up" to the total time for this frame.
        // A cap is added to prevent an infinite spiral on very slow machines.
        const maxStepsPerFrame = 200; 
        let steps = 0;
        while (accumulator >= FIXED_TIME_STEP && steps < maxStepsPerFrame) {
            this.updatePlanets(FIXED_TIME_STEP);
            this.updateTroopMovements(FIXED_TIME_STEP);
            this.playersController.updateAIPlayers(FIXED_TIME_STEP);
            accumulator -= FIXED_TIME_STEP;
            steps++;
        }
        // Update the visual troop bar based on the final state of this frame's simulation.
        this.troopTracker.update();
    }
    updatePlanets(dt) {
        const activePlayerIds = this.gameState.activePlayers;
        for (const planet of this.planets) {
            planet.update(dt);
            if (planet.selected && !activePlayerIds.has(planet.owner)) {
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
            const defenderTroops = targetPlanet.troops;
            const attackerTroops = movement.amount;
            targetPlanet.troops -= attackerTroops;
            if (targetPlanet.troops < 0) {
                const attackerLosses = defenderTroops;
                const defenderLosses = defenderTroops;
                this.gameState.incrementTroopsLost(attackerLosses);
                this.gameState.incrementTroopsLost(defenderLosses);
                targetPlanet.owner = movement.owner;
                targetPlanet.troops = Math.abs(targetPlanet.troops);
                this.gameState.incrementPlanetsConquered();
            } else {
                const attackerLosses = attackerTroops;
                const defenderLosses = attackerTroops;
                this.gameState.incrementTroopsLost(attackerLosses);
                this.gameState.incrementTroopsLost(defenderLosses);
            }
        }
    }
    sendTroops(fromPlanet, toPlanet, amount) {
        if (!amount || amount <= 0) {
            return;
        }
        const troopsAvailable = Math.floor(fromPlanet.troops);
        const sanitizedAmount = Math.min(amount, troopsAvailable);
        if (sanitizedAmount < 1) {
            return;
        }
        const movement = new TroopMovement(
            fromPlanet,
            toPlanet,
            sanitizedAmount,
            fromPlanet.owner,
            this
        );
        fromPlanet.troops -= sanitizedAmount;
        this.gameState.incrementTroopsSent(sanitizedAmount);
        this.troopMovements.push(movement);
    }
    gameLoop() {
        this.update();
        this.renderer.draw();
        if (!this.gameOver) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
    runHeadless() {
        const headlessLoop = () => {
            if (this.gameOver) {
                return;
            }
            this.update();
            setTimeout(headlessLoop, 0);
        };
        headlessLoop();
    }
}