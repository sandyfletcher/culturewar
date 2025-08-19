// =============================================
// root/javascript/bots/BaseBot.js — base class for AI players, handles boilerplate player setup and GameAPI instance
// =============================================

export default class BaseBot {
    constructor(api, playerId) {
        if (this.constructor === BaseBot) {
            throw new Error("BaseBot is an abstract class and cannot be instantiated directly.");
        }
        this.playerId = playerId;
        this.api = api;
        const defaultMemory = { // This object ensures default properties will persist between calls to makeDecision().
            actionCooldown: 0, // A personal timer for this bot, managed by PlayersController.
            phase: 'GAME_START', // To differentiate strategies according to time remaining in-game.
            missions: new Map(), // To track ongoing missions, e.g., { targetPlanetId: 'attack', troopsCommitted: 50 }
            threats: {}, // e.g., { planetId: { totalThreat: 100, eta: 5.2 } }
            lastActionTime: 0,
        };
        // Merge defaults with any memory the subclass might have set before calling super().
        this.memory = { ...defaultMemory, ...this.memory };
    }
    /**
    * This method contains the bot's core strategic logic. It is called by the PlayersController when it is this bot's turn to act.
    * @param {number} dt - The game's delta time, scaled by game speed.
    * @returns {object|null} A decision object like { fromId, toId, troops } or null if no action is taken.
    */
    makeDecision(dt) {
        throw new Error("The 'makeDecision' method must be implemented by the subclass.");
    }
    /**
    * A helper for bot-specific logging. Automatically prepends the bot's ID and game time.
    * @param {string} message - The message to log.
    */
    log(message) {
        const time = this.api.getElapsedTime().toFixed(2);
        console.log(`[${this.playerId}@${time}s]: ${message}`);
    }
}