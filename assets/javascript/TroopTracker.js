// TroopTracker.js - Tracks and displays troop distribution among players
export default class TroopTracker {
    constructor(game) {
        this.game = game;
        this.headerElement = document.querySelector('header h1');
        this.originalTitle = this.headerElement.textContent;
        this.headerContainer = document.querySelector('header');
        
        // Create and append the troop bar container
        this.troopBarContainer = document.createElement('div');
        this.troopBarContainer.id = 'troop-bar-container';
        this.troopBarContainer.style.display = 'none'; // Hidden by default
        this.headerContainer.appendChild(this.troopBarContainer);
        
        // Store reference to player colors from PlayersController instead
        this.playerColors = this.game.playersController.playerColors;
    }
    
    // Show the troop bar (called when game starts)
    showTroopBar() {
        this.headerElement.style.display = 'none';
        this.troopBarContainer.style.display = 'flex';
        this.update(); // Initial update
    }
    
    // Hide the troop bar and show title (called when game ends/returns to menu)
    hideTroopBar() {
        this.headerElement.style.display = 'block';
        this.troopBarContainer.style.display = 'none';
    }
    
    // Update the troop bar based on current game state
    update() {
        if (this.troopBarContainer.style.display === 'none') return;
        
        const players = this.game.playersController.players;
        let totalTroops = 0;
        const playerTroops = {};
        
        // Calculate total troops and troops per player
        for (const planet of this.game.planets) {
            if (planet.owner !== null) {
                if (!playerTroops[planet.owner]) {
                    playerTroops[planet.owner] = 0;
                }
                playerTroops[planet.owner] += planet.troops;
                totalTroops += planet.troops;
            }
        }
        
        // Add troops in transit
        for (const movement of this.game.troopMovements) {
            if (!playerTroops[movement.owner]) {
                playerTroops[movement.owner] = 0;
            }
            playerTroops[movement.owner] += movement.amount;
            totalTroops += movement.amount;
        }
        
        // Clear previous bar segments
        this.troopBarContainer.innerHTML = '';
        
        // Create the bar container
        const barElement = document.createElement('div');
        barElement.id = 'troop-bar';
        barElement.style.position = 'relative';
        this.troopBarContainer.appendChild(barElement);
        
        // Add troops count inside the bar
        const troopCountElement = document.createElement('div');
        troopCountElement.id = 'total-troops-count';
        troopCountElement.textContent = `${Math.round(totalTroops)}`;
        troopCountElement.style.position = 'absolute';
        troopCountElement.style.zIndex = '10';
        troopCountElement.style.left = '50%';
        troopCountElement.style.top = '50%';
        troopCountElement.style.transform = 'translate(-50%, -50%)';
        troopCountElement.style.color = 'white';
        troopCountElement.style.textShadow = '1px 1px 2px black';
        troopCountElement.style.fontWeight = 'bold';
        barElement.appendChild(troopCountElement);
        
        // Create segments for each player
        for (const playerId in playerTroops) {
            if (playerTroops[playerId] > 0) {
                const percentage = (playerTroops[playerId] / totalTroops) * 100;
                const segment = document.createElement('div');
                segment.className = 'troop-bar-segment';
                segment.style.width = `${percentage}%`;
                
                // Get color directly from player ID
                const color = this.playerColors[playerId] || '#888'; // Fallback color
                
                segment.style.backgroundColor = color;
                
                // Add tooltip with player info
                segment.title = `Player ${playerId}: ${Math.round(playerTroops[playerId])} troops (${percentage.toFixed(1)}%)`;
                
                barElement.appendChild(segment);
            }
        }
    }
}