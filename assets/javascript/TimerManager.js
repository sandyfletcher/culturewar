// TimerManager.js
class TimerManager {
    constructor(game) {
        this.game = game;
        this.timeRemaining = 300; // 5 minutes in seconds
        this.isPaused = false;
        this.lastUpdate = Date.now();
        this.timerElement = null;
        this.shouldPauseOnHidden = true;
    }

    initialize() {
        // Get the timer element
        this.timerElement = document.getElementById('game-timer');
        this.setupVisibilityHandler();
        // Only update display if the timer element exists
        if (this.timerElement) {
            this.updateDisplay();
        }
    }

    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            // Only pause if we're in a game mode that should pause
            if (this.shouldPauseOnHidden) {
                this.isPaused = document.visibilityState !== 'visible';
                if (!this.isPaused) {
                    // Reset lastUpdate when resuming
                    this.lastUpdate = Date.now();
                }
            }
        });
    }

    setGameMode(mode) {
        // This is a good place for this logic, but it's not currently called.
        // We can leave it for future use.
        this.shouldPauseOnHidden = (mode === 'singlePlayer');
    }

    // ** MODIFICATION: 'update' now accepts a speed multiplier. **
    update(speedMultiplier = 1.0) {
        if (this.isPaused) return;
        
        const now = Date.now();
        const dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        
        // Only update time if the game is active
        if (this.game.isActive) {
            // ** MODIFICATION: Scale the time reduction by the multiplier. **
            this.timeRemaining = Math.max(0, this.timeRemaining - (dt * speedMultiplier));
        }
        
        this.updateDisplay();
        
        return this.timeRemaining;
    }

    updateDisplay() {
        if (!this.timerElement) return;
        
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = Math.floor(this.timeRemaining % 60);
        
        this.timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    reset(time = 300) {
        this.timeRemaining = time;
        this.isPaused = false;
        this.lastUpdate = Date.now();
        this.updateDisplay();
    }

    pause() { this.isPaused = true; }
    resume() {
        this.isPaused = false;
        this.lastUpdate = Date.now();
    }
    
    getTimeRemaining() {
        return this.timeRemaining;
    }
}

export default TimerManager;