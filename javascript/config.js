// ===========================================================
// root/assets/javascript/config.js — This file centralizes all "magic numbers" and configuration settings for the game, making it easy to tweak and balance.
// ===========================================================

const CONFIG = {
    GAME_DEFAULTS: {
    GAME_TIME_SECONDS: 300, // Default game duration (5 minutes)
    RESIZE_DEBOUNCE_MS: 100, // Debounce delay for window resize event
    DEFAULT_GAME_MODE: 'singleplayer',
    PAUSE_ON_BLUR: true, // Whether the game timer should pause when the window is not in focus
    },
    /**
     * Gameplay balance and mechanics.
     */
    GAMEPLAY: {
        TROOP_SPEED: 150,                   // Speed of troop movements in pixels per second
        MAX_PLANET_TROOPS: 999,             // Maximum number of troops a planet can hold
        PLANET_PRODUCTION_DIVISOR: 20,      // Planet size is divided by this to get production rate (lower is faster)
    },

    /**
     * Settings for procedural planet generation.
     */
    PLANET_GENERATION: {
        // Player starting planets
        PLAYER_STARTING_PLANET_SIZE: 30,
        PLAYER_STARTING_TROOPS: 30,

        // Neutral planet generation
        DEFAULT_NEUTRAL_COUNT: 8,           // Base number of neutral planets before modifiers
        NEUTRAL_COUNT_RANDOM_VARIATION: 3,  // Randomly add/subtract from neutral count (e.g., 3 -> -1, 0, or 1)
        MIN_NEUTRAL_PLANET_SIZE: 15,
        MAX_NEUTRAL_SIZE_VARIATION: 20,     // Max random size to add to MIN_NEUTRAL_PLANET_SIZE
        MIN_CLUSTER_PLANETS: 3,             // Minimum planets needed to attempt generating a cluster

        // Spacing and placement
        MAX_PLACEMENT_ATTEMPTS: 150,
        PLAYER_TO_NEUTRAL_MIN_DISTANCE: 60,
        NEUTRAL_TO_NEUTRAL_MIN_DISTANCE: 40,
        NEUTRAL_BORDER_BUFFER: 10,
    },

    /**
     * Settings related to AI behavior and logic.
     */
    AI: {
        DEFAULT_AI: 'TiffanySpuckler',      // Fallback AI type if one isn't specified
        // Strategic weighting factors for planet evaluation
        PLANET_VALUE_SIZE_WEIGHT: 1.5,
        PLANET_VALUE_PRODUCTION_WEIGHT: 20,
        PLANET_VALUE_CENTRALITY_WEIGHT: 25,
        // Threat calculation parameters
        THREAT_CALCULATION_RADIUS: 300,     // How far an AI looks for enemy planets when calculating threat
        THREAT_DISTANCE_DIVISOR: 10,        // Divisor for distance in threat calculation (higher = less falloff)
    },

    /**
     * User Interface elements, colors, and text.
     */
    UI: {
        // Player and neutral colors
        COLORS: {
            'player1': '#ffff00', 'player2': '#ff0000', 'player3': '#00ffff',
            'player4': '#00ff00', 'player5': '#ff00ff', 'player6': '#ff8000',
            'neutral': '#ffffff'
        },
        // Input handling
        DOUBLE_CLICK_THRESHOLD_MS: 300,
        CLICK_VS_DRAG_THRESHOLD_PX: 5,
        TOUCH_VS_DRAG_THRESHOLD_PX: 10,
        TOUCH_VS_DRAG_DURATION_MS: 300,
    },

    /**
     * Visuals, effects, and rendering settings.
     */
    VISUALS: {
        // Planet glow effects for incoming troops
        ATTACK_GLOW_BASE: 10,
        ATTACK_GLOW_SCALAR: 2,
        ATTACK_GLOW_MAX: 35,
        REINFORCE_GLOW_BASE: 10,
        REINFORCE_GLOW_SCALAR: 2,
        REINFORCE_GLOW_MAX: 35,
        // Troop movement icons (musical notes)
        TROOP_ICON_THRESHOLDS: {
            SMALL: 10,  // Up to this amount uses the small icon
            MEDIUM: 100 // Up to this amount uses the medium icon (large icon is above this)
        },
        TROOP_ICON_MIN_FONT_SIZE: 20,
        TROOP_ICON_MAX_FONT_SIZE: 30,
        // Fonts
        PLANET_TROOP_FONT: '14px Courier New',
        MOVEMENT_TROOP_FONT: '12px Courier New',
        // Selection box and trajectory lines
        SELECTION_BOX_COLOR: '#ffff00',
        SELECTION_BOX_FILL: 'rgba(255, 255, 0, 0.1)',
        SELECTION_BOX_LINE_WIDTH: 1,
        SELECTION_BOX_DASH: [5, 3],
        TRAJECTORY_LINE_COLOR: '#ffffff44',
        TRAJECTORY_LINE_WIDTH: 1,
        TRAJECTORY_LINE_DASH: [5, 5],
    },

    /**
     * Footer slider settings.
     */
    FOOTER_SLIDER: {
        DEFAULT_VALUE: 50,
        MIN_VALUE: 1,
        MAX_VALUE: 100,
        // Bot battle speed multiplier settings
        SPEED_MIN: 0.01,
        SPEED_NORMAL: 1.0,
        SPEED_MAX: 4.0,
    }
};