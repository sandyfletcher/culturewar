class ScreenManager {
    constructor() {
        this.screens = {
            'menu': document.getElementById('menu-screen'),
            'game': document.getElementById('game-screen')
            // Other screens can be added here or dynamically
        };
        this.currentScreen = 'menu';
        this.timer = document.getElementById('timer');
        // Initialize timer with link
        if (this.timer) {
            this.timer.innerHTML = '<a href="https://sandyfletcher.ca" target="_blank">site by sandy</a>';
        }
    }
    
    switchToScreen(screenName) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.style.display = 'none';
        });
        
        // Show requested screen
        if (this.screens[screenName]) {
            this.screens[screenName].style.display = 
                screenName === 'menu' ? 'flex' : 'block';
            this.currentScreen = screenName;
            
            // Update footer based on screen
            this.updateFooter(screenName);
        } else {
            console.error(`Screen ${screenName} not found!`);
        }
    }
    
    updateFooter(screenName) {
        if (screenName === 'game') {
            this.timer.innerHTML = '';
        } else {
            this.timer.innerHTML = '<a href="https://sandyfletcher.ca" target="_blank">site by sandy</a>';
        }
    }

    // Method to register new screens dynamically
    registerScreen(name, element) {
        this.screens[name] = element;
    }
    
    getCurrentScreen() {
        return this.currentScreen;
    }
}

export default ScreenManager;