// ===========================================
// root/javascript/RendererModule.js
// ===========================================

export default class Renderer {
    constructor(game) {
        this.game = game;
        this.ctx = game.ctx;
        this.canvas = game.canvas;
    }
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawTrajectory();
        this.drawSelectionBox();
        for (const planet of this.game.planets) {
            planet.draw(this.ctx);
        }
        for (const movement of this.game.troopMovements) {
            movement.draw(this.ctx);
        }
    }
    drawTrajectory() {
        if (this.game.selectedPlanets.length > 0) {
            const targetPlanet = this.game.planets.find(planet => 
                planet.containsPoint(this.game.mousePos.x, this.game.mousePos.y));
            if (targetPlanet && !this.game.selectedPlanets.includes(targetPlanet)) {
                for (const selectedPlanet of this.game.selectedPlanets) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(selectedPlanet.x, selectedPlanet.y);
                    this.ctx.lineTo(targetPlanet.x, targetPlanet.y);
                    this.ctx.strokeStyle = '#ffffff44';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
                this.ctx.setLineDash([]);
            }
        }
    }
    drawSelectionBox() {
        if (!this.game.inputHandler) return;
        const selectionBox = this.game.inputHandler.getSelectionBox();
        if (!selectionBox || !selectionBox.isActive) return;
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 3]);
        this.ctx.strokeRect(selectionBox.left, selectionBox.top, selectionBox.width, selectionBox.height);
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        this.ctx.fillRect(selectionBox.left, selectionBox.top, selectionBox.width, selectionBox.height);
    }
}