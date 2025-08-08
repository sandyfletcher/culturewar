// =============================================
// root/javascript/bots/HorizonBeta.js
// =============================================

import BaseBot from './BaseBot.js';

/**
 * HorizonBeta: An adaptive, value-driven RTS bot focused on safe expansion, surgical defense,
 * and opportunistic strikes using forward predictions and phased strategy.
 * 
 * Strategic pillars:
 * 1) Defense-first: Intercept lethal incoming attacks with minimal required reinforcements.
 * 2) Value-based expansion: Prioritize high-value neutral/enemy planets using production, distance, and timing.
 * 3) Predictive efficiency: Use future state predictions to send just-enough troops.
 * 4) Phased play: Early = rapid safe expansion; Mid = consolidation and pressure; Late = finish strongest rival.
 */
export default class HorizonBeta extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);
        // Tunable parameters
        this.memory.attackCooldown = 0;           // Global cooldown to avoid over-issuing commands.
        this.memory.minSendThreshold = 6;         // Don't send tiny fleets unless necessary.
        this.memory.reserveFactor = 0.2;          // Keep 20% as local reserve on sender for safety.
        this.memory.interceptHorizon = 8;         // Seconds ahead to predict for defense checks.
        this.memory.opportunityHorizon = 6;       // Seconds ahead to estimate target state.
        this.memory.phaseAggression = {           // Aggression multipliers by phase.
            EARLY: 1.0,
            MID: 1.2,
            LATE: 1.4
        };
        this.memory.lastTick = 0;
        // Lightweight logger guard
        this.log = (msg) => {
            // console.log(`[HorizonBeta][${this.playerId}] ${msg}`);
        };
    }

    /**
     * Core loop: prioritize defend -> expand -> attack.
     * @param {number} dt
     * @returns {object|null}
     */
    makeDecision(dt) {
        // Cooldowns and early exits
        this.memory.attackCooldown = Math.max(0, (this.memory.attackCooldown || 0) - dt);

        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;

        // Phase-based tuning
        const phase = this.api.getGamePhase(); // 'EARLY' | 'MID' | 'LATE'
        const aggression = this.memory.phaseAggression[phase] ?? 1.0;

        // Helper functions
        const planetSafeSendable = (planet) => {
            // Keep a reserve proportional to troops and threat
            const threat = this.api.calculateThreat(planet); // higher = more threatened
            const dynamicReserve = Math.max(
                planet.troops * this.memory.reserveFactor,
                threat * 0.5 // add extra reserve if threatened
            );
            return Math.max(0, Math.floor(planet.troops - dynamicReserve));
        };

        const minimalDefenseNeeded = (planet) => {
            // Predict near-future state factoring all incoming
            const horizon = this.memory.interceptHorizon;
            const future = this.api.predictPlanetState(planet, horizon);
            if (future.owner !== this.playerId) {
                // If we lose it by horizon, compute deficit to keep it by arrival
                // Estimate reinforcement arrival from nearest ally
                const allies = myPlanets.filter(p => p.id !== planet.id);
                if (allies.length === 0) return Infinity;
                const nearest = this.api.findNearestPlanet(planet, allies);
                if (!nearest) return Infinity;
                const travel = this.api.getTravelTime(nearest, planet);
                const reinforceFuture = this.api.predictPlanetState(planet, travel);
                // If at arrival we wouldn't own it or be low, compute required diff
                const needed = Math.max(0, 1 - (reinforceFuture.owner === this.playerId ? reinforceFuture.troops : -reinforceFuture.troops));
                return Math.ceil(needed);
            }
            // If we keep it, no immediate defense needed.
            return 0;
        };

        const computeAttackCost = (from, to, horizon) => {
            // Predict defender future at arrival time
            const travel = this.api.getTravelTime(from, to);
            const t = Math.max(0.5, Math.min(horizon, travel)); // predict at least some time or up to horizon
            const pred = this.api.predictPlanetState(to, t);
            // If enemy-owned at arrival, need to exceed troops by 1 to flip
            // If neutral, need to exceed neutral garrison (no production)
            const needed = (pred.owner === this.playerId) ? 0 : Math.max(1, Math.ceil(pred.troops + 1));
            return { needed, travel };
        };

        // 1) DEFENSE PRIORITY: Intercept lethal threats with nearest available troops.
        // Find planets predicted to be lost soon and reinforce just-in-time from nearest sources.
        const endangered = myPlanets
            .map(p => ({ p, need: minimalDefenseNeeded(p) }))
            .filter(e => e.need > 0 && e.need !== Infinity)
            .sort((a, b) => b.need - a.need); // biggest deficit first

        if (endangered.length > 0) {
            // Try to cover the top endangered with the closest capable ally
            const { p: target, need } = endangered[0];
            // Find candidate senders sorted by travel time
            const candidates = myPlanets
                .filter(src => src.id !== target.id)
                .map(src => ({ src, travel: this.api.getTravelTime(src, target) }))
                .sort((a, b) => a.travel - b.travel);

            for (const { src } of candidates) {
                const canSend = planetSafeSendable(src);
                if (canSend >= need && canSend >= this.memory.minSendThreshold) {
                    if (this.memory.attackCooldown <= 0) {
                        this.memory.attackCooldown = 0.35;
                        const troops = need;
                        this.log(`Reinforce ${target.id} from ${src.id} with ${troops}`);
                        return { from: src, to: target, troops };
                    }
                    break;
                }
            }
            // If no single sender can fully cover, try partial top-up aggregation
            let remaining = need;
            const partials = [];
            for (const { src } of candidates) {
                if (remaining <= 0) break;
                const canSend = planetSafeSendable(src);
                const send = Math.min(canSend, remaining);
                if (send >= this.memory.minSendThreshold / 2 && send > 0) {
                    partials.push({ src, send });
                    remaining -= send;
                }
            }
            if (partials.length > 0 && remaining <= 0 && this.memory.attackCooldown <= 0) {
                // Send from the largest contributor this tick to avoid multiple actions per tick.
                // Next ticks will complete remaining if needed.
                const best = partials.sort((a, b) => b.send - a.send)[0];
                this.memory.attackCooldown = 0.35;
                this.log(`Partial reinforce ${target.id} from ${best.src.id} with ${best.send}`);
                return { from: best.src, to: target, troops: best.send };
            }
        }

        // 2) EXPANSION AND PRESSURE: Choose best target by value-density and timing.
        const allPlanets = this.api.getAllPlanets();
        const targets = allPlanets.filter(p => p.owner !== this.playerId);
        if (targets.length === 0) return null;

        // Rank targets by composite score: API value, inverse distance to our strong hubs, and predicted ease.
        // Choose a hub planet as sender: prefer strong, central, and low-threat planets.
        const hubs = myPlanets
            .map(p => ({ p, threat: this.api.calculateThreat(p), central: this.api.calculateCentrality(p) }))
            .sort((a, b) => {
                // Prefer low threat, high troops, high centrality
                const aScore = (-a.threat * 2) + (a.p.troops) + (a.central * 5);
                const bScore = (-b.threat * 2) + (b.p.troops) + (b.central * 5);
                return bScore - aScore;
            })
            .map(o => o.p);

        const sender = hubs[0] || myPlanets[0];
        const sendable = planetSafeSendable(sender);
        if (sendable < this.memory.minSendThreshold) return null;

        // Evaluate top N candidate targets near the sender
        const candidates = targets
            .map(t => {
                const distance = this.api.getDistance(sender, t);
                const value = this.api.calculatePlanetValue(t);
                const central = this.api.calculateCentrality(t);
                // Predict needed troops at (travel time + small buffer)
                const { needed, travel } = computeAttackCost(sender, t, this.memory.opportunityHorizon);
                // Score: higher planet value and centrality, lower distance and required troops
                // Adjust by phase aggression: more aggressive -> tolerate higher needed
                const score = (value * 1.8 + central * 1.0) - (distance / 100) - (needed / (10 * aggression));
                return { t, distance, needed, travel, score };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 6); // focus on best few

        // 3) Opportunistic strike if we can take a top-scoring target efficiently
        for (const cand of candidates) {
            if (cand.needed <= 0) continue;
            // Add a small margin to account for production during our travel
            const margin = Math.max(1, Math.ceil(cand.travel * 0.2));
            const required = cand.needed + margin;

            if (sendable >= required) {
                if (this.memory.attackCooldown <= 0) {
                    this.memory.attackCooldown = 0.35;
                    const troops = required;
                    this.log(`Attack ${cand.t.id} from ${sender.id} sending ${troops} (need ${cand.needed}+${margin})`);
                    return { from: sender, to: cand.t, troops };
                }
                break;
            }
        }

        // 4) If we cannot take high-value targets outright, perform pressure moves:
        // a) Snipe weak neutrals close to our sender.
        const neutrals = this.api.getNeutralPlanets();
        if (neutrals.length > 0) {
            const nearNeutrals = neutrals
                .map(n => {
                    const { needed, travel } = computeAttackCost(sender, n, this.memory.opportunityHorizon);
                    const dist = this.api.getDistance(sender, n);
                    const score = (this.api.calculatePlanetValue(n) * 1.5) - (dist / 120) - (needed / 8);
                    return { n, needed, travel, score };
                })
                .filter(c => c.needed > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            for (const c of nearNeutrals) {
                const margin = Math.max(1, Math.ceil(c.travel * 0.15));
                const required = c.needed + margin;
                if (sendable >= required && required >= this.memory.minSendThreshold) {
                    if (this.memory.attackCooldown <= 0) {
                        this.memory.attackCooldown = 0.3;
                        const troops = required;
                        this.log(`Expand to neutral ${c.n.id} from ${sender.id} with ${troops}`);
                        return { from: sender, to: c.n, troops };
                    }
                    break;
                }
            }
        }

        // b) Harass weakest enemy frontier planet if safe: choose an enemy close to our sender that we can chip.
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length > 0) {
            const chipCandidates = enemies
                .map(e => {
                    const dist = this.api.getDistance(sender, e);
                    const { needed, travel } = computeAttackCost(sender, e, this.memory.opportunityHorizon);
                    const eVal = this.api.calculatePlanetValue(e);
                    // Harass if needed is moderate and distance is small
                    const score = (eVal * 1.2) - (dist / 150) - (needed / 12);
                    return { e, needed, travel, score };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 4);

            for (const c of chipCandidates) {
                const margin = Math.max(0, Math.floor(c.travel * 0.1));
                const required = c.needed + margin;
                // Only send if we have comfortable surplus
                if (sendable >= required && required >= this.memory.minSendThreshold && required <= sendable * 0.75) {
                    if (this.memory.attackCooldown <= 0) {
                        this.memory.attackCooldown = 0.35;
                        const troops = required;
                        this.log(`Pressure attack ${c.e.id} from ${sender.id} with ${troops}`);
                        return { from: sender, to: c.e, troops };
                    }
                    break;
                }
            }
        }

        // 5) Redistribution: If a backline planet is overflowing, move surplus forward.
        const maxCap = this.api.getMaxPlanetTroops();
        const backline = myPlanets
            .filter(p => this.api.calculateThreat(p) < 0.5 && p.troops > maxCap * 0.6)
            .sort((a, b) => b.troops - a.troops);

        if (backline.length > 0 && myPlanets.length > 1) {
            const src = backline[0];
            // Find a more central or threatened friendly planet to reinforce
            const dest = myPlanets
                .filter(p => p.id !== src.id)
                .map(p => ({ p, central: this.api.calculateCentrality(p), threat: this.api.calculateThreat(p) }))
                .sort((a, b) => {
                    // prefer higher threat or higher centrality
                    const aScore = a.threat * 2 + a.central;
                    const bScore = b.threat * 2 + b.central;
                    return bScore - aScore;
                })[0]?.p;

            if (dest) {
                const canSend = Math.max(this.memory.minSendThreshold, Math.floor(src.troops * 0.25));
                if (canSend >= this.memory.minSendThreshold && this.memory.attackCooldown <= 0) {
                    this.memory.attackCooldown = 0.25;
                    this.log(`Redistribute from ${src.id} to ${dest.id} with ${canSend}`);
                    return { from: src, to: dest, troops: canSend };
                }
            }
        }

        // Nothing compelling this tick
        return null;
    }
}