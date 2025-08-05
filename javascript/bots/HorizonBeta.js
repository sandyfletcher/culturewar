// =============================================
// root/javascript/bots/HorizonBeta.js — High-performance adaptive RTS bot
// =============================================

import BaseBot from './BaseBot.js';
import { config } from '../config.js';

/**
 * HorizonBeta — An adaptive, high-performance Galcon-like AI.
 *
 * Strategic pillars:
 * 1) Tempo and Expansion: Fast early neutral captures with minimal surplus (just enough to win on arrival),
 *    prioritizing high-production and centrally located planets with short travel times.
 * 2) Threat-aware Defense: Continuously predict threatened planets; reinforce preemptively using closest surplus sources.
 * 3) Efficient Offense: Only launch when predicted to capture with margin, factoring production, travel time,
 *    and incoming fleets. Opportunistically snipe enemy planets under attack by others.
 * 4) Flow Control: Maintain decision cooldown; avoid over-sending; cap per-source commitment; stop at useful thresholds.
 * 5) Phase Adaptation: Early (expand), Mid (balance pressure and economy), Late (finishers, deny and choke).
 *
 * Memory usage:
 * - phase: tracked via GameAPI but mirrored for stability.
 * - missions: Map of targetPlanetId -> { type, eta, troopsCommitted, fromIds, createdAt }
 * - threats: map of my planet id -> { need, eta }
 * - lastActionTime: to respect global cooldown.
 */

export default class HorizonBeta extends BaseBot {
    constructor(game, playerId) {
        super(game, playerId);
        // Tunable heuristics
        this.params = {
            sendFractionCap: 0.65,           // Max fraction of a planet's current troops we send in one order
            minGarrisonPerPlanet: 5,         // Keep a small garrison to avoid instant snipes
            defenseOversendFactor: 1.15,     // Overfill slightly for reinforcements
            attackOversendFactor: 1.10,      // Overfill slightly for attacks
            maxConcurrentMissions: 6,        // Avoid spamming too many fronts at once
            perSourceMissionCap: 2,          // Limit parallel missions per source
            snipeWindow: 2.5,                // Seconds window to arrive right after a big fight
            attackHorizon: 8.0,              // Seconds ahead to predict for evaluating attacks
            defenseHorizon: 6.0,             // Seconds ahead to predict for defenses
            minAttackMargin: 2,              // Minimum expected troops after capture
            lateGamePushRatio: 1.15,         // Strength ratio threshold to switch to aggressive finishing
            earlyExpansionWindow: 30,        // Prioritize neutrals early
            pressureRatio: 0.95,             // If stronger than opponents, allow pressure attacks
            regroupThreshold: 0.75,          // If much weaker, shift to defensive consolidation
            starveDistanceFactor: 1.25,      // Prefer closer targets; penalize long travel
        };
    }
    makeDecision(dt) {
        // Respect global AI cooldown
        const now = this.api.getElapsedTime();
        if (now - this.memory.lastActionTime < config.ai.globalDecisionCooldown) {
            return null;
        }
        // Update phase
        this.memory.phase = this.api.getGamePhase();
        // Maintain missions (prune completed or stale)
        this._maintainMissions(now);
        // Build snapshots
        const myPlanets = this.api.getMyPlanets();
        if (myPlanets.length === 0) return null;
        // Compute surplus per planet
        const surplusByPlanet = this._computeSurplusMap(myPlanets, now);
        // 1) Critical defense
        const defenseOrder = this._tryDefendThreats(myPlanets, surplusByPlanet, now);
        if (defenseOrder) {
            this.memory.lastActionTime = now;
            return defenseOrder;
        }
        // 2) Expansion or opportunistic capture
        const expansionOrder = this._tryExpandOrSnipe(myPlanets, surplusByPlanet, now);
        if (expansionOrder) {
            this.memory.lastActionTime = now;
            return expansionOrder;
        }
        // 3) Strategic attack (pressure, mid/late game)
        const attackOrder = this._tryStrategicAttack(myPlanets, surplusByPlanet, now);
        if (attackOrder) {
            this.memory.lastActionTime = now;
            return attackOrder;
        }
        // 4) Consolidation: balance between our planets (overflow mitigation)
        const balanceOrder = this._tryBalance(myPlanets, surplusByPlanet, now);
        if (balanceOrder) {
            this.memory.lastActionTime = now;
            return balanceOrder;
        }
        return null;
    }
    // -----------------------------
    // Internal utilities
    // -----------------------------
    _maintainMissions(now) {
        if (!(this.memory.missions instanceof Map)) {
            this.memory.missions = new Map();
        }
        const toDelete = [];
        for (const [targetId, mission] of this.memory.missions.entries()) {
            const target = this.api.getPlanetById(targetId);
            if (!target || target.owner === this.playerId || (mission.eta && now > mission.eta + 1.0)) {
                toDelete.push(targetId);
            }
        }
        toDelete.forEach(id => this.memory.missions.delete(id));
    }
    _computeSurplusMap(myPlanets, now) {
        const map = new Map();
        for (const p of myPlanets) {
            const incomingEnemy = this.api.getIncomingAttacks(p).reduce((s, m) => s + m.amount, 0);
            const incomingFriendly = this.api.getIncomingReinforcements(p).reduce((s, m) => s + m.amount, 0);
            const netIncoming = incomingFriendly - incomingEnemy;
            // Keep a garrison; don't drop below
            const raw = Math.floor(p.troops + netIncoming - this.params.minGarrisonPerPlanet);
            const sendable = Math.max(0, Math.min(raw, Math.floor(p.troops * this.params.sendFractionCap)));
            // Cap per ongoing missions from this planet
            const activeFrom = this._countActiveMissionsFrom(p.id);
            const capped = activeFrom >= this.params.perSourceMissionCap ? 0 : sendable;
            map.set(p.id, { sendable: capped, planet: p });
        }
        return map;
    }
    _countActiveMissionsFrom(fromPlanetId) {
        let count = 0;
        for (const [, mission] of this.memory.missions.entries()) {
            if (mission.fromIds && mission.fromIds.includes(fromPlanetId)) count++;
        }
        return count;
    }
    _canStartMoreMissions() {
        return this.memory.missions.size < this.params.maxConcurrentMissions;
    }
    _strengthRatio() {
        return this.api.getMyStrengthRatio(); // >1 stronger, <1 weaker
    }
    // -----------------------------
    // Defense
    // -----------------------------
    _tryDefendThreats(myPlanets, surplusByPlanet, now) {
        // Identify threatened planets by prediction
        const threats = [];
        for (const p of myPlanets) {
            const pred = this.api.predictPlanetState(p, this.params.defenseHorizon);
            if (pred.owner !== this.playerId) {
                // Calculate minimal needed to keep
                const need = Math.ceil(pred.troops * this.params.defenseOversendFactor + 1);
                threats.push({ target: p, need, horizon: this.params.defenseHorizon });
            }
        }
        if (threats.length === 0) return null;
        // Try to reinforce the most urgent (lowest time-to-fall if we can infer)
        // We approximate urgency by current incoming attack earliest ETA
        threats.sort((a, b) => {
            const etaA = this._earliestIncomingETA(a.target, false) ?? 999;
            const etaB = this._earliestIncomingETA(b.target, false) ?? 999;
            return etaA - etaB;
        });
        for (const th of threats) {
            let remaining = th.need;
            const donors = this._sortedClosestSurplus(th.target, surplusByPlanet);
            for (const donor of donors) {
                if (remaining <= 0) break;
                if (donor.surplus <= 0) continue;
                const travel = this.api.getTravelTime(donor.planet, th.target);
                if (travel > this.params.defenseHorizon + 1.0) continue; // too slow
                const send = Math.min(donor.surplus, remaining);
                if (send <= 0) continue;
                // Issue order
                this._registerMission(th.target.id, 'defend', now + travel, send, [donor.planet.id]);
                return { from: donor.planet, to: th.target, troops: send };
            }
        }
        return null;
    }
    _earliestIncomingETA(planet, friendly = false) {
        const arr = friendly ? this.api.getIncomingReinforcements(planet) : this.api.getIncomingAttacks(planet);
        if (arr.length === 0) return null;
        return arr.reduce((min, m) => (m.to === planet && m.duration < min) ? m.duration : min, Infinity);
    }
    _sortedClosestSurplus(target, surplusByPlanet) {
        const donors = [];
        for (const [, v] of surplusByPlanet.entries()) {
            if (v.planet.id !== target.id) {
                donors.push({ planet: v.planet, surplus: v.sendable, dist: this.api.getDistance(v.planet, target) });
            }
        }
        donors.sort((a, b) => a.dist - b.dist);
        return donors;
    }
    // -----------------------------
    // Expansion / Sniping
    // -----------------------------
    _tryExpandOrSnipe(myPlanets, surplusByPlanet, now) {
        if (!this._canStartMoreMissions()) return null;
        // Opportunistic snipe on enemy planets after battles
        const snipeOrder = this._opportunisticSnipe(myPlanets, surplusByPlanet, now);
        if (snipeOrder) return snipeOrder;
        if (this.memory.phase === 'EARLY' || now < this.params.earlyExpansionWindow) {
            const target = this._bestNeutralTarget(myPlanets, this.api.getNeutralPlanets());
            if (!target) return null;
            // Choose best donor with enough sendable to win on arrival
            const candidateDonors = this._sortedClosestSurplus(target, surplusByPlanet);
            for (const donor of candidateDonors) {
                const travel = this.api.getTravelTime(donor.planet, target);
                const predicted = this.api.predictPlanetState(target, travel);
                let needed = Math.ceil((predicted.troops + 1) * this.params.attackOversendFactor);
                if (donor.surplus >= needed && needed > 0) {
                    this._registerMission(target.id, 'expand', now + travel, needed, [donor.planet.id]);
                    return { from: donor.planet, to: target, troops: needed };
                }
            }
        }
        return null;
    }
    _bestNeutralTarget(myPlanets, neutrals) {
        if (!neutrals || neutrals.length === 0) return null;
        // Score neutrals by production, size, centrality, and distance from our nearest planet
        let best = null;
        let bestScore = -Infinity;
        for (const n of neutrals) {
            const prodScore = n.productionRate * 25;
            const sizeScore = n.size * 0.5;
            const centScore = this.api.calculateCentrality(n) * 20;
            // distance to nearest owned
            let nearest = null;
            let minDist = Infinity;
            for (const p of myPlanets) {
                const d = this.api.getDistance(p, n);
                if (d < minDist) { minDist = d; nearest = p; }
            }
            const distPenalty = minDist / (config.troop.movementSpeed * this.params.starveDistanceFactor);
            const value = prodScore + sizeScore + centScore - distPenalty - n.troops * 0.8;
            if (value > bestScore) { bestScore = value; best = n; }
        }
        return best;
    }
    _opportunisticSnipe(myPlanets, surplusByPlanet, now) {
        // Look for enemy planets with heavy incoming enemy attacks or recent chaos
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;
        for (const e of enemies) {
            const incoming = this.api.getIncomingAttacks(e);
            if (incoming.length === 0) continue;
            const soonest = this._earliestIncomingETA(e, false);
            if (soonest === null || soonest > this.params.snipeWindow) continue;
            // Predict shortly after the fight
            const arrivalWindow = soonest + 0.2;
            const predicted = this.api.predictPlanetState(e, arrivalWindow);
            if (predicted.owner === this.playerId) continue; // already will become ours
            // Try to find a donor that can arrive around arrivalWindow and beat predicted troops
            const donors = this._sortedClosestSurplus(e, surplusByPlanet);
            for (const donor of donors) {
                const travel = this.api.getTravelTime(donor.planet, e);
                if (Math.abs(travel - arrivalWindow) > 1.5) continue; // keep timing somewhat close
                const need = Math.max(1, Math.ceil((predicted.troops + 1) * this.params.attackOversendFactor));
                if (donor.surplus >= need) {
                    this._registerMission(e.id, 'snipe', now + travel, need, [donor.planet.id]);
                    return { from: donor.planet, to: e, troops: need };
                }
            }
        }
        return null;
    }
    // -----------------------------
    // Strategic attacks
    // -----------------------------
    _tryStrategicAttack(myPlanets, surplusByPlanet, now) {
        if (!this._canStartMoreMissions()) return null;
        const ratio = this._strengthRatio();
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;
        // Skip if we're too weak unless there's a soft nearby target
        const allowAggression = ratio >= this.params.pressureRatio || this.memory.phase !== 'EARLY';
        // Evaluate targets by value minus difficulty
        let best = null;
        let bestScore = -Infinity;
        for (const e of enemies) {
            // Predict in attack horizon
            const pred = this.api.predictPlanetState(e, this.params.attackHorizon);
            // If someone else will take it (pred.owner != e.owner), consider post-capture snipe done above
            const baseValue = this.api.calculatePlanetValue(e);
            // Penalize high predicted troops
            const defensePenalty = pred.troops * 2.0;
            // Distance penalty to nearest of our planets
            let minDist = Infinity;
            let nearest = null;
            for (const p of myPlanets) {
                const d = this.api.getDistance(p, e);
                if (d < minDist) { minDist = d; nearest = p; }
            }
            const distPenalty = minDist / (config.troop.movementSpeed * this.params.starveDistanceFactor);
            // Prefer border planets near us
            const score = baseValue - defensePenalty - distPenalty;
            if (score > bestScore) {
                bestScore = score;
                best = { planet: e, nearest, predTroops: pred.troops, minDist };
            }
        }
        if (!best || !allowAggression) return null;
        // Try to assemble enough from the nearest donor first, otherwise from next
        const target = best.planet;
        // Determine required force based on the donor's actual travel time, not the fixed horizon
        const donors = this._sortedClosestSurplus(target, surplusByPlanet);
        let required = null;
        let chosenDonor = null;
        for (const donor of donors) {
            if (donor.surplus <= 0) continue;
            const travel = this.api.getTravelTime(donor.planet, target);
            const predAtArrival = this.api.predictPlanetState(target, travel);
            let need = Math.ceil((predAtArrival.troops + 1 + this.params.minAttackMargin) * this.params.attackOversendFactor);
            need = Math.max(1, need);
            if (donor.surplus >= need) {
                required = need;
                chosenDonor = donor;
                break;
            }
        }
        if (chosenDonor && required !== null) {
            this._registerMission(target.id, 'attack', now + this.api.getTravelTime(chosenDonor.planet, target), required, [chosenDonor.planet.id]);
            return { from: chosenDonor.planet, to: target, troops: required };
        }
        // If no single donor can handle, try a modest multi-hop consolidation in balance step; skip here.
        return null;
    }
    // -----------------------------
    // Balance / Consolidation
    // -----------------------------
    _tryBalance(myPlanets, surplusByPlanet, now) {
        // Move excess from overfull planets to nearest frontline or higher production
        // Identify a planet near cap or with high troops and low threat; send to closest lower-troop our planet closer to enemies
        const enemies = this.api.getEnemyPlanets();
        if (enemies.length === 0) return null;
        // Frontline heuristic: planets closer to enemies than to center of our cluster
        const enemyCenter = this._centerOfPlanets(enemies);
        let bestSource = null;
        let bestTarget = null;
        let bestSend = 0;
        let bestScore = -Infinity;
        for (const p of myPlanets) {
            const sEntry = surplusByPlanet.get(p.id);
            const canSend = sEntry ? sEntry.sendable : 0;
            if (canSend <= 0) continue;
            // Prefer large production planets to hold some troops; still allow trickle
            const candidateTargets = myPlanets.filter(t => t.id !== p.id);
            for (const t of candidateTargets) {
                // favor targets closer to enemies to stage
                const dToEnemy = this.api.getDistance(t, enemyCenter);
                const dSourceToEnemy = this.api.getDistance(p, enemyCenter);
                if (dToEnemy > dSourceToEnemy) continue; // prefer moving closer to enemy lines
                const travel = this.api.getTravelTime(p, t);
                const score = (p.productionRate < t.productionRate ? 3 : 1) + (dSourceToEnemy - dToEnemy) / 50 - travel * 0.3;
                if (score > bestScore) {
                    bestScore = score;
                    bestSource = p;
                    bestTarget = t;
                    bestSend = Math.min(canSend, Math.max(5, Math.floor(p.troops * 0.25)));
                }
            }
        }
        if (bestSource && bestTarget && bestSend > 0) {
            // No mission registration for internal balance (short-lived), but could be tracked if needed
            return { from: bestSource, to: bestTarget, troops: bestSend };
        }
        return null;
    }
    _centerOfPlanets(planets) {
        if (!planets || planets.length === 0) return { x: this.api.canvas.width / 2, y: this.api.canvas.height / 2 };
        const sum = planets.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return { x: sum.x / planets.length, y: sum.y / planets.length };
    }
    _registerMission(targetId, type, eta, troopsCommitted, fromIds) {
        const existing = this.memory.missions.get(targetId);
        if (existing) {
            existing.troopsCommitted += troopsCommitted;
            if (fromIds && fromIds.length) {
                existing.fromIds = Array.from(new Set([...(existing.fromIds || []), ...fromIds]));
            }
            existing.eta = eta;
            existing.type = type;
        } else {
            this.memory.missions.set(targetId, {
                type,
                eta,
                troopsCommitted,
                fromIds: fromIds || [],
                createdAt: this.api.getElapsedTime(),
            });
        }
    }
}