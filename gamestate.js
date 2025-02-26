// game-state.js
export default class GameState {
    constructor(game) {
        this.game = game;
        this.timeRemaining = 300; // 5 minutes in seconds
        this.lastUpdate = Date.now();
        this.gameOver = false;
        this.startTime = Date.now();
        this.winner = null;
        this.victoryType = null;
    }

    update(dt) {
        if (this.gameOver) return;

        // Update timer
        this.timeRemaining -= dt;
        
        // Check win conditions
        this.checkWinConditions();
    }
    
    // Check win conditions
    checkWinConditions() {
        if (this.gameOver) return false;

        // Check for time victory
        if (this.timeRemaining <= 0) {
            this.game.log("Time victory triggered");
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
            const winner = activePlayers[0].id;
            this.game.log(`${winner} is the last player with planets or troops - victory!`);
            const timeTaken = (Date.now() - this.startTime) / 1000; // in seconds
            this.endGame(winner, 'domination', timeTaken);
            return true;
        }
        
        return false;
    }

    // End the game and show game over screen
    endGame(winner, victoryType, timeTaken = null) {
        this.game.log(`Game over! ${winner} wins by ${victoryType}`);
        this.gameOver = true;
        this.game.gameOver = true;
        this.winner = winner;
        this.victoryType = victoryType;
        
        // Create game over screen
        const gameOverScreen = document.createElement('div');
        gameOverScreen.id = 'game-over-screen';
        
        // Calculate final stats for all players
        const standings = this.game.playerManager.getPlayerStats()
            .filter(stats => stats.id !== 'neutral')
            .sort((a, b) => b.troops - a.troops);
        
        let gameOverHTML = `
            <h1>GAME OVER</h1>
            <h2>${winner.toUpperCase()} WINS!</h2>
            <h3>${victoryType.toUpperCase()} VICTORY</h3>
        `;
        
        if (victoryType === 'domination' && timeTaken) {
            const minutes = Math.floor(timeTaken / 60);
            const seconds = Math.floor(timeTaken % 60);
            gameOverHTML += `<p>Victory achieved in ${minutes}:${seconds.toString().padStart(2, '0')}</p>`;
        }
        
        gameOverHTML += `<h3>FINAL STANDINGS</h3><ul>`;
        
        for (const stat of standings) {
            const player = this.game.playerManager.getPlayerById(stat.id);
            gameOverHTML += `<li>${stat.id.toUpperCase()}: ${Math.floor(stat.troops)} troops (${stat.planets} planets)</li>`;
        }
        
        gameOverHTML += `</ul><button class="menu-button" id="play-again-button">PLAY AGAIN</button>`;
        
        gameOverScreen.innerHTML = gameOverHTML;
        document.getElementById('game-container').appendChild(gameOverScreen);
        
        // Add event listener to play again button
        document.getElementById('play-again-button').addEventListener('click', () => {
            window.location.reload();
        });
    }
}