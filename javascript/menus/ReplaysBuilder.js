// ===========================================
// root/javascript/menus/ReplaysBuilder.js
// ===========================================

import MenuBuilderBase from './MenuBuilderBase.js';

export default class ReplaysBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        this.menuManager.uiManager.setHeaderTitle('SAVED REPLAYS');
        const menuContainer = this.createMenuContainer();
        const replays = this.menuManager.replayManager.getReplays();
        let replayListHTML = '';
        if (replays.length > 0) {
            replays.forEach(replay => {
                replayListHTML += `
                    <div class="replay-entry">
                        <div class="replay-info">
                            <span class="replay-name">${replay.name}</span>
                            <span class="replay-players">${replay.players}</span>
                            <span class="replay-date">${new Date(replay.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="replay-actions">
                            <button class="menu-button -small -cyan" data-timestamp="${replay.timestamp}" data-action="watch">Watch</button>
                            <button class="menu-button -small -red" data-timestamp="${replay.timestamp}" data-action="delete">Delete</button>
                        </div>
                    </div>
                `;
            });
        } else {
            replayListHTML = `<p style="text-align: center; margin: 2rem 0;">No replays saved. Replays are automatically saved for bot-only games and tournament finals.</p>`;
        }
        menuContainer.innerHTML = `
            <div class="instructions-content">
                <div class="replay-list">${replayListHTML}</div>
                ${replays.length > 0 ? '<button id="clear-replays-button" class="menu-button">Clear All Replays</button>' : ''}
            </div>
        `;
        menuContainer.addEventListener('click', (e) => {
            const timestamp = e.target.dataset.timestamp;
            if (!timestamp) return;
            const action = e.target.dataset.action; // get action
            if (action === 'watch') {
                const numericTimestamp = parseInt(timestamp, 10);
                const replay = replays.find(r => r.timestamp === numericTimestamp);
                if (replay) {
                    this.menuManager.startReplay(replay.config);
                }
            } else if (action === 'delete') {
                const numericTimestamp = parseInt(timestamp, 10);
                this.menuManager.replayManager.deleteReplay(numericTimestamp);
                this.build(); // refresh view
            }
        });
        const clearButton = menuContainer.querySelector('#clear-replays-button');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (window.confirm("Are you sure you want to delete all saved replays? This cannot be undone.")) {
                    this.menuManager.replayManager.clearAllReplays();
                    this.build();
                }
            });
        }
        this.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }
}