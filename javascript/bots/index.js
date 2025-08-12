// ===========================================
// root/javascript/bots/index.js
// ===========================================

// --- Alibaba Cloud (China) ---
import Qwen3Coder from './Qwen3Coder.js';
// --- Anthropic (USA) ---
import Claude40Sonnet from './Claude40Sonnet.js';
// --- Google (USA) ---
import Gemma3nE2B from './Gemma3nE2B.js';
import Gemini20Flash from './Gemini20Flash.js';
import Gemini25Pro from './Gemini25Pro.js';
// --- Moonshot AI (China)  ---
import KimiK2A from './KimiK2A.js';
import KimiK2B from './KimiK2B.js';
import KimiK2C from './KimiK2C.js';
import KimiK2D from './KimiK2D.js';
import KimiK2E from './KimiK2E.js';
// --- OpenAI (USA) ---
import CGPT5 from './CGPT5.js';
import gptoss20b from './gptoss20b.js';

// --- Mistral AI (France) MistralSmall32 ---
// --- TNG Tech (Germany) DeepSeekR1T2Chimera ---
// --- OpenRouter / OpenAI? (USA?) HorizonBeta ---

const botRegistry = [
    { // Alibaba
        value: 'Q3C', 
        name: 'Qwen3Coder', 
        class: Qwen3Coder, 
        creationDate: '08/2025', 
        description: 'A strategic, adaptive RTS commander.'
    },
    { // Anthropic
        value: 'C4',
        name: 'Claude 4.0 Sonnet',
        class: Claude40Sonnet,
        creationDate: '05/2025',
        description: "A multi-phase adaptive strategy that prioritizes rapid expansion, intelligent targeting, and dynamic threat response." 
    },
    { // Google
        value: 'G3n',
        name: 'Gemma 3n E2B',
        class: Gemma3nE2B,
        creationDate: '06/2025',
        description: "Aims to aggressively expand and conquer neutral planets while efficiently managing resource production." 
    },
    {
        value: 'G2', 
        name: 'Gemini 2.0 Flash', 
        class: Gemini20Flash, 
        creationDate: '02/2025', 
        description: 'Focuses on rapid expansion and overwhelming opponents with superior troop numbers.'
    },
    {
        value: 'G2.5', 
        name: 'Gemini 2.5 Pro', 
        class: Gemini25Pro, 
        creationDate: '06/2025', 
        description: 'An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.'
    },
    { // Moonshot
        value: 'KK2A', 
        name: 'Kimi K2 A', 
        class: KimiK2A, 
        creationDate: '07/2025', 
        description: 'An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.'
    },
    {
        value: 'KK2B', 
        name: 'Kimi K2 B', 
        class: KimiK2B, 
        creationDate: '07/2025', 
        description: 'An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.'
    },
    {
        value: 'KK2C', 
        name: 'Kimi K2 C', 
        class: KimiK2C, 
        creationDate: '07/2025', 
        description: 'An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.'
    },
    {
        value: 'KK2D', 
        name: 'Kimi K2 D', 
        class: KimiK2D, 
        creationDate: '07/2025', 
        description: 'An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.'
    },
    {
        value: 'KK2E', 
        name: 'Kimi K2 E', 
        class: KimiK2E, 
        creationDate: '07/2025', 
        description: 'An opportunistic AI that adapts its strategy based on game phase, balancing aggressive expansion, calculated enemy strikes, and intelligent defense.'
    },
    { // OpenAI
        value: 'CGPT5', 
        name: 'ChatGPT 5', 
        class: CGPT5, 
        creationDate: '08/2025', 
        description: 'Fast, surgical expansion early, transition to value-targeted crippling attacks mid-game, and perform coordinated all-in pushes in the late game using accurate arrival predictions.' 
    },
    {
        value: 'go20b', 
        name: 'gpt-oss 20b', 
        class: gptoss20b, 
        creationDate: '08/2025', 
        description: 'A phased, predictive Galcon AI.' 
    },
];

export default botRegistry;