// assets/javascript/MenuBuilderBase.js - shared functionality for menu builders

class MenuBuilderBase {
    constructor(container, screenManager, configManager) {
        this.container = container;
        this.screenManager = screenManager;
        this.configManager = configManager;
    }
    createMenuContainer() { // helper to clear and get a fresh menu container
        this.container.innerHTML = ''; // clear existing content
        const menuContainer = document.createElement('div'); // create a new menu container
        menuContainer.className = 'menu-container';
        this.container.appendChild(menuContainer); // add it to main container
        return menuContainer;
    }
}

export default MenuBuilderBase;