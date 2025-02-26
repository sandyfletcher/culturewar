export default class PlayerManager {
    constructor(game, playerCount = 2, aiTypes = []) {
        this.game = game;
        this.players = [];
        this.playerCount = playerCount;
        this.aiTypes = aiTypes;
        this.playerColors = {
            'player1': '#ffff00', // Yellow
            'player2': '#ff0000', // Red
            'player3': '#00ffff', // Cyan
            'player4': '#00ff00', // Green
            'neutral': '#ffffff'  // White
        };
        
        this.initializePlayers();
    }
    
    initializePlayers() {
        // Clear existing players
        this.players = [];
        
        // Create human player
        this.players.push({
            id: 'player1',
            color: this.playerColors['player1'],
            isAI: false,
            aiController: null
        });
        
        // Create AI players with selected AI types
        for (let i = 0; i < this.playerCount - 1; i++) {
            const playerId = `player${i + 2}`;
            const aiType = this.aiTypes[i] || 'claude1'; // Default to claude1 if not specified
            
            this.players.push({
                id: playerId,
                color: this.playerColors[playerId],
                isAI: true,
                aiController: aiType
            });
        }
    }
    
    getPlayerById(playerId) {
        return this.players.find(player => player.id === playerId);
    }
    
    getPlayerColor(playerId) {
        return this.playerColors[playerId] || this.playerColors['neutral'];
    }
    
    getHumanPlayers() {
        return this.players.filter(player => !player.isAI);
    }
    
    getAIPlayers() {
        return this.players.filter(player => player.isAI);
    }
    
    isPlayerHuman(playerId) {
        const player = this.getPlayerById(playerId);
        return player && !player.isAI;
    }
    
    getNextPlayer(currentPlayerId) {
        const currentIndex = this.players.findIndex(player => player.id === currentPlayerId);
        if (currentIndex === -1) return this.players[0].id;
        
        const nextIndex = (currentIndex + 1) % this.players.length;
        return this.players[nextIndex].id;
    }
    
    // For win conditions
    hasPlayerPlanets(playerId) {
        return this.game.planets.some(planet => planet.owner === playerId);
    }
    
    hasPlayerTroopsInMovement(playerId) {
        return this.game.troopMovements.some(movement => movement.owner === playerId);
    }
    
    calculateTotalTroops(playerId) {
        // Sum troops from planets
        const planetTroops = this.game.planets
            .filter(planet => planet.owner === playerId)
            .reduce((total, planet) => total + planet.troops, 0);
        
        // Sum troops from movements
        const movementTroops = this.game.troopMovements
            .filter(movement => movement.owner === playerId)
            .reduce((total, movement) => total + movement.amount, 0);
        
        return planetTroops + movementTroops;
    }
    
    getPlayerStats() {
        const stats = [];
        
        for (const player of this.players) {
            stats.push({
                id: player.id,
                troops: this.calculateTotalTroops(player.id),
                planets: this.game.planets.filter(planet => planet.owner === player.id).length,
                isActive: this.hasPlayerPlanets(player.id) || this.hasPlayerTroopsInMovement(player.id)
            });
        }
        
        // Add neutral stats
        stats.push({
            id: 'neutral',
            troops: this.calculateTotalTroops('neutral'),
            planets: this.game.planets.filter(planet => planet.owner === 'neutral').length
        });
        
        return stats;
    }
    
    getWinningPlayer() {
        const activePlayerStats = this.getPlayerStats()
            .filter(stats => stats.id !== 'neutral')
            .sort((a, b) => b.troops - a.troops);
        
        // If only one player is active, they are the winner
        const activePlayers = activePlayerStats.filter(stats => stats.isActive);
        if (activePlayers.length === 1) {
            return activePlayers[0].id;
        }
        
        // Otherwise, player with most troops is winning
        return activePlayerStats[0].id;
    }
}