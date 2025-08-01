// ===========================================
// root/javascript/config.js
// ===========================================

export const config = {
    // --- GAME & TIMER ---
    game: {
        defaultDuration: 300, // duration of game in seconds
    },
    // --- PLAYER & AI ---
    player: {
        defaultAIValue: 'C3.5A', // unique value of default AI to use when one isn't specified
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
        playerToNeutralDistance: 60, // Minimum distance between a player planet and a new neutral planet
        neutralToNeutralDistance: 40, // Minimum distance between two neutral planets
        neutralBorderBuffer: 10, // Minimum distance from the canvas edge for neutral planets
        maxPlacementAttempts: 150, // How many times to try placing a planet before giving up
        baseNeutralCount: 8, // Base number of neutral planets before modifiers are applied
        minNeutralSize: 15,
        maxNeutralSizeVariation: 20,
        density: { // Min, max, and default values for the galaxy density slider
            min: 0.5,
            max: 2.0,
            default: 1.0,
        },
    },
    planet: {
        maxTroops: 999, // The maximum number of troops a single planet can hold
        productionFactor: 20, // Production rate is calculated as: planet.size / productionFactor. Lower is faster.
    },
    // --- TROOPS ---
    troop: {
        movementSpeed: 150, // Speed in pixels per second. MUST be consistent for game logic and AI.
    },
    // --- AI-SPECIFICS ---
    ai: {
        scoring: { // Weights for calculating the strategic value of a planet
            sizeWeight: 1.5,
            productionWeight: 20,
            centralityWeight: 25,
        },
        threat: { // Parameters for calculating the threat level to an AI's planet
            radius: 300,
            distanceDivisor: 10,
        },
        // NEW: Global cooldown for fairness
        globalDecisionCooldown: 0.25, // Seconds between ANY AI being allowed to make a decision
    },
    // --- UI, VISUALS, & INPUT ---
    ui: {
        input: {
            doubleClickThreshold: 300, // Time in milliseconds to detect a double-click
            clickMoveThreshold: 5, // Mouse movement under this (in pixels) is considered a click, not a drag
            touchMoveThreshold: 10, // Touch movement under this (in pixels) is considered a tap, not a drag
            touchDurationThreshold: 300, // Touch duration under this (in ms) is considered a tap, not a drag
        },
        visuals: {
            glow: { // Settings for the glow effect on planets
                maxIntensity: 35,
                baseIntensity: 10,
                intensityScalar: 2,
            },
            troopIcon: { // Settings for the musical note troop icons
                tier1MaxTroops: 10, // Max troops for '♩'
                tier2MaxTroops: 100, // Max troops for '♪'
                minFontSize: 20,
                maxFontSize: 30,
            },
            fallbackColor: '#888', // Fallback color for troop bar segments if a player ID is not found
        },
        footerSlider: {
            defaultValue: 50, // Default position of the slider (1-100)
            speed: { // Speed multiplier range for bot battles
                min: 0.01,
                mid: 1.0,
                max: 4.0,
            }
        },
    },
    // --- MENU DEFAULTS ---
    menuDefaults: {
        playerCount: 6, // Default number of players for the setup screen
        playerCountRange: [2, 6], // The minimum and maximum number of players allowed in a game.
    },
};