// ===========================================
// root/javascript/menus/InstructionsBuilder.js
// ===========================================

import MenuBuilderBase from './MenuBuilderBase.js';

export default class InstructionsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        this.menuManager.uiManager.setHeaderTitle('INSTRUCTIONS'); // <-- ADD THIS LINE
        const menuContainer = this.createMenuContainer();
        const content = document.createElement('div'); // instructions content
        content.className = 'instructions-content';
        content.innerHTML = `
            <div class="instructions-section">
                <h3>GAMEPLAY</h3>
                <ul>
                    <li>The map is populated with a starting planet for each player, and a random assortment of neutral planets</li>
                    <li>Neutral planets are stagnant, but player-owned planets generate new culture continuously at a rate relative to their size</li>
                    <li>Players can send their accumulated culture out towards nearby planets, which reinforces allied planets but trading 1-for-1 with opponent-controlled planets</li>
                    <li>If the amount of culture arriving at a planet exceeds the amount already there, control of the planet is seized by the invader</li>
                    <li>Victory is achieved when all opponent culture is eradicated, or when the timer runs out and the winner is whomever controls the most planets (tiebreaker: most troops)</li>
                </ul>
                <h3>CONTROLS</h3>
                <ol>
                    <li><strong>Click Planet You Control:</strong> select the planet you'd like to dispatch culture from</li>
                    <li><strong>Click Target Planet:</strong> dispatch culture from your planet to the target</li>
                </ol>
                <h3>ADVANCED</h3>
                <ul>
                    <li><strong>Box:</strong> click and drag to create a box that selects any planets you control touched by the box</li>
                    <li><strong>Onslaught:</strong> double-click a planet you control to select all your planets</li>
                    <li><strong>Allocation:</strong> use the slider at the bottom to change what percentage of culture is dispatched at once</li>
                </ul>
            </div>
        `;
        menuContainer.appendChild(content);
        this.menuManager.footerManager.showBackButton(() => { // set footer to back button
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }
}