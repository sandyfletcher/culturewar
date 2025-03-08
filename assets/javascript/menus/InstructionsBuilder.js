import MenuBuilderBase from '../MenuBuilderBase.js';

class InstructionsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    
    build() {
        const menuContainer = this.createMenuContainer();
        
        // Instructions content
        const content = document.createElement('div');
        content.className = 'instructions-content';
        content.innerHTML = `
            <h2>INSTRUCTIONS</h2>
            <div class="instructions-section">
                <h3>OBJECTIVE</h3>
                <p>Conquer all enemy planets, or be in a dominant position to do so when the clock runs out.</p>
                <h3>CONTROLS</h3>
                <ul>
                    <li><strong>Click Starting Planet:</strong> Select a planet you control to send troops from</li>
                    <li><strong>Click Target Planet:</strong> Select a planet to send troops to</li>
                </ul>
                <p>If troops are sent to an allied planet, they'll add to the total troops there.  If they're sent to an enemy planet, they'll trade evenly and take over if they outnumber the defender</p>
                <p>A few advanced controls:</p>
                <ul>
                    <li><strong>Box:</strong> Click and drag to create a box - any planets you control touching the box will be selected</li>
                    <li><strong>Double-Click:</strong> Double-click a planet you control to select all planets you control</li>
                    <li><strong>Right-Click:</strong> Cancel current troop selection (can also left-click any blank space)</li>
                </ul>
                <h3>GAMEPLAY</h3>
                <p>Neutral planets have a set number of troops, but player-controlled planets generate new troops continuously relative to their size.</p>
                <p>When the clock runs out, the winner is the player who controls the most planets - tiebreaker is how many troops they control</p>
                <p>Keep an eye on the top bar for live troop updates and time left in the game</p>
            </div>
        `;

        // Back button
        const backButton = this.getBackButton(() => this.parentBuilder.buildMainMenu());
        
        menuContainer.appendChild(content);
        menuContainer.appendChild(backButton);
        
        return menuContainer;
    }
}

export default InstructionsBuilder;