// ===========================================
// root/javascript/InputHandlerModule.js
// ===========================================

import { config } from './config.js';

export default class InputHandler {
    constructor(game, footerManager, humanPlayerIds) {
        this.game = game;
        this.canvas = game.canvas;
        this.footerManager = footerManager;
        this.humanPlayerIds = humanPlayerIds;
        this.mousePos = { x: 0, y: 0 };
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        this.touchStartTime = 0;
        this.lastClickedPlanet = null;
        this.lastClickTime = 0;
        this.doubleClickTimeThreshold = config.ui.input.doubleClickThreshold;
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
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
        );
        if (distMoved < config.ui.input.clickMoveThreshold) {
            this.handleClick(e);
            return;
        }
        this.processSelectionBox();
    }
    handleTouchStart(e) {
        if (this.game.gameOver) return;
        e.preventDefault();
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
            this.touchStartTime = Date.now();
        }
    }
    handleTouchMove(e) {
        if (this.game.gameOver) return;
        e.preventDefault();
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
        const touchDuration = Date.now() - this.touchStartTime;
        const distMoved = Math.sqrt(
            Math.pow(this.selectionStart.x - this.selectionEnd.x, 2) + 
            Math.pow(this.selectionStart.y - this.selectionEnd.y, 2)
        );
        if (touchDuration < config.ui.input.touchDurationThreshold && distMoved < config.ui.input.touchMoveThreshold) {
            const clickEvent = {
                clientX: this.selectionEnd.x + this.canvas.getBoundingClientRect().left,
                clientY: this.selectionEnd.y + this.canvas.getBoundingClientRect().top
            };
            this.handleClick(clickEvent);
            return;
        }
        this.processSelectionBox();
    }
    processSelectionBox() { // TODO: re-examine this logic for multiplayer/more than one human in-game
        const left = Math.min(this.selectionStart.x, this.selectionEnd.x);
        const right = Math.max(this.selectionStart.x, this.selectionEnd.x);
        const top = Math.min(this.selectionStart.y, this.selectionEnd.y);
        const bottom = Math.max(this.selectionStart.y, this.selectionEnd.y);
        this.game.clearSelection();
        const planetsInBox = this.game.planets.filter(planet => // find all selectable planets within box
            this.humanPlayerIds.includes(planet.owner) &&
            planet.x + planet.size >= left &&
            planet.x - planet.size <= right &&
            planet.y + planet.size >= top &&
            planet.y - planet.size <= bottom
        );
        if (planetsInBox.length > 0) {
            const ownerToSelect = planetsInBox[0].owner; // determine owner from first planet in box
            for (const planet of planetsInBox) { // select all planets in box that belong to that same owner
                if (planet.owner === ownerToSelect) {
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
        const clickedPlanet = this.game.planets.find(planet => planet.containsPoint(x, y));
        if (!clickedPlanet) {
            this.game.clearSelection();
            return;
        }
        // MODIFIED: Check if the clicked planet is owned by a human.
        const isHumanPlanet = this.humanPlayerIds.includes(clickedPlanet.owner);
        // Check for double-click on a human's planet
        const now = Date.now();
        if (isHumanPlanet && 
            clickedPlanet === this.lastClickedPlanet && 
            now - this.lastClickTime < this.doubleClickTimeThreshold) {
            // MODIFIED: Select all planets belonging to THAT specific human player.
            this.selectAllPlayerPlanets(clickedPlanet.owner);
            this.lastClickedPlanet = null;
            this.lastClickTime = 0;
            return;
        }
        this.lastClickedPlanet = clickedPlanet;
        this.lastClickTime = now;
        if (this.game.selectedPlanets.length > 0 && !this.game.selectedPlanets.includes(clickedPlanet)) {
            // MODIFIED: Ensure all selected planets belong to a human player.
            if (this.game.selectedPlanets.every(p => this.humanPlayerIds.includes(p.owner))) {
                const troopPercentage = this.footerManager.getTroopPercentage() / 100;
                for (const sourcePlanet of this.game.selectedPlanets) {
                    const troopsToSend = Math.floor(sourcePlanet.troops * troopPercentage);
                    if (troopsToSend > 0) {
                        this.game.sendTroops(sourcePlanet, clickedPlanet, troopsToSend);
                    }
                }
                this.game.clearSelection();
            }
        } 
        // If clicking on a human's planet, select it.
        else if (isHumanPlanet) {
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