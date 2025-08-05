// ===========================================
// root/javascript/bots/index.js
// ===========================================

import Claude35a from './Claude35a.js';
import Claude35b from './Claude35b.js';

import Claude37Sonnet from './Claude37Sonnet.js';
import Claude4Sonnet from './Claude4Sonnet.js';

import Gemini20 from './Gemini20.js';

import Gemini25a from './Gemini25a.js';
import Gemini25b from './Gemini25b.js';
import Gemini25c from './Gemini25c.js';
import Gemini25d from './Gemini25d.js';
import Gemini25e from './Gemini25e.js';

import CGPT4o from './CGPT4o.js';

import HorizonBeta from './HorizonBeta.js';

import KimiDev72b from './KimiDev72b.js';


import Qwen3Coder from './Qwen3Coder.js';


const botRegistry = [
    { value: 'C-3.5A', name: 'Claude 3.5 A', class: Claude35a, creationDate: 'Oct 2024', description: 'An unpredictable bot that randomly decides whether to attack or reinforce. It sends fleets from random planets to the nearest available target, making it a chaotic and sometimes surprisingly effective foe.' },
    { value: 'C-3.5B', name: 'Claude 3.5 B', class: Claude35b, creationDate: 'Oct 2024', description: 'Slow and methodical. It patiently builds up its strongest planet before launching a decisive attack. It prefers to expand into neutral territory and will only attack enemies it knows it can overwhelm.' },

    { value: 'C-3.7-S', name: 'Claude 3.7 Sonnet', class: Claude37Sonnet, creationDate: 'Feb 2025', description: 'A reactive strategist. It constantly analyzes the board for threats and opportunities, switching its focus instantly. It will defend its planets, expand to safe neutrals, or attack vulnerable enemies based on a strict set of priorities.' },
    { value: 'C-4-S', name: 'Claude 4 Sonnet', class: Claude4Sonnet, creationDate: 'May 2025', description: "An adaptive multi-phase strategist that evolves from aggressive early expansion to strategic consolidation to decisive late-game pushes. It balances calculated risks with defensive discipline, adjusting its aggression based on whether it's winning or losing." },

    { value: 'G-2.0', name: 'Gemini 2.0', class: Gemini20, creationDate: 'Feb 2025', description: 'Follows a classic expansionist strategy. It prioritizes defending its own territory first, then rapidly expanding to the nearest neutral planets, and only attacks enemies once its own expansion is well underway.' },

    { value: 'G-2.5A', name: 'Gemini 2.5 A', class: Gemini25a, creationDate: 'Jul 2025', description: 'A balanced strategist that evaluates all possible moves — attacking, expanding, and reinforcing — based on a Return on Investment calculation. It fluidly pivots to whatever action provides the most value for the least cost and risk.' },
    { value: 'G-2.5B', name: 'Gemini 2.5 B', class: Gemini25b, creationDate: 'Jul 2025', description: 'A balanced strategist that evaluates all possible moves — attacking, expanding, and reinforcing — based on a Return on Investment calculation. It fluidly pivots to whatever action provides the most value for the least cost and risk.' },
    { value: 'G-2.5C', name: 'Gemini 2.5 C', class: Gemini25c, creationDate: 'Aug 2025', description: 'An experimental adaptive AI. It dynamically changes its grand strategy—from expanding to attacking—based on game conditions. It remembers who attacks it and will prioritize revenge, making it a reactive and dangerous opponent.' },
    { value: 'G-2.5D', name: 'Gemini 2.5 D', class: Gemini25d, creationDate: 'Aug 2025', description: 'Lorem Ipsum, built off of Gemini 2.5 C to be the first to use new API options and likely game-changing memory array in BaseBot.  We shall see.' },
    { value: 'G-2.5E', name: 'Gemini 2.5 E', class: Gemini25e, creationDate: 'Aug 2025', description: 'An AI bot with a "long-term value investor" philosophy. It operates in distinct phases, prioritizing high-value targets and strategic consolidation.' },

    { value: 'GPT-4o', name: 'ChatGPT 4o', class: CGPT4o, creationDate: 'Aug 2025', description: 'Lorem Ipsum' },

    { value: 'HB', name: 'HorizonBeta', class: HorizonBeta, creationDate: 'Aug 2025', description: 'Lorem Ipsum' },

    { value: 'KD72', name: 'KimiDev72b', class: KimiDev72b, creationDate: 'Aug 2025', description: 'Lorem Ipsum' },

    { value: 'Q3C', name: 'Qwen3Coder', class: Qwen3Coder, creationDate: 'Aug 2025', description: 'Lorem Ipsum' },

];

export default botRegistry;