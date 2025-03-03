// (PlanetGeneration.js):

import { Planet } from './PlanetAndTroops.js';

export default class PlanetGeneration {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        
        // Default configuration
        this.config = {
            // Distances between different types of planets
            PLAYER_TO_PLAYER_DISTANCE: 180,  // Players should be far from each other
            PLAYER_TO_NEUTRAL_DISTANCE: 60,  // Players can be closer to neutrals
            NEUTRAL_TO_NEUTRAL_DISTANCE: 40, // Neutrals can be quite close to each other
            
            // Border distances - how close planets can be to map edges
            PLAYER_BORDER_BUFFER: 30,        // Players can be somewhat close to edges
            NEUTRAL_BORDER_BUFFER: 10,       // Neutrals can be very close to edges
            
            MAX_ATTEMPTS: 150,
            NEUTRAL_COUNT: 8,
            MIN_SIZE: 15,
            MAX_SIZE_VARIATION: 20,
            STARTING_PLANET_SIZE: 30,
            STARTING_TROOPS: 30,
        };
    }
    
    // Main method to generate all planets for the game
    generatePlanets() {
        const planets = [];
        
        // 1. Place human player planets first (if any)
        const humanPlayers = this.game.playersController.getHumanPlayers();
        if (humanPlayers.length > 0) {
            planets.push(...this.generateHumanPlayerPlanets(humanPlayers));
        }
        
        // 2. Place AI player planets next
        const aiPlayers = this.game.playersController.getAIPlayers();
        if (aiPlayers.length > 0) {
            planets.push(...this.generateAIPlayerPlanets(aiPlayers, planets));
        }
        
        // 3. Add neutral planets to fill in the map
        planets.push(...this.generateNeutralPlanets(planets));
        
        return planets;
    }
    
    generateHumanPlayerPlanets(humanPlayers) {
        const planets = [];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Divide the map into quadrants
        const quadrants = [
            { minX: 0, maxX: width/2, minY: height/2, maxY: height },   // Bottom left
            { minX: width/2, maxX: width, minY: 0, maxY: height/2 },    // Top right
            { minX: 0, maxX: width/2, minY: 0, maxY: height/2 },        // Top left
            { minX: width/2, maxX: width, minY: height/2, maxY: height } // Bottom right
        ];
        
        // For each human player, select a random quadrant and position
        for (let i = 0; i < humanPlayers.length; i++) {
            const player = humanPlayers[i];
            
            // Select a random quadrant (prefer bottom left for first human player)
            const quadrantIndex = i === 0 ? 0 : Math.floor(Math.random() * quadrants.length);
            const quadrant = quadrants[quadrantIndex];
            
            // Create buffer space from edges (using player-specific border buffer)
            const buffer = this.config.PLAYER_BORDER_BUFFER + this.config.STARTING_PLANET_SIZE;
            
            // Find a valid position within the quadrant
            let x, y, valid = false, attempts = 0;
            
            while (!valid && attempts < this.config.MAX_ATTEMPTS) {
                // Generate position with some randomness but biased toward the center of the quadrant
                const quadrantCenterX = (quadrant.minX + quadrant.maxX) / 2;
                const quadrantCenterY = (quadrant.minY + quadrant.maxY) / 2;
                
                // Get random position with bias toward quadrant center (60% toward center, 40% random)
                const centerBias = 0.6;
                x = quadrant.minX + buffer + (Math.random() * centerBias + (1 - centerBias) * 0.5) * 
                    (quadrant.maxX - quadrant.minX - buffer * 2);
                y = quadrant.minY + buffer + (Math.random() * centerBias + (1 - centerBias) * 0.5) * 
                    (quadrant.maxY - quadrant.minY - buffer * 2);
                
                valid = this.isValidPlayerPosition(x, y, this.config.STARTING_PLANET_SIZE, planets);
                attempts++;
            }
            
            if (valid) {
                const playerPlanet = new Planet(
                    x, y,
                    this.config.STARTING_PLANET_SIZE,
                    this.config.STARTING_TROOPS,
                    player.id,
                    this.game
                );
                planets.push(playerPlanet);
                
                // Remove the used quadrant from options
                quadrants.splice(quadrantIndex, 1);
            } else {
                console.warn('Could not place human player planet in valid position');
                // Fallback to a safe position
                const fallbackX = quadrant.minX + (quadrant.maxX - quadrant.minX) / 2;
                const fallbackY = quadrant.minY + (quadrant.maxY - quadrant.minY) / 2;
                
                const playerPlanet = new Planet(
                    fallbackX, fallbackY,
                    this.config.STARTING_PLANET_SIZE,
                    this.config.STARTING_TROOPS,
                    player.id,
                    this.game
                );
                planets.push(playerPlanet);
            }
        }
        
        return planets;
    }
    
    generateAIPlayerPlanets(aiPlayers, existingPlanets) {
        const planets = [];
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // For each AI player, find a position that's well-distributed from other players
        for (let i = 0; i < aiPlayers.length; i++) {
            const player = aiPlayers[i];
            
            // Try to place AI planets in a way that maximizes distance from other planets
            let bestX = 0, bestY = 0, bestDistance = 0;
            
            // Try multiple random positions and pick the best one
            for (let attempt = 0; attempt < this.config.MAX_ATTEMPTS; attempt++) {
                // Generate a random position with edge buffer
                const buffer = this.config.PLAYER_BORDER_BUFFER + this.config.STARTING_PLANET_SIZE;
                const x = buffer + Math.random() * (width - buffer * 2);
                const y = buffer + Math.random() * (height - buffer * 2);
                
                // Calculate minimum distance to any existing player planet
                let minDistance = Number.MAX_VALUE;
                for (const planet of [...existingPlanets, ...planets]) {
                    const dx = x - planet.x;
                    const dy = y - planet.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    minDistance = Math.min(minDistance, distance);
                }
                
                // If this position is better than previous best, remember it
                if (minDistance > bestDistance && minDistance > this.config.PLAYER_TO_PLAYER_DISTANCE) {
                    bestX = x;
                    bestY = y;
                    bestDistance = minDistance;
                }
            }
            
            // Use the best position found or generate a fallback if none is good enough
            if (bestDistance >= this.config.PLAYER_TO_PLAYER_DISTANCE) {
                const aiPlanet = new Planet(
                    bestX, bestY,
                    this.config.STARTING_PLANET_SIZE,
                    this.config.STARTING_TROOPS,
                    player.id,
                    this.game
                );
                planets.push(aiPlanet);
            } else {
                // If we couldn't find a good position, use corner-based positioning as fallback
                const corners = [
                    { x: width * 0.2, y: height * 0.2 },
                    { x: width * 0.8, y: height * 0.2 },
                    { x: width * 0.2, y: height * 0.8 },
                    { x: width * 0.8, y: height * 0.8 },
                    { x: width * 0.5, y: height * 0.5 },
                    { x: width * 0.5, y: height * 0.2 }
                ];
                
                // Find the best corner position
                let bestCorner = corners[0];
                let bestCornerDistance = 0;
                
                for (const corner of corners) {
                    let minDistance = Number.MAX_VALUE;
                    for (const planet of [...existingPlanets, ...planets]) {
                        const dx = corner.x - planet.x;
                        const dy = corner.y - planet.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        minDistance = Math.min(minDistance, distance);
                    }
                    
                    if (minDistance > bestCornerDistance) {
                        bestCorner = corner;
                        bestCornerDistance = minDistance;
                    }
                }
                
                const aiPlanet = new Planet(
                    bestCorner.x, bestCorner.y,
                    this.config.STARTING_PLANET_SIZE,
                    this.config.STARTING_TROOPS,
                    player.id,
                    this.game
                );
                planets.push(aiPlanet);
            }
        }
        
        return planets;
    }
    
    generateNeutralPlanets(existingPlanets = []) {
        const neutralPlanets = [];
        const neutralCount = this.calculateOptimalNeutralCount();
        
        // Strategy: Create a mix of randomly placed planets and strategic clusters
        const randomPlanetCount = Math.floor(neutralCount * 0.7); // 70% random
        const clusterPlanetCount = neutralCount - randomPlanetCount; // 30% in clusters
        
        // Generate random neutral planets
        this.generateRandomNeutralPlanets(randomPlanetCount, existingPlanets, neutralPlanets);
        
        // Generate cluster neutral planets (if we have 3+ neutral planets)
        if (clusterPlanetCount >= 3) {
            this.generateClusteredNeutralPlanets(clusterPlanetCount, [...existingPlanets, ...neutralPlanets], neutralPlanets);
        } else {
            // If too few for a cluster, just add them as random
            this.generateRandomNeutralPlanets(clusterPlanetCount, [...existingPlanets, ...neutralPlanets], neutralPlanets);
        }
        
        return neutralPlanets;
    }
    
    generateRandomNeutralPlanets(count, existingPlanets, targetArray) {
        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let valid = false;
            
            while (!valid && attempts < this.config.MAX_ATTEMPTS) {
                // Calculate size with some variation
                const size = this.config.MIN_SIZE + Math.random() * this.config.MAX_SIZE_VARIATION;
                
                // Calculate position with edge buffer (much smaller for neutrals)
                const buffer = size + this.config.NEUTRAL_BORDER_BUFFER;
                const x = buffer + Math.random() * (this.canvas.width - buffer * 2);
                const y = buffer + Math.random() * (this.canvas.height - buffer * 2);
                
                valid = this.isValidNeutralPosition(x, y, size, [...existingPlanets, ...targetArray]);
                
                if (valid) {
                    // Each neutral planet starts with troops proportional to its size
                    const startingTroops = Math.floor(size / 3);
                    targetArray.push(new Planet(x, y, size, startingTroops, 'neutral', this.game));
                    break;
                }
                attempts++;
            }
        }
    }
    
    generateClusteredNeutralPlanets(count, existingPlanets, targetArray) {
        // Find a good location for a cluster
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        let clusterX = 0, clusterY = 0, validCluster = false;
        let attempts = 0;
        
        while (!validCluster && attempts < this.config.MAX_ATTEMPTS) {
            // Try to find an empty area for the cluster
            clusterX = width * 0.2 + Math.random() * width * 0.6;
            clusterY = height * 0.2 + Math.random() * height * 0.6;
            
            // Check if the location is far enough from existing planets
            let minDistance = Number.MAX_VALUE;
            for (const planet of existingPlanets) {
                const dx = clusterX - planet.x;
                const dy = clusterY - planet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Use the appropriate distance requirement based on planet type
                const minRequiredDistance = this.getRequiredDistanceFromPlanet(planet, true);
                minDistance = Math.min(minDistance, distance - minRequiredDistance);
            }
            
            // Check if we have enough space for a cluster
            validCluster = minDistance > 0;
            attempts++;
        }
        
        if (!validCluster) {
            // If we can't find a good cluster location, just add random planets
            this.generateRandomNeutralPlanets(count, existingPlanets, targetArray);
            return;
        }
        
        // Generate planets in a cluster around the center point
        const clusterRadius = this.config.NEUTRAL_TO_NEUTRAL_DISTANCE * 0.8; // Slightly closer than normal spacing
        
        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let valid = false;
            
            while (!valid && attempts < this.config.MAX_ATTEMPTS) {
                // Calculate angle and distance from cluster center
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * clusterRadius;
                
                // Size is generally smaller for clustered planets
                const size = this.config.MIN_SIZE + Math.random() * (this.config.MAX_SIZE_VARIATION * 0.7);
                
                // Calculate position
                const x = clusterX + Math.cos(angle) * distance;
                const y = clusterY + Math.sin(angle) * distance;
                
                valid = this.isValidNeutralPosition(x, y, size, [...existingPlanets, ...targetArray]);
                
                if (valid) {
                    // Cluster planets have more troops to make them valuable targets
                    const startingTroops = Math.floor(size / 2) + 5;
                    targetArray.push(new Planet(x, y, size, startingTroops, 'neutral', this.game));
                    break;
                }
                attempts++;
            }
            
            // If we can't place this planet in the cluster after many attempts,
            // just place it randomly
            if (!valid) {
                this.generateRandomNeutralPlanets(1, [...existingPlanets, ...targetArray], targetArray);
            }
        }
    }
    
    calculateOptimalNeutralCount() {
        // Calculate a good number of neutral planets based on map size and player count
        const mapArea = this.canvas.width * this.canvas.height;
        const playerCount = this.game.playerCount;
        
        // Base value plus scaling with map size and player count
        const baseCount = this.config.NEUTRAL_COUNT;
        const areaFactor = Math.sqrt(mapArea) / 500; // Normalize for a 500x500 map
        const playerFactor = Math.sqrt(playerCount);
        
        // Add some randomness to vary the count between games
        const randomVariation = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        
        return Math.max(3, Math.floor(baseCount * areaFactor * playerFactor) + randomVariation);
    }

    // New method to check if a player planet position is valid
    isValidPlayerPosition(x, y, size, existingPlanets) {
        // Check distance from existing planets
        for (const planet of existingPlanets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // For player planets, we enforce strict player-to-player distances
            const minDistance = this.config.PLAYER_TO_PLAYER_DISTANCE;
            
            if (distance < minDistance) {
                return false;
            }
        }
        
        // Check if within canvas bounds with player-specific border
        const borderBuffer = this.config.PLAYER_BORDER_BUFFER;
        if (x - size - borderBuffer < 0 || x + size + borderBuffer > this.canvas.width || 
            y - size - borderBuffer < 0 || y + size + borderBuffer > this.canvas.height) {
            return false;
        }
        
        return true;
    }
    
    // New method to check if a neutral planet position is valid
    isValidNeutralPosition(x, y, size, existingPlanets) {
        // Check distance from existing planets
        for (const planet of existingPlanets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Get the required distance based on the planet type
            const minDistance = this.getRequiredDistanceFromPlanet(planet, false) + size;
            
            if (distance < minDistance) {
                return false;
            }
        }
        
        // Check if within canvas bounds with neutral-specific border
        const borderBuffer = this.config.NEUTRAL_BORDER_BUFFER;
        if (x - size - borderBuffer < 0 || x + size + borderBuffer > this.canvas.width || 
            y - size - borderBuffer < 0 || y + size + borderBuffer > this.canvas.height) {
            return false;
        }
        
        return true;
    }
    
    // Helper method to calculate required distance based on planet type
    getRequiredDistanceFromPlanet(planet, isCluster) {
        const isPlayerPlanet = planet.owner !== 'neutral';
        
        if (isPlayerPlanet) {
            // Distance from a player planet
            return this.config.PLAYER_TO_NEUTRAL_DISTANCE;
        } else {
            // Distance from another neutral planet
            return isCluster ? 
                this.config.NEUTRAL_TO_NEUTRAL_DISTANCE * 0.5 : // Reduced distance for clusters
                this.config.NEUTRAL_TO_NEUTRAL_DISTANCE;
        }
    }
    
    // For backward compatibility - can be removed once other code is updated
    isValidPlanetPosition(x, y, size, existingPlanets) {
        // Check if this is a neutral planet (called from legacy code)
        return this.isValidNeutralPosition(x, y, size, existingPlanets);
    }
}