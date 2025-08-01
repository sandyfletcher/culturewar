// ===========================================
// assets/javascript/bots/index.js — single source of truth for all bots
// ===========================================

import Claude35a from './Claude35a.js';
import Claude35b from './Claude35b.js';
import Claude37 from './Claude37.js';
import Gemini20 from './Gemini20.js';
import Gemini25 from './Gemini25.js';

import JordanSpuckler from './JordanSpuckler.js';
import TaylorSpuckler from './TaylorSpuckler.js';
import BrittanySpuckler from './BrittanySpuckler.js';
import WesleySpuckler from './WesleySpuckler.js';
import RumerSpuckler from './RumerSpuckler.js';
import ChloeSpuckler from './ChloeSpuckler.js';

const botRegistry = [
    { value: 'Claude 3.5 A', name: 'C3.5A', class: Claude35a, creationDate: 'Feb 2025', description: 'An unpredictable bot that randomly decides whether to attack or reinforce. It sends fleets from random planets to the nearest available target, making it a chaotic and sometimes surprisingly effective foe.' },
    { value: 'Claude 3.5 B', name: 'C3.5B', class: Claude35b, creationDate: 'Feb 2025', description: 'Slow and methodical. It patiently builds up its strongest planet before launching a decisive attack. It prefers to expand into neutral territory and will only attack enemies it knows it can overwhelm.' },
    { value: 'Claude 3.7', name: 'C3.7', class: Claude37, creationDate: 'Feb 2025', description: 'A calculated AI that thinks in terms of Return on Investment. It ranks all possible moves by comparing a target\'s strategic value against the risk and distance, always choosing the most efficient and profitable action.' },
    { value: 'Gemini 2.0', name: 'G2.0', class: Gemini20, creationDate: 'Feb 2025', description: 'Follows a classic expansionist strategy. It prioritizes defending its own territory first, then rapidly expanding to the nearest neutral planets, and only attacks enemies once its own expansion is well underway.' },
    { value: 'Gemini 2.5', name: 'G2.5', class: Gemini25, creationDate: 'July 2025', description: 'A balanced strategist that evaluates all possible moves—attacking, expanding, and reinforcing—based on a Return on Investment calculation. It fluidly pivots to whatever action provides the most value for the least cost and risk.' },

    { value: 'JordanSpuckler', name: 'JordanSpuckler', class: JordanSpuckler, creationDate: 'Est. 2024', description: 'A cautious, two-phase AI. It begins by expanding until it controls a certain percentage of the map, then switches to a defensive mode, reinforcing its frontline planets and only attacking when necessary.' },
    { value: 'TaylorSpuckler', name: 'TaylorSpuckler', class: TaylorSpuckler, creationDate: 'Est. 2024', description: 'A reactive strategist. It constantly analyzes the board for threats and opportunities, switching its focus instantly. It will defend its planets, expand to safe neutrals, or attack vulnerable enemies based on a strict set of priorities.' },
    { value: 'BrittanySpuckler', name: 'BrittanySpuckler', class: BrittanySpuckler, creationDate: 'Est. 2024', description: 'A fortress builder. Its primary goal is to consolidate its forces, constantly moving troops from its weaker planets to its strongest one. It will defend when threatened but is otherwise slow to expand or attack.' },
    { value: 'WesleySpuckler', name: 'WesleySpuckler', class: WesleySpuckler, creationDate: 'Est. 2024', description: 'A "value investor" who is hesitant to act without a clear advantage. It heavily prioritizes high-production planets and will delay its decisions if it feels outmatched, waiting for the perfect, low-risk opportunity.' },
    { value: 'RumerSpuckler', name: 'RumerSpuckler', class: RumerSpuckler, creationDate: 'Est. 2024', description: 'Extremely territorial and defensive. Its first priority is always to reinforce any planet under attack. Only when its own territory is secure will it venture out to attack the absolute weakest target on the map.' },
    { value: 'ChloeSpuckler', name: 'ChloeSpuckler', class: ChloeSpuckler, creationDate: 'Est. 2024', description: 'An exhaustive analyzer. It scores every possible move on the board based on a target\'s value, distance, and the risk to the source planet. It then executes the single highest-scoring move, making it methodical and highly predictable.' },
];

export default botRegistry;