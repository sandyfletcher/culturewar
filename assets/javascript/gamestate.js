export default class GameState {
    constructor(game) {
        this.game = game;
        this.timeRemaining = 300; // 5 minutes in seconds
        this.lastUpdate = Date.now();
        this.gameOver = false;
        this.startTime = Date.now();
        this.winner = null;
        this.victoryType = null;
        this.troopsSent = 0;
        this.troopsLost = 0;
        this.planetsConquered = 0;
    }

    update(dt) {
        if (this.gameOver) return;
            
        // Update timer
        this.timeRemaining -= dt;
        
        // Check win conditions
        this.checkWinConditions();
    }
    
    // Increment counters for statistics
    incrementTroopsSent(amount) {
        this.troopsSent += amount;
    }
    
    incrementTroopsLost(amount) {
        this.troopsLost += amount;
    }
    
    incrementPlanetsConquered() {
        this.planetsConquered++;
    }
    
    // Check win conditions
    checkWinConditions() {
        if (this.gameOver) return false;
    
        // Check for time victory
        if (this.timeRemaining <= 0) {
            // Find player with most troops
            const winner = this.game.playerManager.getWinningPlayer();
            this.endGame(winner, 'time');
            return true;
        }
    
        // Check for domination victories
        const playerStats = this.game.playerManager.getPlayerStats()
            .filter(stats => stats.id !== 'neutral');
        
        // Count active players (with planets or troops in movement)
        const activePlayers = playerStats.filter(stats => 
            this.game.playerManager.hasPlayerPlanets(stats.id) || 
            this.game.playerManager.hasPlayerTroopsInMovement(stats.id)
        );
        
        // If only one player remains active, they win
        if (activePlayers.length === 1) {
            this.endGame(activePlayers[0].id, 'domination');
            return true;
        }
        
        return false;
    }
    
    // Updated endGame method to handle both human and bot battles
    endGame(winnerId, victoryType) {
        this.winner = winnerId;
        this.victoryType = victoryType;
        this.gameOver = true;
        this.game.gameOver = true;
        
        // Determine if we're in bot battle mode
        const isBotBattle = this.game.botBattleMode;
        
        // Create game statistics with universal properties
        const stats = {
            winner: this.winner,
            time: (Date.now() - this.startTime) / 1000, // elapsed time in seconds
            planetsConquered: this.planetsConquered,
            troopsSent: this.troopsSent,
            troopsLost: this.troopsLost
        };
        
        // Add property specific to single player mode
        if (!isBotBattle) {
            const humanPlayer = this.game.playerManager.getHumanPlayers()[0];
            stats.playerWon = this.winner === humanPlayer.id;
        }
        
        // Show game over screen using MenuManager
        if (window.menuManager) {
            window.menuManager.showGameOver(stats);
        } else {
            console.error("MenuManager not found. Make sure it's initialized before GameState.");
        }
    }
}