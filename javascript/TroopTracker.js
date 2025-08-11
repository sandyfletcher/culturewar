// ===========================================
// root/javascript/TroopTracker.js
// ===========================================

import { config } from './config.js';

export default class TroopTracker {
    constructor(game) {
        this.game = game;
        this.headerElement = document.querySelector('header h1');
        this.originalTitle = this.headerElement.textContent;
        this.headerContainer = document.querySelector('header');
        this.cleanupExistingBars();
        this.troopBarContainer = document.createElement('div');
        this.troopBarContainer.id = 'troop-bar-container';
        this.troopBarContainer.style.display = 'none';
        this.headerContainer.appendChild(this.troopBarContainer);
        this.playerColors = this.game.playersController.playerColors;
        this.lastTotalTroops = 0;
        this.configManager = game.configManager;
    }
    cleanupExistingBars() {
        const existingBars = document.querySelectorAll('#troop-bar-container');
        existingBars.forEach(bar => bar.remove());
    }
    showTroopBar() {
        this.headerElement.style.display = 'none';
        this.cleanupExistingBars();
        if (!this.troopBarContainer.parentNode) {
            this.headerContainer.appendChild(this.troopBarContainer);
        }
        this.troopBarContainer.style.display = 'flex';
        this.createBarLayout();
        this.update();
    }
    createBarLayout() {
        const barElement = document.createElement('div');
        barElement.id = 'troop-bar';
        this.barSegmentsContainer = document.createElement('div');
        this.barSegmentsContainer.id = 'troop-bar-segments';
        barElement.appendChild(this.barSegmentsContainer);
        this.troopBarContainer.innerHTML = '';
        this.troopBarContainer.appendChild(barElement);
    }
    hideTroopBar() {
        this.headerElement.style.display = 'block';
        if (this.troopBarContainer && this.troopBarContainer.parentNode) {
            this.troopBarContainer.remove();
        }
    }
    update() {
        if (!this.troopBarContainer || this.troopBarContainer.style.display === 'none') return;
        const players = this.game.playersController.players;
        let totalTroops = 0;
        const playerTroops = {};
        for (const planet of this.game.planets) {
            if (planet.owner !== null) {
                if (!playerTroops[planet.owner]) {
                    playerTroops[planet.owner] = 0;
                }
                playerTroops[planet.owner] += planet.troops;
                totalTroops += planet.troops;
            }
        }
        for (const movement of this.game.troopMovements) {
            if (!playerTroops[movement.owner]) {
                playerTroops[movement.owner] = 0;
            }
            playerTroops[movement.owner] += movement.amount;
            totalTroops += movement.amount;
        }
        this.lastTotalTroops = totalTroops; // store calculated total for renderer
        if (this.barSegmentsContainer) {
            this.barSegmentsContainer.innerHTML = '';
            const orderedPlayerIds = this.game.playersController.players.map(p => p.id);
            orderedPlayerIds.push('neutral');
            for (const playerId of orderedPlayerIds) {
                if (playerTroops[playerId] && playerTroops[playerId] > 0) {
                    const percentage = (playerTroops[playerId] / totalTroops) * 100;
                    const segment = document.createElement('div');
                    segment.className = 'troop-bar-segment';
                    segment.style.width = `${percentage}%`;
                    const color = this.playerColors[playerId] || config.ui.visuals.fallbackColor;
                    segment.style.backgroundColor = color;
                    segment.title = `Player ${playerId}: ${Math.round(playerTroops[playerId])} troops (${percentage.toFixed(1)}%)`;
                    if (playerId !== 'neutral') { // add player nickname to segment
                        const playerInfo = this.game.playersController.getPlayerById(playerId);
                        if (playerInfo) {
                            const nickname = this.configManager.getPlayerDisplayName(playerInfo, this.game.config.players, true);
                            const nameSpan = document.createElement('span');
                            nameSpan.className = 'troop-bar-name';
                            nameSpan.textContent = nickname;
                            const minPercentage = 7; // hide name if segment is less than 7% of bar
                            const maxPercentage = 30; // font size maxes out at 25%, 
                            const minFontSize = 8; // smallest font size in pixels
                            const maxFontSize = 16; // largest size
                            if (percentage < minPercentage) {
                                nameSpan.style.display = 'none';
                            } else {
                                let fontSize;
                                if (percentage >= maxPercentage) {
                                    fontSize = maxFontSize;
                                } else { // linearly scale font size between min and maxpercentage
                                    fontSize = minFontSize + (percentage - minPercentage) * (maxFontSize - minFontSize) / (maxPercentage - minPercentage);
                                }
                                nameSpan.style.fontSize = `${fontSize.toFixed(1)}px`;
                            }
                            segment.appendChild(nameSpan);
                        }
                    }
                    this.barSegmentsContainer.appendChild(segment);
                }
            }
        }
    }
    dispose() {
        this.hideTroopBar();
        this.troopBarContainer = null;
    }
}