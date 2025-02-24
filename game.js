import DummyAI from './dummyai.js';

class Planet {
    constructor(x, y, size, troops = 0, owner = 'neutral') {
        this.x = x;
        this.y = y;
        this.size = size;
        this.troops = troops;
        this.owner = owner;
        this.productionRate = size / 20; // Larger planets produce more troops
    }
}

class TroopMovement {
    constructor(from, to, amount, owner) {
        this.from = from;
        this.to = to;
        this.amount = amount;
        this.owner = owner;
        this.progress = 0;
        this.startX = from.x;
        this.startY = from.y;
        this.dx = to.x - from.x;
        this.dy = to.y - from.y;
        this.distance = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
        // Adjusted speed calculation based on distance
        this.speed = 150; // pixels per second
        this.duration = this.distance / this.speed; // seconds to reach target
    }

    update(dt) {
        this.progress += dt / this.duration;
        return this.progress >= 1;
    }

    getCurrentPosition() {
        const easedProgress = this.progress; // Can add easing function here if desired
        return {
            x: this.startX + this.dx * easedProgress,
            y: this.startY + this.dy * easedProgress
        };
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.planets = [];
        this.troopMovements = [];
        this.selectedPlanet = null;
        this.timeRemaining = 300; // 5 minutes in seconds
        this.lastUpdate = Date.now();
        this.mousePos = { x: 0, y: 0 };
        this.gameOver = false;
        this.startTime = Date.now();
        
        // Debug log element
        this.debugLog = document.createElement('div');
        this.debugLog.id = 'debug-log';
        this.debugLog.style.position = 'absolute';
        this.debugLog.style.top = '50px';
        this.debugLog.style.left = '10px';
        this.debugLog.style.color = '#fff';
        this.debugLog.style.fontSize = '10px';
        this.debugLog.style.fontFamily = 'monospace';
        this.debugLog.style.textAlign = 'left';
        this.debugLog.style.pointerEvents = 'none'; // Don't interfere with clicks
        document.getElementById('game-screen').appendChild(this.debugLog);
        
        // Initialize AI
        this.ai = new DummyAI(this);

        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        this.generatePlanets();
        this.gameLoop();
        
        console.log("Game initialized");
    }

    // Debug logging function
    log(message) {
        console.log(message);
        this.debugLog.innerHTML += message + '<br>';
        // Keep only the last 10 messages
        const lines = this.debugLog.innerHTML.split('<br>');
        if (lines.length > 10) {
            this.debugLog.innerHTML = lines.slice(lines.length - 10).join('<br>');
        }
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
    }

    generatePlanets() {
        // Player's starting planet
        const playerPlanet = new Planet(
            this.canvas.width * 0.2,
            this.canvas.height * 0.8,
            30,
            30,
            'player'
        );
        this.planets.push(playerPlanet);

        // AI's starting planet
        const aiPlanet = new Planet(
            this.canvas.width * 0.8,
            this.canvas.height * 0.2,
            30,
            30,
            'ai'
        );
        this.planets.push(aiPlanet);

        // Generate neutral planets
        for (let i = 0; i < 8; i++) {
            let attempts = 0;
            let valid = false;
            
            while (!valid && attempts < 100) {
                const size = 15 + Math.random() * 20;
                const x = size + Math.random() * (this.canvas.width - size * 2);
                const y = size + Math.random() * (this.canvas.height - size * 2);
                
                valid = this.isValidPlanetPosition(x, y, size);
                
                if (valid) {
                    this.planets.push(new Planet(x, y, size, 10, 'neutral'));
                    break;
                }
                attempts++;
            }
        }
    }

    isValidPlanetPosition(x, y, size) {
        const minDistance = 80; // Minimum distance between planet centers
        
        for (const planet of this.planets) {
            const dx = x - planet.x;
            const dy = y - planet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < minDistance) {
                return false;
            }
        }
        return true;
    }

    handleClick(e) {
        if (this.gameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedPlanet = this.planets.find(planet => {
            const dx = x - planet.x;
            const dy = y - planet.y;
            return Math.sqrt(dx * dx + dy * dy) < planet.size;
        });

        if (!clickedPlanet) {
            this.selectedPlanet = null;
            return;
        }

        if (this.selectedPlanet && this.selectedPlanet !== clickedPlanet) {
            if (this.selectedPlanet.owner === 'player') {
                const troopsToSend = Math.floor(this.selectedPlanet.troops / 2);
                if (troopsToSend > 0) {
                    this.selectedPlanet.troops -= troopsToSend;
                    this.troopMovements.push(new TroopMovement(
                        this.selectedPlanet,
                        clickedPlanet,
                        troopsToSend,
                        'player'
                    ));
                }
            }
            this.selectedPlanet = null;
        } else if (clickedPlanet.owner === 'player') {
            this.selectedPlanet = clickedPlanet;
        }
    }

    drawTrajectory() {
        if (this.selectedPlanet) {
            // Find planet under mouse cursor
            const targetPlanet = this.planets.find(planet => {
                const dx = this.mousePos.x - planet.x;
                const dy = this.mousePos.y - planet.y;
                return Math.sqrt(dx * dx + dy * dy) < planet.size;
            });

            if (targetPlanet && targetPlanet !== this.selectedPlanet) {
                // Draw trajectory line
                this.ctx.beginPath();
                this.ctx.moveTo(this.selectedPlanet.x, this.selectedPlanet.y);
                this.ctx.lineTo(targetPlanet.x, targetPlanet.y);
                this.ctx.strokeStyle = '#ffffff44'; // Semi-transparent white
                this.ctx.setLineDash([5, 5]); // Dashed line
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
                this.ctx.setLineDash([]); // Reset dash
            }
        }
    }

    // Check if a player has any planets
    hasPlayerPlanets(player) {
        return this.planets.some(planet => planet.owner === player);
    }

    // Check if a player has any troops in movement
    hasPlayerTroopsInMovement(player) {
        return this.troopMovements.some(movement => movement.owner === player);
    }

    // Calculate total troops for any player
    calculateTotalTroops(player) {
        // Sum troops from planets
        const planetTroops = this.planets
            .filter(planet => planet.owner === player)
            .reduce((total, planet) => total + planet.troops, 0);
        
        // Sum troops from movements
        const movementTroops = this.troopMovements
            .filter(movement => movement.owner === player)
            .reduce((total, movement) => total + movement.amount, 0);
        
        return planetTroops + movementTroops;
    }

    // Check win conditions
    checkWinConditions() {
        if (this.gameOver) return false;

        // Check for time victory
        if (this.timeRemaining <= 0) {
            this.log("Time victory triggered");
            // Find player with most troops
            const playerTroops = this.calculateTotalTroops('player');
            const aiTroops = this.calculateTotalTroops('ai');
            
            const winner = playerTroops >= aiTroops ? 'player' : 'ai';
            
            this.endGame(winner, 'time');
            return true;
        }

        // Check for domination victories

        // First check if AI is eliminated
        const aiHasPlanets = this.hasPlayerPlanets('ai');
        const aiHasTroops = this.hasPlayerTroopsInMovement('ai');
        
        if (!aiHasPlanets && !aiHasTroops) {
            this.log("AI eliminated - player wins");
            const timeTaken = (Date.now() - this.startTime) / 1000; // in seconds
            this.endGame('player', 'domination', timeTaken);
            return true;
        }
        
        // Then check if player is eliminated
        const playerHasPlanets = this.hasPlayerPlanets('player');
        const playerHasTroops = this.hasPlayerTroopsInMovement('player');
        
        if (!playerHasPlanets && !playerHasTroops) {
            this.log("Player eliminated - AI wins");
            const timeTaken = (Date.now() - this.startTime) / 1000; // in seconds
            this.endGame('ai', 'domination', timeTaken);
            return true;
        }

        // Log current game state for debugging
        this.log(`Player: ${playerHasPlanets ? 'Has planets' : 'No planets'}, ${playerHasTroops ? 'Has troops in movement' : 'No troops in movement'}`);
        this.log(`AI: ${aiHasPlanets ? 'Has planets' : 'No planets'}, ${aiHasTroops ? 'Has troops in movement' : 'No troops in movement'}`);
        
        return false;
    }

    // End the game and show game over screen
    endGame(winner, victoryType, timeTaken = null) {
        this.log(`Game over! ${winner} wins by ${victoryType}`);
        this.gameOver = true;
        
        // Calculate final stats
        const playerTroops = Math.floor(this.calculateTotalTroops('player'));
        const aiTroops = Math.floor(this.calculateTotalTroops('ai'));
        
        // Create game over screen
        const gameOverScreen = document.createElement('div');
        gameOverScreen.id = 'game-over-screen';
        
        let gameOverHTML = `
            <h1>GAME OVER</h1>
            <h2>${winner.toUpperCase()} WINS!</h2>
            <h3>${victoryType.toUpperCase()} VICTORY</h3>
        `;
        
        if (victoryType === 'domination' && timeTaken) {
            const minutes = Math.floor(timeTaken / 60);
            const seconds = Math.floor(timeTaken % 60);
            gameOverHTML += `<p>Victory achieved in ${minutes}:${seconds.toString().padStart(2, '0')}</p>`;
        }
        
        gameOverHTML += `<h3>FINAL STANDINGS</h3><ul>`;
        
        // Sort by troop count
        const standings = [
            { player: 'player', troops: playerTroops },
            { player: 'ai', troops: aiTroops }
        ].sort((a, b) => b.troops - a.troops);
        
        for (const stat of standings) {
            gameOverHTML += `<li>${stat.player.toUpperCase()}: ${stat.troops} troops</li>`;
        }
        
        gameOverHTML += `</ul><button class="menu-button" id="play-again-button">PLAY AGAIN</button>`;
        
        gameOverScreen.innerHTML = gameOverHTML;
        document.getElementById('game-container').appendChild(gameOverScreen);
        
        // Add event listener to play again button
        document.getElementById('play-again-button').addEventListener('click', () => {
            window.location.reload();
        });
    }

    update() {
        if (this.gameOver) return;

        const now = Date.now();
        const dt = (now - this.lastUpdate) / 1000; // Convert to seconds
        this.lastUpdate = now;

        // Update timer
        this.timeRemaining -= dt;
        
        // Check win conditions - do this before updating anything else
        if (this.checkWinConditions()) {
            return; // Game is over, stop updates
        }

        // Update planet troops
        for (const planet of this.planets) {
            if (planet.owner !== 'neutral') {
                planet.troops = Math.min(999, planet.troops + planet.productionRate * dt);
            }
        }

        // Update troop movements
        for (let i = this.troopMovements.length - 1; i >= 0; i--) {
            const movement = this.troopMovements[i];
            if (movement.update(dt)) {
                // Troops have arrived
                const targetPlanet = movement.to;
                if (targetPlanet.owner === movement.owner) {
                    targetPlanet.troops += movement.amount;
                } else {
                    targetPlanet.troops -= movement.amount;
                    if (targetPlanet.troops < 0) {
                        targetPlanet.owner = movement.owner;
                        targetPlanet.troops = Math.abs(targetPlanet.troops);
                    }
                }
                this.troopMovements.splice(i, 1);
                
                // After troop movements complete, check win conditions again
                this.checkWinConditions();
            }
        }

        // Let AI make a decision if it's not eliminated
        if (this.hasPlayerPlanets('ai') || this.hasPlayerTroopsInMovement('ai')) {
            const aiDecision = this.ai.makeDecision({
                planets: this.planets,
                troopMovements: this.troopMovements
            });

            if (aiDecision) {
                aiDecision.from.troops -= aiDecision.troops;
                this.troopMovements.push(new TroopMovement(
                    aiDecision.from,
                    aiDecision.to,
                    aiDecision.troops,
                    'ai'
                ));
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw trajectory line first (so it's behind everything)
        this.drawTrajectory();

        // Draw planets
        for (const planet of this.planets) {
            this.ctx.beginPath();
            this.ctx.arc(planet.x, planet.y, planet.size, 0, Math.PI * 2);
            this.ctx.strokeStyle = planet.owner === 'player' ? '#ffff00' : 
                                 planet.owner === 'neutral' ? '#ffffff' :
                                 planet.owner === 'ai' ? '#ff0000' : '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            if (planet === this.selectedPlanet) {
                this.ctx.beginPath();
                this.ctx.arc(planet.x, planet.y, planet.size + 5, 0, Math.PI * 2);
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.stroke();
            }

            // Draw troop count
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '14px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(Math.floor(planet.troops), planet.x, planet.y + 5);
        }

        // Draw troop movements
        for (const movement of this.troopMovements) {
            const pos = movement.getCurrentPosition();
            
            // Draw movement trail
            this.ctx.beginPath();
            this.ctx.moveTo(movement.startX, movement.startY);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.strokeStyle = '#ffffff22';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // Draw troops
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = movement.owner === 'player' ? '#ffff00' : '#ff0000';
            this.ctx.fill();

            // Draw troop count
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Courier New';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(movement.amount, pos.x, pos.y - 10);
        }

        // Update timer display
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = Math.floor(this.timeRemaining % 60);
        document.getElementById('timer').textContent = 
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    gameLoop() {
        this.update();
        this.draw();
        if (!this.gameOver) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Initialize game when the Begin button is clicked
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const beginButton = document.getElementById('begin-button');

beginButton.addEventListener('click', () => {
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    new Game();
});