// assets/javascript/AI/AIUtilities.js

// Function to calculate distance between two planets
export function calculateDistance(planet1, planet2) {
    const dx = planet2.x - planet1.x;
    const dy = planet2.y - planet1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Function to get all planets owned by a specific player
export function getPlanetsOwnedBy(game, playerId) {
    return game.planets.filter(planet => planet.owner === playerId);
}