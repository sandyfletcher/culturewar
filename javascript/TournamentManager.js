// ===========================================
// root/javascript/TournamentManager.js (new file)
// ===========================================

export default class TournamentManager {
    constructor(participants, menuManager) {
        this.menuManager = menuManager;
        this.participants = participants; // Array of AI player configs { type, aiController }
        this.bracket = this._createBracket(participants);
        this.currentRound = 0;
        this.currentMatch = 0;
        this.finalMatchConfig = null;
    }

    _createBracket(participants) {
        // Simple logic for single-elimination bracket
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        return [shuffled]; // The first round is just the shuffled list of participants
    }

    start() {
        this.runNextMatch();
    }

    runNextMatch() {
        if (this.bracket[this.currentRound].length < 2) {
            // We have a winner for this round, move to the next
            this.currentRound++;
            this.currentMatch = 0;
            if (!this.bracket[this.currentRound] || this.bracket[this.currentRound].length < 2) {
                this.endTournament();
                return;
            }
        }

        const player1 = this.bracket[this.currentRound][this.currentMatch * 2];
        const player2 = this.bracket[this.currentRound][this.currentMatch * 2 + 1];

        if (!player1 || !player2) {
            // Odd number of players, someone gets a bye
            const winner = player1 || player2;
            this.reportMatchResult(winner.id); // This is simplified, assumes winner has an id
            return;
        }

        // Get the base config and set up the 1v1 match
        const baseConfig = this.menuManager.getGameConfig();
        const matchConfig = {
            ...baseConfig,
            players: [
                { id: 'player1', ...player1 },
                { id: 'player2', ...player2 }
            ],
            batchSize: 1,
            isHeadless: true, // Tournaments should be fast!
            seed: Date.now() + Math.random() // Unique seed for each match
        };
        
        // If this is the final match (2 players left in the round)
        if(this.bracket[this.currentRound].length === 2) {
            this.finalMatchConfig = { ...matchConfig };
            console.log("Final match config saved for replay.", this.finalMatchConfig);
        }

        // Use MenuManager to start the game
        this.menuManager.startTournamentGame(matchConfig);
    }

    reportMatchResult(winnerId) {
        const round = this.bracket[this.currentRound];
        const player1 = round[this.currentMatch * 2];
        const player2 = round[this.currentMatch * 2 + 1];

        const winner = winnerId === 'player1' ? player1 : player2;

        if (!this.bracket[this.currentRound + 1]) {
            this.bracket[this.currentRound + 1] = [];
        }
        this.bracket[this.currentRound + 1].push(winner);

        this.currentMatch++;
        
        // Short delay before next match for dramatic effect / UI update
        setTimeout(() => this.runNextMatch(), 1000); 
    }

    endTournament() {
        const champion = this.bracket[this.bracket.length - 1][0];
        console.log("TOURNAMENT COMPLETE! Champion:", champion.aiController);

        // Tell MenuManager to show the final screen
        this.menuManager.showTournamentCompleteScreen(champion, this.finalMatchConfig);
    }
}