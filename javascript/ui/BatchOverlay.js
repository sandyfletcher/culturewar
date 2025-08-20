// ===========================================
// root/javascript/BatchOverlay.js
// ===========================================

export default class BatchOverlay {
    constructor(element) {
        this.element = element;
        this.progressText = this.element.querySelector('#batch-progress-text');
    }
    show() {
        this.element.style.display = 'flex';
    }
    hide() {
        this.element.style.display = 'none';
    }
    update(data) {
        if (this.progressText && data.gameNumber && data.totalGames) {
            this.progressText.textContent = `Game ${data.gameNumber} of ${data.totalGames}`;
        }
    }
}