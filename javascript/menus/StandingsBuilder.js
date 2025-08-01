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
        if (standingsData.length === 0) {
            leaderboardHTML = `
                <h2>STANDINGS</h2>
                <p style="text-align: center; opacity: 0.7; margin: 2rem 0;">
                    No game data found. Play a few matches to see statistics here!
                </p>
            `;
        } else {
            let tableBody = '';
            standingsData.forEach((player, index) => {
                const rank = index + 1;
                const winRate = player.winRate.toFixed(1);
                const avgSurvival = window.menuManager.formatTime(player.avgSurvival);
                tableBody += `
                    <tr>
                        <td>${rank}</td>
                        <td>${player.nickname}</td>
                        <td>${winRate}%</td>
                        <td>${avgSurvival}</td>
                    </tr>
                `;
            });
            leaderboardHTML = `
                <h2>STANDINGS</h2>
                <p style="text-align: center; opacity: 0.7; margin-bottom: 1rem;">
                    Live statistics from all recorded games.
                </p>
                <div class="leaderboard">
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Combatant</th>
                                <th>Win %</th>
                                <th>Avg. Survival</th>
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
        window.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }
}