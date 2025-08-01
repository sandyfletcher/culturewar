// ===========================================
// root/javascript/TimerManager.js
// ===========================================

import { config } from './config.js';

export default class TimerManager {
    constructor(game) {
        this.game = game;
        this.timeRemaining = config.game.defaultDuration;
        this.isPaused = false;
        this.lastUpdate = Date.now();
        this.timerElement = null;
        this.shouldPauseOnHidden = true;
    }
    initialize() {
        this.timerElement = document.getElementById('game-timer');
        this.setupVisibilityHandler();
        if (this.timerElement) {
            this.updateDisplay();
        }
    }
    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (this.shouldPauseOnHidden) {
                this.isPaused = document.visibilityState !== 'visible';
                if (!this.isPaused) {
                    this.lastUpdate = Date.now();
                }
            }
        });
    }
    setGameMode(mode) {
        this.shouldPauseOnHidden = (mode === 'singlePlayer');
    }
    update(speedMultiplier = 1.0) {
        if (this.isPaused) return; 
        const now = Date.now();
        const dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        // Only update time if the game is active
        if (this.game.isActive) {
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
    reset(time = config.game.defaultDuration) {
        this.timeRemaining = time;
        this.isPaused = false;
        this.lastUpdate = Date.now();
        this.updateDisplay();
    }
    pause() {
        this.isPaused = true;
    }
    resume() {
        this.isPaused = false;
        this.lastUpdate = Date.now();
    }
    getTimeRemaining() {
        return this.timeRemaining;
    }
}