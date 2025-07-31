import { config } from './config.js'; // <-- IMPORT THE NEW CONFIG

class Planet {
    constructor(x, y, size, troops = 0, owner = 'neutral', game) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.troops = troops;
        this.owner = owner;
        this.game = game;
        // Use the production factor from the config
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
    update(dt) { // Update planet state, calculate incoming troop totals for glows, reset each frame before recalculating
        this.incomingAttackGlow = 0;
        this.incomingReinforcementGlow = 0;
        for (const movement of this.game.troopMovements) {
            if (movement.to === this) { // Check if this planet is the destination
                if (movement.owner !== this.owner && movement.owner !== 'neutral') { // If the owner is different and not neutral, it's an attack
                    this.incomingAttackGlow += movement.amount;
                } 
                else if (movement.owner === this.owner) { // If the owner is the same, it's a reinforcement
                    this.incomingReinforcementGlow += movement.amount;
                }
            }
        }
        if (this.owner !== 'neutral') { // Original troop production logic
            // Use max troop count from config
            this.troops = Math.min(config.planet.maxTroops, this.troops + this.productionRate * dt);
        }
    }
    draw(ctx) { // Draw planet
        const originalShadowBlur = ctx.shadowBlur; // Glow Rendering Logic uses shadows to create an efficient and nice-looking glow effect
        const originalShadowColor = ctx.shadowColor;
        if (this.incomingAttackGlow > 0) { // Draw Attack Glow (fiery red/orange)
            // Use glow parameters from config
            const glowIntensity = Math.min(
                config.ui.visuals.glow.maxIntensity, 
                config.ui.visuals.glow.baseIntensity + Math.sqrt(this.incomingAttackGlow) * config.ui.visuals.glow.intensityScalar
            );
            ctx.shadowBlur = glowIntensity;
            ctx.shadowColor = 'rgba(255, 60, 0, 0.9)';
            // Draw a temporary circle path to apply the shadow to
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.stroke(); // The stroke itself will be mostly invisible, but it casts the shadow
        }
        // Draw Reinforcement Glow (calm blue)
        if (this.incomingReinforcementGlow > 0) {
            const glowIntensity = Math.min(
                config.ui.visuals.glow.maxIntensity, 
                config.ui.visuals.glow.baseIntensity + Math.sqrt(this.incomingReinforcementGlow) * config.ui.visuals.glow.intensityScalar
            );
            ctx.shadowBlur = glowIntensity;
            ctx.shadowColor = 'rgba(0, 150, 255, 0.9)';
            // Draw a temporary circle path to apply the shadow to
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.stroke();
        }
        // Restore original shadow settings so it doesn't affect other elements
        ctx.shadowBlur = originalShadowBlur;
        ctx.shadowColor = originalShadowColor;
        // --- End Glow Rendering ---
        // --- Original Planet Drawing ---
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        // Set color based on owner
        if (this.owner === 'neutral') {
            ctx.strokeStyle = '#ffffff'; // White for neutral
        } else {
            ctx.strokeStyle = this.game.playersController.getPlayerColor(this.owner);
        }
        ctx.lineWidth = 2;
        ctx.stroke();
        // Draw selection highlight if selected
        if (this.selected) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        }
        // Draw troop count
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(this.troops), this.x, this.y + 5);
    }
}

class TroopMovement {
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
        // Use troop movement speed from config
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

    // Draw the troop movement
    draw(ctx) {
        const pos = this.getCurrentPosition();
        
        // Draw movement trail
        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = '#ffffff22';
        ctx.lineWidth = 1;
        ctx.stroke();
    
        // Get player color
        const playerColor = this.game.playersController.getPlayerColor(this.owner);
        
        // Determine which musical note to use based on troop count from config
        let noteSymbol;
        if (this.amount < config.ui.visuals.troopIcon.tier1MaxTroops) noteSymbol = '♩';
        else if (this.amount < config.ui.visuals.troopIcon.tier2MaxTroops) noteSymbol = '♪';
        else noteSymbol = '♫';
        
        // Calculate size scaling within each category
        let categoryMin, categoryMax;
        if (this.amount < config.ui.visuals.troopIcon.tier1MaxTroops) { categoryMin = 1; categoryMax = config.ui.visuals.troopIcon.tier1MaxTroops - 1; } 
        else if (this.amount < config.ui.visuals.troopIcon.tier2MaxTroops) { categoryMin = config.ui.visuals.troopIcon.tier1MaxTroops; categoryMax = config.ui.visuals.troopIcon.tier2MaxTroops - 1; } 
        else { categoryMin = config.ui.visuals.troopIcon.tier2MaxTroops; categoryMax = config.planet.maxTroops; }
        
        // Normalized position within the category (0 to 1)
        const categoryPosition = (this.amount - categoryMin) / (categoryMax - categoryMin);
        const minSize = config.ui.visuals.troopIcon.minFontSize;
        const maxSize = config.ui.visuals.troopIcon.maxFontSize;
        const fontSize = minSize + categoryPosition * (maxSize - minSize);
        
        // Draw the music note symbol
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = playerColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(noteSymbol, pos.x, pos.y);
        
        // Draw troop count
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(Math.floor(this.amount), pos.x, pos.y - fontSize/2 - 2);
    }
}

export { Planet, TroopMovement };