// UnifiedPlanetGenerator.js
import { Planet } from './PlanetAndTroops.js';

export default class UnifiedPlanetGenerator {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        
        // Default configuration
        this.config = {
            MIN_DISTANCE: 80,
            MAX_ATTEMPTS: 100,
            NEUTRAL_COUNT: 8,
            MIN_SIZE: 15,
            MAX_SIZE_VARIATION: 20,
            STARTING_PLANET_SIZE: 30,
            STARTING_TROOPS: 30,
            // Percentage of canvas radius to place player planets
            PLAYER_PLANET_RADIUS_FACTOR: 0.35,
            // Edge buffer for placement
            EDGE_BUFFER: 40
        };
    }
    
    // Main method to generate all planets for the game
    generatePlanets() {
        const planets = [];
        const playerCount = this.game.playerCount;
        
        // 1. Place all player planets (human and AI)
        planets.push(...this.generatePlayerPlanets());
        
        // 2. Add neutral planets to fill in the map
        planets.push(...this.generateNeutralPlanets(planets));
        
        return planets;
    }
    
    generatePlayerPlanets() {
        const planets = [];
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Get all players (human and AI)
        const humanPlayers = this.game.playersController.getHumanPlayers();
        const aiPlayers = this.game.playersController.getAIPlayers();
        const allPlayers = [...humanPlayers, ...aiPlayers];
        
        // Calculate good positions for player planets
        const positions = this.calculateBalancedPositions(allPlayers.length);
        
        // Place planets for all players
        for (let i = 0; i < allPlayers.length; i++) {
            const player = allPlayers[i];
            const position = positions[i];
            
            const playerPlanet = new Planet(
                position.x,
                position.y,
                this.config.STARTING_PLANET_SIZE,
                this.config.STARTING_TROOPS,
                player.id,
                this.game
            );
            
            planets.push(playerPlanet);
        }
        
        return planets;
    }
    
    calculateBalancedPositions(playerCount) {
        const positions = [];
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Calculate radius for placing planets, based on the smaller dimension
        const radius = Math.min(width, height) * this.config.PLAYER_PLANET_RADIUS_FACTOR;
        
        // Place planets evenly in a circle around the center
        for (let i = 0; i < playerCount; i++) {
            // Calculate angle for even distribution
            const angle = (i / playerCount) * Math.PI * 2;
            
            // Add some small random variation to avoid perfectly symmetric placement
            const variationFactor = 0.15; // 15% variation
            const radiusVariation = radius * (1 - variationFactor/2 + Math.random() * variationFactor);
            const angleVariation = angle + (Math.random() * 0.1 - 0.05); // +/- 0.05 radians
            
            // Calculate position with variation
            const x = centerX + Math.cos(angleVariation) * radiusVariation;
            const y = centerY + Math.sin(angleVariation) * radiusVariation;
            
            // Ensure planets stay within canvas bounds
            const safeX = Math.max(this.config.EDGE_BUFFER, 
                        Math.min(width - this.config.EDGE_BUFFER, x));
            const safeY = Math.max(this.config.EDGE_BUFFER, 
                        Math.min(height - this.config.EDGE_BUFFER, y));
            
            positions.push({ x: safeX, y: safeY });
        }
        
        return positions;
    }
    
    generateNeutralPlanets(existingPlanets = []) {
        const neutralPlanets = [];
        const neutralCount = this.calculateOptimalNeutralCount();
        
        // Create neutral planets with collision avoidance
        for (let i = 0; i < neutralCount; i++) {
            let attempts = 0;
            let valid = false;
            
            while (!valid && attempts < this.config.MAX_ATTEMPTS) {
                // Calculate size with some variation
                const size = this.config.MIN_SIZE + Math.random() * this.config.MAX_SIZE_VARIATION;
                
                // Calculate position with edge buffer
                const buffer = size + this.config.EDGE_BUFFER;
                const x = buffer + Math.random() * (this.canvas.width - buffer * 2);
                const y = buffer + Math.random() * (this.canvas.height - buffer * 2);
                
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
    
    calculateOptimalNeutralCount() {
        // Calculate a good number of neutral planets based on map size and player count
        const mapArea = this.canvas.width * this.canvas.height;
        const playerCount = this.game.playerCount;
        
        // Base value plus scaling with map size and player count
        const baseCount = this.config.NEUTRAL_COUNT;
        const areaFactor = Math.sqrt(mapArea) / 500; // Normalize for a 500x500 map
        const playerFactor = Math.sqrt(playerCount);
        
        return Math.floor(baseCount * areaFactor * playerFactor);
    }

    isValidPlanetPosition(x, y, size, existingPlanets) {
        // Check distance from existing planets
        for (const planet of existingPlanets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = this.config.MIN_DISTANCE + size + planet.size;
            
            if (distance < minDistance) {
                return false;
            }
        }
        
        // Check if within canvas bounds
        if (x - size < 0 || x + size > this.canvas.width || 
            y - size < 0 || y + size > this.canvas.height) {
            return false;
        }
        
        return true;
    }
}