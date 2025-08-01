// ===========================================
// root/javascript/GameStateCheck.js
// ===========================================

export default class GameState {
    constructor(game) {
        this.game = game;
        this.lastUpdate = Date.now();
        this.gameOver = false;
        this.startTime = Date.now();
        this.winner = null;
        this.victoryType = null;
        this.troopsSent = 0;
        this.troopsLost = 0;
        this.planetsConquered = 0;
        this.elapsedGameTime = 0;
        this.eliminationTimes = {};
        this.activePlayers = new Set(this.game.playersController.players.map(player => player.id));
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.lastUpdate = Date.now();
        }
    }
    update(dt, speedMultiplier = 1.0) {
        if (this.gameOver) return;
        const scaledDt = dt * speedMultiplier; // You already have this in game.js, but good to have here too
        this.elapsedGameTime += scaledDt; // Increment by scaled time
        const timeRemaining = this.game.timerManager.getTimeRemaining();
        this.checkPlayerEliminations(); // No longer needs dt
        this.checkWinConditions(timeRemaining);
        this.checkHumanPlayerStatus(); // check if human players are all out to switch footer mode
    }
    checkPlayerEliminations() {
        for (const playerId of this.activePlayers) {
            if (playerId === 'neutral') continue;
            const playerStat = this.game.playersController.getPlayerStats().find(p => p.id === playerId);
            const hasResources = playerStat ? playerStat.isActive : false;
            if (!hasResources && !this.eliminationTimes[playerId]) {
                this.eliminationTimes[playerId] = this.elapsedGameTime;
                this.activePlayers.delete(playerId);
            }
        }
    }
    checkHumanPlayerStatus() { // logic to handle dynamic footer slider
        if (!this.game.footerManager || this.game.humanPlayerIds.length === 0) {
            return; // if there's no footer manager or no human players from the start, do nothing
        }
        if (this.game.footerManager.mode === 'troop') { // only need to do this check if the slider is still in troop mode
            const activeHumanPlayers = this.game.humanPlayerIds.filter(id => 
                this.game.playersController.hasPlayerPlanets(id) || 
                this.game.playersController.hasPlayerTroopsInMovement(id)
            );
            if (activeHumanPlayers.length === 0) {
                this.game.footerManager.switchToSpeedMode();
            }
        }
    }
    incrementTroopsSent(amount) { this.troopsSent += amount; }
    incrementTroopsLost(amount) { this.troopsLost += amount; }
    incrementPlanetsConquered() { this.planetsConquered++; }
    checkWinConditions(timeRemaining) {
        if (this.gameOver) return false;
        if (timeRemaining <= 0) {
            const winner = this.game.playersController.getWinningPlayer();
            this.endGame(winner, 'time');
            return true;
        }
        const playerStats = this.game.playersController.getPlayerStats().filter(stats => stats.id !== 'neutral');
        const activePlayers = playerStats.filter(stats => 
            this.game.playersController.hasPlayerPlanets(stats.id) || 
            this.game.playersController.hasPlayerTroopsInMovement(stats.id)
        );
        if (activePlayers.length === 1) {
            this.endGame(activePlayers[0].id, 'domination');
            return true;
        }
        return false;
    }
    endGame(winnerId, victoryType) {
        this.winner = winnerId;
        this.victoryType = victoryType;
        this.gameOver = true;
        this.game.gameOver = true;
        const humanWon = this.game.humanPlayerIds.includes(this.winner); // determine if human won based on the dynamic list
        const stats = {
            winner: this.winner,
            time: (Date.now() - this.startTime) / 1000,
            planetsConquered: this.planetsConquered,
            troopsSent: this.troopsSent,
            troopsLost: this.troopsLost,
            eliminationTimes: this.eliminationTimes,
            playerWon: humanWon,
            hasHumanPlayer: this.game.humanPlayerIds.length > 0
        };
        if (window.menuManager) {
            // Callback for the 'PLAY AGAIN' button: returns to the game setup screen.
            const onPlayAgain = () => {
                window.menuManager.menuBuilder.buildGameSetup();
                window.menuManager.switchToScreen('menu');
            };
            // Callback for the '< MENUS' button: returns to the main menu.
            const onBackToMenu = () => {
                window.menuManager.menuBuilder.buildMainMenu();
                window.menuManager.switchToScreen('menu');
            };
            // Pass both distinct callbacks to the manager.
            window.menuManager.showGameOver(stats, this.game, onPlayAgain, onBackToMenu);
        } else {
            console.error("MenuManager not found.");
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}