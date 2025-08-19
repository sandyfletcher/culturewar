// ===========================================
// root/javascript/ScreenManager.js
// ===========================================

export default class ScreenManager {
    constructor() {
        this.screens = {
            'menu': document.getElementById('menu-screen'),
            'game': document.getElementById('game-screen'),
            'game-over': document.getElementById('game-over-container'),
            'tournament-complete': document.getElementById('tournament-complete-screen')
        };
        this.currentScreen = 'menu';
        this.timer = document.getElementById('timer');
        if (this.timer) {
            this.timer.innerHTML = '<a href="https://sandyfletcher.ca" target="_blank">site by sandy</a>';
        }
    }
    switchToScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.style.display = 'none';
        });
        if (this.screens[screenName]) {
            this.screens[screenName].style.display = 
                screenName === 'game' ? 'block' : 'flex';
            this.currentScreen = screenName;
        } else {
            console.error(`Screen ${screenName} not found!`);
        }
    }
    registerScreen(name, element) {
        this.screens[name] = element;
    }
    getCurrentScreen() {
        return this.currentScreen;
    }
}