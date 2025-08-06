// ===========================================
// root/javascript/RendererModule.js
// ===========================================
import { formatTime } from './utils.js';

export default class Renderer {
    constructor(ctx, canvas) {
        this.ctx = ctx;
        this.canvas = canvas;
    }

    draw(renderables) {
        const { planets, troopMovements, selectedPlanets, mousePos, selectionBox, uiData } = renderables;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawTrajectory(selectedPlanets, planets, mousePos);
        this.drawSelectionBox(selectionBox);

        for (const planet of planets) {
            planet.draw(this.ctx);
        }
        for (const movement of troopMovements) {
            movement.draw(this.ctx);
        }

        this.drawUIOverlays(uiData);
    }

    drawTrajectory(selectedPlanets, allPlanets, mousePos) {
        if (selectedPlanets.length > 0) {
            const targetPlanet = allPlanets.find(planet =>
                planet.containsPoint(mousePos.x, mousePos.y));

            if (targetPlanet && !selectedPlanets.includes(targetPlanet)) {
                for (const selectedPlanet of selectedPlanets) {
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

    drawSelectionBox(selectionBox) {
        if (!selectionBox || !selectionBox.isActive) return;
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 3]);
        this.ctx.strokeRect(selectionBox.left, selectionBox.top, selectionBox.width, selectionBox.height);
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
        this.ctx.fillRect(selectionBox.left, selectionBox.top, selectionBox.width, selectionBox.height);
    }

    drawUIOverlays(uiData) {
        if (!uiData) return;
        const { totalTroops, timeRemaining } = uiData;
        const ctx = this.ctx;
        const padding = 10;
        const topY = 18;

        // --- Save context state ---
        const originalFont = ctx.font;
        const originalFillStyle = ctx.fillStyle;
        const originalTextAlign = ctx.textAlign;
        const originalTextBaseline = ctx.textBaseline;
        const originalShadowColor = ctx.shadowColor;
        const originalShadowBlur = ctx.shadowBlur;

        // --- Set styles for UI text ---
        ctx.font = "20px 'Wallpoet'";
        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 5;

        // --- Draw Total Troops (Top-Left) ---
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(totalTroops)}`, padding, topY);

        // --- Draw Time Remaining (Top-Right) ---
        const formattedTime = formatTime(timeRemaining);
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