// ===========================================
// root/javascript/TournamentManager.js
// ===========================================

import PRNG from './PRNG.js';

export default class TournamentManager {
    constructor(participants, menuManager) {
        this.menuManager = menuManager;
        this.participants = participants; // array of AI player configs { type, aiController }
        this.prng = new PRNG(Date.now());
        this.bracket = this._createBracket(participants);
        this.currentRound = 0;
        this.currentMatchIndex = 0;
        this.finalMatchConfig = null;
    }
    _createBracket(participants) {
        const shuffled = [...participants].sort(() => 0.5 - this.prng.next()); // simple logic for single-elimination bracket
        return [shuffled]; // first round is just shuffled list of participants
    }
    start() {
        this.menuManager.showTournamentUI(this.bracket);
        setTimeout(() => this.runNextMatch(), 1500);
    }
    runNextMatch() {
        const round = this.bracket[this.currentRound];
        if (this.currentMatchIndex * 2 >= round.length) {
            if (round.length === 1) { // end of round
                this.endTournament(); // we have a tournament winner!
                return;
            }
            this.currentRound++; // move to next round
            this.currentMatchIndex = 0;
            this.menuManager.showTournamentUI(this.bracket);
            setTimeout(() => this.runNextMatch(), 1500);
            return;
        }
        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];
        if (!player2) { // handle bye for odd number of players in round
            this.reportMatchResult({ id: 'player1' }); // player 1 wins by default
            return;
        }
        this.menuManager.updateTournamentStatus(`Round ${this.currentRound + 1}: ${player1.aiController} vs ${player2.aiController}`);
        const baseConfig = this.menuManager.getGameConfig();
        const matchConfig = {
            ...baseConfig,
            players: [
                { id: 'player1', type: 'bot', aiController: player1.aiController },
                { id: 'player2', type: 'bot', aiController: player2.aiController }
            ],
            batchSize: 1,
            isHeadless: true, // tournaments play out quickly
            seed: Date.now() + Math.random() // unique seed for each match
        };
        if(this.bracket[this.currentRound].length === 2) { // final match in tournament
            this.finalMatchConfig = { ...matchConfig };
            console.log("Final match config saved for replay.", this.finalMatchConfig);
        }
        this.menuManager.startTournamentGame(matchConfig);
    }
    reportMatchResult(winnerPlayerId) {
        const round = this.bracket[this.currentRound];
        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];
        const winner = winnerPlayerId.id === 'player1' ? player1 : player2; // determine winner object
        if (!this.bracket[this.currentRound + 1]) {
            this.bracket[this.currentRound + 1] = [];
        }
        this.bracket[this.currentRound + 1].push(winner);
        this.currentMatchIndex++;
        this.menuManager.showTournamentUI(this.bracket); // update UI with winner
        setTimeout(() => this.runNextMatch(), 1000); 
    }
    endTournament() {
        const champion = this.bracket[this.bracket.length - 1][0];
        this.menuManager.updateTournamentStatus(`CHAMPION: ${champion.aiController}!`);
        console.log("TOURNAMENT COMPLETE! Champion:", champion.aiController);
        if (this.finalMatchConfig) {
            this.menuManager.replayManager.saveReplay(this.finalMatchConfig, `Tournament Final: ${this.finalMatchConfig.players[0].aiController} vs ${this.finalMatchConfig.players[1].aiController}`);
        }
        this.menuManager.showTournamentCompleteScreen(champion, this.finalMatchConfig);
    }
}