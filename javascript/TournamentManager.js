// ===========================================
// root/javascript/TournamentManager.js
// ===========================================

import PRNG from './PRNG.js';
import eventManager from './EventManager.js';

export default class TournamentManager {
    constructor(participants, menuManager, tournamentScreen) {
        this.menuManager = menuManager;
        this.tournamentScreen = tournamentScreen;
        this.participants = participants;
        this.prng = new PRNG(Date.now());
        this.bracket = this._createBracket(participants);
        this.currentRound = 0;
        this.currentMatchIndex = 0;
        this.finalMatchConfig = null;
    }
    _createBracket(participants) {
        const bracket = [];
        let currentRoundPlayers = [...participants].sort(() => 0.5 - this.prng.next());
        bracket.push(currentRoundPlayers);
        while (currentRoundPlayers.length > 1) {
            const nextRoundPlayerCount = Math.ceil(currentRoundPlayers.length / 2);
            const nextRound = Array(nextRoundPlayerCount).fill(null);
            bracket.push(nextRound);
            currentRoundPlayers = nextRound;
        }
        return bracket;
    }
    start() {
        this.menuManager.uiManager.setHeaderTitle('TOURNAMENT');
        this.tournamentScreen.show(this.bracket);
        this.menuManager.footerManager.showBackButton(() => {
            this.menuManager.menuBuilder.buildMainMenu();
        });
        setTimeout(() => this.runNextMatch(), 500);
    }
    runNextMatch() {
        const round = this.bracket[this.currentRound];
        // Check if the current round is finished
        if (this.currentMatchIndex >= Math.floor(round.length / 2)) {
            this.currentRound++;
            this.currentMatchIndex = 0;
            // Check if the whole tournament is over
            if (this.currentRound >= this.bracket.length - 1) {
                this.endTournament();
                return;
            }
            // Add a small delay between rounds for visual pacing
            setTimeout(() => this.runNextMatch(), 1000);
            return;
        }
        // Get the players for the current match
        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];
        if (player1 && !player2) { // Handle a bye
            this.bracket[this.currentRound + 1][this.currentMatchIndex] = player1;
            this.currentMatchIndex++;
            this.tournamentScreen._renderBracket(this.bracket); // Re-render to show bye
            setTimeout(() => this.runNextMatch(), 250); // Quickly process next match
            return;
        }
        const onSimulate = () => this.startMatch(player1, player2, true);
        const onWatch = () => this.startMatch(player1, player2, false);
        this.tournamentScreen.prepareNextMatch(player1, player2, this.currentRound, this.currentMatchIndex, onSimulate, onWatch);
    }
    startMatch(player1, player2, isHeadless) {
        const baseConfig = this.menuManager.getGameConfig();
        const matchConfig = {
            ...baseConfig,
            players: [
                { id: 'player1', type: 'bot', aiController: player1.aiController },
                { id: 'player2', type: 'bot', aiController: player2.aiController }
            ],
            batchSize: 1,
            isHeadless: isHeadless,
            isTournamentMatch: true,
            seed: Date.now() + Math.random()
        };
        // If this is the final match, save its config for the replay button.
        if (this.bracket[this.currentRound].length <= 2) {
            this.finalMatchConfig = { ...matchConfig };
        }
        if (isHeadless) {
            this.menuManager.startTournamentGame(matchConfig);
        } else {
            this.menuManager.startTournamentWatchGame(matchConfig);
        }
    }
    reportMatchResult(winnerPlayerId) {
        const round = this.bracket[this.currentRound];
        const player1 = round[this.currentMatchIndex * 2];
        const player2 = round[this.currentMatchIndex * 2 + 1];
        const winner = winnerPlayerId.id === 'player1' ? player1 : player2;
        const loser = winnerPlayerId.id === 'player1' ? player2 : player1;
        this.bracket[this.currentRound + 1][this.currentMatchIndex] = winner;
        this.tournamentScreen.updateBracket(winner, loser, this.currentRound, this.currentMatchIndex, this.bracket);
        this.currentMatchIndex++;
        setTimeout(() => this.runNextMatch(), 1500);
    }
    endTournament() {
        const champion = this.bracket[this.bracket.length - 1][0];
        const semiFinalRound = this.bracket[this.bracket.length - 2];
        const runnerUp = semiFinalRound.find(p => p && p.aiController !== champion.aiController); // guard to ensure `p` is not null/undefined before accessing its properties
        const onReplay = () => this.menuManager.startReplay(this.finalMatchConfig);
        const onReturn = () => {
            this.menuManager.menuBuilder.buildMainMenu();
            eventManager.emit('screen-changed', 'menu');
        };
        this.tournamentScreen.showPodium(champion, runnerUp, onReplay, onReturn);
    }
}