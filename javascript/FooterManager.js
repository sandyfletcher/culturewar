// assets/javascript/FooterManager.js

import { config } from './config.js';

export default class FooterManager {
    constructor() {
        this.footerElement = document.querySelector('footer');
        this.originalFooterHTML = this.footerElement.innerHTML;
        this.sliderContainer = null;
        this.value = config.ui.footerSlider.defaultValue;
        this.mode = 'troop';
    }

    // NEW: Clears any dynamic content from the footer.
    clearFooter() {
        this.footerElement.innerHTML = '';
        this.sliderContainer = null;
    }

    // NEW: Shows the default "site by sandy" link.
    showDefault() {
        this.clearFooter();
        this.footerElement.innerHTML = this.originalFooterHTML;
    }

    // NEW: Shows a functional back button.
    showBackButton(onClickHandler) {
        this.clearFooter();
        const backButton = document.createElement('button');
        backButton.id = 'footer-back-button';
        backButton.innerHTML = '< BACK'; // Use HTML entity for '<'
        backButton.addEventListener('click', onClickHandler);
        this.footerElement.appendChild(backButton);
    }

    showSlider(mode) {
        this.clearFooter(); // Use the new clear method
        this.mode = (mode === 'singleplayer') ? 'troop' : 'speed';
        this.value = config.ui.footerSlider.defaultValue;
        
        this.sliderContainer = document.createElement('div');
        this.sliderContainer.id = 'footer-slider-container';
        
        this.updateSliderUI(this.value); 
        this.footerElement.appendChild(this.sliderContainer);
        
        const track = document.getElementById('slider-track');
        track.addEventListener('click', (e) => this.handleSliderClick(e));
    }

    switchToSpeedMode() {
        if (this.mode === 'speed') return; 
        
        this.mode = 'speed';
        console.log("All human players eliminated. Switching footer to game speed control.");
        this.updateSliderUI(this.value);
    }

    // MODIFIED: Renamed from hideSlider to be more generic.
    // This is now primarily used for when the game ends.
    revertToDefault() {
        this.showDefault();
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