// menus/SettingsScreenBuilder.js - Builds the settings screen

import MenuBuilderBase from '../MenuBuilderBase.js';

class SettingsScreenBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    
    build() {
        const menuContainer = this.createMenuContainer();
        
        // Settings content placeholder
        const content = document.createElement('div');
        content.className = 'settings-content';
        content.innerHTML = `
            <h2>GAME SETTINGS</h2>
            <p>Settings will be available soon! Check back later to customize your game experience.</p>
        `;
        
        // Back button
        const backButton = this.getBackButton(() => this.parentBuilder.buildMainMenu());
        
        menuContainer.appendChild(content);
        menuContainer.appendChild(backButton);
        
        return menuContainer;
    }
}

export default SettingsScreenBuilder;