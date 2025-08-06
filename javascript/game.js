// ===========================================
// root/game.js
// ===========================================

import eventManager from './javascript/EventManager.js';
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
    constructor(gameConfig, footerManager = null, configManager = null, innerContainer, canvas) {
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
        this.planets = [];
        this.troopMovements = [];
        this.selectedPlanets = [];
        this.mousePos = { x: 0, y: 0 };
        this.timerManager = new TimerManager(this);
        this.isActive = false;
        this.gameOver = false;
        this.humanPlayerIds = this.config.players.filter(p => p.type === 'human').map(p => p.id); // determine which players are human from config
        this.playersController = new PlayersController(this, this.config);
        this.inputHandler = this.humanPlayerIds.length > 0 ? new InputHandler(this.canvas, this.footerManager, this.humanPlayerIds) : null; // InputHandler is created only if there are human players
        this.renderer = new Renderer(this.ctx, this.canvas);
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
        // In headless mode, the canvas's direct parent ('#game-screen') is not displayed,
        // causing its clientWidth and clientHeight to be 0. This prevents planets from
        // being generated correctly as the game world has no area.
        // To fix this, we size the canvas based on '#inner-container', which is the
        // main content area and always has the correct dimensions.
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
        this.playersController.updateAIPlayers(gameDt); // pass dt to manage bot cooldowns
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
        if (!amount || amount <= 0) { // ensure amount is positive
            return;
        }
        const troopsAvailable = Math.floor(fromPlanet.troops); // ensure more troops aren't sent than available
        const sanitizedAmount = Math.min(amount, troopsAvailable);
        if (sanitizedAmount < 1) { // ensure it's at least one whole troop
            return;
        }
        const movement = new TroopMovement(
            fromPlanet,
            toPlanet,
            sanitizedAmount, // use sanitized amount
            fromPlanet.owner,
            this
        );
        fromPlanet.troops -= sanitizedAmount;
        this.gameState.incrementTroopsSent(sanitizedAmount);
        this.troopMovements.push(movement);
    }
    gameLoop() {
        this.update();

        const selectionBox = this.inputHandler ? this.inputHandler.getSelectionBox() : null;
        const renderables = {
            planets: this.planets,
            troopMovements: this.troopMovements,
            selectedPlanets: this.selectedPlanets,
            mousePos: this.mousePos,
            selectionBox: selectionBox,
            uiData: {
                totalTroops: this.troopTracker.lastTotalTroops,
                timeRemaining: this.timerManager.getTimeRemaining()
            }
        };
        this.renderer.draw(renderables);

        if (!this.gameOver) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
    runHeadless() { // headless game loop that runs without rendering
        const headlessLoop = () => {
            if (this.gameOver) {
                return;
            }
            this.update();
            setTimeout(headlessLoop, 0); // use setTimeout to yield to the browser's event loop, preventing a freeze
        };
        headlessLoop();
    }
}