// ===========================================
// root/javascript/menus/StandingsBuilder.js
// ===========================================

import MenuBuilderBase from './MenuBuilderBase.js';
import { formatTime } from '../utils.js';
import eventManager from '../EventManager.js';
import botRegistry from '../bots/index.js';

export default class StandingsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager, statsTracker) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
        this.statsTracker = statsTracker;
    }
    getArchetype(player) { // determine a bot's personality from its stats
        if (player.gamesPlayed === 0) return 'Rookie'; // archetype for bots that haven't played yet
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
        this.menuManager.uiManager.setHeaderTitle('STANDINGS'); // Set the header title
        const menuContainer = this.createMenuContainer();
        const content = document.createElement('div');
        content.className = 'instructions-content';
        // 1. Get stats and create a lookup map
        const aggregatedStats = this.statsTracker.getAggregatedStats();
        const statsMap = new Map(aggregatedStats.map(s => [s.nickname, s]));
        // 2. Combine bot registry data with stats
        const combinedData = botRegistry.map(bot => {
            const stats = statsMap.get(bot.value); 
            return {
                ...bot, // value, name, class, creationDate, description
                stats: stats || { // default stats if bot has not played
                    nickname: bot.name, wins: 0, gamesPlayed: 0, totalSurvivalTime: 0,
                    totalCultureScore: 0, totalRank: 0, winRate: 0, avgSurvival: 0, avgRank: 0
                }
            };
        });
        // 3. Sort by culture score, then alphabetically for those with 0 score
        combinedData.sort((a, b) => {
            if (b.stats.totalCultureScore !== a.stats.totalCultureScore) {
                return b.stats.totalCultureScore - a.stats.totalCultureScore;
            }
            return a.name.localeCompare(b.name);
        });
        // 4. Build HTML table with expandable rows
        let tableBody = '';
        combinedData.forEach((player, index) => {
            const rank = player.stats.gamesPlayed > 0 ? index + 1 : '—';
            const winRate = player.stats.gamesPlayed > 0 ? `${player.stats.winRate.toFixed(1)}` : '—';
            const scoreText = player.stats.gamesPlayed > 0 ? (player.stats.totalCultureScore > 0 ? `+${player.stats.totalCultureScore.toFixed(1)}` : player.stats.totalCultureScore.toFixed(1)) : '—';
            const avgSurvival = player.stats.gamesPlayed > 0 ? formatTime(player.stats.avgSurvival) : '—';
            const avgRank = player.stats.gamesPlayed > 0 ? player.stats.avgRank.toFixed(1) : '—';
            const archetype = this.getArchetype(player.stats);
            // always visible main row
            tableBody += `
                <tr class="standings-main-row" data-bot-name="${player.name}">
                    <td class="col-rank">${rank}</td>
                    <td class="col-fighter">
                        <div>${player.name}</div>
                        <div style="font-size: 0.8em; opacity: 1;">${archetype}</div>
                    </td>
                    <td class="col-score">${scoreText}</td>
                    <td class="col-games">${player.stats.gamesPlayed}</td>
                    <td class="col-winrate">${winRate}</td>
                    <td class="col-survival">${avgSurvival}</td>
                    <td class="col-avgrank">${avgRank}</td>
                </tr>
            `;
            // initially hidden detail row
            tableBody += `
                <tr class="standings-detail-row" style="display: none;">
                    <td colspan="7">
                        <div class="standings-card">
                            <p><strong>Commissioned:</strong> ${player.creationDate}</p>
                            <p>${player.description}</p>
                        </div>
                    </td>
                </tr>
            `;
        });
        const leaderboardHTML = `
            <div class="leaderboard standings">
                <table>
                    <thead>
                        <tr>
                            <th class="col-rank" title="Overall Rank by Culture Score">Rank</th>
                            <th class="col-fighter" title="Bot Name and Archetype">Fighter</th>
                            <th class="col-score" title="Elo Accumulation Across All Games">Score</th>
                            <th class="col-games" title="Total Games Played">Games</th>
                            <th class="col-winrate" title="First-Place Percentage">Win %</th>
                            <th class="col-survival" title="Average Survival Time">Avg. Life</th>
                            <th class="col-avgrank" title="Average Match Ranking">Avg. Rank</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableBody}
                    </tbody>
                </table>
            </div>
        `;
        content.innerHTML = leaderboardHTML;
        menuContainer.appendChild(content);
        // 5. Add event listeners for expanding/collapsing rows
        menuContainer.querySelectorAll('.standings-main-row').forEach(row => {
            row.addEventListener('click', () => {
                const detailRow = row.nextElementSibling;
                if (detailRow && detailRow.classList.contains('standings-detail-row')) {
                    const isHidden = detailRow.style.display === 'none';
                    detailRow.style.display = isHidden ? 'table-row' : 'none';
                    row.classList.toggle('active', isHidden);
                }
            });
        });
        if (aggregatedStats.length > 0) {
            const clearButton = document.createElement('button');
            clearButton.id = 'clear-stats-button';
            clearButton.className = 'menu-button -subtle';
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