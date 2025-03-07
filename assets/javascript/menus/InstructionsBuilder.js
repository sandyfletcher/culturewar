// menus/InstructionsBuilder.js - Builds the instructions screen

import MenuBuilderBase from '../MenuBuilderBase.js';

class InstructionsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    
    build() {
        const menuContainer = this.createMenuContainer();
        
        // Instructions content
        const content = document.createElement('div');
        content.className = 'instructions-content';
        content.innerHTML = `
            <h2>GAME INSTRUCTIONS</h2>
            <div class="instructions-section">
                <h3>OBJECTIVE</h3>
                <p>Conquer all planets to defeat your opponents or have the most planets when time runs out.</p>
                
                <h3>CONTROLS</h3>
                <ul>
                    <li><strong>Select Planet:</strong> Click on a planet you own</li>
                    <li><strong>Send Troops:</strong> Click a second planet to send troops</li>
                    <li><strong>Cancel Selection:</strong> Right-click or click on empty space</li>
                </ul>
                
                <h3>GAMEPLAY</h3>
                <p>Each planet continuously generates troops over time. The larger the planet, the faster it produces troops.</p>
                <p>Send troops to neutral or enemy planets to capture them, or to your own planets to reinforce them.</p>
                <p>When attacking, if you send more troops than the defending planet has, you'll capture it.</p>
            </div>
        `;

        // Back button
        const backButton = this.getBackButton(() => this.parentBuilder.buildMainMenu());
        
        menuContainer.appendChild(content);
        menuContainer.appendChild(backButton);
        
        return menuContainer;
    }
}

export default InstructionsBuilder;