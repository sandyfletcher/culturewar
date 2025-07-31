// menus/StandingsBuilder.js

import MenuBuilderBase from '../MenuBuilderBase.js';

class StandingsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }

    build() {
        const menuContainer = this.createMenuContainer();
        
        const content = document.createElement('div');
        content.className = 'instructions-content';
        content.innerHTML = `
            <h2>STANDINGS</h2>
            <p style="text-align: center; opacity: 0.7; margin-bottom: 1rem;">
                Note: Live stats are a future feature. The data below is for demonstration only.
            </p>
        `;

        const leaderboardHTML = `
            <div class="leaderboard">
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Combatant</th>
                            <th>Win %</th>
                            <th>Avg. Survival</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>1</td><td>CodySpuckler</td><td>71.4%</td><td>4:12</td></tr>
                        <tr><td>2</td><td>MorganSpuckler</td><td>68.9%</td><td>3:58</td></tr>
                        <tr><td>3</td><td>WesleySpuckler</td><td>65.2%</td><td>3:31</td></tr>
                        <tr><td>4</td><td>ZoeSpuckler</td><td>59.8%</td><td>4:25</td></tr>
                        <tr><td>5</td><td>HeatherSpuckler</td><td>55.1%</td><td>3:02</td></tr>
                        <tr><td>6</td><td>TiffanySpuckler</td><td>52.5%</td><td>4:01</td></tr>
                        <tr><td>7</td><td>...</td><td>...</td><td>...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
        
        content.innerHTML += leaderboardHTML;
        menuContainer.appendChild(content);

        // NEW: Set the footer to be a back button.
        window.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        
        return menuContainer;
    }
}

export default StandingsBuilder;