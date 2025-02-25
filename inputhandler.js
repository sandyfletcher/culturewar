// input-handler.js
export default class InputHandler {
    constructor(game) {
        this.game = game;
        this.canvas = game.canvas;
        this.mousePos = { x: 0, y: 0 };
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        this.touchStartTime = 0;
        
        // Add mouse event listeners
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Add touch event listeners
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    handleMouseMove(e) {
        if (this.game.gameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
        
        // Update selection box if currently selecting
        if (this.isSelecting) {
            this.selectionEnd.x = this.mousePos.x;
            this.selectionEnd.y = this.mousePos.y;
        }
        
        // Update the game's reference to mouse position
        this.game.mousePos = this.mousePos;
    }

    handleMouseDown(e) {
        if (this.game.gameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Start selection box
        this.selectionStart.x = x;
        this.selectionStart.y = y;
        this.selectionEnd.x = x;
        this.selectionEnd.y = y;
        this.isSelecting = true;
    }

    handleMouseUp(e) {
        if (this.game.gameOver) return;
        
        this.isSelecting = false;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // If it's a small movement, treat it as a click
        const distMoved = Math.sqrt(
            Math.pow(this.selectionStart.x - x, 2) + 
            Math.pow(this.selectionStart.y - y, 2)
        );
        
        if (distMoved < 5) {
            this.handleClick(e);
            return;
        }
        
        // Process selection box
        this.processSelectionBox();
    }

    handleTouchStart(e) {
        if (this.game.gameOver) return;
        
        e.preventDefault(); // Prevent scrolling
        
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            this.selectionStart.x = x;
            this.selectionStart.y = y;
            this.selectionEnd.x = x;
            this.selectionEnd.y = y;
            this.isSelecting = true;
            
            // Store timestamp to detect tap vs drag
            this.touchStartTime = Date.now();
        }
    }

    handleTouchMove(e) {
        if (this.game.gameOver) return;
        
        e.preventDefault(); // Prevent scrolling
        
        if (e.touches.length === 1 && this.isSelecting) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            
            this.mousePos.x = touch.clientX - rect.left;
            this.mousePos.y = touch.clientY - rect.top;
            
            this.selectionEnd.x = this.mousePos.x;
            this.selectionEnd.y = this.mousePos.y;
            
            // Update the game's reference to mouse position
            this.game.mousePos = this.mousePos;
        }
    }

    handleTouchEnd(e) {
        if (this.game.gameOver) return;
        
        e.preventDefault(); // Prevent default behavior
        
        this.isSelecting = false;
        
        // If it was a short touch with minimal movement, treat as a tap
        const touchDuration = Date.now() - this.touchStartTime;
        const distMoved = Math.sqrt(
            Math.pow(this.selectionStart.x - this.selectionEnd.x, 2) + 
            Math.pow(this.selectionStart.y - this.selectionEnd.y, 2)
        );
        
        if (touchDuration < 300 && distMoved < 10) {
            // Create a synthetic click event
            const clickEvent = {
                clientX: this.selectionEnd.x + this.canvas.getBoundingClientRect().left,
                clientY: this.selectionEnd.y + this.canvas.getBoundingClientRect().top
            };
            this.handleClick(clickEvent);
            return;
        }
        
        // Process selection box for drag
        this.processSelectionBox();
    }

    processSelectionBox() {
        // Normalize selection box coordinates
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const right = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const bottom = Math.max(this.selectionStart.y, this.selectionEnd.y);
        
        // Clear previous selection
        this.game.clearSelection();
        
        // Find all player planets within the selection box
        for (const planet of this.game.planets) {
            if (planet.owner === 'player') {
                // Check if planet is within or touched by the selection box
                if (planet.x + planet.size >= left && 
                    planet.x - planet.size <= right && 
                    planet.y + planet.size >= top && 
                    planet.y - planet.size <= bottom) {
                    planet.selected = true;
                    this.game.selectedPlanets.push(planet);
                }
            }
        }
    }

    handleClick(e) {
        if (this.game.gameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Find clicked planet
        const clickedPlanet = this.game.planets.find(planet => planet.containsPoint(x, y));

        // If clicking on empty space, clear selection
        if (!clickedPlanet) {
            this.game.clearSelection();
            return;
        }

        // If we have planets selected and click on a different planet
        if (this.game.selectedPlanets.length > 0 && !this.game.selectedPlanets.includes(clickedPlanet)) {
            if (this.game.selectedPlanets.every(planet => planet.owner === 'player')) {
                // Send troops from all selected planets
                for (const sourcePlanet of this.game.selectedPlanets) {
                    const troopsToSend = Math.floor(sourcePlanet.troops / 2);
                    
                    if (troopsToSend > 0) {
                        sourcePlanet.troops -= troopsToSend;
                        this.game.troopMovements.push(new this.game.TroopMovement(
                            sourcePlanet,
                            clickedPlanet,
                            troopsToSend,
                            'player'
                        ));
                    }
                }
                
                // Clear selection after sending troops
                this.game.clearSelection();
            }
        } 
        // If clicking on a player's planet, select it
        else if (clickedPlanet.owner === 'player') {
            this.game.clearSelection();
            clickedPlanet.selected = true;
            this.game.selectedPlanets = [clickedPlanet];
        }
    }

    // Getter for selection state
    getSelectionBox() {
        if (!this.isSelecting) return null;
        
        return {
            left: Math.min(this.selectionStart.x, this.selectionEnd.x),
            top: Math.min(this.selectionStart.y, this.selectionEnd.y),
            width: Math.abs(this.selectionEnd.x - this.selectionStart.x),
            height: Math.abs(this.selectionEnd.y - this.selectionStart.y),
            isActive: this.isSelecting
        };
    }
}