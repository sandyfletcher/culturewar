// =============================================
// assets/javascript/bots/BaseBot.js
// =============================================

import GameAPI from '../GameAPI.js';

export default class BaseBot { // base class for AI players, handles boilerplate player setup and GameAPI instance
    constructor(game, playerId) {
        if (this.constructor === BaseBot) {
            throw new Error("BaseBot is an abstract class and cannot be instantiated directly.");
        }
        this.game = game;
        this.playerId = playerId;
        this.api = new GameAPI(game, playerId);
    }
    
    /**
     * This method contains the bot's core strategic logic. It is called by the PlayersController
     * when it is this bot's turn to act.
     * @param {number} dt - The game's delta time, scaled by game speed.
     * @returns {object|null} A decision object like { from, to, troops } or null if no action is taken.
     */
    makeDecision(dt) { 
        throw new Error("The 'makeDecision' method must be implemented by the subclass.");
    }
}