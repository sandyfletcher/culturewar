// ===========================================
// root/javascript/bots/index.js
// ===========================================

// --- Anthropic (USA) ---
import Claude40SonnetC from './Claude40SonnetC.js';
import Claude40SonnetD from './Claude40SonnetD.js';
// --- Google (USA) ---
import Gemma3nE2B from './Gemma3nE2B.js';
import Gemini20Flash from './Gemini20Flash.js';
import Gemini25ProA from './Gemini25ProA.js';
import Gemini25ProD from './Gemini25ProD.js';
// --- OpenAI (USA) ---
import CGPT5B from './CGPT5B.js';
import CGPT5D from './CGPT5D.js';
import CGPT5E from './CGPT5E.js';
import gptoss20bA from './gptoss20bA.js';
import gptoss20bB from './gptoss20bB.js';
import gptoss20bC from './gptoss20bC.js';
import gptoss20bD from './gptoss20bD.js';
// --- Alibaba Cloud (China) ---
import Qwen3CoderA from './Qwen3CoderA.js';
import Qwen3CoderB from './Qwen3CoderB.js';
import Qwen3CoderC from './Qwen3CoderC.js';
import Qwen3CoderD from './Qwen3CoderD.js';
import Qwen3CoderE from './Qwen3CoderE.js';

// --- Mistral AI (France) ---
import MistralSmall32 from './MistralSmall32.js';
// --- TNG Tech (Germany) ---
import DeepSeekR1T2Chimera from './DeepSeekR1T2Chimera.js';
// --- OpenRouter / OpenAI? (USA?) ---
import HorizonBeta from './HorizonBeta.js';
// --- Moonshot AI (China) ---
import KimiDev72b from './KimiDev72b.js';

const botRegistry = [
    { 
        value: 'C-4.0-SC',
        name: 'Claude 4.0 Sonnet C',
        class: Claude40SonnetC,
        creationDate: 'May 2025',
        description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." 
    },
    { 
        value: 'C-4.0-SD',
        name: 'Claude 4.0 Sonnet D',
        class: Claude40SonnetD,
        creationDate: 'May 2025',
        description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." 
    },
    { 
        value: 'G3nE2B',
        name: 'Gemma 3n E2B',
        class: Gemma3nE2B,
        creationDate: 'May 2025',
        description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." 
    },
    { 
        value: 'G2.OF', 
        name: 'Gemini 2.0 Flash', 
        class: Gemini20Flash, 
        creationDate: 'March 2025', 
        description: 'Employs a balanced, phase-aware strategy that prioritizes robust defense and calculated aggression..'
    },
    { 
        value: 'G2.5PA', 
        name: 'Gemini 2.5 Pro A', 
        class: Gemini25ProA, 
        creationDate: 'March 2025', 
        description: 'Employs a balanced, phase-aware strategy that prioritizes robust defense and calculated aggression..'
    },
    { 
        value: 'G2.5PD', 
        name: 'Gemini 2.5 Pro D', 
        class: Gemini25ProD, 
        creationDate: 'March 2025', 
        description: "Employs an adaptive, three-phase strategy focusing on aggressive expansion, strategic targeting, and intelligent consolidation."
    },
    { 
        value: 'CGPT5B', 
        name: 'ChatGPT 5 B', 
        class: CGPT5B, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'CGPT5D', 
        name: 'ChatGPT 5 D', 
        class: CGPT5D, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'CGPT5E', 
        name: 'ChatGPT 5 E', 
        class: CGPT5E, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'go20bA', 
        name: 'gpt-oss 20b A', 
        class: gptoss20bA, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'go20bB', 
        name: 'gpt-oss 20b B', 
        class: gptoss20bB, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'go20bC', 
        name: 'gpt-oss 20b C', 
        class: gptoss20bC, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'go20bD', 
        name: 'gpt-oss 20b D', 
        class: gptoss20bD, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { 
        value: 'Q3CA', 
        name: 'Qwen3Coder A', 
        class: Qwen3CoderA, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
    { 
        value: 'Q3CB', 
        name: 'Qwen3Coder B', 
        class: Qwen3CoderB, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
    { 
        value: 'Q3CC', 
        name: 'Qwen3Coder C', 
        class: Qwen3CoderC, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
    { 
        value: 'Q3CD', 
        name: 'Qwen3Coder D', 
        class: Qwen3CoderD, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
    { 
        value: 'Q3CE', 
        name: 'Qwen3Coder E', 
        class: Qwen3CoderE, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
];

export default botRegistry;