// ===========================================
// root/javascript/FooterManager.js
// ===========================================

import { config } from './config.js';

export default class FooterManager {
    constructor() {
        this.footerElement = document.querySelector('footer');
        this.originalFooterHTML = this.footerElement.innerHTML;
        this.sliderContainer = null;
        this.value = config.ui.footerSlider.defaultValue;
        this.mode = 'troop';
        this.isDragging = false;
        this.handleDragStart = this.handleDragStart.bind(this); // bind drag handlers to instance
        this.handleDragMove = this.handleDragMove.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
    }
    clearFooter() { // clear any dynamic content from footer
        this.footerElement.innerHTML = '';
        this.sliderContainer = null;
    }
    showDefault() { // "site by sandy" link
        this.clearFooter();
        this.footerElement.innerHTML = this.originalFooterHTML;
    }
    showBackButton(onClickHandler, text = '< BACK') { // functional back button
        this.clearFooter();
        const backButton = document.createElement('button');
        backButton.id = 'footer-back-button';
        backButton.innerHTML = text; // use text parameter
        backButton.addEventListener('click', onClickHandler);
        this.footerElement.appendChild(backButton);
    }
    showSlider(mode) {
        this.clearFooter();
        this.mode = (mode === 'singleplayer') ? 'troop' : 'speed';
        this.value = config.ui.footerSlider.defaultValue;
        this.sliderContainer = document.createElement('div');
        this.sliderContainer.id = 'footer-slider-container'; // build slider structure once with IDs for easy updating
        this.sliderContainer.innerHTML = ` 
            <span class="slider-text label" id="slider-text-label"></span>
            <div id="slider-wrapper">
                <div id="slider-track">
                    <div id="slider-fill"></div>
                    <div id="slider-thumb"></div>
                </div>
            </div>
            <span class="slider-text value" id="slider-text-value"></span>
        `;
        this.footerElement.appendChild(this.sliderContainer);
        const track = document.getElementById('slider-track');
        if (track) {
            track.addEventListener('mousedown', this.handleDragStart); // attach drag start listeners instead of just click
            track.addEventListener('touchstart', this.handleDragStart, { passive: false });
        }
        this.updateSliderUI(this.value); 
    }
    switchToSpeedMode() {
        if (this.mode === 'speed') return; 
        this.mode = 'speed';
        this.value = config.ui.footerSlider.defaultValue; // reset slider's value to default (50) to ensure speed starts at 1.0x
        this.updateSliderUI(this.value); // update UI with newly reset value
    }
    revertToDefault() {
        this.showDefault();
    }
    updateValueFromEvent(e) { // calculates and updates slider's value based on a mouse/touch event
        const track = document.getElementById('slider-track');
        if (!track) return;
        const trackRect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clickX = clientX - trackRect.left;
        const width = trackRect.width;
        let percent = Math.round((clickX / width) * 100);
        percent = Math.max(0, Math.min(100, percent)); // clamp value between 0 and 100
        this.value = percent;
        this.updateSliderUI(this.value);
    }
    handleDragStart(e) { // handles start of a drag/click action
        e.preventDefault();
        this.isDragging = true;
        this.updateValueFromEvent(e); // set initial position
        document.addEventListener('mousemove', this.handleDragMove); // add listeners to the whole document to track movement anywhere on the page
        document.addEventListener('mouseup', this.handleDragEnd);
        document.addEventListener('touchmove', this.handleDragMove, { passive: false });
        document.addEventListener('touchend', this.handleDragEnd);
    }
    handleDragMove(e) { // handles movement during a drag
        if (!this.isDragging) return;
        e.preventDefault();
        this.updateValueFromEvent(e);
    }
    handleDragEnd() { // handles end of a drag, cleaning up listeners
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        document.removeEventListener('touchmove', this.handleDragMove);
        document.removeEventListener('touchend', this.handleDragEnd);
    }
    updateSliderUI(percent) { // updates existing elements
        const fill = document.getElementById('slider-fill');
        const thumb = document.getElementById('slider-thumb');
        const label = document.getElementById('slider-text-label');
        const valueDisplay = document.getElementById('slider-text-value');
        if (!fill || !thumb || !label || !valueDisplay) return;
        fill.style.width = `${percent}%`; // update style
        thumb.style.left = `${percent}%`;
        label.textContent = (this.mode === 'troop') ? 'TROOP %' : 'PACE'; // update text content
        if (this.mode === 'troop') {
            valueDisplay.textContent = `${percent}%`;
        } else {
            const speedMultiplier = this.getSpeedMultiplier();
            valueDisplay.textContent = `${speedMultiplier.toFixed(1)}X`;
        }
    }
    getTroopPercentage() {
        return this.value;
    }
    getSpeedMultiplier() {
        const { min, mid, max } = config.ui.footerSlider.speed;
        const midPoint = config.ui.footerSlider.defaultValue; // e.g., 50
        let multiplier;
        if (this.value <= midPoint) {
            // Linear interpolation for the lower half (e.g., 0-50)
            const t = this.value / midPoint; // t will be 0 at value=0, 1 at value=midPoint
            multiplier = min + t * (mid - min);
        } else {
            // Linear interpolation for the upper half (e.g., 50-100)
            const t = (this.value - midPoint) / (100 - midPoint); // t will be 0 at value=midPoint, 1 at value=100
            multiplier = mid + t * (max - mid);
        }
        // **THE FIX:** The FooterManager is the authority on game speed.
        // It enforces the final value is within the legal bounds defined in the config.
        return Math.max(min, Math.min(max, multiplier));
    }
    setSpeedFromMultiplier(multiplier) { // set slider's percentage based on a desired speed multiplier
        if (this.mode !== 'speed') return;
        const { min, mid, max } = config.ui.footerSlider.speed;
        const midPoint = config.ui.footerSlider.defaultValue;
        let percent = midPoint;
        if (multiplier <= mid) { // solving for value in lower range
            const range = mid - min;
            if (range > 0) {
                percent = (multiplier - min) / range * midPoint;
            }
        } else { // solving for value in upper range
            const range = max - mid;
            if (range > 0) {
                percent = midPoint + (multiplier - mid) / range * (100 - midPoint);
            }
        }
        this.value = Math.max(0, Math.min(100, Math.round(percent))); // clamp final value and update UI
        this.updateSliderUI(this.value);
    }
}