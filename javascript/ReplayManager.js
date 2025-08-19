// ===========================================
// root/javascript/ReplayManager.js
// ===========================================

const REPLAY_STORAGE_KEY = 'cultureWarReplays';

export default class ReplayManager {
    constructor() {
        this.replays = this.loadReplays();
    }
    saveReplay(gameConfig, replayName) {
        if (gameConfig.players.some(p => p.type === 'human')) return; // only save replays for non-human games to keep it simple
        const replayData = {
            name: replayName,
            timestamp: Date.now(),
            config: gameConfig,
            players: gameConfig.players.map(p => p.aiController || 'Human').join(' vs. ')
        };
        this.replays.unshift(replayData); // add to beginning of array
        if (this.replays.length > 20) { // limit to last 20 replays
            this.replays.length = 20;
        }
        this._persist();
        // console.log(`Replay '${replayName}' saved.`);
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
    getReplays() { // sorted by most recent
        return this.replays.sort((a, b) => b.timestamp - a.timestamp);
    }
    deleteReplay(timestamp) {
        this.replays = this.replays.filter(r => r.timestamp !== timestamp);
        this._persist();
    }
    clearAllReplays() {
        this.replays = [];
        this._persist();
    }
    _persist() {
        try {
            localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(this.replays));
        } catch (error) {
            console.error("Could not save replays to localStorage:", error);
        }
    }
}