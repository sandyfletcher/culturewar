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
        const leftColumn = document.createElement('div');
        leftColumn.className = 'troop-column left-column';
        this.troopCountElement = document.createElement('div');
        this.troopCountElement.id = 'total-troops-count';
        leftColumn.appendChild(this.troopCountElement);
        const rightColumn = document.createElement('div');
        rightColumn.className = 'troop-column right-column';
        const timerElement = document.createElement('div');
        timerElement.id = 'game-timer';
        rightColumn.appendChild(timerElement);
        barElement.appendChild(leftColumn);
        barElement.appendChild(rightColumn);
        this.barSegmentsContainer = document.createElement('div');
        this.barSegmentsContainer.id = 'troop-bar-segments';
        barElement.appendChild(this.barSegmentsContainer);
        this.troopBarContainer.innerHTML = '';
        this.troopBarContainer.appendChild(barElement);
        if (this.game.timerManager) {
            this.game.timerManager.timerElement = timerElement;
            this.game.timerManager.updateDisplay();
        }
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
        if (this.troopCountElement) {
            this.troopCountElement.textContent = `${Math.round(totalTroops)}`;
        }
        if (this.barSegmentsContainer) {
            this.barSegmentsContainer.innerHTML = '';
            const orderedPlayerIds = [
                'player1', 'player2', 'player3', 'player4', 'player5', 'player6', 'neutral'
            ];
            for (const playerId of orderedPlayerIds) {
                if (playerTroops[playerId] && playerTroops[playerId] > 0) {
                    const percentage = (playerTroops[playerId] / totalTroops) * 100;
                    const segment = document.createElement('div');
                    segment.className = 'troop-bar-segment';
                    segment.style.width = `${percentage}%`;
                    const color = this.playerColors[playerId] || config.ui.visuals.fallbackColor;
                    segment.style.backgroundColor = color;
                    segment.title = `Player ${playerId}: ${Math.round(playerTroops[playerId])} troops (${percentage.toFixed(1)}%)`;

                    // Add player nickname to the segment
                    if (playerId !== 'neutral') {
                        const playerInfo = this.game.playersController.getPlayerById(playerId);
                        if (playerInfo) {
                            const nickname = window.menuManager.getPlayerDisplayName(playerInfo, this.game, true);
                            const nameSpan = document.createElement('span');
                            nameSpan.className = 'troop-bar-name';
                            nameSpan.textContent = nickname;

                            // Constants for dynamic font sizing and visibility
                            const minPercentage = 5;    // Hide name if segment is less than 5% of the bar
                            const maxPercentage = 25;   // At 25% of bar width, font size is maxed out
                            const minFontSize = 9;      // Smallest font size in pixels
                            const maxFontSize = 13;     // Largest font size in pixels

                            if (percentage < minPercentage) {
                                nameSpan.style.display = 'none';
                            } else {
                                let fontSize;
                                if (percentage >= maxPercentage) {
                                    fontSize = maxFontSize;
                                } else {
                                    // Linearly scale font size between min and max percentage
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