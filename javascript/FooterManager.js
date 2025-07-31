import { config } from './config.js';

export default class FooterManager {
    constructor() {
        this.footerElement = document.querySelector('footer');
        this.originalFooterHTML = this.footerElement.innerHTML;
        this.sliderContainer = null;
        this.value = config.ui.footerSlider.defaultValue;
        this.mode = 'troop';
    }

    showSlider(mode) {
        if (this.sliderContainer) return;
        this.mode = (mode === 'singleplayer') ? 'troop' : 'speed';
        this.value = config.ui.footerSlider.defaultValue;
        
        this.footerElement.innerHTML = '';
        this.sliderContainer = document.createElement('div');
        this.sliderContainer.id = 'footer-slider-container';

        // MODIFIED: Label text is now determined by the current mode, not the initial one.
        this.updateSliderUI(this.value); // This will set the label and value
        
        this.footerElement.appendChild(this.sliderContainer);
        
        const track = document.getElementById('slider-track');
        track.addEventListener('click', (e) => this.handleSliderClick(e));
    }

    // NEW: Method to explicitly switch the slider to speed control mode mid-game.
    switchToSpeedMode() {
        if (this.mode === 'speed') return; // Already in speed mode.
        
        this.mode = 'speed';
        console.log("All human players eliminated. Switching footer to game speed control.");
        // Update the UI to reflect the new mode.
        this.updateSliderUI(this.value);
    }

    hideSlider() {
        if (!this.sliderContainer) return;
        this.footerElement.innerHTML = this.originalFooterHTML;
        this.sliderContainer = null;
    }

    handleSliderClick(e) {
        const trackRect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - trackRect.left;
        const width = trackRect.width;
        let percent = Math.round((clickX / width) * 100);
        percent = Math.max(1, Math.min(100, percent));
        
        this.value = percent;
        this.updateSliderUI(this.value);
    }

    updateSliderUI(percent) {
        // MODIFIED: Completely re-renders the slider content based on the current mode.
        if (!this.sliderContainer) return;

        const labelText = (this.mode === 'troop') ? 'TROOP %' : 'GAME PACE';
        let valueText;
        if (this.mode === 'troop') {
            valueText = `${percent}%`;
        } else {
            const speedMultiplier = this.getSpeedMultiplier();
            valueText = `${speedMultiplier.toFixed(2)}X`;
        }

        this.sliderContainer.innerHTML = `
            <span class="footer-slider-label">${labelText}</span>
            <div id="slider-track">
                <div id="slider-fill" style="width: ${percent}%;"></div>
                <div id="slider-thumb" style="left: ${percent}%;"></div>
            </div>
            <span class="slider-value" id="slider-value-display">${valueText}</span>
        `;

        // Re-add the event listener since we overwrote the innerHTML
        const track = document.getElementById('slider-track');
        if (track) {
            track.addEventListener('click', (e) => this.handleSliderClick(e));
        }
    }

    getTroopPercentage() {
        return this.value;
    }

    getSpeedMultiplier() {
        const { min, mid, max } = config.ui.footerSlider.speed;
        const midPoint = config.ui.footerSlider.defaultValue;

        if (this.value <= midPoint) {
            const range = mid - min;
            return min + (this.value - 1) * (range / (midPoint - 1));
        } else {
            const range = max - mid;
            return mid + (this.value - midPoint) * (range / (100 - midPoint));
        }
    }
}