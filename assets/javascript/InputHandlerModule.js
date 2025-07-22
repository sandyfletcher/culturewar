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
        this.doubleClickTimeThreshold = 300; // ms
        this.lastClickedPlanet = null;
        this.lastClickTime = 0;
        // mouse event listeners with passive option for touch events
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
        if (this.isSelecting) {
            this.selectionEnd.x = this.mousePos.x;
            this.selectionEnd.y = this.mousePos.y;
        }
        this.game.mousePos = this.mousePos;
    }
    handleMouseDown(e) {
        if (this.game.gameOver) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
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
            this.touchStartTime = Date.now(); // timestamp to detect tap vs drag
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
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const right = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const bottom = Math.max(this.selectionStart.y, this.selectionEnd.y);
        this.game.clearSelection();
        const humanPlayerId = this.game.playersController.getHumanPlayers()[0].id;
        for (const planet of this.game.planets) { // find all player planets within or touched by selection box
            if (planet.owner === humanPlayerId) {
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
        const clickedPlanet = this.game.planets.find(planet => planet.containsPoint(x, y)); // find clicked planet
        if (!clickedPlanet) { // clicking on empty space clears selection
            this.game.clearSelection();
            return;
        }
        const humanPlayerId = this.game.playersController.getHumanPlayers()[0].id;
        const now = Date.now();
        if (clickedPlanet.owner === humanPlayerId && clickedPlanet === this.lastClickedPlanet && now - this.lastClickTime < this.doubleClickTimeThreshold) {
            this.selectAllPlayerPlanets(humanPlayerId); // double-click detected on player planet, select all
            this.lastClickedPlanet = null; // reset double-click tracking
            this.lastClickTime = 0;
            return;
        }
        this.lastClickedPlanet = clickedPlanet; // update double-click tracking
        this.lastClickTime = now;
        if (this.game.selectedPlanets.length > 0 && !this.game.selectedPlanets.includes(clickedPlanet)) { // if we have planets selected and click on a different planet
            if (this.game.selectedPlanets.every(planet => planet.owner === humanPlayerId)) { // send troops from all selected planets
                const troopPercentage = this.footerManager.getValue() / 100;
                for (const sourcePlanet of this.game.selectedPlanets) { // calculate troops to send based on slider
                    const troopsToSend = Math.floor(sourcePlanet.troops * troopPercentage);
                    if (troopsToSend > 0) {
                        this.game.sendTroops(sourcePlanet, clickedPlanet, troopsToSend);
                    }
                }
                this.game.clearSelection();
            }
        } 
        else if (clickedPlanet.owner === humanPlayerId) { // clicking on a player's planet selects it
            this.game.clearSelection();
            clickedPlanet.selected = true;
            this.game.selectedPlanets = [clickedPlanet];
        }
    }
    selectAllPlayerPlanets(playerId) {
        this.game.clearSelection();
        for (const planet of this.game.planets) {
            if (planet.owner === playerId) {
                planet.selected = true;
                this.game.selectedPlanets.push(planet);
            }
        }
    }
    getSelectionBox() { // getter for selection state
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