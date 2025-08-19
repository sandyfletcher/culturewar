// ===========================================
// root/javascript/gameWorker.js
// ===========================================

import Game from './game.js';
import StatsTracker from './StatsTracker.js';

// The worker script has its own scope. 'self' refers to the worker itself.
self.onmessage = function(e) {
    const { config, gameNumber, totalGames } = e.data;
    
    // Create a new StatsTracker instance within the worker's scope
    // to collect stats for this single game.
    const statsTracker = new StatsTracker();
    
    // We don't have a DOM, so we pass null for UI-related components.
    // The Game class is robust enough to handle this.
    const game = new Game(
        config,
        null, // footerManager
        null, // configManager
        null, // menuManager
        statsTracker,
        { clientWidth: 400, clientHeight: 800 }, // Mock container dimensions
        { getContext: () => ({ clearRect: () => {} }) } // Mock canvas
    );

    // The game will run headlessly and call endGame when finished.
    // We've modified the Game class to post a message when it completes in a worker context.
};