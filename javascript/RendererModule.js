// ===========================================
// root/javascript/RendererModule.js
// ===========================================

import { formatTime } from './utils.js';

export default class Renderer {
    constructor(game) {
        this.game = game;
        this.ctx = game.ctx;
        this.canvas = game.canvas;
    }
    draw(alpha = 0) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        // First, move the origin to the center offset, then apply the uniform scale
        this.ctx.translate(this.game.offsetX, this.game.offsetY);
        this.ctx.scale(this.game.scale, this.game.scale);
        this.drawTrajectory();
        this.drawSelectionBox();
        for (const planet of this.game.planets) {
            planet.draw(this.ctx);
        }
        for (const movement of this.game.troopMovements) {
            movement.draw(this.ctx, alpha);
        }
        this.ctx.restore();
        this.drawUIOverlays();
    }
    drawTrajectory() {
        if (this.game.selectedPlanets.length > 0) {
            const targetPlanet = this.game.planets.find(planet =>
                planet.containsPoint(this.game.worldMousePos.x, this.game.worldMousePos.y));
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
        this.ctx.lineWidth = 1 / this.game.scale; // consistent line width
        this.ctx.setLineDash([5 / this.game.scale, 3 / this.game.scale]);
        const worldBox = { // convert screen coordinates of box to world coordinates to draw within scaled context
            left: (selectionBox.left - this.game.offsetX) / this.game.scale,
            top: (selectionBox.top - this.game.offsetY) / this.game.scale,
            width: selectionBox.width / this.game.scale,
            height: selectionBox.height / this.game.scale
        };
        this.ctx.strokeRect(worldBox.left, worldBox.top, worldBox.width, worldBox.height);
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        this.ctx.fillRect(worldBox.left, worldBox.top, worldBox.width, worldBox.height);
    }
    drawUIOverlays() {
        const ctx = this.ctx;
        // percentage of canvas dimensions for scalable padding
        const paddingX = this.canvas.width * 0.025; // 2.5% from horizontal edges
        const paddingY = this.canvas.height * 0.02; // 2% from vertical edge
        const originalFont = ctx.font;
        const originalFillStyle = ctx.fillStyle;
        const originalTextAlign = ctx.textAlign;
        const originalTextBaseline = ctx.textBaseline;
        const originalShadowColor = ctx.shadowColor;
        const originalShadowBlur = ctx.shadowBlur;
        // set UI text styles
        ctx.font = "20px 'Wallpoet'";
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 5;
        // draw total troops
        const totalTroops = Math.round(this.game.troopTracker.lastTotalTroops);
        ctx.textAlign = 'left';
        ctx.fillText(`${totalTroops}`, paddingX, paddingY);
        // draw time remaining
        const timeRemaining = this.game.timerManager.getTimeRemaining();
        const formattedTime = formatTime(timeRemaining);
        ctx.textAlign = 'right';
        ctx.fillText(formattedTime, this.canvas.width - paddingX, paddingY);
        // restore context state
        ctx.font = originalFont;
        ctx.fillStyle = originalFillStyle;
        ctx.textAlign = originalTextAlign;
        ctx.textBaseline = originalTextBaseline;
        ctx.shadowColor = originalShadowColor;
        ctx.shadowBlur = originalShadowBlur;
    }
}