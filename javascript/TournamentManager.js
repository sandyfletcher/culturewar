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
        const bracket = [];
        const shuffled = [...participants].sort(() => 0.5 - this.prng.next());
        bracket.push(shuffled);
        let currentRoundPlayers = shuffled;
        while (currentRoundPlayers.length > 1) {
            const nextRoundPlayerCount = Math.ceil(currentRoundPlayers.length / 2);
            const nextRound = Array(nextRoundPlayerCount).fill(null);
            bracket.push(nextRound);
            currentRoundPlayers = nextRound;
        }
        return bracket;
    }
    start() {
        this.menuManager.showTournamentUI(this.bracket);
        setTimeout(() => this.runNextMatch(), 1500);
    }
    runNextMatch() {
        const round = this.bracket[this.currentRound];
        // Check if all matches in the current round are complete
        if (this.currentMatchIndex * 2 >= round.length) {
            // If the round just completed only had one player, they are the champion.
            if (round.length === 1) {
                this.endTournament();
                return;
            }
            // Advance to the next round
            this.currentRound++;
            this.currentMatchIndex = 0;
            this.menuManager.showTournamentUI(this.bracket);
            setTimeout(() => this.runNextMatch(), 1500); // Pause between rounds
            return;
        }
        // Get the players for the current match
        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];
        // Handle a bye (player1 has no opponent)
        if (player1 && !player2) {
            // CRITICAL FIX: Only advance the player if a next round exists in the bracket.
            if (this.bracket[this.currentRound + 1]) {
                this.bracket[this.currentRound + 1][this.currentMatchIndex] = player1;
                this.currentMatchIndex++;
                this.menuManager.showTournamentUI(this.bracket);
                // Immediately process the next match in the same round
                setTimeout(() => this.runNextMatch(), 50);
                return;
            } else {
                // This case should not be reached with proper bracket generation, but as a safeguard:
                this.endTournament();
                return;
            }
        }
        // If for some reason a player slot is empty, wait and retry.
        if (!player1 || !player2) {
            setTimeout(() => this.runNextMatch(), 1000);
            return;
        }
        // Proceed with a normal match
        this.menuManager.updateTournamentStatus(`Round ${this.currentRound + 1}: ${player1.aiController} vs ${player2.aiController}`);
        const baseConfig = this.menuManager.getGameConfig();
        const matchConfig = {
            ...baseConfig,
            players: [
                { id: 'player1', type: 'bot', aiController: player1.aiController },
                { id: 'player2', type: 'bot', aiController: player2.aiController }
            ],
            batchSize: 1,
            isHeadless: true,
            seed: Date.now() + Math.random()
        };
        // If this match will decide the champion, save its config for replay
        if (this.bracket[this.currentRound].length === 2) {
            this.finalMatchConfig = { ...matchConfig };
            console.log("Final match config saved for replay.", this.finalMatchConfig);
        }
        this.menuManager.startTournamentGame(matchConfig);
    }
    reportMatchResult(winnerPlayerId) {
        const round = this.bracket[this.currentRound];
        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];
        const winner = winnerPlayerId.id === 'player1' ? player1 : player2;
        this.bracket[this.currentRound + 1][this.currentMatchIndex] = winner;
        this.currentMatchIndex++;
        this.menuManager.showTournamentUI(this.bracket);
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