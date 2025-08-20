// ===========================================
// root/javascript/MenuBuilder.js
// ===========================================

import MenuBuilderBase from './MenuBuilderBase.js';
import MainMenuBuilder from './MainMenuBuilder.js';
import GameSetupBuilder from './GameSetupBuilder.js';
import InstructionsBuilder from './InstructionsBuilder.js';
import StandingsBuilder from './StandingsBuilder.js';
import TournamentSetupBuilder from './TournamentSetupBuilder.js';
import ReplaysBuilder from './ReplaysBuilder.js';

export default class MenuBuilder extends MenuBuilderBase {
    constructor(container, screenManager, configManager, menuManager) {
        super(container, screenManager, configManager, menuManager);
        this.mainMenuBuilder = new MainMenuBuilder(this, container, screenManager, configManager, menuManager);
        this.gameSetupBuilder = new GameSetupBuilder(this, container, screenManager, configManager, menuManager, () => menuManager.startGame());
        this.instructionsBuilder = new InstructionsBuilder(this, container, screenManager, configManager, menuManager);
        this.standingsBuilder = new StandingsBuilder(this, container, screenManager, configManager, menuManager, menuManager.statsTracker);
        this.tournamentSetupBuilder = new TournamentSetupBuilder(this, container, screenManager, configManager, menuManager);
        this.replaysBuilder = new ReplaysBuilder(this, container, screenManager, configManager, menuManager);
    }
    buildMainMenu() {
        return this.mainMenuBuilder.build();
    }
    buildGameSetup() {
        return this.gameSetupBuilder.build();
    }
    buildInstructionsScreen() {
        return this.instructionsBuilder.build();
    }
    buildStandingsScreen() {
        return this.standingsBuilder.build();
    }
    buildTournamentSetup() {
        return this.tournamentSetupBuilder.build();
    }
    buildReplaysScreen() {
        return this.replaysBuilder.build();
    }
}