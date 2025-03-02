export default class Renderer {
    constructor(game) {
        this.game = game;
        this.ctx = game.ctx;
        this.canvas = game.canvas;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw trajectory lines first (so they're behind everything)
        this.drawTrajectory();

        // Draw selection box if active
        this.drawSelectionBox();

        // Draw planets
        for (const planet of this.game.planets) {
            planet.draw(this.ctx);
        }

        // Draw troop movements
        for (const movement of this.game.troopMovements) {
            movement.draw(this.ctx);
        }

        // Update timer display
        this.updateTimerDisplay();
    }

    drawTrajectory() {
        if (this.game.selectedPlanets.length > 0) {
            // Find planet under mouse cursor
            const targetPlanet = this.game.planets.find(planet => 
                planet.containsPoint(this.game.mousePos.x, this.game.mousePos.y));

            if (targetPlanet && !this.game.selectedPlanets.includes(targetPlanet)) {
                // Draw trajectory lines from all selected planets
                for (const selectedPlanet of this.game.selectedPlanets) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(selectedPlanet.x, selectedPlanet.y);
                    this.ctx.lineTo(targetPlanet.x, targetPlanet.y);
                    this.ctx.strokeStyle = '#ffffff44'; // Semi-transparent white
                    this.ctx.setLineDash([5, 5]); // Dashed line
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
                this.ctx.setLineDash([]); // Reset dash
            }
        }
    }

    drawSelectionBox() {
        // Skip if inputHandler is null (bot battle mode)
        if (!this.game.inputHandler) return;
        
        const selectionBox = this.game.inputHandler.getSelectionBox();
        if (!selectionBox || !selectionBox.isActive) return;
        
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 3]);
        this.ctx.strokeRect(selectionBox.left, selectionBox.top, selectionBox.width, selectionBox.height);
        this.ctx.setLineDash([]);
        
        // Semi-transparent fill
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        this.ctx.fillRect(selectionBox.left, selectionBox.top, selectionBox.width, selectionBox.height);
    }

    updateTimerDisplay() {
        // Get time remaining from game state
        const timeRemaining = Math.max(0, this.game.gameState.timeRemaining);
        
        // Format minutes and seconds properly
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        
        // Update the timer display with proper padding
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
}