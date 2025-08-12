// ===========================================
// root/javascript/bots/index.js
// ===========================================

// --- Anthropic (USA) ---
import Claude40Sonnet from './Claude40Sonnet.js';
// --- Google (USA) ---
import Gemma3nE2B from './Gemma3nE2B.js';
import Gemini20Flash from './Gemini20Flash.js';
import Gemini25Pro from './Gemini25Pro.js';
// --- OpenAI (USA) ---
import CGPT5 from './CGPT5.js';
import gptoss20bB from './gptoss20bB.js';
import gptoss20bC from './gptoss20bC.js';
// --- Alibaba Cloud (China) ---
import Qwen3CoderA from './Qwen3CoderA.js';
import Qwen3CoderB from './Qwen3CoderB.js';
// --- Mistral AI (France) MistralSmall32 ---
// --- TNG Tech (Germany) DeepSeekR1T2Chimera ---
// --- OpenRouter / OpenAI? (USA?) HorizonBeta ---
// --- Moonshot AI (China) KimiDev72b ---

const botRegistry = [
    { // Anthropic Claude 4.0 Sonnet
        value: 'C4',
        name: 'Claude 4.0 Sonnet',
        class: Claude40Sonnet,
        creationDate: '05/2025',
        description: "A multi-phase adaptive strategy that prioritizes rapid expansion, intelligent targeting, and dynamic threat response." 
    },
    { // Google Gemma3nE2B
        value: 'G3n',
        name: 'Gemma 3n E2B',
        class: Gemma3nE2B,
        creationDate: '06/2025',
        description: "Aims to aggressively expand and conquer neutral planets while efficiently managing resource production." 
    },
    { // Google Gemini 2.0 Flash
        value: 'G2', 
        name: 'Gemini 2.0 Flash', 
        class: Gemini20Flash, 
        creationDate: '02/2025', 
        description: 'Focuses on rapid expansion and overwhelming opponents with superior troop numbers.'
    },
    { // Google Gemini 2.5 Pro
        value: 'G2.5', 
        name: 'Gemini 2.5 Pro', 
        class: Gemini25Pro, 
        creationDate: '06/2025', 
        description: 'An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.'
    },
    { // OpenAI ChatGPT 5 Thinking Nano
        value: 'CGPT5', 
        name: 'ChatGPT 5', 
        class: CGPT5, 
        creationDate: '08/2025', 
        description: 'Fast, surgical expansion early, transition to value-targeted crippling attacks mid-game, and perform coordinated all-in pushes in the late game using accurate arrival predictions.' 
    },
    { // OpenAI gpt-oss 20b
        value: 'go20bB', 
        name: 'gpt-oss 20b B', 
        class: gptoss20bB, 
        creationDate: '08/2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // OpenAI gpt-oss 20b
        value: 'go20bC', 
        name: 'gpt-oss 20b C', 
        class: gptoss20bC, 
        creationDate: '08/2025', 
        description: 'Adaptive value-driven expansion with layered defense and opportunistic punishment — play smart, conserve forces, and strike where predictions guarantee value.' 
    },
    { // Alibaba Qwen 3 Coder
        value: 'Q3CA', 
        name: 'Qwen3Coder A', 
        class: Qwen3CoderA, 
        creationDate: '08/2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
    { // Alibaba Qwen 3 Coder
        value: 'Q3CB', 
        name: 'Qwen3Coder B', 
        class: Qwen3CoderB, 
        creationDate: '08/2025', 
        description: 'Prioritizes defense, expands based on value, and adapts its playstyle based on game phase and relative strength.'
    },
];

export default botRegistry;