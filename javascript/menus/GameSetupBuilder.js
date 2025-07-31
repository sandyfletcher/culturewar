// menus/GameSetupBuilder.js - Builds the game setup screen for single player and bot battle modes

import MenuBuilderBase from '../MenuBuilderBase.js';
import { config } from '../config.js'; // <-- IMPORT THE NEW CONFIG (note the path)

class GameSetupBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    build(gameMode) {
        // Update config with selected game mode
        this.configManager.setGameMode(gameMode);
        const menuContainer = this.createMenuContainer();
        // Create appropriate setup form based on game mode
        let minCount, maxCount, countLabel, startButtonText, isBotBattle;
        switch(gameMode) {
            case 'singleplayer':
                minCount = 1;
                maxCount = 5;
                countLabel = 'NUMBER OF OPPONENTS';
                startButtonText = 'BATTLE >';
                isBotBattle = false;
                break;
            case 'botbattle':
                minCount = 2;
                maxCount = 6;
                countLabel = 'NUMBER OF PLAYERS';
                startButtonText = 'BATTLE >';
                isBotBattle = true;
                break;
        }
        this.createGameSetupForm(menuContainer, minCount, maxCount, countLabel, startButtonText, isBotBattle);
        return menuContainer;
    }
    createGameSetupForm(menuContainer, minCount, maxCount, countLabel, startButtonText, isBotBattle) {
        const setupForm = document.createElement('div');
        setupForm.className = 'setup-form';
        // Count selection title
        const countLabelElement = document.createElement('h2');
        countLabelElement.textContent = countLabel;
        countLabelElement.className = 'setup-title';
        setupForm.appendChild(countLabelElement);
        // Count selection circles
        const countSelect = document.createElement('div');
        countSelect.className = 'player-count-select';
        for (let i = minCount; i <= maxCount; i++) {
            const countButton = document.createElement('button');
            countButton.className = 'count-button';
            countButton.textContent = i;
            countButton.dataset.count = i;
            countButton.setAttribute('aria-label', `${i} ${isBotBattle ? 'bots' : 'opponent' + (i > 1 ? 's' : '')}`);
            // Set default selected for the first button
            if (i === minCount) {
                countButton.classList.add('active');
                if (isBotBattle) {
                    this.configManager.setBotBattleCount(i);
                } else {
                    this.configManager.setPlayerCount(i + 1); // +1 for human player
                }
            }
            countButton.addEventListener('click', () => {
                // Remove active class from all buttons
                document.querySelectorAll('.count-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Add active class to clicked button
                countButton.classList.add('active');
                // Store count in config
                if (isBotBattle) {
                    this.configManager.setBotBattleCount(parseInt(i));
                } else {
                    this.configManager.setPlayerCount(parseInt(i) + 1); // +1 for human player
                }
                // Update AI selectors
                this.updateEntitySelectors(setupForm, i, isBotBattle);
            });
            countSelect.appendChild(countButton);
        }
        setupForm.appendChild(countSelect);
        setupForm.appendChild(this.createPlanetDensityControl());
        // Remove separate selectionContainer, will now insert directly into setupForm
        this.updateEntitySelectors(setupForm, minCount, isBotBattle);
        // Bottom button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'setup-buttons';
        // Add back button
        const backButton = this.getBackButton(() => this.parentBuilder.buildMainMenu());
        // Start button
        const startButton = document.createElement('button');
        startButton.className = 'menu-button start-game';
        startButton.textContent = startButtonText;
        startButton.addEventListener('click', () => {
            const count = document.querySelector('.count-button.active').dataset.count;
            // Collect AI types
            const aiTypes = [];
            for (let i = 1; i <= count; i++) {
                const selector = document.querySelector(`#${isBotBattle ? 'bot' : 'ai'}-type-${i}`);
                if (selector) {
                    aiTypes.push(selector.value);
                } else {
                    console.error(`Selector #${isBotBattle ? 'bot' : 'ai'}-type-${i} not found!`);
                }
            }
            // Update config
            this.configManager.setAITypes(aiTypes);
            // Tell the parent MenuManager to start the game
            window.menuManager.startGame();
        });
        buttonContainer.appendChild(backButton);
        buttonContainer.appendChild(startButton);
        setupForm.appendChild(buttonContainer);
        menuContainer.appendChild(setupForm);
    }
    // Extracted planet density control creation to a separate method
    createPlanetDensityControl() {
        const planetDensityContainer = document.createElement('div');
        planetDensityContainer.className = 'planet-density-container';
        // Add a title for the planet density section
        const densityTitle = document.createElement('h3');
        densityTitle.textContent = 'GALAXY DENSITY';
        densityTitle.className = 'section-title';
        planetDensityContainer.appendChild(densityTitle);
        // Create a container for the slider and its labels
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'slider-container';
        // Add slider
        const densitySlider = document.createElement('input');
        densitySlider.type = 'range';
        // Use min/max/default from config
        densitySlider.min = config.planetGeneration.density.min.toString();
        densitySlider.max = config.planetGeneration.density.max.toString();
        densitySlider.step = '0.05';
        densitySlider.value = config.planetGeneration.density.default.toString();
        densitySlider.className = 'density-slider';
        densitySlider.id = 'planet-density-slider';
        // Add left label (Sparse)
        const leftLabel = document.createElement('span');
        leftLabel.className = 'slider-label left-label';
        leftLabel.textContent = 'EMPTY';
        // Add right label (Dense)
        const rightLabel = document.createElement('span');
        rightLabel.className = 'slider-label right-label';
        rightLabel.textContent = 'DENSE';
        // Add event listener for slider
        densitySlider.addEventListener('input', () => {
            const value = parseFloat(densitySlider.value);
            // Update config in GameConfigManager
            this.configManager.setPlanetDensity(value);
        });
        // Assemble the slider container
        sliderContainer.appendChild(leftLabel);
        sliderContainer.appendChild(densitySlider);
        sliderContainer.appendChild(rightLabel);
        // Add all elements to planet density container
        planetDensityContainer.appendChild(sliderContainer);
        return planetDensityContainer;
    }
    updateEntitySelectors(setupForm, count, isBotBattle) {
        // Remove any existing selectors first
        const existingSelectors = setupForm.querySelector('.ai-selectors-container');
        if (existingSelectors) {
            existingSelectors.remove();
        }
        // Create a container for the selectors
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'ai-selectors-container';
        // Add a small title for the selectors
        const selectorsTitle = document.createElement('h3');
        selectorsTitle.textContent = 'BOT PERSONALITIES';
        selectorsTitle.className = 'selectors-title';
        selectorsContainer.appendChild(selectorsTitle);
        const playerColors = this.configManager.getPlayerColors();
        const aiOptions = this.configManager.getAIOptions();
        for (let i = 1; i <= count; i++) {
            const container = document.createElement('div');
            container.className = 'ai-selector';
            // Create unique ID for the select element
            const selectId = `${isBotBattle ? 'bot' : 'ai'}-type-${i}`;
            // Create colored circle with number
            const playerNumber = isBotBattle ? i : i;
            const playerColor = playerColors[`player${playerNumber}`];
            const circleLabel = document.createElement('div');
            circleLabel.className = 'player-circle';
            circleLabel.style.backgroundColor = playerColor;
            circleLabel.innerHTML = `<span>${playerNumber}</span>`;
            container.appendChild(circleLabel);
            const selector = document.createElement('select');
            selector.id = selectId;
            selector.name = selectId;
            selector.setAttribute('aria-label', isBotBattle ? 
                `Bot ${i} type` : 
                `Opponent ${i} difficulty`);
            // Add AI options
            aiOptions.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.name;
                selector.appendChild(option);
            });
            container.appendChild(selector);
            selectorsContainer.appendChild(container);
        }
        // Insert the selectors container directly into the setupForm
        setupForm.insertBefore(selectorsContainer, setupForm.querySelector('.setup-buttons'));
    }
}

export default GameSetupBuilder;