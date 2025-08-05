// ===========================================
// root/javascript/bots/index.js
// ===========================================

// --- Anthropic (USA) ---
import Claude35Sonnet from './Claude35Sonnet.js';
import Claude37Sonnet from './Claude37Sonnet.js';
import Claude4Sonnet from './Claude4Sonnet.js';
// --- Google (USA) ---
import Gemini20 from './Gemini20.js';
import Gemini25Pro from './Gemini25Pro.js';
// --- OpenAI (USA) ---
import CGPT4o from './CGPT4o.js';
// --- TNG Tech (Germany) ---
import DeepSeekR1T2Chimera from './DeepSeekR1T2Chimera.js';
// --- Unknown (Unknown) ---
import HorizonBeta from './HorizonBeta.js';
// --- Unknown (Unknown) ---
import KimiDev72b from './KimiDev72b.js';
// --- Unknown (Unknown) ---
import Qwen3Coder from './Qwen3Coder.js';




const botRegistry = [
    { value: 'C-3.5-S', name: 'Claude 3.5 Sonnet', class: Claude35Sonnet, creationDate: 'Oct 2024', description: 'An unpredictable bot that randomly decides whether to attack or reinforce. It sends fleets from random planets to the nearest available target, making it a chaotic and sometimes surprisingly effective foe.' },
    { value: 'C-3.7-S', name: 'Claude 3.7 Sonnet', class: Claude37Sonnet, creationDate: 'Feb 2025', description: 'A reactive strategist. It constantly analyzes the board for threats and opportunities, switching its focus instantly. It will defend its planets, expand to safe neutrals, or attack vulnerable enemies based on a strict set of priorities.' },
    { value: 'C-4-S', name: 'Claude 4 Sonnet', class: Claude4Sonnet, creationDate: 'May 2025', description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." },

    { value: 'G-2.0', name: 'Gemini 2.0', class: Gemini20, creationDate: 'Feb 2025', description: 'Follows a classic expansionist strategy. It prioritizes defending its own territory first, then rapidly expanding to the nearest neutral planets, and only attacks enemies once its own expansion is well underway.' },
    { value: 'G-2.5-P', name: 'Gemini 2.5 Pro', class: Gemini25Pro, creationDate: '?? 2025', description: 'This bot operates on a "waterfall" logic model, where it evaluates a strict hierarchy of possible actions each turn. This ensures that critical tasks are always handled first.' },

    { value: 'GPT-4o', name: 'ChatGPT 4o', class: CGPT4o, creationDate: 'Aug 2025', description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' },

    { value: 'DSR1T2C', name: 'DeepSeekR1T2Chimera', class: DeepSeekR1T2Chimera, creationDate: 'Aug 2025', description: 'A strategic AI bot that dynamically balances expansion, defense, and attacks based on game phase, maintaining optimal troop efficiency and threat awareness.' },

    { value: 'HB', name: 'HorizonBeta', class: HorizonBeta, creationDate: 'Aug 2025', description: 'Lorem Ipsum' },

    { value: 'KD72', name: 'KimiDev72b', class: KimiDev72b, creationDate: 'Aug 2025', description: 'Lorem Ipsum' },

    { value: 'Q3C', name: 'Qwen3Coder', class: Qwen3Coder, creationDate: 'Aug 2025', description: 'A strategic bot that prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.' },

];

export default botRegistry;