// ===========================================
// root/javascript/menus/ReplaysBuilder.js (NEW FILE)
// ===========================================

import MenuBuilderBase from '../MenuBuilderBase.js';

export default class ReplaysBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
    }

    build() {
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
                            <button class="replay-button watch" data-timestamp="${replay.timestamp}">Watch</button>
                            <button class="replay-button delete" data-timestamp="${replay.timestamp}">Delete</button>
                        </div>
                    </div>
                `;
            });
        } else {
            replayListHTML = `<p style="text-align: center; margin: 2rem 0;">No replays saved. Play some bot-only games to save replays of the final match!</p>`;
        }

        menuContainer.innerHTML = `
            <div class="instructions-content">
                <h2>SAVED REPLAYS</h2>
                <div class="replay-list">${replayListHTML}</div>
                ${replays.length > 0 ? '<button id="clear-replays-button" class="menu-button">Clear All Replays</button>' : ''}
            </div>
        `;

        menuContainer.addEventListener('click', (e) => {
            const timestamp = e.target.dataset.timestamp;
            if (!timestamp) return;

            const numericTimestamp = parseInt(timestamp, 10);

            if (e.target.classList.contains('watch')) {
                const replay = replays.find(r => r.timestamp === numericTimestamp);
                if (replay) {
                    this.menuManager.startReplay(replay.config);
                }
            } else if (e.target.classList.contains('delete')) {
                this.menuManager.replayManager.deleteReplay(numericTimestamp);
                this.build(); // Refresh the view
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