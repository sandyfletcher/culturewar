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
        const scaledDt = dt * speedMultiplier;
        this.elapsedGameTime += scaledDt;
        const timeRemaining = this.game.timerManager.getTimeRemaining();
        this.checkPlayerEliminations();
        this.checkWinConditions(timeRemaining);
        this.checkHumanPlayerStatus();
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
    checkHumanPlayerStatus() {
        if (!this.game.footerManager || this.game.humanPlayerIds.length === 0) {
            return;
        }
        if (this.game.footerManager.mode === 'troop') {
            const activeHumanPlayers = this.game.humanPlayerIds.filter(id =>
                this.game.playersController.hasPlayerPlanets(id) ||
                this.game.playersController.hasPlayerTroopsInMovement(id)
            );
            if (activeHumanPlayers.length === 0) {
                this.game.footerManager.switchToSpeedMode();
                this.game.timerManager.shouldPauseOnHidden = false;
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
        if (this.gameOver) return;
        this.winner = winnerId;
        this.victoryType = victoryType;
        this.gameOver = true;
        this.game.gameOver = true;
        const allPlayersData = this.game.playersController.players; // this runs every game, single or batch
        const playerStats = this.game.playersController.getPlayerStats()
            .filter(p => p.id !== 'neutral');
        playerStats.sort((a,b) => b.planets - a.planets || b.troops - a.troops);
        const gameId = `${window.CULTURE_WAR_USER_ID}-${Date.now()}`;
        const gameStatsLog = `[GAME_STATS],${gameId},${this.elapsedGameTime.toFixed(2)},${Math.round(this.troopsSent || 0)},${Math.round(this.planetsConquered || 0)},${Math.round(this.troopsLost || 0)}`;
        console.log(gameStatsLog);
        playerStats.forEach((player, index) => {
            const rank = index + 1;
            const cultureScore = ((allPlayersData.length + 1) / 2) - rank;
            const survivalTime = this.eliminationTimes[player.id] || this.elapsedGameTime;
            const originalPlayerData = allPlayersData.find(p => p.id === player.id);
            const aggregationKey = originalPlayerData.aiController || 'PLAYER';
            const playerStatsLog = `[PLAYER_STATS],${gameId},${rank},${aggregationKey},${player.planets},${Math.floor(player.troops)},${survivalTime.toFixed(2)},${cultureScore.toFixed(4)}`;
            console.log(playerStatsLog);
        });
        if (window.menuManager.isBatchRunning) { // decide what to do next based on batch mode
            window.menuManager.startNextBatchGame();
            return; // exit to prevent showing game over screen
        }
        // single-game screen display logic
        const humanWon = this.game.humanPlayerIds.includes(this.winner);
        const stats = {
            winner: this.winner,
            time: this.elapsedGameTime,
            planetsConquered: this.planetsConquered,
            troopsSent: this.troopsSent,
            troopsLost: this.troopsLost,
            eliminationTimes: this.eliminationTimes,
            playerWon: humanWon,
            hasHumanPlayer: this.game.humanPlayerIds.length > 0
        };
        if (window.menuManager) {
            const onPlayAgain = () => {
                window.menuManager.menuBuilder.buildGameSetup();
                window.menuManager.switchToScreen('menu');
            };
            const onBackToMenu = () => {
                window.menuManager.menuBuilder.buildMainMenu();
                window.menuManager.switchToScreen('menu');
            };
            window.menuManager.showGameOver(stats, this.game, onPlayAgain, onBackToMenu);
        } else {
            console.error("MenuManager not found.");
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}