export default class FooterManager {
    constructor() {
        this.footerElement = document.querySelector('footer');
        this.originalFooterHTML = this.footerElement.innerHTML;
        this.sliderContainer = null;
        this.value = 50; // Default value for both modes
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
            <span class="slider-value" id="slider-value-display">50%</span>
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
        this.valueDisplay.textContent = `${percent}%`;
    }

    /**
     * Gets the current value of the slider.
     * @returns {number} The current value (1-100).
     */
    getValue() {
        return this.value;
    }
}