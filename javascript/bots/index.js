// ===========================================
// root/javascript/bots/index.js
// ===========================================

import Claude35a from './Claude35a.js';
import Claude35b from './Claude35b.js';
import Claude37 from './Claude37.js';
import Gemini20 from './Gemini20.js';
import Gemini25a from './Gemini25a.js';
import Gemini25c from './Gemini25c.js';
import CGPT4o from './CGPT4o.js';

const botRegistry = [
    { value: 'C-3.5A', name: 'Claude 3.5 A', class: Claude35a, creationDate: 'Jan 2025', description: 'An unpredictable bot that randomly decides whether to attack or reinforce. It sends fleets from random planets to the nearest available target, making it a chaotic and sometimes surprisingly effective foe.' },
    { value: 'C-3.5B', name: 'Claude 3.5 B', class: Claude35b, creationDate: 'Jan 2025', description: 'Slow and methodical. It patiently builds up its strongest planet before launching a decisive attack. It prefers to expand into neutral territory and will only attack enemies it knows it can overwhelm.' },
    { value: 'C-3.7', name: 'Claude 3.7', class: Claude37, creationDate: 'Feb 2025', description: 'A reactive strategist. It constantly analyzes the board for threats and opportunities, switching its focus instantly. It will defend its planets, expand to safe neutrals, or attack vulnerable enemies based on a strict set of priorities.' },
    { value: 'G-2.0', name: 'Gemini 2.0', class: Gemini20, creationDate: 'Feb 2025', description: 'Follows a classic expansionist strategy. It prioritizes defending its own territory first, then rapidly expanding to the nearest neutral planets, and only attacks enemies once its own expansion is well underway.' },
    { value: 'G-2.5A', name: 'Gemini 2.5 A', class: Gemini25a, creationDate: 'Jul 2025', description: 'A balanced strategist that evaluates all possible moves — attacking, expanding, and reinforcing — based on a Return on Investment calculation. It fluidly pivots to whatever action provides the most value for the least cost and risk.' },
    { value: 'G-2.5C', name: 'Gemini 2.5 C', class: Gemini25c, creationDate: 'Aug 2025', description: 'An experimental adaptive AI. It dynamically changes its grand strategy—from expanding to attacking—based on game conditions. It remembers who attacks it and will prioritize revenge, making it a reactive and dangerous opponent.' },
    { value: 'GPT-4o', name: 'ChatGPT 4o', class: CGPT4o, creationDate: 'Aug 2025', description: 'Lorem Ipsum' },
];

export default botRegistry;