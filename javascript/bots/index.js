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
import gptoss20bB from './gptoss20bB.js';
import gptoss20bC from './gptoss20bC.js';
import gptoss20bD from './gptoss20bD.js';
// --- Alibaba Cloud (China) ---
import Qwen3CoderA from './Qwen3CoderA.js';
import Qwen3CoderB from './Qwen3CoderB.js';
// --- Mistral AI (France) MistralSmall32 ---
// --- TNG Tech (Germany) DeepSeekR1T2Chimera ---
// --- OpenRouter / OpenAI? (USA?) HorizonBeta ---
// --- Moonshot AI (China) KimiDev72b ---

const botRegistry = [
    { // Anthropic Claude 4.0 Sonnet
        value: 'C-4.0-SC',
        name: 'Claude 4.0 Sonnet C',
        class: Claude40SonnetC,
        creationDate: 'May 2025',
        description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." 
    },
    { // Anthropic Claude 4.0 Sonnet
        value: 'C-4.0-SD',
        name: 'Claude 4.0 Sonnet D',
        class: Claude40SonnetD,
        creationDate: 'May 2025',
        description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." 
    },
    { // Google Gemma3nE2B
        value: 'G3nE2B',
        name: 'Gemma 3n E2B',
        class: Gemma3nE2B,
        creationDate: '06/2025',
        description: "Aims to aggressively expand and conquer neutral planets while efficiently managing resource production." 
    },
    { // Google Gemini 2.0 Flash
        value: 'G2.OF', 
        name: 'Gemini 2.0 Flash', 
        class: Gemini20Flash, 
        creationDate: '02/2025', 
        description: 'Focuses on rapid expansion and overwhelming opponents with superior troop numbers.'
    },
    { // Google Gemini 2.5 Pro
        value: 'G2.5PA', 
        name: 'Gemini 2.5 Pro A', 
        class: Gemini25ProA, 
        creationDate: 'March 2025', 
        description: 'Employs a balanced, phase-aware strategy that prioritizes robust defense and calculated aggression..'
    },
    { // Google Gemini 2.5 Pro
        value: 'G2.5PD', 
        name: 'Gemini 2.5 Pro D', 
        class: Gemini25ProD, 
        creationDate: 'March 2025', 
        description: "Employs an adaptive, three-phase strategy focusing on aggressive expansion, strategic targeting, and intelligent consolidation."
    },
    { // OpenAI ChatGPT 5 Thinking Nano
        value: 'CGPT5B', 
        name: 'ChatGPT 5 B', 
        class: CGPT5B, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // OpenAI ChatGPT 5 Thinking Nano
        value: 'CGPT5D', 
        name: 'ChatGPT 5 D', 
        class: CGPT5D, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // OpenAI ChatGPT 5 Thinking Nano
        value: 'CGPT5E', 
        name: 'ChatGPT 5 E', 
        class: CGPT5E, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // OpenAI gpt-oss 20b
        value: 'go20bB', 
        name: 'gpt-oss 20b B', 
        class: gptoss20bB, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // OpenAI gpt-oss 20b
        value: 'go20bC', 
        name: 'gpt-oss 20b C', 
        class: gptoss20bC, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // OpenAI gpt-oss 20b
        value: 'go20bD', 
        name: 'gpt-oss 20b D', 
        class: gptoss20bD, 
        creationDate: 'Aug 2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // Alibaba Qwen 3 Coder
        value: 'Q3CA', 
        name: 'Qwen3Coder A', 
        class: Qwen3CoderA, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
    { // Alibaba Qwen 3 Coder
        value: 'Q3CB', 
        name: 'Qwen3Coder B', 
        class: Qwen3CoderB, 
        creationDate: 'July 2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
];

export default botRegistry;