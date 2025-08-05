// ===========================================
// root/javascript/bots/index.js
// ===========================================

// --- Anthropic (USA) ---
import Claude4Sonnet from './Claude4Sonnet.js';
// --- Google (USA) ---
import Gemini25Pro from './Gemini25Pro.js';
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



MistralSmall32


const botRegistry = [
    { value: 'C-4-S', name: 'Claude 4 Sonnet', class: Claude4Sonnet, creationDate: 'May 2025', description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." },

    { value: 'G-2.5-P', name: 'Gemini 2.5 Pro', class: Gemini25Pro, creationDate: '?? 2025', description: 'This bot operates on a "waterfall" logic model, where it evaluates a strict hierarchy of possible actions each turn. This ensures that critical tasks are always handled first.' },

    { value: 'GPT-4o', name: 'ChatGPT 4o', class: CGPT4o, creationDate: 'Aug 2025', description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' },

    { value: 'DSR1T2C', name: 'DeepSeekR1T2Chimera', class: DeepSeekR1T2Chimera, creationDate: 'July 2025', description: 'A strategic AI bot that dynamically balances expansion, defense, and attacks based on game phase, maintaining optimal troop efficiency and threat awareness.' },

    { value: 'HB', name: 'HorizonBeta', class: HorizonBeta, creationDate: 'Aug 2025', description: 'An adaptive, value-driven RTS bot focused on safe expansion, surgical defense, and opportunistic strikes using forward predictions and phased strategy.' },

    { value: 'KD72', name: 'KimiDev72b', class: KimiDev72b, creationDate: 'June 2025', description: 'This bot automatically adjusts to focus on defense when under attack and aggressive expansion when safe.' },

    { value: 'Q3C', name: 'Qwen3Coder', class: Qwen3Coder, creationDate: 'July 2025', description: 'A strategic bot that prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.' },

    { value: 'MS32', name: 'MistralSmall32', class: MistralSmall32, creationDate: 'June 2025', description: 'Memory maintains state between decisions, allowing it to execute coordinated strategic plans over multiple turns.' },

];

export default botRegistry;