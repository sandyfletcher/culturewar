// ===========================================
// root/javascript/GameOverScreen.js
// ===========================================

export default class GameOverScreen {
    constructor(parentContainer, configManager, menuManager) {
        this.parentContainer = parentContainer || document.getElementById('inner-container');
        this.gameOverScreen = null;
        this.configManager = configManager;
        this.menuManager = menuManager;
    }
    show(stats, gameInstance, onPlayAgainCallback) {
        this.remove();
        this.gameOverScreen = document.createElement('div');
        this.gameOverScreen.id = 'game-over-screen';
        const allPlayersData = gameInstance.playersController.players;
        const playerStatsMap = new Map(
            gameInstance.playersController.getPlayerStats()
                .filter(p => p.id !== 'neutral')
                .map(p => [p.id, p])
        );
        const playerCount = allPlayersData.length;
        const eliminationTimes = gameInstance.gameState.eliminationTimes || {};
        const gameTime = stats.time;

        const leaderboardData = allPlayersData.map(playerData => {
            const playerStat = playerStatsMap.get(playerData.id) || { planets: 0, troops: 0 };
            const isWinner = playerData.id === stats.winner;
            const survivalTime = eliminationTimes[playerData.id] || gameTime;
            return {
                id: playerData.id,
                displayName: this.configManager.getPlayerDisplayName(playerData, gameInstance.config.players, false),
                nickname: this.configManager.getPlayerDisplayName(playerData, gameInstance.config.players, true),
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
            const winnerName = leaderboardData.length > 0 ? leaderboardData[0].displayName : 'Nobody';
            headerText = `<h1>BATTLE COMPLETE</h1><h2>Successful Subjugation:<br>${winnerName}</h2>`;
        }
        let leaderboardHTML = `
            <div class="leaderboard">
                <table>
                    <thead>
                        <tr>
                            <th class="col-rank">Rank</th>
                            <th class="col-fighter">Fighter</th>
                            <th class="col-planets">Planets</th>
                            <th class="col-troops">Troops</th>
                            <th class="col-score">Score</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        const finalLeaderboardData = leaderboardData.map((player, index) => {
            const rank = index + 1;
            const cultureScore = ((playerCount + 1) / 2) - rank;
            return { ...player, rank, cultureScore };
        });
        finalLeaderboardData.forEach(player => {
            const scoreText = player.cultureScore > 0 ? `+${player.cultureScore.toFixed(1)}` : player.cultureScore.toFixed(1);
            const rowClass = player.isWinner ? 'winner' : '';
            leaderboardHTML += `
                <tr class="${rowClass}">
                    <td class="col-rank">${player.rank}</td>
                    <td class="col-fighter">${player.displayName}</td>
                    <td class="col-planets">${player.planets}</td>
                    <td class="col-troops">${player.troops}</td>
                    <td class="col-score">${scoreText}</td>
                </tr>
            `;
        });
        leaderboardHTML += `</tbody></table></div>`;
        const overallStats = `
            <div class="overall-stats">
                <h3>BATTLE STATS</h3>
                <div class="stats-container">
                    <div class="stat-item">
                        <span class="stat-label">Preservation:</span>
                        <span class="stat-value">${this.menuManager.formatTime(stats.time)}</span>
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
        // NEW: Add a container for buttons
        const gameIsReplayable = !gameInstance.config.players.some(p => p.type === 'human');
        const buttonsHTML = `
            <div class="game-over-buttons">
                <button id="play-again-button">PLAY AGAIN</button>
                ${gameIsReplayable ? '<button id="save-replay-button">SAVE REPLAY</button>' : ''}
            </div>
        `;
        this.gameOverScreen.innerHTML = `
            ${headerText}
            ${leaderboardHTML}
            ${overallStats}
            ${buttonsHTML}
        `;
        this.parentContainer.appendChild(this.gameOverScreen);
        document.getElementById('play-again-button').addEventListener('click', () => {
            this.remove();
            if (onPlayAgainCallback) {
                onPlayAgainCallback();
            }
        });
        // NEW: Add event listener for the save replay button
        if (gameIsReplayable) {
            document.getElementById('save-replay-button').addEventListener('click', (e) => {
                const replayName = `Game: ${gameInstance.config.players.map(p => p.aiController).join(' vs ')}`;
                this.menuManager.replayManager.saveReplay(gameInstance.config, replayName);
                e.target.textContent = 'SAVED!';
                e.target.disabled = true;
            });
        }
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