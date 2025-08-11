// ===========================================
// root/javascript/menus/StandingsBuilder.js
// ===========================================

import MenuBuilderBase from '../MenuBuilderBase.js';
import { formatTime } from '../utils.js';
import eventManager from '../EventManager.js';

export default class StandingsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager, statsTracker) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
        this.statsTracker = statsTracker;
    }
    getArchetype(player) { // determines a bot's "personality" from its stats
        const scorePerGame = player.totalCultureScore / player.gamesPlayed;
        const avgGameDuration = 180; // rough baseline for average game length
        if (player.winRate > 60 && scorePerGame > 1.5) return 'Tyrant';
        if (player.winRate > 40 && player.avgSurvival < (avgGameDuration * 0.6)) return 'Berserker';
        if (player.winRate < 15 && player.avgSurvival > (avgGameDuration * 1.2)) return 'Survivor';
        if (scorePerGame > 1.0 && player.winRate < 30) return 'Contender';
        if (scorePerGame < -1.0 && player.avgRank > 4.5) return 'Underdog';
        if (player.winRate > 45) return 'Victor';
        if (scorePerGame > 0.5) return 'Strategist';
        if (player.avgRank < 3.0) return 'Professional';
        return 'Mysterious';
    }
    build() {
        const menuContainer = this.createMenuContainer();
        const content = document.createElement('div');
        content.className = 'instructions-content';
        const standingsData = this.statsTracker.getAggregatedStats();
        let leaderboardHTML;
        let hasData = standingsData.length > 0;
        if (!hasData) {
            leaderboardHTML = `
                <h2>STANDINGS</h2>
                <p style="text-align: center; opacity: 0.7; margin: 2rem 0;">
                    No game data found.<br>
                    Play a few matches to populate the table!
                </p>
            `;
        } else {
            let tableBody = '';
            standingsData.forEach((player, index) => {
                const rank = index + 1;
                const winRate = player.winRate.toFixed(1);
                const scoreText = player.totalCultureScore > 0 ? `+${player.totalCultureScore.toFixed(1)}` : player.totalCultureScore.toFixed(1);
                const avgSurvival = formatTime(player.avgSurvival);
                const archetype = this.getArchetype(player); // Get the bot's title
                tableBody += `
                    <tr>
                        <td>${rank}</td>
                        <td>
                            <div>${player.nickname}</div>
                            <div style="font-size: 0.8em; opacity: 0.7;">${archetype}</div>
                        </td>
                        <td>${scoreText}</td>
                        <td>${winRate}%</td>
                        <td>${avgSurvival}</td>
                    </tr>
                `;
            });
            leaderboardHTML = `
                <h2>STANDINGS</h2>
                <div class="leaderboard">
                    <table>
                        <thead>
                            <tr>
                                <th title="Overall rank based on Culture Score">Rank</th>
                                <th title="Bot's name and calculated archetype">Combatant</th>
                                <th title="Total points earned across all games. Rewards high placement.">Score</th>
                                <th title="Percentage of games where the bot placed first">Win %</th>
                                <th title="Average time the bot survived in each match">Avg. Survival</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableBody}
                        </tbody>
                    </table>
                </div>
            `;
        }
        content.innerHTML = leaderboardHTML;
        menuContainer.appendChild(content);
        if (hasData) {
            const clearButton = document.createElement('button');
            clearButton.id = 'clear-stats-button';
            clearButton.className = 'menu-button';
            clearButton.textContent = 'Clear All Stats';
            clearButton.addEventListener('click', () => {
                eventManager.emit('confirm-action', {
                    message: 'Are you sure you want to permanently delete all game stats?',
                    onConfirm: () => {
                        this.statsTracker.clearStats();
                        this.build();
                    }
                });
            });
            menuContainer.appendChild(clearButton);
        }
        this.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }
}