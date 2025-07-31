// assets/javascript/MenuBuilderBase.js

// MenuBuilderBase.js - Contains shared functionality for all menu builders

class MenuBuilderBase {
    constructor(container, screenManager, configManager) {
        this.container = container;
        this.screenManager = screenManager;
        this.configManager = configManager;
        
        // MODIFIED: This method is no longer needed.
        // this.createReusableElements(); 
    }
    
    // MODIFIED: Entire method removed.
    /*
    createReusableElements() {
        // Create a reusable back button template
        this.backButtonTemplate = document.createElement('button');
        this.backButtonTemplate.className = 'menu-button back-button';
        this.backButtonTemplate.textContent = '< BACK';
    }
    */
    
    // MODIFIED: Entire method removed.
    /*
    getBackButton(handler) {
        // Clone the template button
        const backButton = this.backButtonTemplate.cloneNode(true);
        // Add the specific click handler
        backButton.addEventListener('click', handler);
        return backButton;
    }
    */
    
    // Helper to clear and get a fresh menu container
    createMenuContainer() {
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create a new menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        
        // Add it to the main container
        this.container.appendChild(menuContainer);
        
        return menuContainer;
    }
}

export default MenuBuilderBase;