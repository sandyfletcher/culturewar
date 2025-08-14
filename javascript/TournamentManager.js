// ===========================================
// root/javascript/TournamentManager.js (NEW FILE)
// ===========================================

export default class TournamentManager {
    constructor(participants, menuManager) {
        this.menuManager = menuManager;
        this.participants = participants; // Array of AI player configs { type, aiController }
        this.bracket = this._createBracket(participants);
        this.currentRound = 0;
        this.currentMatchIndex = 0;
        this.finalMatchConfig = null;
    }

    _createBracket(participants) {
        // Simple logic for single-elimination bracket
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        return [shuffled]; // The first round is just the shuffled list of participants
    }

    start() {
        this.menuManager.showTournamentUI(this.bracket);
        setTimeout(() => this.runNextMatch(), 1500);
    }

    runNextMatch() {
        const round = this.bracket[this.currentRound];
        if (this.currentMatchIndex * 2 >= round.length) {
            // End of round
            if (round.length === 1) {
                // We have a winner for the whole tournament!
                this.endTournament();
                return;
            }
            // Move to the next round
            this.currentRound++;
            this.currentMatchIndex = 0;
            this.menuManager.showTournamentUI(this.bracket);
            setTimeout(() => this.runNextMatch(), 1500);
            return;
        }

        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];

        // Handle bye (odd number of players in a round)
        if (!player2) {
            this.reportMatchResult({ id: 'player1' }); // Player 1 wins by default
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
            isHeadless: true, // Tournaments must be fast!
            seed: Date.now() + Math.random() // Unique seed for each match
        };
        
        // If this is the final match (2 players left in the tournament)
        if(this.bracket[this.currentRound].length === 2) {
            this.finalMatchConfig = { ...matchConfig };
            console.log("Final match config saved for replay.", this.finalMatchConfig);
        }

        this.menuManager.startTournamentGame(matchConfig);
    }

    reportMatchResult(winnerPlayerId) {
        const round = this.bracket[this.currentRound];
        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];

        // Determine the actual winner object
        const winner = winnerPlayerId.id === 'player1' ? player1 : player2;

        if (!this.bracket[this.currentRound + 1]) {
            this.bracket[this.currentRound + 1] = [];
        }
        this.bracket[this.currentRound + 1].push(winner);

        this.currentMatchIndex++;
        
        this.menuManager.showTournamentUI(this.bracket); // Update UI with winner
        setTimeout(() => this.runNextMatch(), 1000); 
    }

    endTournament() {
        const champion = this.bracket[this.bracket.length - 1][0];
        this.menuManager.updateTournamentStatus(`CHAMPION: ${champion.aiController}!`);
        console.log("TOURNAMENT COMPLETE! Champion:", champion.aiController);

        if (this.finalMatchConfig) {
            this.menuManager.replayManager.saveReplay(this.finalMatchConfig, `Tournament Final: ${this.finalMatchConfig.players[0].aiController} vs ${this.finalMatchConfig.players[1].aiController}`);
        }

        setTimeout(() => {
            this.menuManager.hideTournamentUI();
            this.menuManager.showTournamentCompleteScreen(champion, this.finalMatchConfig);
        }, 3000);
    }
}