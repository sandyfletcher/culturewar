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
    constructor(container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.mainMenuBuilder = new MainMenuBuilder(this, container, screenManager, configManager);
        this.gameSetupBuilder = new GameSetupBuilder(this, container, screenManager, configManager);
        this.instructionsBuilder = new InstructionsBuilder(this, container, screenManager, configManager);
        this.combatantsBuilder = new CombatantsBuilder(this, container, screenManager, configManager);
        this.standingsBuilder = new StandingsBuilder(this, container, screenManager, configManager);
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

