// menus/CombatantsBuilder.js

import MenuBuilderBase from '../MenuBuilderBase.js';
import botRegistry from '../bots/index.js';

export default class CombatantsBuilder extends MenuBuilderBase {
    constructor(parentBuilder, container, screenManager, configManager) {
        super(container, screenManager, configManager);
        this.parentBuilder = parentBuilder;
    }
    build() {
        const menuContainer = this.createMenuContainer();
        const content = document.createElement('div');
        content.className = 'instructions-content'; // Reuse for similar styling
        content.innerHTML = `<h2>COMBATANTS</h2>`;
        const combatantsList = document.createElement('div');
        combatantsList.className = 'combatants-list';
        botRegistry.forEach(bot => {
            const entry = document.createElement('div');
            entry.className = 'combatant-entry';
            const name = document.createElement('h3');
            name.className = 'combatant-name';
            name.textContent = bot.name;
            const card = document.createElement('div');
            card.className = 'combatant-card';
            card.style.display = 'none'; // Initially hidden
            card.innerHTML = `
                <h4>${bot.name}</h4>
                <p><strong>Commissioned:</strong> ${bot.creationDate}</p>
                <p class="blurb">${bot.description}</p>
            `;
            name.addEventListener('click', () => {
                const isHidden = card.style.display === 'none';
                card.style.display = isHidden ? 'block' : 'none';
                entry.classList.toggle('active', isHidden);
            });
            entry.appendChild(name);
            entry.appendChild(card);
            combatantsList.appendChild(entry);
        });
        content.appendChild(combatantsList);
        menuContainer.appendChild(content);
        window.menuManager.footerManager.showBackButton(() => {
            this.parentBuilder.buildMainMenu();
        });
        return menuContainer;
    }
}