// =============================================
// root/javascript/bots/KimiK2C.js
// Dominant real-time strategy bot for Galcon
// Tactics: adaptive-expansion into mid-term surgical strikes, ending with full out
// collapse. Uses event-driven threat assessment and resource-value optimization.
// =============================================
import BaseBot from './BaseBot.js';

export default class KimiK2C extends BaseBot {
    constructor(api, playerId) {
        super(api, playerId);

        // memory block holds all long-term state
        this.memory = {
            actionCooldown: 0,
            missions: {},                   // planetId -> targetId | null (Tasks queued to avoid overlap)
            lastThreatScan: 0,              // epoch of previous threat modeling
            threatMap: {},                  // planetId -> estimated max incoming (scaled by dt)
            valueMap: {},                   // planetId -> custom planetValue
            frontier: [],                   // planets we consider valid expansion targets
            rallyPlanets: new Set(),        // planets under major attack to receive focus
            phaseOverride: null             // 'EARLY' | 'MID' | 'LATE' | null
        };
    }

    makeDecision(dt) {
        if (this.memory.actionCooldown > 0) {
            this.memory.actionCooldown -= dt;
            return null;
        }

        const myPlanets = this.api.getMyPlanets();
        if (!myPlanets.length) return null;

        // refresh long-eval once every 0.4–0.6s (jitter to space scans)
        const step = Math.max(0.4, this.api.getDecisionCooldown() * 0.9);
        if (this.memory.lastThreatScan + step < this.api.getElapsedTime()) {
            this._populateMaps();
            this.memory.lastThreatScan = this.api.getElapsedTime();
        }

        // determine macro phase (EARLY 0-60s, MID 60-200s, LATE beyond)
        const gamePhase = this.memory.phaseOverride || this.api.getGamePhase();

        // high-value decisions ordered by priority
        let decision = null;

        // 1. If future collapse of my planet detected, attempt parity discharge
        if (!decision) decision = this._handleImminentCollapse();

        // 2. Priority defense (return troops available on  nearby allies to shortest arrival)
        if (!decision) decision = this._doEmergencyReinforce();

        // 3. Targeted expansion greedy grab under current value model
        if (!decision) decision = this._pickBestExpansion(gamePhase);

        // 4. If lots of idle troops around, laser a weak enemy
        if (!decision) decision = this._surgicalStrike();

        // 5. Final escalation: avalanche (dump everything at closest enemy capital)
        if (!decision && gamePhase === 'LATE' && this.api.getMyStrengthRatio() > 0.6) {
            decision = this._avalanche();
        }

        // store chosen mission to avoid multiple contributions
        if (decision) {
            this.memory.missions[decision.fromId] = decision.toId;
            this.memory.actionCooldown = this.api.getDecisionCooldown();
        }
        return decision;
    }

// -------------------------------------------------------------------------------
// ❇️ Internal utility layer
// -------------------------------------------------------------------------------
    _populateMaps() {
        const allPlanets = this.api.getAllPlanets();
        const threats = new Map();  // planetId -> incoming enemy troops
        const values = new Map();

        for (const p of allPlanets) {
            // threats: incoming attacks only (ignoring neutral fleets)
            let threat = 0;
            const incomings = this.api.getIncomingAttacks(p);
            for (const fleet of incomings) {
                if (fleet.owner !== this.playerId && fleet.to.id === p.id) {
                    threat += fleet.amount;
                }
            }
            threats.set(p.id, threat);

            // value: weighted by production, closeness to opponents, size
            let v = this.api.calculatePlanetValue(p);
            // slight bonus for centrality mid-game
            if (this.api.getGamePhase() !== 'EARLY') {
                v *= (1 + 0.4 * this.api.getPlanetCentrality(p));
            }
            // skip saturated planets entirely
            v *= (p.owner !== this.playerId || p.troops < 950) ? 1 : 0;
            values.set(p.id, v);
        }

        this.memory.threatMap = threats;
        this.memory.valueMap = values;

        const frontier = allPlanets.filter(p =>
            (p.owner !== this.playerId) &&
            (p.owner === 'neutral' || !this.api.isPlayerActive(p.owner))
        ).sort((a,b) => values.get(b.id) - values.get(a.id));
        this.memory.frontier = frontier.map(p => p.id);
    }

// -------------------------------------------------------------------------------
    _handleImminentCollapse() {
        for (const p of this.api.getMyPlanets()) {
            const predicted = this.api.predictPlanetState(p, 1.6);
            if (predicted.owner !== this.playerId) {
                const alliesNearby = this.api.getMyPlanets()
                    .filter(other => other.id !== p.id)
                    .sort((a,b) => this.api.getDistance(a,p) - this.api.getDistance(b,p));

                const need = p.troops + (this.memory.threatMap[p.id] || 0) + 5;
                for (const ally of alliesNearby.slice(0,3)) {
                    if (ally.troops > need * 0.9) {
                        return {
                            fromId: ally.id,
                            toId: p.id,
                            troops: Math.floor(Math.min(ally.troops - 5, need))
                        };
                    }
                }
            }
        }
        return null;
    }

// -------------------------------------------------------------------------------
    _doEmergencyReinforce() {
        // modeled on _handleImminentCollapse but dynamic against active fleets
        // return here is too close variation, we merge with collapse above
        return null;
    }

// -------------------------------------------------------------------------------
    _pickBestExpansion(phase) {
        const myPlanets = this.api.getMyPlanets();
        // allow multi-send on same planet only if troops > 30 * sendCount
        const assignedPlanets = new Set(Object.values(this.memory.missions));
        let orderedFrontier = this.memory.frontier.filter(id => !assignedPlanets.has(id))
            .map(id => this.api.getPlanetById(id));

        for (const planet of orderedFrontier) {
            const attackers = myPlanets
                .sort((a,b) => this.api.getDistance(a, planet) - this.api.getDistance(b, planet))
                .slice(0,2);

            // require larger safety margins early to avoid over-stretch
            const safety = phase === 'EARLY' ? 5 : 3;
            const timeout = this.api.getTravelTime(attackers[0], planet) + 1.0;
            const required = Math.floor(this.api.predictPlanetState(planet, timeout).troops + safety);
            let totalAvail = attackers.reduce((acc,src) => acc + (src.troops - 10), 0);

            if (totalAvail > required && required > 0) {
                return {
                    fromId: attackers[0].id,
                    toId: planet.id,
                    troops: Math.min(attackers[0].troops - 5, Math.ceil(required * 1.1))
                };
            }
        }
        return null;
    }

// -------------------------------------------------------------------------------
    _surgicalStrike() {
        const enemies = this.api.getEnemyPlanets()
              .sort((a, b) => a.troops - b.troops);

        for (const target of enemies) {
            const hub = this.api.findNearestPlanet(target, this.api.getMyPlanets());
            if (!hub) continue;

            const sendTime = this.api.getTravelTime(hub, target);
            const afterAttack = this.api.predictPlanetState(target, sendTime);
            const needed = afterAttack.troops + 2;
            if (hub.troops > needed * 1.2 && target.troops < hub.troops * 0.4) {
                return {
                    fromId: hub.id,
                    toId: target.id,
                    troops: Math.floor(needed + 2)
                };
            }
        }
        return null;
    }

// -------------------------------------------------------------------------------
    // FINAL STAGE: aggregate power and accelerate to hail-mary strike
    _avalanche() {
        // choose biggest enemy cluster centroid
        const enemyPlanets = this.api.getEnemyPlanets();
        if (!enemyPlanets.length) return null;

        const targetsByDist = enemyPlanets
              .sort((a,b) => {
                  const distA = this.api.getDistance(a, {x:0,y:0});
                  const distB = this.api.getDistance(b, {x:0,y:0});
                  return distA - distB;
              });

        const target = targetsByDist[0]; // pick closest centroid
        const powerBase = this.api.getMyPlanets()
              .filter(p => !this.memory.missions[p.id])
              .sort((a,b) => b.troops - a.troops)[0];

        if (powerBase && powerBase.troops >= 60) {
            return {
                fromId: powerBase.id,
                toId: target.id,
                troops: Math.floor(powerBase.troops * 0.8)
            };
        }
        return null;
    }
}