// ===========================================
// root/javascript/config.js
// ===========================================

export const config = {
    // --- GAME TIMER ---
    game: {
        defaultDuration: 300, // duration of game in seconds
    },
    // --- PLAYERS ---
    player: {
        defaultAIValue: 'C3.5A', // unique value of default AI to use when one isn't specified
        colors: { // colours assigned to each player ID and neutral faction
            'player1': '#ffff00', // yellow
            'player2': '#ff0000', // red
            'player3': '#00ffff', // cyan
            'player4': '#00ff00', // green
            'player5': '#ff00ff', // magenta
            'player6': '#ff8000', // orange
            'neutral': '#ffffff', // white
        },
    },
    // --- PLANETS ---
    planetGeneration: {
        startingPlanetSize: 30,
        startingPlanetTroops: 30,
        playerToNeutralDistance: 60, // minimum distance between a player planet and a new neutral planet
        neutralToNeutralDistance: 40, // minimum distance between two neutral planets
        neutralBorderBuffer: 10, // minimum distance from the canvas edge for neutral planets
        maxPlacementAttempts: 150, // how many times to try placing a planet before giving up
        baseNeutralCount: 8, // base number of neutral planets before modifiers are applied
        minNeutralSize: 15,
        maxNeutralSizeVariation: 20,
        density: { // min, max, and default values for galaxy density slider
            min: 0.6,
            max: 2.0,
            default: 1.3,
        },
    },
    planet: {
        maxTroops: 999, // maximum number of troops a single planet can hold
        productionFactor: 20, // production rate is planet.size/productionFactor, so lower is faster
    },
    // --- TROOPS ---
    troop: {
        movementSpeed: 150, // speed in pixels per second
    },
    // --- AI ---
    ai: {
        scoring: { // weights for calculating strategic value of a planet
            sizeWeight: 1.5,
            productionWeight: 20,
            centralityWeight: 25,
        },
        threat: { // parameters for calculating threat level to an AI's planet
            radius: 300,
            distanceDivisor: 10,
        },
        decisionCooldown: 0.5, // seconds between AI being allowed to make a decision
    },
    // --- UI & INPUT ---
    ui: {
        input: {
            doubleClickThreshold: 300, // time in milliseconds to double-click
            clickMoveThreshold: 5, // mouse movement (in pixels) under this is a click
            touchMoveThreshold: 10, // touch movement (in pixels) under this is a tap
            touchDurationThreshold: 300, // touch duration (in ms) under this is a tap
        },
        visuals: {
            glow: { // glow effect on planets
                maxIntensity: 35,
                baseIntensity: 10,
                intensityScalar: 2,
            },
            troopIcon: { // musical note troop icons
                tier1MaxTroops: 10, // max troops for '♩'
                tier2MaxTroops: 100, // max troops for '♪'
                minFontSize: 20,
                maxFontSize: 30,
            },
            fallbackColor: '#888', // fallback for troop bar segments if a player ID isn't found
        },
        footerSlider: {
            defaultValue: 50, // default position of slider (1-100)
            speed: { // multiplier range for bot battles
                min: 0.1,
                mid: 1.0,
                max: 4.0,
            }
        },
    },
    // --- MENUS ---
    menuDefaults: {
        playerCount: 6, // default number of players
        playerCountRange: [2, 6], // min and max number of players allowed in a game
    },
};