// ===========================================
// root/javascript/GameStateCheck.js
// ===========================================

import eventManager from './EventManager.js';

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
        // activePlayers will be initialized in the init() method.
        this.activePlayers = new Set();
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        this.memory_human_eliminated = false;
    }
    // New init() method for second-phase initialization
    init() {
        // This line is now safe to run because playersController is guaranteed to exist.
        this.activePlayers = new Set(this.game.playersController.players.map(player => player.id));
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
        if (this.game.humanPlayerIds.length === 0) {
            return;
        }
        const hasActiveHuman = this.game.humanPlayerIds.some(id =>
            this.game.gameState.activePlayers.has(id)
        );
        if (!hasActiveHuman && !this.memory_human_eliminated) {
            this.memory_human_eliminated = true;
            eventManager.emit('human-players-eliminated');
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
        const allPlayersData = this.game.playersController.players;
        const playerStats = this.game.playersController.getPlayerStats()
            .filter(p => p.id !== 'neutral');
        playerStats.sort((a,b) => b.planets - a.planets || b.troops - a.troops);
        const gameId = `${window.CULTURE_WAR_USER_ID}-${Date.now()}`;
        this.game.reportStats({
            type: 'GAME_STATS',
            gameId: gameId,
            duration: this.elapsedGameTime,
            troopsSent: this.troopsSent,
            planetsConquered: this.planetsConquered,
            troopsLost: this.troopsLost
        });

        playerStats.forEach((player, index) => {
            const rank = index + 1;
            const cultureScore = ((allPlayersData.length + 1) / 2) - rank;
            const survivalTime = this.eliminationTimes[player.id] || this.elapsedGameTime;
            const originalPlayerData = allPlayersData.find(p => p.id === player.id);
            const aggregationKey = originalPlayerData.aiController || 'PLAYER';
            this.game.reportStats({
                type: 'PLAYER_STATS',
                gameId: gameId,
                rank: rank,
                nickname: aggregationKey,
                planets: player.planets,
                troops: Math.floor(player.troops),
                survivalTime: survivalTime,
                cultureScore: cultureScore
            });
        });
        if (this.game.menuManager.isBatchRunning) {
            this.game.menuManager.startNextBatchGame();
            return;
        }
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
        if (this.game.menuManager) {
            const onPlayAgain = () => {
                this.game.menuManager.menuBuilder.buildGameSetup();
                this.game.menuManager.switchToScreen('menu');
            };
            const onBackToMenu = () => {
                this.game.menuManager.menuBuilder.buildMainMenu();
                this.game.menuManager.switchToScreen('menu');
            };
            this.game.menuManager.showGameOver(stats, this.game, onPlayAgain, onBackToMenu);
        } else {
            console.error("MenuManager not found.");
        }
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}