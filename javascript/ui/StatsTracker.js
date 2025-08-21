// ===========================================
// root/javascript/ui/StatsTracker.js
// ===========================================

export default class StatsTracker { // singleton class to intercept game stat logs, parse them, and persist them in localStorage for aggregation
    constructor() {
        if (StatsTracker.instance) { // ensure only one instance of StatsTracker exists
            return StatsTracker.instance;
        }
        this.games = {};
        this.playerRecords = [];
        this.loadFromLocalStorage();
        StatsTracker.instance = this;
    }
    report(data) { // central reporting method for all game statistics
        if (!data || !data.type || !data.gameId) return;

        const { type, gameId } = data;

        if (type === 'GAME_STATS') {
            this.games[gameId] = {
                id: gameId,
                duration: data.duration,
                troopsSent: data.troopsSent,
                planetsConquered: data.planetsConquered,
                troopsLost: data.troopsLost,
            };
        } else if (type === 'PLAYER_STATS') {
            this.playerRecords.push({
                gameId: gameId,
                rank: data.rank,
                nickname: data.nickname,
                planets: data.planets,
                troops: data.troops,
                survivalTime: data.survivalTime,
                cultureScore: data.cultureScore || 0
            });
        }
        this.saveToLocalStorage();
    }
    loadFromLocalStorage() {
        try {
            const storedData = localStorage.getItem('cultureWarStats');
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                this.games = parsedData.games || {};
                this.playerRecords = parsedData.playerRecords || [];
            }
        } catch (error) {
            console.error('Error loading stats from localStorage:', error);
            this.games = {};
            this.playerRecords = [];
        }
    }
    saveToLocalStorage() {
        try {
            const dataToStore = JSON.stringify({
                games: this.games,
                playerRecords: this.playerRecords
            });
            localStorage.setItem('cultureWarStats', dataToStore);
        } catch (error) {
            console.error('Error saving stats to localStorage:', error);
        }
    }
    getAggregatedStats() {
        const statsByPlayer = {};
        for (const record of this.playerRecords) {
            if (!statsByPlayer[record.nickname]) {
                statsByPlayer[record.nickname] = {
                    nickname: record.nickname,
                    wins: 0,
                    gamesPlayed: 0,
                    totalSurvivalTime: 0,
                    totalCultureScore: 0,
                    totalRank: 0,
                };
            }
            const playerStat = statsByPlayer[record.nickname];
            playerStat.gamesPlayed++;
            playerStat.totalSurvivalTime += record.survivalTime;
            playerStat.totalCultureScore += record.cultureScore || 0;
            playerStat.totalRank += record.rank;
            if (record.rank === 1) {
                playerStat.wins++;
            }
        }
        const aggregatedList = Object.values(statsByPlayer).map(player => {
            return {
                ...player,
                winRate: (player.wins / player.gamesPlayed) * 100,
                avgSurvival: player.totalSurvivalTime / player.gamesPlayed,
                avgRank: player.totalRank / player.gamesPlayed,
            };
        });
        aggregatedList.sort((a, b) => b.totalCultureScore - a.totalCultureScore || b.winRate - a.winRate);
        return aggregatedList;
    }
    clearStats() {
        this.games = {};
        this.playerRecords = [];
        localStorage.removeItem('cultureWarStats');
    }
}