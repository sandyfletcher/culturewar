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
        this.drawUIOverlays();
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
    drawUIOverlays() {
        const ctx = this.ctx;
        const padding = 10;
        const topY = 18; // position for text from top
        // --- Save context state ---
        const originalFont = ctx.font;
        const originalFillStyle = ctx.fillStyle;
        const originalTextAlign = ctx.textAlign;
        const originalTextBaseline = ctx.textBaseline;
        const originalShadowColor = ctx.shadowColor;
        const originalShadowBlur = ctx.shadowBlur;
        // --- Set styles for UI text ---
        ctx.font = "bold 20px 'LondrinaSketch'";
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 5;
        // --- Draw Total Troops (Top-Left) ---
        const totalTroops = Math.round(this.game.troopTracker.lastTotalTroops);
        ctx.textAlign = 'left';
        ctx.fillText(`${totalTroops}`, padding, topY);
        // --- Draw Time Remaining (Top-Right) ---
        const timeRemaining = this.game.timerManager.getTimeRemaining();
        const formattedTime = window.menuManager.formatTime(timeRemaining);
        ctx.textAlign = 'right';
        ctx.fillText(formattedTime, this.canvas.width - padding, topY);
        // --- Restore context state ---
        ctx.font = originalFont;
        ctx.fillStyle = originalFillStyle;
        ctx.textAlign = originalTextAlign;
        ctx.textBaseline = originalTextBaseline;
        ctx.shadowColor = originalShadowColor;
        ctx.shadowBlur = originalShadowBlur;
    }
}