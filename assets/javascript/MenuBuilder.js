import MenuBuilderBase from './MenuBuilderBase.js';
import MainMenuBuilder from './menus/MainMenuBuilder.js';
import GameSetupBuilder from './menus/GameSetupBuilder.js';
import InstructionsBuilder from './menus/InstructionsBuilder.js';
import CampaignMenuBuilder from './menus/CampaignMenuBuilder.js';
import SettingsScreenBuilder from './menus/SettingsScreenBuilder.js';

class MenuBuilder extends MenuBuilderBase {
    constructor(container, screenManager, configManager) {
        super(container, screenManager, configManager);
        
        // Initialize section builders
        this.mainMenuBuilder = new MainMenuBuilder(this, container, screenManager, configManager);
        this.gameSetupBuilder = new GameSetupBuilder(this, container, screenManager, configManager);
        this.instructionsBuilder = new InstructionsBuilder(this, container, screenManager, configManager);
        this.campaignMenuBuilder = new CampaignMenuBuilder(this, container, screenManager, configManager);
        this.settingsScreenBuilder = new SettingsScreenBuilder(this, container, screenManager, configManager);
    }
    
    // Main entry points that delegate to specialized builders
    
    buildMainMenu() {
        return this.mainMenuBuilder.build();
    }
    
    buildGameSetup(gameMode) {
        return this.gameSetupBuilder.build(gameMode);
    }
    
    buildInstructionsScreen() {
        return this.instructionsBuilder.build();
    }
    
    buildCampaignMenu() {
        return this.campaignMenuBuilder.build();
    }
    
    buildSettingsScreen() {
        return this.settingsScreenBuilder.build();
    }
}

export default MenuBuilder;