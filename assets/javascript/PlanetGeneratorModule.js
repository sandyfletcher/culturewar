// ===========================================================
// root/assets/javascript/PlanetGeneratorModule.js
// ===========================================================

import { Planet } from './PlanetAndTroops.js';

export default class PlanetGeneration {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.config = { // player planets are handled by grid system, these constants are for neutral planets
            PLAYER_TO_NEUTRAL_DISTANCE: 60,
            NEUTRAL_TO_NEUTRAL_DISTANCE: 40,
            NEUTRAL_BORDER_BUFFER: 10,
            MAX_ATTEMPTS: 150,
            NEUTRAL_COUNT: 8,
            MIN_SIZE: 15,
            MAX_SIZE_VARIATION: 20,
            STARTING_PLANET_SIZE: 30,
            STARTING_TROOPS: 30,
            PLANET_DENSITY: 1.0,
        };
    }
    generatePlanets() {
        const planets = [];
        const allPlayers = this.game.playersController.players;
        // 1. generate starting planets for all players using grid system
        const playerPlanets = this.generatePlayerPlanets(allPlayers);
        planets.push(...playerPlanets);
        // 2. add neutral planets to fill in map around player planets
        const neutralPlanets = this.generateNeutralPlanets(planets);
        planets.push(...neutralPlanets);
        return planets;
    }
    generatePlayerPlanets(players) {
        const playerPlanets = [];
        const playerCount = players.length;
        if (playerCount === 0) return [];
        const { width, height } = this.canvas;
        const planetSize = this.config.STARTING_PLANET_SIZE;
        // 1. calculate grid dimensions to divide map into chunks
        const cols = Math.ceil(Math.sqrt(playerCount));
        const rows = Math.ceil(playerCount / cols);
        const cellWidth = width / cols;
        const cellHeight = height / rows;
        // 2. create list of all available grid chunks
        let chunks = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                chunks.push({
                    x: c * cellWidth,
                    y: r * cellHeight,
                    width: cellWidth,
                    height: cellHeight
                });
            }
        }
        // 3. randomly assign a unique chunk to each player
        this._shuffleArray(chunks);
        // 4. iterate through players and place a planet within their assigned chunk
        for (let i = 0; i < playerCount; i++) {
            const player = players[i];
            const chunk = chunks[i]; // get pre-shuffled unique chunk
            const validPlacementWidth = chunk.width - (planetSize * 2); // calculate valid placement area within chunk to ensure perimeter does not extend beyond boundaries
            const validPlacementHeight = chunk.height - (planetSize * 2);
            let pX, pY;
            if (validPlacementWidth <= 0 || validPlacementHeight <= 0) { // edge case: chunk is too small for planet, warn user and place planet directly in center
                console.warn(`Planet generation: Chunk is too small for planet size. Placing at center.`);
                pX = chunk.x + chunk.width / 2;
                pY = chunk.y + chunk.height / 2;
            } else { // place planet randomly within valid area
                pX = chunk.x + planetSize + (Math.random() * validPlacementWidth);
                pY = chunk.y + planetSize + (Math.random() * validPlacementHeight);
            }
            const playerPlanet = new Planet(
                pX, pY,
                planetSize,
                this.config.STARTING_TROOPS,
                player.id,
                this.game
            );
            playerPlanets.push(playerPlanet);
        }
        return playerPlanets;
    }
    _shuffleArray(array) { // Fisher-Yates shuffle algorithm randomizes player array
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // ES6 destructuring swap
        }
    }
    generateNeutralPlanets(existingPlanets = []) {
        const neutralPlanets = [];
        const neutralCount = this.calculateOptimalNeutralCount();
        const randomPlanetCount = Math.floor(neutralCount * 0.7);
        const clusterPlanetCount = neutralCount - randomPlanetCount;
        this.generateRandomNeutralPlanets(randomPlanetCount, existingPlanets, neutralPlanets);
        if (clusterPlanetCount >= 3) {
            this.generateClusteredNeutralPlanets(clusterPlanetCount, [...existingPlanets, ...neutralPlanets], neutralPlanets);
        } else {
            this.generateRandomNeutralPlanets(clusterPlanetCount, [...existingPlanets, ...neutralPlanets], neutralPlanets);
        }
        return neutralPlanets;
    }
    generateRandomNeutralPlanets(count, existingPlanets, targetArray) {
        for (let i = 0; i < count; i++) {
            let attempts = 0;
            let valid = false;
            while (!valid && attempts < this.config.MAX_ATTEMPTS) {
                const size = this.config.MIN_SIZE + Math.random() * this.config.MAX_SIZE_VARIATION;
                const buffer = size + this.config.NEUTRAL_BORDER_BUFFER;
                const x = buffer + Math.random() * (this.canvas.width - buffer * 2);
                const y = buffer + Math.random() * (this.canvas.height - buffer * 2);
                valid = this.isValidNeutralPosition(x, y, size, [...existingPlanets, ...targetArray]);
                if (valid) {
                    const startingTroops = Math.floor(size / 3);
                    targetArray.push(new Planet(x, y, size, startingTroops, 'neutral', this.game));
                    break;
                }
                attempts++;
            }
        }
    }
    generateClusteredNeutralPlanets(count, existingPlanets, targetArray) {
        const { width, height } = this.canvas;
        let clusterX = 0, clusterY = 0, validCluster = false, attempts = 0;
        while (!validCluster && attempts < this.config.MAX_ATTEMPTS) {
            clusterX = width * 0.2 + Math.random() * width * 0.6;
            clusterY = height * 0.2 + Math.random() * height * 0.6;
            let minDistance = Number.MAX_VALUE;
            for (const planet of existingPlanets) {
                const dx = clusterX - planet.x;
                const dy = clusterY - planet.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minRequiredDistance = this.getRequiredDistanceFromPlanet(planet, true);
                minDistance = Math.min(minDistance, distance - minRequiredDistance);
            }
            validCluster = minDistance > 0;
            attempts++;
        }
        if (!validCluster) {
            this.generateRandomNeutralPlanets(count, existingPlanets, targetArray);
            return;
        }
        const clusterRadius = this.config.NEUTRAL_TO_NEUTRAL_DISTANCE * 0.8;
        for (let i = 0; i < count; i++) {
            let placed = false;
            for (let j = 0; j < this.config.MAX_ATTEMPTS; j++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * clusterRadius;
                const size = this.config.MIN_SIZE + Math.random() * (this.config.MAX_SIZE_VARIATION * 0.7);
                const x = clusterX + Math.cos(angle) * distance;
                const y = clusterY + Math.sin(angle) * distance;
                if (this.isValidNeutralPosition(x, y, size, [...existingPlanets, ...targetArray])) {
                    const startingTroops = Math.floor(size / 2) + 5;
                    targetArray.push(new Planet(x, y, size, startingTroops, 'neutral', this.game));
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                this.generateRandomNeutralPlanets(1, [...existingPlanets, ...targetArray], targetArray);
            }
        }
    }
    calculateOptimalNeutralCount() {
        const mapArea = this.canvas.width * this.canvas.height;
        const playerCount = this.game.playerCount;
        const baseCount = this.config.NEUTRAL_COUNT;
        const areaFactor = Math.sqrt(mapArea) / 500;
        const playerFactor = Math.sqrt(playerCount);
        const densityFactor = this.config.PLANET_DENSITY;
        const randomVariation = Math.floor(Math.random() * 3) - 1;
        return Math.max(3, Math.floor(baseCount * areaFactor * playerFactor * densityFactor) + randomVariation);
    }
    isValidNeutralPosition(x, y, size, existingPlanets) {
        for (const planet of existingPlanets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = this.getRequiredDistanceFromPlanet(planet, false) + size;
            if (distance < minDistance) {
                return false;
            }
        }
        const borderBuffer = this.config.NEUTRAL_BORDER_BUFFER;
        if (x - size - borderBuffer < 0 || x + size + borderBuffer > this.canvas.width || 
            y - size - borderBuffer < 0 || y + size + borderBuffer > this.canvas.height) {
            return false;
        }
        return true;
    }
    getRequiredDistanceFromPlanet(planet, isCluster) {
        const isPlayerPlanet = planet.owner !== 'neutral';
        const densityFactor = 1 / Math.sqrt(this.config.PLANET_DENSITY);
        if (isPlayerPlanet) {
            return this.config.PLAYER_TO_NEUTRAL_DISTANCE * densityFactor;
        } else {
            return (isCluster ? 
                this.config.NEUTRAL_TO_NEUTRAL_DISTANCE * 0.5 :
                this.config.NEUTRAL_TO_NEUTRAL_DISTANCE) * densityFactor;
        }
    }
    setPlanetDensity(density) {
        this.config.PLANET_DENSITY = Math.max(0.5, Math.min(2.0, density));
    }
}