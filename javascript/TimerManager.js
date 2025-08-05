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
        this.shouldPauseOnHidden = true;
    }
    initialize() {
        this.setupVisibilityHandler();
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
    update(speedMultiplier = 1.0) {
        if (this.isPaused) return; 
        const now = Date.now();
        const dt = (now - this.lastUpdate) / 1000;
        this.lastUpdate = now;
        if (this.game.isActive) { // only update time if game is active
            this.timeRemaining = Math.max(0, this.timeRemaining - (dt * speedMultiplier));
        }
        return this.timeRemaining;
    }
    reset(time = config.game.defaultDuration) {
        this.timeRemaining = time;
        this.isPaused = false;
        this.lastUpdate = Date.now();
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