// ===========================================
// root/javascript/InputHandlerModule.js
// ===========================================

import { config } from './config.js';
import eventManager from './EventManager.js';

export default class InputHandler {
    constructor(canvas, footerManager, humanPlayerIds, game) {
        this.canvas = canvas;
        this.footerManager = footerManager;
        this.humanPlayerIds = humanPlayerIds;
        this.game = game; // Store the game instance to access planets
        this.mousePos = { x: 0, y: 0 };
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionEnd = { x: 0, y: 0 };
        this.touchStartTime = 0;
        // Double-click detection state is now managed here
        this.lastClickTarget = null;
        this.lastClickTime = 0;
        this.doubleClickTimeThreshold = config.ui.input.doubleClickThreshold;
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
    }
    processClick(x, y) {
        const clickedPlanet = this.game.planets.find(planet => planet.containsPoint(x, y));
        const now = Date.now();
        // Check for double click on the same planet
        if (clickedPlanet &&
            clickedPlanet === this.lastClickTarget &&
            (now - this.lastClickTime < this.doubleClickTimeThreshold)
        ) {
            eventManager.emit('planet-double-clicked', clickedPlanet);
            // Reset state to prevent a triple-click from also counting as a double-click
            this.lastClickTime = 0;
            this.lastClickTarget = null;
        } else {
            // It's a single click
            eventManager.emit('click', { x, y, target: clickedPlanet });
            this.lastClickTime = now;
            this.lastClickTarget = clickedPlanet;
        }
    }
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
        if (this.isSelecting) {
            this.selectionEnd.x = this.mousePos.x;
            this.selectionEnd.y = this.mousePos.y;
        }
        eventManager.emit('mouse-moved', this.mousePos);
    }
    handleMouseDown(e) {
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
        this.isSelecting = false;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const distMoved = Math.sqrt(
            Math.pow(this.selectionStart.x - x, 2) +
            Math.pow(this.selectionStart.y - y, 2)
        );

        if (distMoved < config.ui.input.clickMoveThreshold) {
            this.processClick(x, y);
        } else {
            const selectionBox = {
                left: Math.min(this.selectionStart.x, this.selectionEnd.x),
                top: Math.min(this.selectionStart.y, this.selectionEnd.y),
                right: Math.max(this.selectionStart.x, this.selectionEnd.x),
                bottom: Math.max(this.selectionStart.y, this.selectionEnd.y),
            };
            eventManager.emit('selection-box', selectionBox);
        }
    }
    handleTouchStart(e) {
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
        e.preventDefault();
        if (e.touches.length === 1 && this.isSelecting) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos.x = touch.clientX - rect.left;
            this.mousePos.y = touch.clientY - rect.top;
            this.selectionEnd.x = this.mousePos.x;
            this.selectionEnd.y = this.mousePos.y;
            eventManager.emit('mouse-moved', this.mousePos); // Emit event for consistency
        }
    }
    handleTouchEnd(e) {
        e.preventDefault();
        this.isSelecting = false;
        const touchDuration = Date.now() - this.touchStartTime;
        const distMoved = Math.sqrt(
            Math.pow(this.selectionStart.x - this.selectionEnd.x, 2) +
            Math.pow(this.selectionStart.y - this.selectionEnd.y, 2)
        );

        if (touchDuration < config.ui.input.touchDurationThreshold && distMoved < config.ui.input.touchMoveThreshold) {
            this.processClick(this.selectionEnd.x, this.selectionEnd.y);
        } else {
            const selectionBox = {
                left: Math.min(this.selectionStart.x, this.selectionEnd.x),
                top: Math.min(this.selectionStart.y, this.selectionEnd.y),
                right: Math.max(this.selectionStart.x, this.selectionEnd.x),
                bottom: Math.max(this.selectionStart.y, this.selectionEnd.y),
            };
            eventManager.emit('selection-box', selectionBox);
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