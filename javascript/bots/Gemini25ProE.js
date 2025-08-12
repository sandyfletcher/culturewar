// =============================================
// root/javascript/bots/Gemini25ProE.js
// =============================================

import BaseBot from './BaseBot.js';
/**
GenghisTron: An adaptive, phased-strategy AI that seeks to dominate through predictive warfare and superior resource management.
STRATEGIC PILLARS:
Adaptive Phasing: Employs distinct logic for Early (rapid expansion), Mid (crippling key opponents), and Late (securing victory) game phases.
Predictive Warfare: Leverages predictPlanetState to execute hyper-efficient attacks and defenses, committing the minimum troops necessary for success, thus preserving forces.
Value-Based Targeting: Custom heuristics evaluate targets based on production, strategic location, and defensibility, ensuring every action provides maximum strategic value.
Smart Consolidation: Proactively moves troops from safe, high-capacity planets to critical front-line positions, preventing wasted production and maintaining constant pressure.
*/
export default class Gemini25ProE extends BaseBot {
constructor(api, playerId) {
super(api, playerId);
// memory is a persistent object available throughout the game.
this.memory.actionCooldown = 0;
// Tracks { targetId: sourceId } for active missions to prevent redundant actions.
this.memory.missions = {};
}
/**
This method is called by the game engine when it's your turn.
@param {number} dt - The time elapsed since the last turn, scaled by game speed.
@returns {object|null} A decision object or null to take no action.
*/
makeDecision(dt) {
// Prevent constant re-evaluation when we know we can't act.
if (this.memory.actionCooldown > 0) {
this.memory.actionCooldown -= dt;
return null;
}
const myPlanets = this.api.getMyPlanets();
if (myPlanets.length === 0) {
return null; // Game over for us, no actions to take.
}
this.cleanupMissions(myPlanets);
const enemyPlanets = this.api.getEnemyPlanets();
const neutralPlanets = this.api.getNeutralPlanets();
// The Master Plan: A hierarchy of decisions from most to least critical.
let move = null;
// Priority 1: Prevent waste. If a planet is about to hit the 999 troop cap, move troops away.
move = this.findOverloadRelief(myPlanets);
if (move) return this.executeMove(move);
// Priority 2: Defend. Protect our planets from imminent, predicted threats.
move = this.findDefensiveMove(myPlanets);
if (move) return this.executeMove(move);
// Priority 3: Attack/Expand based on game phase.
const gamePhase = this.api.getGamePhase();
if (gamePhase === 'EARLY') {
move = this.findExpansionMove(myPlanets, neutralPlanets);
} else { // Mid and Late game logic is combined into a general aggressive stance.
move = this.findOffensiveMove(myPlanets, enemyPlanets, neutralPlanets);
}
if (move) return this.executeMove(move);
// Priority 4: Consolidate. If no urgent actions, improve our troop positions.
move = this.findConsolidationMove(myPlanets, enemyPlanets);
if (move) return this.executeMove(move);
// No valid moves found this turn.
return null;
}
// --- Core Action & State Management ---
/** A helper to finalize a decision, set the cooldown, and update mission logs. */
executeMove(move) {
// If the move is an attack, log it so we don't target the same planet again.
if (move.type === 'attack') {
this.memory.missions[move.toId] = move.fromId;
}
this.memory.actionCooldown = this.api.getDecisionCooldown();
// Return the move in the format required by the game engine.
return { fromId: move.fromId, toId: move.toId, troops: move.troops };
}
/** Prunes completed or aborted missions from memory. */
cleanupMissions(myPlanets) {
const newMissions = {};
const myPlanetIds = new Set(myPlanets.map(p => p.id));
const planetMap = new Map(this.api.getAllPlanets().map(p => [p.id, p]));
for (const targetId in this.memory.missions) {
     const sourceId = this.memory.missions[targetId];
     const targetPlanet = planetMap.get(targetId);
     // Keep a mission if: I still own the source AND the target is not yet mine AND the target planet still exists.
     if (myPlanetIds.has(sourceId) && targetPlanet && targetPlanet.owner !== this.playerId) {
         newMissions[targetId] = sourceId;
     }
 }
 this.memory.missions = newMissions;
}
// --- STRATEGIC MODULES (HIERARCHICAL) ---
/** Priority 1: Prevents wasting production by moving troops from planets near the 999 cap. */
findOverloadRelief(myPlanets) {
const overloadedPlanets = myPlanets.filter(p => p.troops > 950);
if (overloadedPlanets.length === 0) return null;
const source = overloadedPlanets.sort((a,b) => b.troops - a.troops)[0];
 // Find the nearest friendly planet that isn't also overloaded to receive the troops.
 const potentialTargets = myPlanets.filter(p => p.id !== source.id && p.troops < 800);
 if (potentialTargets.length === 0) return null; // Nowhere to send
 
 const target = this.api.findNearestPlanet(source, potentialTargets);
 const troopsToSend = Math.floor(source.troops - 700); // Send a significant chunk.
 
 return { fromId: source.id, toId: target.id, troops: troopsToSend, type: 'consolidation' };
}
/** Priority 2: Finds and executes the most critical defensive maneuver using prediction. */
findDefensiveMove(myPlanets) {
let mostCriticalThreat = null;
for (const myPlanet of myPlanets) {
     const incomingAttacks = this.api.getIncomingAttacks(myPlanet);
     if (incomingAttacks.length === 0) continue;

     const earliestAttack = incomingAttacks.sort((a, b) => a.duration - b.duration)[0];
     const arrivalTime = earliestAttack.duration;

     const predictedState = this.api.predictPlanetState(myPlanet, arrivalTime);
     
     // If we are predicted to lose the planet
     if (predictedState.owner !== this.playerId) {
         const troopsNeeded = Math.ceil(predictedState.troops) + 2;
         const threat = {
             planetToDefend: myPlanet,
             troopsNeeded: troopsNeeded,
             urgency: 1 / arrivalTime // Closer attacks are more urgent.
         };
         
         if (!mostCriticalThreat || threat.urgency > mostCriticalThreat.urgency) {
             mostCriticalThreat = threat;
         }
     }
 }

 if (mostCriticalThreat) {
     const { planetToDefend, troopsNeeded } = mostCriticalThreat;
     // Find the best reinforcement source: a nearby planet that has enough troops and is not under threat itself.
     const potentialReinforcers = myPlanets.filter(p => p.id !== planetToDefend.id && p.troops > troopsNeeded)
         .sort((a, b) => this.api.getTravelTime(a, planetToDefend) - this.api.getTravelTime(b, planetToDefend));

     if (potentialReinforcers.length > 0) {
         const reinforcer = potentialReinforcers[0];
         return { fromId: reinforcer.id, toId: planetToDefend.id, troops: troopsNeeded, type: 'defense' };
     }
 }

 return null;
}
/** Priority 3 (Early Game): Rapidly captures valuable, untargeted neutral planets. */
findExpansionMove(myPlanets, neutralPlanets) {
const availableNeutrals = neutralPlanets.filter(p => !this.memory.missions[p.id]);
if (availableNeutrals.length === 0) return null;
const availableAttackers = myPlanets.filter(p => p.troops > 15 && !Object.values(this.memory.missions).includes(p.id));
 if (availableAttackers.length === 0) return null;

 let bestAttack = null;

 for (const source of availableAttackers) {
     for (const target of availableNeutrals) {
         const troopsNeeded = Math.ceil(target.troops) + 2;
         if (source.troops > troopsNeeded) {
             const travelTime = this.api.getTravelTime(source, target);
             // Score: higher value and lower travel time is better.
             const value = this.api.calculatePlanetValue(target);
             const score = value / (travelTime * troopsNeeded);

             if (!bestAttack || score > bestAttack.score) {
                 bestAttack = { fromId: source.id, toId: target.id, troops: troopsNeeded, score: score, type: 'attack' };
             }
         }
     }
 }
 return bestAttack;
}
/** Priority 3 (Mid/Late Game): Finds the best offensive move against enemies or high-value neutrals. */
findOffensiveMove(myPlanets, enemyPlanets, neutralPlanets) {
const targets = [...enemyPlanets, ...neutralPlanets.filter(p => p.size > 0)]
.filter(p => !this.memory.missions[p.id]);
if (targets.length === 0) return null;

 const availableAttackers = myPlanets
     .filter(p => !Object.values(this.memory.missions).includes(p.id))
     .sort((a, b) => b.troops - a.troops);
 
 if (availableAttackers.length === 0) return null;

 let bestAttack = null;

 // Check from our strongest planets to find the best possible attack.
 for (const source of availableAttackers.slice(0, 5)) {
     if (source.troops < 40) continue; // Don't attack from very weak planets.

     for (const target of targets) {
         const travelTime = this.api.getTravelTime(source, target);
         const predictedState = this.api.predictPlanetState(target, travelTime);
         
         if (predictedState.owner === this.playerId) continue;

         // Calculate troops needed with a safety buffer, larger for defended enemy planets.
         const troopsNeeded = (target.owner === 'neutral')
             ? Math.ceil(predictedState.troops) + 2
             : Math.ceil(predictedState.troops) + Math.floor(predictedState.troops * 0.1) + 2;
         
         // Only send a portion of troops to leave a defense force.
         const troopsAvailable = Math.floor(source.troops * 0.8);
         if (troopsAvailable > troopsNeeded) {
             // Score prioritizes valuable enemy planets.
             const value = this.api.calculatePlanetValue(target) * (target.owner !== 'neutral' ? 1.5 : 1);
             const score = value / (travelTime * troopsNeeded);
             
             if (!bestAttack || score > bestAttack.score) {
                 bestAttack = { fromId: source.id, toId: target.id, troops: troopsNeeded, score: score, type: 'attack' };
             }
         }
     }
 }
 return bestAttack;
}
/** Priority 4: Moves troops from safe back-line planets to more threatened front-line planets. */
findConsolidationMove(myPlanets, enemyPlanets) {
if (myPlanets.length < 2 || enemyPlanets.length === 0) return null;
// Find the "center of mass" of the enemy empire to define the front.
 const enemyCenter = enemyPlanets.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
 enemyCenter.x /= enemyPlanets.length;
 enemyCenter.y /= enemyPlanets.length;
 
 const distanceToEnemyCenter = (p) => Math.hypot(p.x - enemyCenter.x, p.y - enemyCenter.y);

 const sortedMyPlanets = [...myPlanets].sort((a, b) => distanceToEnemyCenter(a) - distanceToEnemyCenter(b));
 
 const frontLinePlanet = sortedMyPlanets[0];
 const backLinePlanet = sortedMyPlanets[sortedMyPlanets.length - 1];

 // If our safest planet has a large surplus and our front-line is weak, consolidate.
 if (backLinePlanet.troops > 150 && frontLinePlanet.troops < 100 && backLinePlanet.id !== frontLinePlanet.id) {
     // Don't send troops to a front-line planet that we are already sending troops to.
     if(this.memory.missions[frontLinePlanet.id]) return null;

     const troopsToSend = Math.floor(backLinePlanet.troops * 0.5);
     return { fromId: backLinePlanet.id, toId: frontLinePlanet.id, troops: troopsToSend, type: 'consolidation' };
 }
 
 return null;
}
}