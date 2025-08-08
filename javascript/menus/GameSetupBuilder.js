// ===========================================
// root/javascript/menus/GameSetupBuilder.js
// ===========================================

import MenuBuilderBase from '../MenuBuilderBase.js';
import { config } from '../config.js';

export default class GameSetupBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager, menuManager, startGameCallback) {
        super(container, screenManager, configManager, menuManager);
        this.parentBuilder = parentBuilder;
        this.startGameCallback = startGameCallback;
    }
    build() {
        const menuContainer = this.createMenuContainer();
        const setupForm = document.createElement('div');
        setupForm.className = 'setup-form';
        setupForm.appendChild(this.createPlayerCountControl());
        setupForm.appendChild(this.createPlanetDensityControl());
        const playerSelectorsContainer = document.createElement('div');
        playerSelectorsContainer.className = 'ai-selectors-container';
        playerSelectorsContainer.id = 'player-selectors-container';
        setupForm.appendChild(playerSelectorsContainer);

        const advancedPanel = this.createAdvancedPanel();
        setupForm.appendChild(advancedPanel); 

        const bottomButtons = this.createBottomButtons(advancedPanel);
        setupForm.appendChild(bottomButtons);

        menuContainer.appendChild(setupForm);
        this.updatePlayerSelectors();
        this.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }

    createAdvancedPanel() {
        const panel = document.createElement('div');
        panel.className = 'advanced-settings-panel';
        panel.id = 'advanced-settings-panel';

        const title = document.createElement('h3');
        title.className = 'section-title';
        title.textContent = 'ADVANCED SETTINGS';
        panel.appendChild(title);

        // NEW: Wrapper for the actual settings
        const settingsContent = document.createElement('div');
        settingsContent.className = 'advanced-settings-content';

        settingsContent.appendChild(this.createBatchGameControl());
        settingsContent.appendChild(this.createGamePaceControl());
        settingsContent.appendChild(this.createHeadlessModeControl());
        
        panel.appendChild(settingsContent);
        return panel;
    }

    createBatchGameControl() {
        const batchContainer = document.createElement('div');
        batchContainer.className = 'advanced-setting-item';
        const label = document.createElement('label');
        label.htmlFor = 'batch-size-input';
        label.textContent = 'Number of Games:';
        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'batch-size-input';
        input.min = '1';
        input.max = '100';
        input.value = this.configManager.getConfig().batchSize;
        input.addEventListener('change', () => {
            this.configManager.setBatchSize(input.value);
            input.value = this.configManager.getConfig().batchSize;
        });
        batchContainer.appendChild(label);
        batchContainer.appendChild(input);
        return batchContainer;
    }
    
    // NEW: Placeholder UI for Game Pace
    createGamePaceControl() {
        const container = document.createElement('div');
        container.className = 'advanced-setting-item';
        const label = document.createElement('label');
        label.htmlFor = 'game-pace-input';
        label.textContent = 'Initial Game Pace:';
        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'game-pace-input';
        input.min = '0.1';
        input.max = '4.0';
        input.step = '0.1';
        input.value = this.configManager.getConfig().initialGamePace;
        input.addEventListener('change', (e) => {
            this.configManager.setInitialGamePace(e.target.value);
            input.value = this.configManager.getConfig().initialGamePace;
        });
        container.appendChild(label);
        container.appendChild(input);
        return container;
    }

    // NEW: Placeholder UI for Headless Mode
    createHeadlessModeControl() {
        const container = document.createElement('div');
        container.className = 'advanced-setting-item';
        const label = document.createElement('label');
        label.htmlFor = 'headless-mode-toggle';
        label.textContent = 'Run Headless (Fast):';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = 'headless-mode-toggle';
        input.checked = this.configManager.getConfig().isHeadless;
        input.addEventListener('change', (e) => {
            this.configManager.setHeadlessMode(e.target.checked);
        });
        container.appendChild(label);
        container.appendChild(input);
        return container;
    }

    createBottomButtons(advancedPanel) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'setup-buttons';
        const toggleButton = document.createElement('button');
        toggleButton.className = 'menu-button advanced-toggle';
        toggleButton.innerHTML = 'ADVANCED <span>▲</span>';
        toggleButton.addEventListener('click', () => {
            advancedPanel.classList.toggle('active');
            toggleButton.classList.toggle('active');
        });
        const startButton = document.createElement('button');
        startButton.className = 'menu-button start-game';
        startButton.textContent = 'BATTLE >';
        startButton.addEventListener('click', () => {
            this.startGameCallback();
        });
        buttonContainer.appendChild(toggleButton);
        buttonContainer.appendChild(startButton);
        return buttonContainer;
    }

    createPlayerCountControl() {
        const container = document.createElement('div');
        const countLabelElement = document.createElement('h2');
        countLabelElement.textContent = 'NUMBER OF PLAYERS';
        countLabelElement.className = 'setup-title';
        container.appendChild(countLabelElement);
        const countSelect = document.createElement('div');
        countSelect.className = 'player-count-select';
        const [min, max] = config.menuDefaults.playerCountRange;
        const currentCount = this.configManager.getConfig().players.length;
        for (let i = min; i <= max; i++) {
            const countButton = document.createElement('button');
            countButton.className = 'count-button';
            countButton.textContent = i;
            countButton.dataset.count = i;
            if (i === currentCount) {
                countButton.classList.add('active');
            }
            countButton.addEventListener('click', () => {
                document.querySelectorAll('.count-button').forEach(btn => btn.classList.remove('active'));
                countButton.classList.add('active');
                this.configManager.setPlayerCount(i);
                this.updatePlayerSelectors(); // re-render the player list
            });
            countSelect.appendChild(countButton);
        }
        container.appendChild(countSelect);
        return container;
    }
    updatePlayerSelectors() {
        const container = document.getElementById('player-selectors-container');
        if (!container) return;
        container.innerHTML = '';
        const selectorsTitle = document.createElement('h3');
        selectorsTitle.textContent = 'PLAYER SETUP';
        selectorsTitle.className = 'selectors-title';
        container.appendChild(selectorsTitle);
        const players = this.configManager.getConfig().players;
        const playerColors = this.configManager.getPlayerColors();
        const aiOptions = this.configManager.getAIOptions();
        players.forEach((player, index) => {
            const playerRow = document.createElement('div');
            playerRow.className = 'ai-selector';
            const circleLabel = document.createElement('div');
            circleLabel.className = 'player-circle';
            circleLabel.style.backgroundColor = playerColors[player.id];
            circleLabel.innerHTML = `<span>${index + 1}</span>`;
            const typeSelector = document.createElement('select');
            typeSelector.innerHTML = `<option value="human">Human</option><option value="bot">Bot</option>`;
            typeSelector.value = player.type;
            const aiSelector = document.createElement('select');
aiOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.name;
                aiSelector.appendChild(option);
            });
            aiSelector.value = player.aiController || config.player.defaultAIValue;
            aiSelector.style.visibility = player.type === 'bot' ? 'visible' : 'hidden';
            typeSelector.addEventListener('change', (e) => {
                const newType = e.target.value;
                aiSelector.style.visibility = newType === 'bot' ? 'visible' : 'hidden';
                this.configManager.updatePlayerConfig(index, { 
                    type: newType,
                    aiController: newType === 'bot' ? aiSelector.value : undefined
                });
            });
            aiSelector.addEventListener('change', (e) => {
                this.configManager.updatePlayerConfig(index, { aiController: e.target.value });
            });
            playerRow.appendChild(circleLabel);
            playerRow.appendChild(typeSelector);
            playerRow.appendChild(aiSelector);
            container.appendChild(playerRow);
        });
    }
    createPlanetDensityControl() {
        const planetDensityContainer = document.createElement('div');
        planetDensityContainer.className = 'planet-density-container';
        const densityTitle = document.createElement('h3');
        densityTitle.textContent = 'GALAXY DENSITY';
        densityTitle.className = 'section-title';
        planetDensityContainer.appendChild(densityTitle);
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';
        const densitySlider = document.createElement('input');
        densitySlider.type = 'range';
        densitySlider.min = config.planetGeneration.density.min.toString();
        densitySlider.max = config.planetGeneration.density.max.toString();
        densitySlider.step = '0.05';
        densitySlider.value = this.configManager.getConfig().planetDensity.toString();
        densitySlider.className = 'density-slider';
        densitySlider.id = 'planet-density-slider';
        const leftLabel = document.createElement('span');
        leftLabel.className = 'slider-label left-label';
        leftLabel.textContent = 'EMPTY';
        const rightLabel = document.createElement('span');
        rightLabel.className = 'slider-label right-label';
        rightLabel.textContent = 'DENSE';
        densitySlider.addEventListener('input', () => {
            this.configManager.setPlanetDensity(densitySlider.value);
        });
        sliderContainer.appendChild(leftLabel);
        sliderContainer.appendChild(densitySlider);
        sliderContainer.appendChild(rightLabel);
        planetDensityContainer.appendChild(sliderContainer);
        return planetDensityContainer;
    }
}