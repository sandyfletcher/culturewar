export default class InputHandler {
    constructor(game, footerManager) {
        this.game = game;
        this.canvas = game.canvas;
        this.footerManager = footerManager;
        this.mousePos = { x: 0, y: 0 };
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        this.touchStartTime = 0;
        // For double-click detection
        this.lastClickedPlanet = null;
        this.lastClickTime = 0;
        this.doubleClickTimeThreshold = 300; // ms
        // Add mouse event listeners with passive option for touch events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        // touch event listeners with passive: false explicitly
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
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
        const distMoved = Math.sqrt(
            Math.pow(this.selectionStart.x - x, 2) + 
            Math.pow(this.selectionStart.y - y, 2)
        ); // small movement treated as a click
        if (distMoved < 5) {
            this.handleClick(e);
            return;
        }
        
        // Process selection box
        this.processSelectionBox();
    }

    handleTouchStart(e) {
        if (this.game.gameOver) return;
        e.preventDefault(); // prevent scrolling
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
        e.preventDefault(); // prevent scrolling
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
        e.preventDefault();
        this.isSelecting = false;
        // short touch with minimal movement treated as a tap
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
        this.processSelectionBox(); // selection box for drag
    }
    processSelectionBox() {
        // Normalize selection box coordinates
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const right = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const bottom = Math.max(this.selectionStart.y, this.selectionEnd.y);
        // Clear previous selection
        this.game.clearSelection();
        // Get human player ID (player1 is the human player)
        const humanPlayerId = this.game.playersController.getHumanPlayers()[0].id;
        // Find all player planets within the selection box
        for (const planet of this.game.planets) {
            if (planet.owner === humanPlayerId) {
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
        // Get human player ID
        const humanPlayerId = this.game.playersController.getHumanPlayers()[0].id;
        // Check for double-click on player's planet
        const now = Date.now();
        if (clickedPlanet.owner === humanPlayerId && 
            clickedPlanet === this.lastClickedPlanet && 
            now - this.lastClickTime < this.doubleClickTimeThreshold) {
            // Double-click detected on own planet - select all player's planets
            this.selectAllPlayerPlanets(humanPlayerId);
            // Reset double-click tracking
            this.lastClickedPlanet = null;
            this.lastClickTime = 0;
            return;
        }
        // Update double-click tracking
        this.lastClickedPlanet = clickedPlanet;
        this.lastClickTime = now;
        // If we have planets selected and click on a different planet
        if (this.game.selectedPlanets.length > 0 && !this.game.selectedPlanets.includes(clickedPlanet)) {
            if (this.game.selectedPlanets.every(planet => planet.owner === humanPlayerId)) {
                // Get the troop percentage from the footer slider
                const troopPercentage = this.footerManager.getTroopPercentage() / 100;
                for (const sourcePlanet of this.game.selectedPlanets) {
                    // Calculate troops to send based on the slider percentage
                    const troopsToSend = Math.floor(sourcePlanet.troops * troopPercentage);
                    if (troopsToSend > 0) {
                        this.game.sendTroops(sourcePlanet, clickedPlanet, troopsToSend);
                    }
                }
                // Clear selection after sending troops
                this.game.clearSelection();
            }
        } 
        // If clicking on a player's planet, select it
        else if (clickedPlanet.owner === humanPlayerId) {
            this.game.clearSelection();
            clickedPlanet.selected = true;
            this.game.selectedPlanets = [clickedPlanet];
        }
    }
    
    // New method to select all player's planets
    selectAllPlayerPlanets(playerId) {
        // Clear current selection
        this.game.clearSelection();
        
        // Select all planets owned by the player
        for (const planet of this.game.planets) {
            if (planet.owner === playerId) {
                planet.selected = true;
                this.game.selectedPlanets.push(planet);
            }
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