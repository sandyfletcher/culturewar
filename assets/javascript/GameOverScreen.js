class GameOverScreen {
    constructor(parentContainer) {
        // Store reference to parent container
        this.parentContainer = parentContainer || document.getElementById('inner-container');
        
        // Reference to game over screen element
        this.gameOverScreen = null;
    }
    
    // Show game over screen with leaderboard and stats
    show(stats, gameInstance) {
        // Get AI options from MenuManager when we actually need them
        this.aiOptions = window.menuManager.aiOptions;
        
        // Remove existing game over screen if it exists
        this.remove();
        
        // Create new game over screen
        this.gameOverScreen = document.createElement('div');
        this.gameOverScreen.id = 'game-over-screen';
        
        // Get all player stats for leaderboard
        const playerStats = gameInstance.playersController.getPlayerStats()
            .filter(player => player.id !== 'neutral');
        
        // Get all players including eliminated ones
        const allPlayers = gameInstance.playersController.players;
        
        // Track elimination times
        const eliminationTimes = gameInstance.gameState.eliminationTimes || {};
        const gameTime = stats.time;
        
        // Create leaderboard data with all necessary fields
        const leaderboardData = allPlayers.map(player => {
            const playerStat = playerStats.find(p => p.id === player.id) || { planets: 0, troops: 0 };
            const isWinner = player.id === stats.winner;
            const survivalTime = eliminationTimes[player.id] || gameTime; // Use game time if player survived
            
            return {
                id: player.id,
                displayName: this.getPlayerDisplayName(player),
                planets: playerStat.planets,
                troops: Math.floor(playerStat.troops || 0),
                survivalTime,
                isWinner,
                isAI: player.isAI,
                aiType: player.aiController
            };
        });
        
        // Sort players based on ranking criteria: planets → troops → survival time
        leaderboardData.sort((a, b) => {
            if (a.planets !== b.planets) return b.planets - a.planets;
            if (a.troops !== b.troops) return b.troops - a.troops;
            return b.survivalTime - a.survivalTime;
        });
        
        // Create header based on game mode
        const gameMode = window.menuManager.getGameConfig().gameMode;
        let headerText;
        if (gameMode === 'singleplayer') {
            const isPlayerWinner = stats.playerWon;
            headerText = `<h1>${isPlayerWinner ? 'VICTORY!' : 'DEFEAT'}</h1>
                        <h2>${leaderboardData[0].displayName} successfully subjugated space</h2>`;
        } else {
            // Bot battle mode
            headerText = `<h1>BATTLE COMPLETE</h1>
                        <h2>${leaderboardData[0].displayName} successfully subjugated space</h2>`;
        }
        
        // Create leaderboard HTML
        let leaderboardHTML = `
            <div class="leaderboard">
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>Planets</th>
                            <th>Troops</th>
                            <th>Survived</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add each player to the leaderboard
        leaderboardData.forEach((player, index) => {
            const rank = index + 1;
            const formattedTime = this.formatTime(player.survivalTime);
            const rowClass = player.isWinner ? 'winner' : '';
            
            leaderboardHTML += `
                <tr class="${rowClass}">
                    <td>${rank}</td>
                    <td>${player.displayName}</td>
                    <td>${player.planets}</td>
                    <td>${player.troops}</td>
                    <td>${formattedTime}</td>
                </tr>
            `;
        });
        
        leaderboardHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Log a concise summary of the game stats
        const leaderboardRankings = leaderboardData.map(player => player.displayName).join(', ');
        console.log(`Ranking: [${leaderboardRankings}], [${this.formatTime(stats.time)}], [${Math.round(stats.troopsSent || 0)}]`);

        // Add overall game stats
        const overallStats = `
            <div class="overall-stats">
                <h3>BATTLE STATS</h3>
                <div class="stats-container">
                    <div class="stat-item">
                        <span class="stat-label">Battle Duration:</span>
                        <span class="stat-value">${this.formatTime(stats.time)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Planet Subjugations:</span>
                        <span class="stat-value">${Math.round(stats.planetsConquered || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Tunes Deployed:</span>
                        <span class="stat-value">${Math.round(stats.troopsSent || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Tunes Lost:</span>
                        <span class="stat-value">${Math.round(stats.troopsLost || 0)}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Assemble the complete game over screen
        this.gameOverScreen.innerHTML = `
            ${headerText}
            ${leaderboardHTML}
            ${overallStats}
            <button id="play-again-button" class="menu-button">PLAY AGAIN</button>
        `;
        
        // Add to parent container
        this.parentContainer.appendChild(this.gameOverScreen);
        
        // Add event listener for play again button
        document.getElementById('play-again-button').addEventListener('click', () => {
            this.remove();
            window.menuManager.switchToScreen('menu');
        });
    }
    
    // Remove the game over screen
    remove() {
        if (this.gameOverScreen) {
            this.gameOverScreen.remove();
            this.gameOverScreen = null;
        } else {
            // Also try to find and remove by ID in case the instance reference is lost
            const existingScreen = document.getElementById('game-over-screen');
            if (existingScreen) {
                existingScreen.remove();
            }
        }
    }
    
    // Helper method to format time in MM:SS format
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Helper method to get friendly display name for players
    getPlayerDisplayName(player) {
        if (!player.isAI) {
            return 'Player';
        }
        
        // Make sure aiOptions are available
        if (!this.aiOptions) {
            // Attempt to get AI options again if not already available
            this.aiOptions = window.menuManager?.aiOptions || [];
            
            // Fallback to player's aiController if aiOptions still not available
            if (!this.aiOptions || this.aiOptions.length === 0) {
                return player.aiController;
            }
        }
        
        // Find the matching AI option to get the display name
        const aiOption = this.aiOptions.find(option => option.value === player.aiController);
        return aiOption ? aiOption.name : player.aiController;
    }
}

export default GameOverScreen;