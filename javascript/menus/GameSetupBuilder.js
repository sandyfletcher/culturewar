// menus/GameSetupBuilder.js - Builds the unified game setup screen.

import MenuBuilderBase from '../MenuBuilderBase.js';
import { config } from '../config.js';

class GameSetupBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }

    build() {
        const menuContainer = this.createMenuContainer();
        const setupForm = document.createElement('div');
        setupForm.className = 'setup-form';

        // 1. Player Count Selection
        setupForm.appendChild(this.createPlayerCountControl());
        // 2. Planet Density Slider
        setupForm.appendChild(this.createPlanetDensityControl());

        // 3. Dynamic Player Configuration List
        const playerSelectorsContainer = document.createElement('div');
        playerSelectorsContainer.className = 'ai-selectors-container';
        playerSelectorsContainer.id = 'player-selectors-container';
        setupForm.appendChild(playerSelectorsContainer);
        this.updatePlayerSelectors();

        setupForm.appendChild(this.createBottomButtons());
        
        menuContainer.appendChild(setupForm);
        return menuContainer;
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
                this.updatePlayerSelectors(); // Re-render the player list
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
            // REVERTED: We are back to a simple, flat row structure.
            const playerRow = document.createElement('div');
            playerRow.className = 'ai-selector';

            // Player color swatch and name
            const circleLabel = document.createElement('div');
            circleLabel.className = 'player-circle';
            circleLabel.style.backgroundColor = playerColors[player.id];
            circleLabel.innerHTML = `<span>${index + 1}</span>`;
            // Type selector (Human / Bot)
            
            const typeSelector = document.createElement('select');
            typeSelector.innerHTML = `<option value="human">Human</option><option value="bot">Bot</option>`;
            typeSelector.value = player.type;
            
            // AI selector
            const aiSelector = document.createElement('select');
            aiOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.name;
                aiSelector.appendChild(option);
            });
            aiSelector.value = player.aiController || config.player.defaultAIValue;
            
            // MODIFIED: Use `visibility` instead of `display` to prevent layout shifts.
            aiSelector.style.visibility = player.type === 'bot' ? 'visible' : 'hidden';

            // Event listener for type change
            typeSelector.addEventListener('change', (e) => {
                const newType = e.target.value;
                // MODIFIED: Toggle visibility.
                aiSelector.style.visibility = newType === 'bot' ? 'visible' : 'hidden';
                this.configManager.updatePlayerConfig(index, { 
                    type: newType,
                    aiController: newType === 'bot' ? aiSelector.value : undefined
                });
            });

            // Event listener for AI change
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

    createBottomButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'setup-buttons';
        
        const backButton = this.getBackButton(() => this.parentBuilder.buildMainMenu());
        
        const startButton = document.createElement('button');
        startButton.className = 'menu-button start-game';
        startButton.textContent = 'BATTLE >';
        startButton.addEventListener('click', () => {
            window.menuManager.startGame();
        });

        buttonContainer.appendChild(backButton);
        buttonContainer.appendChild(startButton);
        return buttonContainer;
    }
}

export default GameSetupBuilder;