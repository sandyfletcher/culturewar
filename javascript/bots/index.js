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
import KimiK2 from './KimiK2.js';
// --- OpenAI (USA) ---
import CGPT5 from './CGPT5.js';
import gptoss20b from './gptoss20b.js';
// --- TNG Tech (Germany) ---
import DeepSeekR1T2 from './DeepSeekR1T2.js';
// --- Mistral AI (France) MistralSmall32 ---
// --- OpenRouter / OpenAI? (USA?) HorizonBeta ---

const botRegistry = [
    { // ALIBABA
        value: 'Q3C', 
        name: 'Qwen3Coder', 
        class: Qwen3Coder, 
        creationDate: '08/2025', 
        description: 'A strategic, adaptive RTS commander.'
    },
    { // ANTHROPIC
        value: 'C4',
        name: 'Claude 4.0 Sonnet',
        class: Claude40Sonnet,
        creationDate: '05/2025',
        description: "A multi-phase adaptive strategy that prioritizes rapid expansion, intelligent targeting, and dynamic threat response." 
    },
    { // GOOGLE
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
    { // MOONSHOT
        value: 'KK2', 
        name: 'Kimi K2', 
        class: KimiK2, 
        creationDate: '07/2025', 
        description: 'Explosive early–expansion that turns into remorseless mid-game strikes on the strongest neighbour, then clinical endgame consolidation.'
    },
    { // OPENAI
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
    { // TNG TECH
        value: 'DSR1T2', 
        name: 'DeepSeekR1T2', 
        class: DeepSeekR1T2, 
        creationDate: '08/2025', 
        description: 'Adaptive strategic dominator using phased warfare and predictive analytics.' 
    },
];

export default botRegistry;