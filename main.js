// ===========================================
// root/main.js
// ===========================================

import UIManager from './javascript/UIManager.js';
import MenuManager from './javascript/MenuManager.js';

class App {
    constructor() {
        const uiManager = new UIManager();
        new MenuManager(uiManager);
    }
}

new App();