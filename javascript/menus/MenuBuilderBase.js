// ===========================================
// root/javascript/MenuBuilderBase.js
// ===========================================

export default class MenuBuilderBase {
    constructor(container, screenManager, configManager, menuManager) {
        this.container = container;
        this.screenManager = screenManager;
        this.configManager = configManager;
        this.menuManager = menuManager;
    }
    createMenuContainer() { // helper to clear and get a fresh menu container
        this.container.innerHTML = ''; // clear existing content
        const menuContainer = document.createElement('div'); // create a new menu container
        menuContainer.className = 'menu-container';
        this.container.appendChild(menuContainer); // add it to main container
        return menuContainer;
    }
}