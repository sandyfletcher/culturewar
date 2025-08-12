// ===========================================
// root/javascript/bots/index.js
// ===========================================

// --- Anthropic (USA) ---
import Claude4Sonnet from './Claude4Sonnet.js';
// --- Google (USA) ---
import Gemini25Pro from './Gemini25Pro.js';
import Gemini25ProA from './Gemini25ProA.js';
import Gemini25ProC from './Gemini25ProC.js';
import Gemini25ProD from './Gemini25ProD.js';
import Gemini25ProE from './Gemini25ProE.js';
// --- OpenAI (USA) ---
import CGPT4o from './CGPT4o.js';
// --- TNG Tech (Germany) ---
import DeepSeekR1T2Chimera from './DeepSeekR1T2Chimera.js';
// --- OpenRouter / OpenAI? (USA?) ---
import HorizonBeta from './HorizonBeta.js';
// --- Moonshot AI (China) ---
import KimiDev72b from './KimiDev72b.js';
// --- Unknown (Unknown) ---
import Qwen3Coder from './Qwen3Coder.js';
// --- Mistral AI (France) ---
import MistralSmall32 from './MistralSmall32.js';

const botRegistry = [
    { 
        value: 'C-4-S',
        name: 'Claude 4 Sonnet',
        class: Claude4Sonnet,
        creationDate: 'May 2025',
        description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." 
    },
    { 
        value: 'G2.5P', 
        name: 'Gemini 2.5 Pro', 
        class: Gemini25Pro, 
        creationDate: 'March 2025?', 
        description: 'Operates on a "waterfall" logic model, where it evaluates a strict hierarchy of possible actions each turn. This ensures that critical tasks are always handled first.'
    },
    { 
        value: 'G2.5PA', 
        name: 'Gemini 2.5 Pro A', 
        class: Gemini25ProA, 
        creationDate: 'March 2025', 
        description: 'Employs a balanced, phase-aware strategy that prioritizes robust defense and calculated aggression..'
    },
    { 
        value: 'G2.5PC', 
        name: 'Gemini 2.5 Pro C', 
        class: Gemini25ProC, 
        creationDate: 'March 2025', 
        description: "A balanced bot that adapts its strategy based on the game phase, focusing on efficient expansion, strong defense, and calculated aggression."
    },
    { 
        value: 'G2.5PD', 
        name: 'Gemini 2.5 Pro D', 
        class: Gemini25ProD, 
        creationDate: 'March 2025', 
        description: "Employs an adaptive, three-phase strategy focusing on aggressive expansion, strategic targeting, and intelligent consolidation."
    },
    { 
        value: 'G2.5PE', 
        name: 'Gemini 2.5 Pro E', 
        class: Gemini25ProE, 
        creationDate: 'March 2025', 
        description: "Employs a defense-first, phased strategy that adapts to the game's flow."
    },
    { 
        value: 'GPT-4o', 
        name: 'ChatGPT 4o', 
        class: CGPT4o, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'DSR1T2C', 
        name: 'DeepSeekR1T2Chimera', 
        class: DeepSeekR1T2Chimera, 
        creationDate: 'July 2025', 
        description: 'Strategic AI bot that dynamically balances expansion, defense, and attacks based on game phase, maintaining optimal troop efficiency and threat awareness.' 
    },
    { 
        value: 'HB', 
        name: 'HorizonBeta', 
        class: HorizonBeta, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive, value-driven RTS bot focused on safe expansion, surgical defense, and opportunistic strikes using forward predictions and phased strategy.'
     },
    { 
        value: 'KD72', 
        name: 'KimiDev72b', 
        class: KimiDev72b, 
        creationDate: 'June 2025', 
        description: 'Automatically adjusts to focus on defense when under attack and aggressive expansion when safe.'
     },
    { 
        value: 'Q3C', 
        name: 'Qwen3Coder', 
        class: Qwen3Coder, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
    { 
        value: 'MS32', 
        name: 'MistralSmall32', 
        class: MistralSmall32, 
        creationDate: 'June 2025', 
        description: 'Memory maintains state between decisions, allowing it to execute coordinated strategic plans over multiple turns.'
     },
];

export default botRegistry;