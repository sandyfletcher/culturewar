// game-state.js
export default class GameState {
    constructor(game) {
        this.game = game;
        this.timeRemaining = 300; // 5 minutes in seconds
        this.lastUpdate = Date.now();
        this.gameOver = false;
        this.startTime = Date.now();
    }

    update(dt) {
        if (this.gameOver) return;

        // Update timer
        this.timeRemaining -= dt;
        
        // Check win conditions
        this.checkWinConditions();
    }
    
    // Check if a player has any planets
    hasPlayerPlanets(player) {
        return this.game.planets.some(planet => planet.owner === player);
    }

    // Check if a player has any troops in movement
    hasPlayerTroopsInMovement(player) {
        return this.game.troopMovements.some(movement => movement.owner === player);
    }

    // Calculate total troops for any player
    calculateTotalTroops(player) {
        // Sum troops from planets
        const planetTroops = this.game.planets
            .filter(planet => planet.owner === player)
            .reduce((total, planet) => total + planet.troops, 0);
        
        // Sum troops from movements
        const movementTroops = this.game.troopMovements
            .filter(movement => movement.owner === player)
            .reduce((total, movement) => total + movement.amount, 0);
        
        return planetTroops + movementTroops;
    }

    // Check win conditions
    checkWinConditions() {
        if (this.gameOver) return false;

        // Check for time victory
        if (this.timeRemaining <= 0) {
            this.game.log("Time victory triggered");
            // Find player with most troops
            const playerTroops = this.calculateTotalTroops('player');
            const aiTroops = this.calculateTotalTroops('ai');
            
            const winner = playerTroops >= aiTroops ? 'player' : 'ai';
            
            this.endGame(winner, 'time');
            return true;
        }

        // Check for domination victories

        // First check if AI is eliminated
        const aiHasPlanets = this.hasPlayerPlanets('ai');
        const aiHasTroops = this.hasPlayerTroopsInMovement('ai');
        
        if (!aiHasPlanets && !aiHasTroops) {
            this.game.log("AI eliminated - player wins");
            const timeTaken = (Date.now() - this.startTime) / 1000; // in seconds
            this.endGame('player', 'domination', timeTaken);
            return true;
        }
        
        // Then check if player is eliminated
        const playerHasPlanets = this.hasPlayerPlanets('player');
        const playerHasTroops = this.hasPlayerTroopsInMovement('player');
        
        if (!playerHasPlanets && !playerHasTroops) {
            this.game.log("Player eliminated - AI wins");
            const timeTaken = (Date.now() - this.startTime) / 1000; // in seconds
            this.endGame('ai', 'domination', timeTaken);
            return true;
        }
        
        return false;
    }

    // End the game and show game over screen
    endGame(winner, victoryType, timeTaken = null) {
        this.game.log(`Game over! ${winner} wins by ${victoryType}`);
        this.gameOver = true;
        this.game.gameOver = true;
        
        // Calculate final stats
        const playerTroops = Math.floor(this.calculateTotalTroops('player'));
        const aiTroops = Math.floor(this.calculateTotalTroops('ai'));
        
        // Create game over screen
        const gameOverScreen = document.createElement('div');
        gameOverScreen.id = 'game-over-screen';
        
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
        
        // Sort by troop count
        const standings = [
            { player: 'player', troops: playerTroops },
            { player: 'ai', troops: aiTroops }
        ].sort((a, b) => b.troops - a.troops);
        
        for (const stat of standings) {
            gameOverHTML += `<li>${stat.player.toUpperCase()}: ${stat.troops} troops</li>`;
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