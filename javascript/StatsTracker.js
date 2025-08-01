// ===========================================
// root/javascript/StatsTracker.js
// ===========================================

/**
 * A singleton class to intercept game stat logs, parse them,
 * and persist them in localStorage for aggregation.
 */
export default class StatsTracker {
    constructor() {
        // Ensure only one instance of StatsTracker exists
        if (StatsTracker.instance) {
            return StatsTracker.instance;
        }

        this.games = {};
        this.playerRecords = [];
        this.loadFromLocalStorage();

        // Monkey-patch console.log to intercept our structured logs
        this.originalLog = console.log.bind(console);
        this.overrideConsoleLog();

        StatsTracker.instance = this;
    }

    /**
     * Replaces the global console.log with a function that checks for
     * our specific stat formats before passing the log to the original function.
     */
    overrideConsoleLog() {
        console.log = (...args) => {
            if (typeof args[0] === 'string') {
                if (args[0].startsWith('[GAME_STATS]') || args[0].startsWith('[PLAYER_STATS]')) {
                    this.parseAndStore(args[0]);
                }
            }
            // Call the original console.log so we don't lose any debug info
            this.originalLog(...args);
        };
    }

    /**
     * Parses a structured log string and stores the data.
     * @param {string} logLine - The CSV-formatted log line.
     */
    parseAndStore(logLine) {
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
            });
        }
        this.saveToLocalStorage();
    }

    /**
     * Loads all historical stats data from localStorage.
     */
    loadFromLocalStorage() {
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

    /**
     * Saves the current stats data to localStorage.
     */
    saveToLocalStorage() {
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

    /**
     * Processes all stored player records to calculate aggregate stats
     * like win rate and average survival time for each combatant.
     * @returns {Array} An array of objects, each containing the aggregated stats for a player.
     */
    getAggregatedStats() {
        const statsByPlayer = {};

        // Aggregate data from all recorded games
        for (const record of this.playerRecords) {
            if (!statsByPlayer[record.nickname]) {
                statsByPlayer[record.nickname] = {
                    nickname: record.nickname,
                    wins: 0,
                    gamesPlayed: 0,
                    totalSurvivalTime: 0,
                };
            }
            const playerStat = statsByPlayer[record.nickname];
            playerStat.gamesPlayed++;
            playerStat.totalSurvivalTime += record.survivalTime;
            if (record.rank === 1) {
                playerStat.wins++;
            }
        }

        // Calculate final percentages and averages
        const aggregatedList = Object.values(statsByPlayer).map(player => {
            return {
                ...player,
                winRate: (player.wins / player.gamesPlayed) * 100,
                avgSurvival: player.totalSurvivalTime / player.gamesPlayed,
            };
        });

        // Sort by win rate (descending) as the primary ranking metric
        aggregatedList.sort((a, b) => b.winRate - a.winRate);
        
        return aggregatedList;
    }
}