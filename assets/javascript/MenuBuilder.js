// (MenuBuilder.js):

class MenuBuilder {
    constructor(container, screenManager, configManager) {
        this.container = container;
        this.screenManager = screenManager;
        this.configManager = configManager;
        
        // Create reusable UI elements
        this.createReusableElements();
    }
    
    createReusableElements() {
        // Create a reusable back button template
        this.backButtonTemplate = document.createElement('button');
        this.backButtonTemplate.className = 'menu-button back-button';
        this.backButtonTemplate.textContent = '< BACK';
    }
    
    // Helper to get a configured back button for any screen
    getBackButton(handler) {
        // Clone the template button
        const backButton = this.backButtonTemplate.cloneNode(true);
        // Add the specific click handler
        backButton.addEventListener('click', handler);
        return backButton;
    }
    
    // Helper to clear and get a fresh menu container
    createMenuContainer() {
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create a new menu container
        const menuContainer = document.createElement('div');
        menuContainer.className = 'menu-container';
        
        // Add it to the main container
        this.container.appendChild(menuContainer);
        
        return menuContainer;
    }
    
    buildMainMenu() {
        const menuContainer = this.createMenuContainer();
        
        // Create game mode buttons
        const gameModeContainer = document.createElement('div');
        gameModeContainer.className = 'game-mode-container';
        
        // Define all main menu options
        const options = [
            { 
                id: 'instructions', 
                name: 'INSTRUCTIONS', 
                description: 'How to play',
                available: true,
                handler: () => this.buildInstructionsScreen()
            },
            { 
                id: 'botbattle', 
                name: 'BATTLEBOTS', 
                description: 'AI against AI',
                available: true,
                handler: () => this.buildGameSetup('botbattle')
            },
            { 
                id: 'singleplayer', 
                name: 'SINGLE PLAYER', 
                description: 'You against AI',
                available: true,
                handler: () => this.buildGameSetup('singleplayer')
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
                description: 'Complete Missions',
                available: false,
                handler: () => this.buildCampaignMenu()
            },
            { 
                id: 'settings', 
                name: 'SETTINGS', 
                description: 'Personalize Options',
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
                ${option.available ? '' : '<span class="badge">SOON</span>'}
            `;
            
            if (option.available && option.handler) {
                modeButton.addEventListener('click', option.handler);
            }
            
            gameModeContainer.appendChild(modeButton);
        });
        
        menuContainer.appendChild(gameModeContainer);
    }
    
    buildGameSetup(gameMode) {
        // Update config with selected game mode
        this.configManager.setGameMode(gameMode);
        
        const menuContainer = this.createMenuContainer();
        
        // Create appropriate setup form based on game mode
        let minCount, maxCount, countLabel, startButtonText, isBotBattle;
        
        switch(gameMode) {
            case 'singleplayer':
                minCount = 1;
                maxCount = 5;
                countLabel = 'NUMBER OF BOTS';
                startButtonText = 'BATTLE >';
                isBotBattle = false;
                break;
            case 'botbattle':
                minCount = 2;
                maxCount = 6;
                countLabel = 'NUMBER OF OPPONENTS';
                startButtonText = 'BATTLE >';
                isBotBattle = true;
                break;
        }
        
        this.createGameSetupForm(menuContainer, minCount, maxCount, countLabel, startButtonText, isBotBattle);
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
        const backButton = this.getBackButton(() => this.buildMainMenu());
        
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
        densitySlider.min = '0.5';
        densitySlider.max = '2.0';
        densitySlider.step = '0.05';
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

    buildInstructionsScreen() {
        const menuContainer = this.createMenuContainer();
        
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

        // Back button
        const backButton = this.getBackButton(() => this.buildMainMenu());
        
        menuContainer.appendChild(content);
        menuContainer.appendChild(backButton);
    }
    
    buildCampaignMenu() {
        const menuContainer = this.createMenuContainer();
        
        // Back button
        const backButton = this.getBackButton(() => this.buildMainMenu());
        
        // Campaign content placeholder
        const content = document.createElement('div');
        content.className = 'campaign-content';
        content.innerHTML = `
            <h2>CAMPAIGN MODE</h2>
            <p>A series of scripted missions will be implemented here, but we ain't written on scripts yet.</p>
        `;
        
        menuContainer.appendChild(content);
        menuContainer.appendChild(backButton);
    }
    
    buildSettingsScreen() {
        const menuContainer = this.createMenuContainer();
        
        // Back button
        const backButton = this.getBackButton(() => this.buildMainMenu());
        
        // Settings content placeholder
        const content = document.createElement('div');
        content.className = 'settings-content';
        content.innerHTML = `
            <h2>GAME SETTINGS</h2>
            <p>Settings will be available soon! Check back later to customize your game experience.</p>
        `;
    
        menuContainer.appendChild(content);
        menuContainer.appendChild(backButton);
    }
}

export default MenuBuilder;