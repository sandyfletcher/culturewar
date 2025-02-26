// entities.js
class Planet {
    constructor(x, y, size, troops = 0, owner = 'neutral', game) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.troops = troops;
        this.owner = owner;
        this.game = game;
        this.productionRate = size / 20; // Larger planets produce more troops
        this.selected = false; // Track selection state directly on the planet
    }

    // Check if a point is inside this planet
    containsPoint(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) < this.size;
    }

    // Update planet state
    update(dt) {
        if (this.owner !== 'neutral') {
            this.troops = Math.min(999, this.troops + this.productionRate * dt);
        }
    }

    // Draw the planet
    draw(ctx) {
        // Draw planet circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        
        // Set color based on owner
        if (this.owner === 'neutral') {
            ctx.strokeStyle = '#ffffff'; // White for neutral
        } else {
            ctx.strokeStyle = this.game.playerManager.getPlayerColor(this.owner);
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
        // Adjusted speed calculation based on distance
        this.speed = 150; // pixels per second
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

        // Draw troops - use player color
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = this.game.playerManager.getPlayerColor(this.owner);
        ctx.fill();

        // Draw troop count
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(this.amount, pos.x, pos.y - 10);
    }
}

export { Planet, TroopMovement };