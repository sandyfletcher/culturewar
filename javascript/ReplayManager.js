// ===========================================
// root/javascript/ReplayManager.js
// ===========================================

const REPLAY_STORAGE_KEY = 'cultureWarReplays';

export default class ReplayManager {
    constructor() {
        this.replays = this.loadReplays();
    }
    saveReplay(gameConfig, replayName) {
        const replayData = {
            name: replayName,
            timestamp: Date.now(),
            config: gameConfig
        };
        this.replays.push(replayData);
        this._persist();
        console.log(`Replay '${replayName}' saved.`);
    }
    loadReplays() {
        try {
            const stored = localStorage.getItem(REPLAY_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error("Failed to load replays:", e);
            return [];
        }
    }
    getReplays() {
        return this.replays;
    }
    deleteReplay(timestamp) {
        this.replays = this.replays.filter(r => r.timestamp !== timestamp);
        this._persist();
    }
    _persist() {
        localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(this.replays));
    }
}