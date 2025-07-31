
// ===========================================================
// assets/javascript/config.js — centralizes magic numbers and configuration settings for game balancing
// ===========================================================

export const config = {
    // --- GAME TIMER ---
    game: {
        defaultDuration: 300, // duration of a game in seconds
    },
    // --- PLAYERS ---
    player: {
        defaultAIValue: 'TiffanySpuckler', // unique value of default AI to use when one isn't specified
        colors: { // colours assigned to each player ID and neutral faction
            'player1': '#ffff00', // Yellow
            'player2': '#ff0000', // Red
            'player3': '#00ffff', // Cyan
            'player4': '#00ff00', // Green
            'player5': '#ff00ff', // Magenta
            'player6': '#ff8000', // Orange
            'neutral': '#ffffff', // White
        },
    },
    // --- PLANET GENERATION & BEHAVIOUR ---
    planetGeneration: {
        startingPlanetSize: 30,
        startingPlanetTroops: 30,
        // Minimum distance between a player planet and a new neutral planet
        playerToNeutralDistance: 60,
        // Minimum distance between two neutral planets
        neutralToNeutralDistance: 40,
        // Minimum distance from the canvas edge for neutral planets
        neutralBorderBuffer: 10,
        // How many times to try placing a planet before giving up
        maxPlacementAttempts: 150,
        // Base number of neutral planets before modifiers are applied
        baseNeutralCount: 8,
        minNeutralSize: 15,
        maxNeutralSizeVariation: 20,
        // Min, max, and default values for the galaxy density slider
        density: {
            min: 0.5,
            max: 2.0,
            default: 1.0,
        },
    },

    planet: {
        // The maximum number of troops a single planet can hold
        maxTroops: 999,
        // Production rate is calculated as: planet.size / productionFactor. Lower is faster.
        productionFactor: 20,
    },

    //-------------------------------------------------
    // TROOP SETTINGS
    //-------------------------------------------------
    troop: {
        // Speed in pixels per second. MUST be consistent for game logic and AI.
        movementSpeed: 150,
    },

    //-------------------------------------------------
    // AI-SPECIFIC SETTINGS
    //-------------------------------------------------
    ai: {
        // Weights for calculating the strategic value of a planet
        scoring: {
            sizeWeight: 1.5,
            productionWeight: 20,
            centralityWeight: 25,
        },
        // Parameters for calculating the threat level to an AI's planet
        threat: {
            radius: 300,
            distanceDivisor: 10,
        },
    },

    //-------------------------------------------------
    // UI, VISUALS, & INPUT
    //-------------------------------------------------
    ui: {
        input: {
            // Time in milliseconds to detect a double-click
            doubleClickThreshold: 300,
            // Mouse movement under this (in pixels) is considered a click, not a drag
            clickMoveThreshold: 5,
            // Touch movement under this (in pixels) is considered a tap, not a drag
            touchMoveThreshold: 10,
            // Touch duration under this (in ms) is considered a tap, not a drag
            touchDurationThreshold: 300,
        },
        visuals: {
            // Settings for the glow effect on planets
            glow: {
                maxIntensity: 35,
                baseIntensity: 10,
                intensityScalar: 2,
            },
            // Settings for the musical note troop icons
            troopIcon: {
                tier1MaxTroops: 10, // Max troops for '♩'
                tier2MaxTroops: 100, // Max troops for '♪'
                minFontSize: 20,
                maxFontSize: 30,
            },
            // Fallback color for troop bar segments if a player ID is not found
            fallbackColor: '#888',
        },
        footerSlider: {
            // Default position of the slider (1-100)
            defaultValue: 50,
            // Speed multiplier range for bot battles
            speed: {
                min: 0.01,
                mid: 1.0,
                max: 4.0,
            }
        },
    },

    //-------------------------------------------------
    // MENU DEFAULTS
    //-------------------------------------------------
    menuDefaults: {
        // Default number of players for the setup screen
        playerCount: 2, // (1 Human + 1 AI)
        // Default number of bots for the bot battle setup screen
        botBattleCount: 2,
        // Default AI types selected for a new game
        aiTypes: ['TiffanySpuckler'],
    },
};