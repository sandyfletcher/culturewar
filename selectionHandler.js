// selectionHandler.js
class SelectionHandler {
    constructor(game) {
        this.game = game;
        this.selectedPlanets = [];
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        this.touchStartTime = 0;
    }

    // Handle mouse movement
    handleMouseMove(x, y) {
        // Update selection box if currently selecting
        if (this.isSelecting) {
            this.selectionEnd.x = x;
            this.selectionEnd.y = y;
        }
    }

    // Start selection box
    startSelection(x, y) {
        this.selectionStart.x = x;
        this.selectionStart.y = y;
        this.selectionEnd.x = x;
        this.selectionEnd.y = y;
        this.isSelecting = true;
        this.touchStartTime = Date.now();
    }

    // End selection and determine if it was a click or drag
    endSelection(x, y) {
        this.isSelecting = false;
        
        // If it's a small movement, treat it as a click
        const distMoved = Math.sqrt(
            Math.pow(this.selectionStart.x - x, 2) + 
            Math.pow(this.selectionStart.y - y, 2)
        );
        
        const touchDuration = Date.now() - this.touchStartTime;
        if ((touchDuration < 300 && distMoved < 10) || distMoved < 5) {
            return { isClick: true, x, y };
        }
        
        // Process selection box
        this.processSelectionBox();
        return { isClick: false };
    }

    // Process the selection box to select planets
    processSelectionBox() {
        // Normalize selection box coordinates
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const right = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const bottom = Math.max(this.selectionStart.y, this.selectionEnd.y);
        
        // Clear previous selection
        this.clearSelection();
        
        // Find all player planets within the selection box
        for (const planet of this.game.planets) {
            if (planet.owner === 'player') {
                // Check if planet is within or touched by the selection box
                if (planet.x + planet.size >= left && 
                    planet.x - planet.size <= right && 
                    planet.y + planet.size >= top && 
                    planet.y - planet.size <= bottom) {
                    planet.selected = true;
                    this.selectedPlanets.push(planet);
                }
            }
        }
    }

    // Handle click on a specific position
    handleClick(x, y) {
        // Find clicked planet
        const clickedPlanet = this.game.planets.find(planet => planet.containsPoint(x, y));

        // If clicking on empty space, clear selection
        if (!clickedPlanet) {
            this.clearSelection();
            return;
        }

        // If we have planets selected and click on a different planet
        if (this.selectedPlanets.length > 0 && !this.selectedPlanets.includes(clickedPlanet)) {
            if (this.selectedPlanets.every(planet => planet.owner === 'player')) {
                // Send troops from all selected planets
                this.sendTroopsToTarget(clickedPlanet);
                
                // Clear selection after sending troops
                this.clearSelection();
            }
        } 
        // If clicking on a player's planet, select it
        else if (clickedPlanet.owner === 'player') {
            this.clearSelection();
            clickedPlanet.selected = true;
            this.selectedPlanets = [clickedPlanet];
        }
    }

    // Send troops from all selected planets to a target
    sendTroopsToTarget(targetPlanet) {
        for (const sourcePlanet of this.selectedPlanets) {
            const troopsToSend = Math.floor(sourcePlanet.troops / 2);
            
            if (troopsToSend > 0) {
                sourcePlanet.troops -= troopsToSend;
                this.game.troopMovements.push(new this.game.TroopMovement(
                    sourcePlanet,
                    targetPlanet,
                    troopsToSend,
                    'player'
                ));
            }
        }
    }

    // Clear all planet selections
    clearSelection() {
        for (const planet of this.game.planets) {
            planet.selected = false;
        }
        this.selectedPlanets = [];
    }

    // Draw the selection box
    drawSelectionBox(ctx) {
        if (this.isSelecting) {
            const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
            const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
            const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
            const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
            
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(left, top, width, height);
            ctx.setLineDash([]);
            
            // Semi-transparent fill
            ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
            ctx.fillRect(left, top, width, height);
        }
    }

    // Draw trajectory lines between selected planets and target
    drawTrajectory(ctx, mousePos) {
        if (this.selectedPlanets.length > 0) {
            // Find planet under mouse cursor
            const targetPlanet = this.game.planets.find(planet => 
                planet.containsPoint(mousePos.x, mousePos.y));

            if (targetPlanet && !this.selectedPlanets.includes(targetPlanet)) {
                // Draw trajectory lines from all selected planets
                for (const selectedPlanet of this.selectedPlanets) {
                    ctx.beginPath();
                    ctx.moveTo(selectedPlanet.x, selectedPlanet.y);
                    ctx.lineTo(targetPlanet.x, targetPlanet.y);
                    ctx.strokeStyle = '#ffffff44'; // Semi-transparent white
                    ctx.setLineDash([5, 5]); // Dashed line
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                ctx.setLineDash([]); // Reset dash
            }
        }
    }

    // Check if a planet should remain selected after update
    validateSelections() {
        // Remove any planets from selection that are no longer owned by player
        this.selectedPlanets = this.selectedPlanets.filter(planet => {
            if (planet.owner !== 'player') {
                planet.selected = false;
                return false;
            }
            return true;
        });
    }

    // Get currently selected planets
    getSelectedPlanets() {
        return this.selectedPlanets;
    }
}

export default SelectionHandler;