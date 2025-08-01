// ===========================================================
// root/javascript/TroopMovement.js
// ===========================================================

import { config } from './config.js';

export default class TroopMovement {
    constructor(from, to, amount, owner, game) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.owner = owner;
        this.game = game;
        this.progress = 0;
        this.startX = from.x;
        this.startY = from.y;
        this.dx = to.x - from.x;
        this.dy = to.y - from.y;
        this.distance = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        this.speed = config.troop.movementSpeed;
        this.duration = this.distance / this.speed; // seconds to reach target
    }
    update(dt) {
        this.progress += dt / this.duration;
        return this.progress >= 1;
    }
    getCurrentPosition() {
        const easedProgress = this.progress; // Can add easing function here if desired
        return {
            x: this.startX + this.dx * easedProgress,
            y: this.startY + this.dy * easedProgress
        };
    }
    draw(ctx) { // draw troop movement
        const pos = this.getCurrentPosition();
        ctx.beginPath(); // draw movement trail
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#ffffff22';
        ctx.lineWidth = 1;
        ctx.stroke();
        const playerColor = this.game.playersController.getPlayerColor(this.owner); // get player color
        let noteSymbol; // determine which musical note to use based on troop count from config
        if (this.amount < config.ui.visuals.troopIcon.tier1MaxTroops) noteSymbol = '♩';
        else if (this.amount < config.ui.visuals.troopIcon.tier2MaxTroops) noteSymbol = '♪';
        else noteSymbol = '♫';
        let categoryMin, categoryMax; // calculate size scaling within each category
        if (this.amount < config.ui.visuals.troopIcon.tier1MaxTroops) { categoryMin = 1; categoryMax = config.ui.visuals.troopIcon.tier1MaxTroops - 1; } 
        else if (this.amount < config.ui.visuals.troopIcon.tier2MaxTroops) { categoryMin = config.ui.visuals.troopIcon.tier1MaxTroops; categoryMax = config.ui.visuals.troopIcon.tier2MaxTroops - 1; } 
        else { categoryMin = config.ui.visuals.troopIcon.tier2MaxTroops; categoryMax = config.planet.maxTroops; }
        const categoryPosition = (this.amount - categoryMin) / (categoryMax - categoryMin); // normalized position within the category (0 to 1)
        const minSize = config.ui.visuals.troopIcon.minFontSize;
        const maxSize = config.ui.visuals.troopIcon.maxFontSize;
        const fontSize = minSize + categoryPosition * (maxSize - minSize);
        ctx.font = `bold ${fontSize}px Arial`; // draw the music note symbol
        ctx.fillStyle = playerColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(noteSymbol, pos.x, pos.y);
        ctx.fillStyle = '#ffffff'; // draw troop count
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(Math.floor(this.amount), pos.x, pos.y - fontSize/2 - 2);
    }
}