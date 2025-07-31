import MenuBuilderBase from './MenuBuilderBase.js';
import MainMenuBuilder from './menus/MainMenuBuilder.js';
import GameSetupBuilder from './menus/GameSetupBuilder.js';
import InstructionsBuilder from './menus/InstructionsBuilder.js';
// NEW: Import the new builders
import CombatantsBuilder from './menus/CombatantsBuilder.js';
import StandingsBuilder from './menus/StandingsBuilder.js';

class MenuBuilder extends MenuBuilderBase {
    constructor(container, screenManager, configManager) {
        super(container, screenManager, configManager);
        // Initialize section builders
        this.mainMenuBuilder = new MainMenuBuilder(this, container, screenManager, configManager);
        this.gameSetupBuilder = new GameSetupBuilder(this, container, screenManager, configManager);
        this.instructionsBuilder = new InstructionsBuilder(this, container, screenManager, configManager);
        // NEW: Instantiate the new builders
        this.combatantsBuilder = new CombatantsBuilder(this, container, screenManager, configManager);
        this.standingsBuilder = new StandingsBuilder(this, container, screenManager, configManager);
    }

    // Main entry points that delegate to specialized builders
    buildMainMenu() {
        return this.mainMenuBuilder.build();
    }
    buildGameSetup() {
        return this.gameSetupBuilder.build();
    }
    buildInstructionsScreen() {
        return this.instructionsBuilder.build();
    }

    // NEW: Add the build methods for the new screens
    buildCombatantsScreen() {
        return this.combatantsBuilder.build();
    }
    buildStandingsScreen() {
        return this.standingsBuilder.build();
    }
}

export default MenuBuilder;