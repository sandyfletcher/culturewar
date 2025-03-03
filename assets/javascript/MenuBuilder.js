// MenuBuilder.js
// Builds and manages UI components for menu screens

class MenuBuilder {
    constructor(container, screenManager, configManager) {
        this.container = container;
        this.screenManager = screenManager;
        this.configManager = configManager;
    }
    
    buildMainMenu() {
        this.container.innerHTML = '';
        
        // Create a menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        
        // Create game mode buttons
        const gameModeContainer = document.createElement('div');
        gameModeContainer.className = 'game-mode-container';
        
        // Define all main menu options
        const options = [
            { 
                id: 'singleplayer', 
                name: 'SINGLE PLAYER', 
                description: 'You against AI',
                available: true,
                handler: () => this.buildGameSetup('singleplayer')
            },
            { 
                id: 'botbattle', 
                name: 'BOT BATTLE', 
                description: 'AI against AI',
                available: true,
                handler: () => this.buildGameSetup('botbattle')
            },
            { 
                id: 'multiplayer', 
                name: 'MULTIPLAYER', 
                description: 'You against humans',
                available: false,
                handler: null
            },
            { 
                id: 'campaign', 
                name: 'CAMPAIGN', 
                description: 'Mission-based gameplay',
                available: false,
                handler: () => this.buildCampaignMenu()
            },
            { 
                id: 'instructions', 
                name: 'INSTRUCTIONS', 
                description: 'How to play',
                available: true,
                handler: () => this.buildInstructionsScreen()
            },
            { 
                id: 'settings', 
                name: 'SETTINGS', 
                description: 'Game options',
                available: false,
                handler: () => this.buildSettingsScreen()
            }
        ];
        
        // Create and append each button
        options.forEach(option => {
            const modeButton = document.createElement('div');
            modeButton.className = 'game-mode-button';
            modeButton.dataset.mode = option.id;
            
            if (!option.available) {
                modeButton.classList.add('coming-soon');
            }
            
            modeButton.innerHTML = `
                <h3>${option.name}</h3>
                <p>${option.description}</p>
                ${option.available ? '' : '<span class="badge">COMING SOON</span>'}
            `;
            
            if (option.available && option.handler) {
                modeButton.addEventListener('click', option.handler);
            }
            
            gameModeContainer.appendChild(modeButton);
        });
        
        menuContainer.appendChild(gameModeContainer);
        this.container.appendChild(menuContainer);
    }
    
    buildGameSetup(gameMode) {
        // Update config with selected game mode
        this.configManager.setGameMode(gameMode);
        
        // Clear existing menu
        this.container.innerHTML = '';
        
        // Create a menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        
        // Add back button
        const backButton = this.createBackButton(() => this.buildMainMenu());
        menuContainer.appendChild(backButton);
        
        // Create appropriate setup form based on game mode
        let minCount, maxCount, countLabel, startButtonText, isBotBattle;
        
        switch(gameMode) {
            case 'singleplayer':
                minCount = 1;
                maxCount = 5;
                countLabel = 'OPPONENTS';
                startButtonText = 'START GAME';
                isBotBattle = false;
                break;
            case 'botbattle':
                minCount = 2;
                maxCount = 6;
                countLabel = 'NUMBER OF BOTS';
                startButtonText = 'START BATTLE';
                isBotBattle = true;
                break;
        }
        
        this.createGameSetupForm(menuContainer, minCount, maxCount, countLabel, startButtonText, isBotBattle);
        
        this.container.appendChild(menuContainer);
    }
    
// Updated createGameSetupForm method to include planet density slider
createGameSetupForm(menuContainer, minCount, maxCount, countLabel, startButtonText, isBotBattle) {
    const setupForm = document.createElement('div');
    setupForm.className = 'setup-form';
    
    // Create a container for the header part
    const headerContainer = document.createElement('div');
    headerContainer.className = 'setup-header';
    
    // Count selection title
    const countLabelElement = document.createElement('h2');
    countLabelElement.textContent = countLabel;
    countLabelElement.className = 'setup-title';
    headerContainer.appendChild(countLabelElement);
    
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
            this.updateEntitySelectors(selectionContainer, i, isBotBattle);
        });
        
        countSelect.appendChild(countButton);
    }
    
    headerContainer.appendChild(countSelect);
    setupForm.appendChild(headerContainer);
    
    // AI/Bot selection container - create it before trying to update it
    const selectionContainer = document.createElement('div');
    selectionContainer.className = 'setup-section ai-selection-container';
    selectionContainer.id = isBotBattle ? 'bot-selection' : 'ai-selection';
    setupForm.appendChild(selectionContainer);
    
    // Add a new section for planet density slider
    const planetDensityContainer = document.createElement('div');
    planetDensityContainer.className = 'setup-section planet-density-container';
    
    // Add a title for the planet density section
    const densityTitle = document.createElement('h3');
    densityTitle.textContent = 'PLANET DENSITY';
    densityTitle.className = 'section-title';
    planetDensityContainer.appendChild(densityTitle);
    
    // Create a container for the slider and its labels
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    
    // Add slider
    const densitySlider = document.createElement('input');
    densitySlider.type = 'range';
    densitySlider.min = '0.5';
    densitySlider.max = '2.0';
    densitySlider.step = '0.1';
    densitySlider.value = '1.0'; // Default value
    densitySlider.className = 'density-slider';
    densitySlider.id = 'planet-density-slider';
    
    // Add left label (Sparse)
    const leftLabel = document.createElement('span');
    leftLabel.className = 'slider-label left-label';
    leftLabel.textContent = 'Sparse';
    
    // Add right label (Dense)
    const rightLabel = document.createElement('span');
    rightLabel.className = 'slider-label right-label';
    rightLabel.textContent = 'Dense';
    
    // Add value display
    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'slider-value';
    valueDisplay.id = 'density-value-display';
    valueDisplay.textContent = '1.0';
    
    // Add description text
    const description = document.createElement('p');
    description.className = 'slider-description';
    description.textContent = 'Adjust the number and spacing of neutral planets';
    
    // Add event listener for slider
    densitySlider.addEventListener('input', () => {
        const value = parseFloat(densitySlider.value);
        valueDisplay.textContent = value.toFixed(1);
        
        // Update config in GameConfigManager
        this.configManager.setPlanetDensity(value);
    });
    
    // Assemble the slider container
    sliderContainer.appendChild(leftLabel);
    sliderContainer.appendChild(densitySlider);
    sliderContainer.appendChild(rightLabel);
    
    // Add all elements to planet density container
    planetDensityContainer.appendChild(sliderContainer);
    planetDensityContainer.appendChild(valueDisplay);
    planetDensityContainer.appendChild(description);
    
    // Add the planet density container to the setup form
    setupForm.appendChild(planetDensityContainer);
    
    // Bottom button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'setup-buttons';
    
    // Back button inside the form
    const backButton = this.createBackButton(() => this.buildMainMenu());
    buttonContainer.appendChild(backButton);
    
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
    
    buttonContainer.appendChild(startButton);
    setupForm.appendChild(buttonContainer);
    
    menuContainer.appendChild(setupForm);
    
    // Initialize selectors with default count - pass the selectionContainer directly
    this.updateEntitySelectors(selectionContainer, minCount, isBotBattle);
}

    updateEntitySelectors(selectionContainer, count, isBotBattle) {
        // We're now using the container reference passed directly rather than trying to find it by ID
        if (!selectionContainer) {
            console.error(`Selection container not provided!`);
            return;
        }
        
        selectionContainer.innerHTML = '';
        
        // Create a container for the selectors
        const selectorsContainer = document.createElement('div');
        selectorsContainer.className = 'ai-selectors-container';
        
        // Add a small title for the selectors
        const selectorsTitle = document.createElement('h3');
        selectorsTitle.textContent = isBotBattle ? 'BOT TYPES' : 'OPPONENT TYPES';
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
        
        selectionContainer.appendChild(selectorsContainer);
    }

    buildInstructionsScreen() {
        // Build instructions UI
        this.container.innerHTML = '';
        
        // Create a menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        
        // Back button
        const backButton = this.createBackButton(() => this.buildMainMenu());
        menuContainer.appendChild(backButton);
        
        // Instructions content
        const content = document.createElement('div');
        content.className = 'instructions-content';
        content.innerHTML = `
            <h2>GAME INSTRUCTIONS</h2>
            <div class="instructions-section">
                <h3>OBJECTIVE</h3>
                <p>Conquer all planets to defeat your opponents or have the most planets when time runs out.</p>
                
                <h3>CONTROLS</h3>
                <ul>
                    <li><strong>Select Planet:</strong> Click on a planet you own</li>
                    <li><strong>Send Troops:</strong> Click a second planet to send troops</li>
                    <li><strong>Cancel Selection:</strong> Right-click or click on empty space</li>
                </ul>
                
                <h3>GAMEPLAY</h3>
                <p>Each planet continuously generates troops over time. The larger the planet, the faster it produces troops.</p>
                <p>Send troops to neutral or enemy planets to capture them, or to your own planets to reinforce them.</p>
                <p>When attacking, if you send more troops than the defending planet has, you'll capture it.</p>
            </div>
        `;
        
        menuContainer.appendChild(content);
        this.container.appendChild(menuContainer);
    }
    
    buildCampaignMenu() {
        // Implementation for campaign menu - placeholder for now
        this.container.innerHTML = '';
        
        // Create a menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        
        // Back button
        const backButton = this.createBackButton(() => this.buildMainMenu());
        menuContainer.appendChild(backButton);
        
        // Campaign content placeholder
        const content = document.createElement('div');
        content.className = 'campaign-content';
        content.innerHTML = `
            <h2>CAMPAIGN MODE</h2>
            <p>Campaign mode is coming soon! Check back later for mission-based gameplay.</p>
        `;
        
        menuContainer.appendChild(content);
        this.container.appendChild(menuContainer);
    }
    
    buildSettingsScreen() {
        // Implementation for settings - placeholder for now
        this.container.innerHTML = '';
        
        // Create a menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        
        // Back button
        const backButton = this.createBackButton(() => this.buildMainMenu());
        menuContainer.appendChild(backButton);
        
        // Settings content placeholder
        const content = document.createElement('div');
        content.className = 'settings-content';
        content.innerHTML = `
            <h2>GAME SETTINGS</h2>
            <p>Settings will be available soon! Check back later to customize your game experience.</p>
        `;
        
        menuContainer.appendChild(content);
        this.container.appendChild(menuContainer);
    }
    
    createBackButton(handler) {
        const button = document.createElement('button');
        button.className = 'menu-button back-button';
        button.textContent = '← BACK';
        button.addEventListener('click', handler);
        return button;
    }
}

export default MenuBuilder;