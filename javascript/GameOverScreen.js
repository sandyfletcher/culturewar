// ===========================================
// root/javascript/GameOverScreen.js
// ===========================================

export default class GameOverScreen {
    constructor(parentContainer) {
        this.parentContainer = parentContainer || document.getElementById('inner-container');
        this.gameOverScreen = null;
    }
    show(stats, gameInstance, onPlayAgainCallback) {
        this.remove();
        this.gameOverScreen = document.createElement('div');
        this.gameOverScreen.id = 'game-over-screen';
        const playerStats = gameInstance.playersController.getPlayerStats()
            .filter(player => player.id !== 'neutral');
        const allPlayersData = gameInstance.playersController.players;
        const playerCount = allPlayersData.length; // get total player count for scoring
        const eliminationTimes = gameInstance.gameState.eliminationTimes || {};
        const gameTime = stats.time;
        const leaderboardData = allPlayersData.map(playerData => {
            const playerStat = playerStats.find(p => p.id === playerData.id) || { planets: 0, troops: 0 };
            const isWinner = playerData.id === stats.winner;
            const survivalTime = eliminationTimes[playerData.id] || gameTime;
            return {
                id: playerData.id,
                displayName: window.menuManager.getPlayerDisplayName(playerData, gameInstance, false),
                nickname: window.menuManager.getPlayerDisplayName(playerData, gameInstance, true),
                planets: playerStat.planets,
                troops: Math.floor(playerStat.troops || 0),
                survivalTime,
                isWinner
            };
        });
        leaderboardData.sort((a, b) => {
            if (a.planets !== b.planets) return b.planets - a.planets;
            if (a.troops !== b.troops) return b.troops - a.troops;
            return b.survivalTime - a.survivalTime;
        });
        let headerText;
        if (stats.hasHumanPlayer) {
            headerText = `<h1>${stats.playerWon ? 'VICTORY!' : 'DEFEAT'}</h1><h2>Successful Subjugation</h2>`;
        } else {
            headerText = `<h1>BATTLE COMPLETE</h1><h2>Successful Subjugation:<br>${leaderboardData[0].displayName}</h2>`;
        }
        let leaderboardHTML = `
            <div class="leaderboard">
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Player</th>
                            <th>Planets</th>
                            <th>Troops</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        const finalLeaderboardData = leaderboardData.map((player, index) => { // add player rank and score to leaderboard data
            const rank = index + 1;
            const cultureScore = ((playerCount + 1) / 2) - rank;
            return { ...player, rank, cultureScore };
        });
        finalLeaderboardData.forEach(player => {
            // Format score to one decimal place and show plus sign
            const scoreText = player.cultureScore > 0 ? `+${player.cultureScore.toFixed(1)}` : player.cultureScore.toFixed(1);
            const rowClass = player.isWinner ? 'winner' : '';
            leaderboardHTML += `
                <tr class="${rowClass}">
                    <td>${player.rank}</td>
                    <td>${player.displayName}</td>
                    <td>${player.planets}</td>
                    <td>${player.troops}</td>
                    <td>${scoreText}</td>
                </tr>
            `;
        });
        leaderboardHTML += `</tbody></table></div>`;
        const gameId = Date.now();
        const gameStatsLog = `[GAME_STATS],${gameId},${stats.time.toFixed(2)},${Math.round(stats.troopsSent || 0)},${Math.round(stats.planetsConquered || 0)},${Math.round(stats.troopsLost || 0)}`;
        console.log(gameStatsLog);
        finalLeaderboardData.forEach(player => { // log new score
        finalLeaderboardData.forEach(player => {
            const survivalTime = player.survivalTime.toFixed(2);
            const originalPlayerData = allPlayersData.find(p => p.id === player.id);
            const aggregationKey = originalPlayerData.aiController || player.nickname;
            // Log score with decimal precision
            const playerStatsLog = `[PLAYER_STATS],${gameId},${player.rank},${aggregationKey},${player.planets},${player.troops},${survivalTime},${player.cultureScore.toFixed(4)}`;
            console.log(playerStatsLog);
        });
        const overallStats = `
            <div class="overall-stats">
                <h3>BATTLE STATS</h3>
                <div class="stats-container">
                    <div class="stat-item">
                        <span class="stat-label">Preservation:</span>
                        <span class="stat-value">${window.menuManager.formatTime(stats.time)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Persuasions:</span>
                        <span class="stat-value">${Math.round(stats.planetsConquered || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Proclamations:</span>
                        <span class="stat-value">${Math.round(stats.troopsSent || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Extirpations:</span>
                        <span class="stat-value">${Math.round(stats.troopsLost || 0)}</span>
                    </div>
                </div>
            </div>
        `;
        this.gameOverScreen.innerHTML = `
            ${headerText}
            ${leaderboardHTML}
            ${overallStats}
            <button id="play-again-button" class="menu-button">PLAY AGAIN</button>
        `;
        this.parentContainer.appendChild(this.gameOverScreen);
        document.getElementById('play-again-button').addEventListener('click', () => {
            this.remove();
            if (onPlayAgainCallback) {
                onPlayAgainCallback();
            }
        });
    }
    remove() {
        if (this.gameOverScreen) {
            this.gameOverScreen.remove();
            this.gameOverScreen = null;
        } else {
            const existingScreen = document.getElementById('game-over-screen');
            if (existingScreen) {
                existingScreen.remove();
            }
        }
    }
}