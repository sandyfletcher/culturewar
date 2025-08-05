// ===========================================================
// root/javascript/Planet.js
// ===========================================================

import { config } from './config.js';

export default class Planet {
    constructor(x, y, size, troops = 0, owner = 'neutral', game) {
         this.id = null;
        this.x = x;
        this.y = y;
        this.size = size;
        this.troops = troops;
        this.owner = owner;
        this.game = game;
        this.productionRate = size / config.planet.productionFactor;
        this.selected = false;
        this.incomingAttackGlow = 0;
        this.incomingReinforcementGlow = 0;
    }
    containsPoint(x, y) { // check if a point is inside this planet
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) < this.size;
    }
    update(dt) { // update planet state, calculate incoming troop totals for glows, reset each frame before recalculating
        this.incomingAttackGlow = 0;
        this.incomingReinforcementGlow = 0;
        for (const movement of this.game.troopMovements) {
            if (movement.to === this) { // check if this planet is the destination
                if (movement.owner !== this.owner && movement.owner !== 'neutral') { // if owner is different and not neutral, it's an attack
                    this.incomingAttackGlow += movement.amount;
                } 
                else if (movement.owner === this.owner) { // if owner is same, it's a reinforcement
                    this.incomingReinforcementGlow += movement.amount;
                }
            }
        }
        if (this.owner !== 'neutral') { // original troop production logic
            this.troops = Math.min(config.planet.maxTroops, this.troops + this.productionRate * dt); // use max troop count from config
        }
    }
    draw(ctx) { // draw planet
        const originalShadowBlur = ctx.shadowBlur; // glow rendering logic uses shadows to create an efficient and nice-looking glow effect
        const originalShadowColor = ctx.shadowColor;
        if (this.incomingAttackGlow > 0) { // draw Attack Glow (fiery red/orange)
            const glowIntensity = Math.min( // use glow parameters from config
                config.ui.visuals.glow.maxIntensity, 
                config.ui.visuals.glow.baseIntensity + Math.sqrt(this.incomingAttackGlow) * config.ui.visuals.glow.intensityScalar
            );
            ctx.shadowBlur = glowIntensity;
            ctx.shadowColor = 'rgba(255, 60, 0, 0.9)';
            ctx.beginPath(); // draw a temporary circle path to apply the shadow to
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.stroke(); // stroke itself will be mostly invisible, but it casts shadow
        }
        if (this.incomingReinforcementGlow > 0) { // draw reinforcement glow (calm blue)
            const glowIntensity = Math.min(
                config.ui.visuals.glow.maxIntensity, 
                config.ui.visuals.glow.baseIntensity + Math.sqrt(this.incomingReinforcementGlow) * config.ui.visuals.glow.intensityScalar
            );
            ctx.shadowBlur = glowIntensity;
            ctx.shadowColor = 'rgba(0, 150, 255, 0.9)';
            ctx.beginPath(); // draw a temporary circle path to apply the shadow to
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.shadowBlur = originalShadowBlur; // restore original shadow settings so it doesn't affect other elements
        ctx.shadowColor = originalShadowColor;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        if (this.owner === 'neutral') { // set color based on owner
            ctx.strokeStyle = '#ffffff'; // white for neutral
        } else {
            ctx.strokeStyle = this.game.playersController.getPlayerColor(this.owner);
        }
        ctx.lineWidth = 2;
        ctx.stroke();
        if (this.selected) { // draw selection highlight if selected
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        }
        ctx.fillStyle = '#ffffff'; // draw troop count
        ctx.font = '14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(this.troops), this.x, this.y + 5);
    }
}