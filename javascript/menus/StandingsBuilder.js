// ===========================================
// root/javascript/menus/StandingsBuilder.js
// ===========================================

import MenuBuilderBase from '../MenuBuilderBase.js';

export default class StandingsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        const menuContainer = this.createMenuContainer();
        const content = document.createElement('div');
        content.className = 'instructions-content';
        const standingsData = window.menuManager.statsTracker.getAggregatedStats();
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
                const avgRank = player.avgRank.toFixed(2);
                tableBody += `
                    <tr>
                        <td>${rank}</td>
                        <td>${player.nickname}</td>
                        <td>${scoreText}</td>
                        <td>${winRate}%</td>
                        <td>${avgRank}</td>
                    </tr>
                `;
            });
            leaderboardHTML = `
                <h2>STANDINGS</h2>
                <div class="leaderboard">
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Combatant</th>
                                <th>Score</th>
                                <th>Win %</th>
                                <th>Avg. Rank</th>
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
            clearButton.className = 'menu-button'; // reuse base styling
            clearButton.textContent = 'Clear All Stats';
            clearButton.addEventListener('click', () => {
                if (window.confirm('Are you sure you want to permanently delete all game stats?')) {
                    window.menuManager.statsTracker.clearStats();
                    this.build(); // re-render screen to show "no data" message
                }
            });
            menuContainer.appendChild(clearButton);
        }
        window.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }
}