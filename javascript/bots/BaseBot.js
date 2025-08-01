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
    makeDecision() { // must be implemented by any class that extends BaseBot, should return a decision object like { from, to, troops } or null if no action is taken
        throw new Error("The 'makeDecision' method must be implemented by the subclass."); // an "abstract" method meant to be overridden, here to ensure if a developer forgets to implement it game will fail loudly instead of silently doing nothing
    }
}