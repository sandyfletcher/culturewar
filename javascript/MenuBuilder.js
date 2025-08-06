// ===========================================
// root/javascript/MenuBuilder.js
// ===========================================

import MenuBuilderBase from './MenuBuilderBase.js';
import MainMenuBuilder from './menus/MainMenuBuilder.js';
import GameSetupBuilder from './menus/GameSetupBuilder.js';
import InstructionsBuilder from './menus/InstructionsBuilder.js';
import CombatantsBuilder from './menus/CombatantsBuilder.js';
import StandingsBuilder from './menus/StandingsBuilder.js';

export default class MenuBuilder extends MenuBuilderBase {
    constructor(container, configManager, startGameCallback, statsTracker) {
        super(container, configManager);
        this.mainMenuBuilder = new MainMenuBuilder(this, container, configManager);
        this.gameSetupBuilder = new GameSetupBuilder(this, container, configManager, startGameCallback);
        this.instructionsBuilder = new InstructionsBuilder(this, container, configManager);
        this.combatantsBuilder = new CombatantsBuilder(this, container, configManager);
        this.standingsBuilder = new StandingsBuilder(this, container, configManager, statsTracker);
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
    buildCombatantsScreen() {
        return this.combatantsBuilder.build();
    }
    buildStandingsScreen() {
        return this.standingsBuilder.build();
    }
}

