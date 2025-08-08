import BaseBot from './BaseBot.js';

/**

MistralSmall32-24B: A strategic, adaptive AI bot for galactic conquest.

Strategic Pillars:

Phased Strategy: Adapt behavior based on game phase (early, mid, late)
Risk Assessment: Balance expansion with defense based on threat analysis
Value Targeting: Prioritize high-value planets with strategic importance
Resource Management: Optimize troop allocations to maximize efficiency
*/
export default class MistralSmall32 extends BaseBot {
constructor(api, playerId) {
super(api, playerId);
// Initialize memory with additional strategic tracking
this.memory.trackedPlanets = new Set();
this.memory.attackTargets = [];
this.memory.defensePriorities = [];
this.memory.strategyPhase = 'EXPLORATION';
}
makeDecision(dt) {
// Update game phase based on elapsed time
this.updateGamePhase();


 // Update memory based on current state
 this.updateMemory();

 // Get current planets and game state
 const myPlanets = this.api.getMyPlanets();
 const enemyPlanets = this.api.getEnemyPlanets();
 const neutralPlanets = this.api.getNeutralPlanets();
 const allPlanets = this.api.getAllPlanets();
 const gamePhase = this.api.getGamePhase();
 const timeLeft = this.api.getGameDuration() - this.api.getElapsedTime();

 // If we have no planets, we can't do anything
 if (myPlanets.length === 0) {
     return null;
 }

 // Base defense - defend against imminent attacks
 const defenseAction = this.planDefenses(myPlanets);
 if (defenseAction) {
     return defenseAction;
 }

 // Strategy based on game phase
 switch (this.memory.strategyPhase) {
     case 'EXPLORATION':
         return this.explorationStrategy(myPlanets, neutralPlanets);
     case 'EXPANSION':
         return this.expansionStrategy(myPlanets, neutralPlanets, enemyPlanets);
     case 'LATE_EXPANSION':
         return this.lateExpansionStrategy(myPlanets, enemyPlanets);
     case 'CONSOLIDATION':
         return this.consolidationStrategy(myPlanets, enemyPlanets);
     default:
         return this.explorationStrategy(myPlanets, neutralPlanets);
 }
}

updateGamePhase() {
const elapsedTime = this.api.getElapsedTime();
const gameDuration = this.api.getGameDuration();


 if (elapsedTime < gameDuration * 0.3) {
     this.memory.strategyPhase = 'EXPLORATION';
 } else if (elapsedTime < gameDuration * 0.6) {
     this.memory.strategyPhase = 'EXPANSION';
 } else if (elapsedTime < gameDuration * 0.8) {
     this.memory.strategyPhase = 'LATE_EXPANSION';
 } else {
     this.memory.strategyPhase = 'CONSOLIDATION';
 }
}

updateMemory() {
// Clear old targets and priorities
this.memory.attackTargets = [];
this.memory.defensePriorities = [];


 // Track all planets we haven't analyzed yet
 this.memory.trackedPlanets = new Set(this.api.getAllPlanets().map(p => p.id));

 // Re-evaluate all enemy planets as potential targets
 const enemyPlanets = this.api.getEnemyPlanets();
 enemyPlanets.forEach(planet => {
     this.memory.attackTargets.push(planet);
 });

 // Re-evaluate all neutral planets as potential targets
 const neutralPlanets = this.api.getNeutralPlanets();
 neutralPlanets.forEach(planet => {
     this.memory.attackTargets.push(planet);
 });

 // Sort attack targets by strategic value
 this.memory.attackTargets.sort((a, b) => {
     const aValue = this.api.calculatePlanetValue(a);
     const bValue = this.api.calculatePlanetValue(b);
     return bValue - aValue;
 });

 // Evaluate defense priorities
 const myPlanets = this.api.getMyPlanets();
 myPlanets.forEach(planet => {
     this.memory.defensePriorities.push({
         planet,
         priority: this.api.calculateThreat(planet)
     });
 });

 // Sort defense priorities by threat level
 this.memory.defensePriorities.sort((a, b) => b.priority - a.priority);
}

planDefenses(myPlanets) {
// Check for immediate threats to our planets
for (const defense of this.memory.defensePriorities) {
const planet = defense.planet;
const incomingAttacks = this.api.getIncomingAttacks(planet);


     if (incomingAttacks.length === 0) continue;

     // Calculate the most imminent attack
     const imminentAttack = incomingAttacks.reduce((prev, curr) =>
         curr.duration < prev.duration ? curr : prev
     );

     // Predict planet state when attack arrives
     const predictedState = this.api.predictPlanetState(planet, imminentAttack.duration);

     // If we'll lose the planet without reinforcement, send reinforcements
     if (predictedState.troops < 1) {
         // Calculate how many troops we need to reinforce
         const neededTroops = Math.ceil(imminentAttack.amount * 1.1) - predictedState.troops;

         // Find the closest friendly planet that can send reinforcements
         const closestReinforcement = this.api.findNearestPlanet(
             planet,
             myPlanets.filter(p => p.id !== planet.id && p.troops >= neededTroops)
         );

         if (closestReinforcement) {
             this.log(`Defending ${planet.id} against attack from ${imminentAttack.from.id}. Sending ${neededTroops} troops.`);

             // Send slightly more than needed to account for possible production changes
             const troopsToSend = Math.min(neededTroops * 1.2, closestReinforcement.troops - 10);
             return {
                 from: closestReinforcement,
                 to: planet,
                 troops: Math.floor(troopsToSend)
             };
         }
     }
 }

 return null;
}

explorationStrategy(myPlanets, neutralPlanets) {
// In exploration phase, focus on securing nearby neutral planets
const targetPlanets = neutralPlanets.filter(planet => {
// Only consider neutral planets we can reach
const sourcePlanet = this.api.findNearestPlanet(planet, myPlanets);
return sourcePlanet !== null;
});


 // Sort by value and distance
 targetPlanets.sort((a, b) => {
     const aValue = this.api.calculatePlanetValue(a);
     const bValue = this.api.calculatePlanetValue(b);
     const aDistance = this.api.getDistance(
         this.api.findNearestPlanet(a, myPlanets),
         a
     );
     const bDistance = this.api.getDistance(
         this.api.findNearestPlanet(b, myPlanets),
         b
     );

     // Prioritize by value first, then distance
     return (bValue - aValue) || (aDistance - bDistance);
 });

 // Find the strongest planet that can expand
 const expansionPlanets = myPlanets.filter(planet => planet.troops > 30);
 const sourcePlanet = expansionPlanets.sort((a, b) => b.troops - a.troops)[0];

 if (sourcePlanet && targetPlanets.length > 0) {
     const targetPlanet = targetPlanets[0];

     // Calculate optimal troop count based on target and travel time
     const travelTime = this.api.getTravelTime(sourcePlanet, targetPlanet);
     const predictedDefenders = this.api.predictPlanetState(targetPlanet, travelTime).troops;
     const troopsToSend = Math.ceil(predictedDefenders * 1.2) + 1;

     if (sourcePlanet.troops > troopsToSend + 10) {
         this.log(`Exploring with ${troopsToSend} troops from ${sourcePlanet.id} to ${targetPlanet.id}`);
         return {
             from: sourcePlanet,
             to: targetPlanet,
             troops: troopsToSend
         };
     }
 }

 return null;
}

expansionStrategy(myPlanets, neutralPlanets, enemyPlanets) {
// In expansion phase, focus on both neutral and weak enemy planets
const myTotalTroops = this.api.getMyTotalTroops();
const otherPlayers = this.api.getOpponentIds();


 // If we're significantly stronger, consider more aggressive tactics
 const myStrength = this.api.getMyStrengthRatio();
 let targetPlanets = [...neutralPlanets, ...enemyPlanets];

 // Sort targets by strategic value and proximity
 targetPlanets.sort((a, b) => {
     const aValue = this.api.calculatePlanetValue(a) * (a.owner === 'neutral' ? 1.5 : (a.troops < 100 ? 1.2 : 1.0));
     const bValue = this.api.calculatePlanetValue(b) * (b.owner === 'neutral' ? 1.5 : (b.troops < 100 ? 1.2 : 1.0));
     const aDistance = this.api.getDistance(
         this.api.findNearestPlanet(a, myPlanets),
         a
     );
     const bDistance = this.api.getDistance(
         this.api.findNearestPlanet(b, myPlanets),
         b
     );

     return (bValue - aValue) || (aDistance - bDistance);
 });

 // Find suitable source planets based on target priorities
 for (const target of targetPlanets) {
     const sourcePlanet = this.api.findNearestPlanet(target, myPlanets);

     if (!sourcePlanet) continue;

     // Calculate optimal troop count based on target and travel time
     const travelTime = this.api.getTravelTime(sourcePlanet, target);
     const predictedDefenders = this.api.predictPlanetState(target, travelTime).troops;
     const troopsToSend = Math.ceil(predictedDefenders * 1.2) + 1;

     if (sourcePlanet.troops > troopsToSend + 10) {
         // If we're stronger, sometimes aggressively target enemy planets
         if (myStrength > 1.3 && target.owner !== 'neutral' && target.troops < 150) {
             this.log(`Aggressive expansion with ${troopsToSend} troops from ${sourcePlanet.id} to ${target.id}`);
             return {
                 from: sourcePlanet,
                 to: target,
                 troops: troopsToSend
             };
         }
         // Regular expansion
         this.log(`Expanding with ${troopsToSend} troops from ${sourcePlanet.id} to ${target.id}`);
         return {
             from: sourcePlanet,
             to: target,
             troops: troopsToSend
         };
     }
 }

 // If no immediate expansion opportunities, fall back to sending minimal forces to growth areas
 // This code would be added here, but omitted for brevity

 return null;
}

lateExpansionStrategy(myPlanets, enemyPlanets) {
// In late expansion, focus on strong enemy planets and strategic positions
const timeLeft = this.api.getGameDuration() - this.api.getElapsedTime();
const myTotalTroops = this.api.getMyTotalTroops();
const otherPlayers = this.api.getOpponentIds();
const myStrength = this.api.getMyStrengthRatio();


 // If we're losing badly, switch to a last-ditch defense approach
 if (myStrength < 0.5 && timeLeft < 60) {
     return this.consolidationStrategy(myPlanets, enemyPlanets);
 }

 // Sort enemy planets by value and also by centrality (position on map)
 const targetPlanets = enemyPlanets.slice().sort((a, b) => {
     const aValue = this.api.calculatePlanetValue(a) * (a.troops < 150 ? 2 : 1);
     const bValue = this.api.calculatePlanetValue(b) * (b.troops < 150 ? 2 : 1);
     const aCentrality = this.api.calculateCentrality(a);
     const bCentrality = this.api.calculateCentrality(b);

     return (bValue - aValue) || (bCentrality - aCentrality);
 });

 // Try to find a source planet that can take a high-risk target
 for (const target of targetPlanets) {
     const sourcePlanet = this.api.findNearestPlanet(target, myPlanets);

     if (!sourcePlanet) continue;

     // Calculate optimal troop count based on target and travel time
     const travelTime = this.api.getTravelTime(sourcePlanet, target);
     const predictedDefenders = this.api.predictPlanetState(target, travelTime).troops;
     const troopsToSend = Math.ceil(predictedDefenders * 1.2) + 1;

     // If we have a significant strength advantage or the planet is weakly defended
     if ((myStrength > 1.3 || predictedDefenders < 100) &&
         sourcePlanet.troops > troopsToSend + 10) {

         this.log(`Late stage strike with ${troopsToSend} troops from ${sourcePlanet.id} to ${target.id}`);
         return {
             from: sourcePlanet,
             to: target,
             troops: troopsToSend
         };
     }
 }

 // If no immediate targets, consider consolidating positions
 return this.consolidationStrategy(myPlanets, enemyPlanets);
}

consolidationStrategy(myPlanets, enemyPlanets) {
// In consolidation phase, focus on defending strong positions and picking off weakened enemies
const timeLeft = this.api.getGameDuration() - this.api.getElapsedTime();
const myTotalTroops = this.api.getMyTotalTroops();
const otherPlayers = this.api.getOpponentIds();
const myStrength = this.api.getMyStrengthRatio();


 // If time is very short, focus on overwhelming the strongest enemy with everything
 if (timeLeft < 15) {
     const strongestEnemy = otherPlayers.reduce((strongest, playerId) => {
         const playerTroops = this.api.getPlayerTotalTroops(playerId);
         return playerTroops > this.api.getPlayerTotalTroops(strongest) ? playerId : strongest;
     }, otherPlayers[0] || '');

     if (strongestEnemy) {
         const enemyPlanet = this.api.getEnemyPlanets().sort((a, b) => b.troops - a.troops)[0];
         if (enemyPlanet) {
             const sourcePlanet = myPlanets.sort((a, b) => b.troops - a.troops)[0];

             if (sourcePlanet && sourcePlanet.troops > 50) {
                 this.log(`Final push with all troops from ${sourcePlanet.id} to ${enemyPlanet.id}`);
                 return {
                     from: sourcePlanet,
                     to: enemyPlanet,
                     troops: Math.max(1, sourcePlanet.troops - 10)
                 };
             }
         }
     }
 }

 // Otherwise, focus on maintaining strong positions and picking off vulnerable enemies
 const targetPlanets = enemyPlanets.filter(p => p.troops < 100).sort((a, b) => {
     const aValue = this.api.calculatePlanetValue(a);
     const bValue = this.api.calculatePlanetValue(b);
     return bValue - aValue;
 });

 for (const target of targetPlanets) {
     const sourcePlanet = this.api.findNearestPlanet(target, myPlanets);

     if (!sourcePlanet) continue;

     const travelTime = this.api.getTravelTime(sourcePlanet, target);
     const predictedDefenders = this.api.predictPlanetState(target, travelTime).troops;
     const troopsToSend = Math.ceil(predictedDefenders * 1.2) + 1;

     if (sourcePlanet.troops > troopsToSend + 10) {
         this.log(`Final consolidation attack with ${troopsToSend} troops from ${sourcePlanet.id} to ${target.id}`);
         return {
             from: sourcePlanet,
             to: target,
             troops: troopsToSend
         };
     }
 }

 return null;
}
}