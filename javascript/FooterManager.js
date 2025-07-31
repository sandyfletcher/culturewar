import { config } from './config.js'; // <-- IMPORT THE NEW CONFIG

export default class FooterManager {
    constructor() {
        this.footerElement = document.querySelector('footer');
        this.originalFooterHTML = this.footerElement.innerHTML;
        this.sliderContainer = null;
        // Use default value from config
        this.value = config.ui.footerSlider.defaultValue;
        this.mode = 'troop'; // 'troop' or 'speed'
    }

    /**
     * Replaces the default footer with the interactive slider.
     * @param {string} mode - The mode for the slider, either 'singleplayer' or 'botbattle'.
     */
    showSlider(mode) {
        // If slider already exists, do nothing.
        if (this.sliderContainer) return;

        this.mode = (mode === 'singleplayer') ? 'troop' : 'speed';
        this.value = config.ui.footerSlider.defaultValue; // Reset to default on show
        
        // Clear footer and build slider
        this.footerElement.innerHTML = '';
        this.sliderContainer = document.createElement('div');
        this.sliderContainer.id = 'footer-slider-container';

        const labelText = (this.mode === 'troop') ? 'TROOP %' : 'GAME PACE';

        this.sliderContainer.innerHTML = `
            <span class="footer-slider-label">${labelText}</span>
            <div id="slider-track">
                <div id="slider-fill"></div>
                <div id="slider-thumb"></div>
            </div>
            <span class="slider-value" id="slider-value-display"></span>
        `;

        this.footerElement.appendChild(this.sliderContainer);
        
        this.fillElement = document.getElementById('slider-fill');
        this.thumbElement = document.getElementById('slider-thumb');
        this.valueDisplay = document.getElementById('slider-value-display');
        
        // Add event listener
        const track = document.getElementById('slider-track');
        track.addEventListener('click', (e) => this.handleSliderClick(e));

        // Set initial position
        this.updateSliderUI(this.value);
    }

    /**
     * Removes the slider and restores the original footer content.
     */
    hideSlider() {
        if (!this.sliderContainer) return;
        this.footerElement.innerHTML = this.originalFooterHTML;
        this.sliderContainer = null;
    }

    /**
     * Handles clicks on the slider track to update the value.
     * @param {MouseEvent} e - The click event.
     */
    handleSliderClick(e) {
        const trackRect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - trackRect.left;
        const width = trackRect.width;
        
        // Calculate percentage, ensuring it's between 1 and 100
        let percent = Math.round((clickX / width) * 100);
        percent = Math.max(1, Math.min(100, percent));
        
        this.value = percent;
        this.updateSliderUI(this.value);
    }

    /**
     * Updates the visual state of the slider.
     * @param {number} percent - The value (1-100) to display.
     */
    updateSliderUI(percent) {
        if (!this.fillElement || !this.thumbElement || !this.valueDisplay) return;

        this.fillElement.style.width = `${percent}%`;
        this.thumbElement.style.left = `${percent}%`;

        // ** MODIFICATION: Change display text based on mode **
        if (this.mode === 'troop') {
            this.valueDisplay.textContent = `${percent}%`;
        } else { // 'speed' mode
            const speedMultiplier = this.getSpeedMultiplier();
            this.valueDisplay.textContent = `${speedMultiplier.toFixed(2)}X`;
        }
    }

    /**
     * Gets the current value of the slider for the troop percentage.
     * @returns {number} The current value (1-100).
     */
    getTroopPercentage() {
        return this.value;
    }

    /**
     * Calculates and returns the game speed multiplier for bot battles.
     * @returns {number} The speed multiplier (e.g., 0.01, 1.0, 4.0).
     */
    getSpeedMultiplier() {
        const { min, mid, max } = config.ui.footerSlider.speed;
        const midPoint = config.ui.footerSlider.defaultValue;

        if (this.value <= midPoint) {
            // Scale from min to mid over the first half
            const range = mid - min;
            return min + (this.value - 1) * (range / (midPoint - 1));
        } else {
            // Scale from mid to max over the second half
            const range = max - mid;
            return mid + (this.value - midPoint) * (range / (100 - midPoint));
        }
    }
}