// menus/CampaignMenuBuilder.js - Builds the campaign menu screen

import MenuBuilderBase from '../MenuBuilderBase.js';

class CampaignMenuBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    
    build() {
        const menuContainer = this.createMenuContainer();
        
        // Campaign content placeholder
        const content = document.createElement('div');
        content.className = 'campaign-content';
        content.innerHTML = `
            <h2>CAMPAIGN MODE</h2>
            <p>A series of scripted missions will be implemented here, but we ain't written on scripts yet.</p>
        `;
        
        // Back button
        const backButton = this.getBackButton(() => this.parentBuilder.buildMainMenu());
        
        menuContainer.appendChild(content);
        menuContainer.appendChild(backButton);
        
        return menuContainer;
    }
}

export default CampaignMenuBuilder;