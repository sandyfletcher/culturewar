// ===========================================
// root/javascript/StatsTracker.js
// ===========================================

export default class StatsTracker { // singleton class to intercept game stat logs, parse them, and persist them in localStorage for aggregation
    constructor() {
        if (StatsTracker.instance) { // ensure only one instance of StatsTracker exists
            return StatsTracker.instance;
        }
        this.games = {};
        this.playerRecords = [];
        this.loadFromLocalStorage();
        this.originalLog = console.log.bind(console); // monkey-patch console.log to intercept structured logs
        this.overrideConsoleLog();
        StatsTracker.instance = this;
    }
    overrideConsoleLog() { // replaces global console.log with a function that checks for our specific stat formats before passing log to original function
        console.log = (...args) => {
            if (typeof args[0] === 'string') {
                if (args[0].startsWith('[GAME_STATS]') || args[0].startsWith('[PLAYER_STATS]')) {
                    this.parseAndStore(args[0]);
                }
            }
            this.originalLog(...args); // call original console.log so we don't lose any debug info
        };
    }
    parseAndStore(logLine) { // parses a structured log string and stores the data
        const parts = logLine.split(',');
        const type = parts[0];
        const gameId = parts[1];
        if (type === '[GAME_STATS]') {
            this.games[gameId] = {
                id: gameId,
                duration: parseFloat(parts[2]),
                troopsSent: parseInt(parts[3], 10),
                planetsConquered: parseInt(parts[4], 10),
                troopsLost: parseInt(parts[5], 10),
            };
        } else if (type === '[PLAYER_STATS]') {
            this.playerRecords.push({
                gameId: gameId,
                rank: parseInt(parts[2], 10),
                nickname: parts[3],
                planets: parseInt(parts[4], 10),
                troops: parseInt(parts[5], 10),
                survivalTime: parseFloat(parts[6]),
                cultureScore: parts[7] ? parseFloat(parts[7]) : 0
            });
        }
        this.saveToLocalStorage();
    }
    loadFromLocalStorage() { // loads all historical stats data from localStorage
        try {
            const storedData = localStorage.getItem('cultureWarStats');
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                this.games = parsedData.games || {};
                this.playerRecords = parsedData.playerRecords || [];
            }
        } catch (error) {
            this.originalLog('Error loading stats from localStorage:', error);
            this.games = {};
            this.playerRecords = [];
        }
    }
    saveToLocalStorage() { // saves current stats data to localStorage
        try {
            const dataToStore = JSON.stringify({
                games: this.games,
                playerRecords: this.playerRecords
            });
            localStorage.setItem('cultureWarStats', dataToStore);
        } catch (error) {
            this.originalLog('Error saving stats to localStorage:', error);
        }
    }
    getAggregatedStats() { // processes all stored player records to calculate aggregate stats like winrate and average survival time
        const statsByPlayer = {};
        for (const record of this.playerRecords) { // aggregate data from all recorded games
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
        const aggregatedList = Object.values(statsByPlayer).map(player => { // calculate final percentages and averages
            return {
                ...player,
                winRate: (player.wins / player.gamesPlayed) * 100,
                avgSurvival: player.totalSurvivalTime / player.gamesPlayed,
                avgRank: player.totalRank / player.gamesPlayed,
            };
        });
        aggregatedList.sort((a, b) => b.totalCultureScore - a.totalCultureScore || b.winRate - a.winRate); // sort by culture score, then win rate
        return aggregatedList;
    }
    clearStats() { // clears stats from memory and localStorage
        this.games = {};
        this.playerRecords = [];
        localStorage.removeItem('cultureWarStats');
    }
}