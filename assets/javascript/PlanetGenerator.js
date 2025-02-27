// PlanetGenerator.js
import { Planet } from './PlanetAndTroops.js';

export default class PlanetGenerator {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        
        // Configuration can be passed in or use defaults
        this.config = {
            MIN_DISTANCE: 80,
            MAX_ATTEMPTS: 100,
            NEUTRAL_COUNT: 8,
            MIN_SIZE: 15,
            MAX_SIZE_VARIATION: 20,
            STARTING_PLANET_SIZE: 30,
            STARTING_TROOPS: 30
        };
    }
    
    // Main method to generate all planets for the game
    generatePlanets(playerCount, botBattleMode) {
        const planets = [];
        
        if (botBattleMode) {
            // Generate planets for bot battle mode
            planets.push(...this.generateBotBattlePlanets(playerCount));
        } else {
            // Generate planets for regular game mode with human player
            const humanPlayer = this.game.playersController.getHumanPlayers()[0].id;
            const aiPlayers = this.game.playersController.getAIPlayers().map(player => player.id);
            planets.push(...this.generatePlayerPlanets(humanPlayer, aiPlayers, playerCount));
        }
        
        // Generate neutral planets
        planets.push(...this.generateNeutralPlanets(planets));
        
        return planets;
    }
    
    generateBotBattlePlanets(botCount) {
        const planets = [];
        // Get all bot player IDs
        const botPlayers = this.game.playersController.getAIPlayers().map(player => player.id);
        
        // Calculate positions based on canvas dimensions
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Position bots evenly around the map
        for (let i = 0; i < botCount; i++) {
            // Calculate position in a circular pattern
            const angle = (i / botCount) * Math.PI * 2;
            const radius = Math.min(width, height) * 0.35;
            
            const x = width / 2 + Math.cos(angle) * radius;
            const y = height / 2 + Math.sin(angle) * radius;
            
            const botPlanet = new Planet(
                x,
                y,
                this.config.STARTING_PLANET_SIZE,
                this.config.STARTING_TROOPS,
                botPlayers[i],
                this.game
            );
            
            planets.push(botPlanet);
        }
        
        return planets;
    }
    
    generatePlayerPlanets(humanPlayer, aiPlayers, playerCount) {
        const planets = [];
        // Calculate positions based on canvas dimensions for better adaptability
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Player's starting planet - lower left quadrant
        const playerPlanet = new Planet(
            width * 0.2,
            height * 0.8,
            this.config.STARTING_PLANET_SIZE,
            this.config.STARTING_TROOPS,
            humanPlayer,
            this.game
        );
        planets.push(playerPlanet);

        // AI starting planets
        for (let i = 0; i < aiPlayers.length; i++) {
            let position;
            
            // Position AI planets based on player count
            if (playerCount === 2) {
                // 2 players: AI in upper right
                position = { x: width * 0.8, y: height * 0.2 };
            } else if (playerCount === 3) {
                // 3 players: AIs in upper right and lower right
                position = (i === 0) 
                    ? { x: width * 0.8, y: height * 0.2 } 
                    : { x: width * 0.8, y: height * 0.8 };
            } else if (playerCount === 4) {
                // 4 players positions
                const positions = [
                    { x: width * 0.8, y: height * 0.2 },
                    { x: width * 0.2, y: height * 0.2 },
                    { x: width * 0.8, y: height * 0.8 }
                ];
                position = positions[i % positions.length];
            }
            
            const aiPlanet = new Planet(
                position.x,
                position.y,
                this.config.STARTING_PLANET_SIZE,
                this.config.STARTING_TROOPS,
                aiPlayers[i],
                this.game
            );
            planets.push(aiPlanet);
        }
        
        return planets;
    }
    
    generateNeutralPlanets(existingPlanets = []) {
        const neutralPlanets = [];
        for (let i = 0; i < this.config.NEUTRAL_COUNT; i++) {
            let attempts = 0;
            let valid = false;
            
            while (!valid && attempts < this.config.MAX_ATTEMPTS) {
                const size = this.config.MIN_SIZE + Math.random() * this.config.MAX_SIZE_VARIATION;
                const x = size + Math.random() * (this.canvas.width - size * 2);
                const y = size + Math.random() * (this.canvas.height - size * 2);
                
                valid = this.isValidPlanetPosition(x, y, size, [...existingPlanets, ...neutralPlanets]);
                
                if (valid) {
                    // Each neutral planet starts with troops proportional to its size
                    const startingTroops = Math.floor(size / 3);
                    neutralPlanets.push(new Planet(x, y, size, startingTroops, 'neutral', this.game));
                    break;
                }
                attempts++;
            }
        }
        return neutralPlanets;
    }

    isValidPlanetPosition(x, y, size, existingPlanets) {
        for (const planet of existingPlanets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.config.MIN_DISTANCE) {
                return false;
            }
        }
        return true;
    }
}