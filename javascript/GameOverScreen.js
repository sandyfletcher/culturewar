// ===========================================
// root/javascript/GameOverScreen.js
// ===========================================

import { formatTime } from './utils.js';

export default class GameOverScreen {
    constructor(parentContainer, configManager, menuManager) {
        this.container = parentContainer;
        this.configManager = configManager;
        this.menuManager = menuManager;
    }
    show(stats, gameInstance, onPlayAgainCallback) {
        this.remove();
        const gameOverContent = document.createElement('div');
        gameOverContent.id = 'game-over-screen';
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
        const winnerName = leaderboardData.length > 0 ? leaderboardData[0].displayName : 'Nobody';
        headerText = `<h2>Successful Subjugation:<br>${winnerName}</h2>`;
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
        const persuasionRate = stats.planetsConquered > 0 ? (stats.troopsSent / stats.planetsConquered).toFixed(1) : 'N/A';
        const overallStats = `
            <div class="overall-stats">
                <h3>BATTLE STATS</h3>
                <div class="stats-container">
                    <div class="stat-item">
                        <span class="stat-label">Duration:</span>
                        <span class="stat-value">${formatTime(stats.time)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Planets Converted:</span>
                        <span class="stat-value">${Math.round(stats.planetsConquered || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Culture Dispatched:</span>
                        <span class="stat-value">${Math.round(stats.troopsSent || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Casualties:</span>
                        <span class="stat-value">${Math.round(stats.troopsLost || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label" >Avg. Persuasion Rate:</span>
                        <span class="stat-value">${persuasionRate}</span>
                    </div>
                </div>
            </div>
        `;
        const gameIsReplayable = !gameInstance.config.players.some(p => p.type === 'human');
        const buttonsHTML = `
            <div class="game-over-buttons">
                <button id="play-again-button">PLAY AGAIN</button>
                ${gameIsReplayable ? '<button id="save-replay-button">SAVE REPLAY</button>' : ''}
            </div>
        `;
        gameOverContent.innerHTML = `
            ${headerText}
            ${leaderboardHTML}
            ${overallStats}
            ${buttonsHTML}
        `;
        this.container.appendChild(gameOverContent);
        document.getElementById('play-again-button').addEventListener('click', () => {
            this.remove();
            if (onPlayAgainCallback) {
                onPlayAgainCallback();
            }
        });
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
        if (this.container) {
            this.container.innerHTML = ''; // clear content of dedicated screen container
        }
    }
}