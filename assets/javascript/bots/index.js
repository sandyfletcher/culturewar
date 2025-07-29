// assets/javascript/bots/index.js

// Import all available bot classes
import TiffanySpuckler from './TiffanySpuckler.js';
import HeatherSpuckler from './HeatherSpuckler.js';
import CodySpuckler from './CodySpuckler.js';
import DylanSpuckler from './DylanSpuckler.js';
import DermotSpuckler from './DermotSpuckler.js';
import JordanSpuckler from './JordanSpuckler.js';
import TaylorSpuckler from './TaylorSpuckler.js';
import BrittanySpuckler from './BrittanySpuckler.js';
import WesleySpuckler from './WesleySpuckler.js';
import RumerSpuckler from './RumerSpuckler.js';
import ScoutSpuckler from './ScoutSpuckler.js';
import ZoeSpuckler from './ZoeSpuckler.js';
import ChloeSpuckler from './ChloeSpuckler.js';
import MorganSpuckler from './MorganSpuckler.js';

// The single source of truth for all bots
const botRegistry = [
    { value: 'TiffanySpuckler', name: 'TiffanySpuckler', class: TiffanySpuckler },
    { value: 'HeatherSpuckler', name: 'HeatherSpuckler', class: HeatherSpuckler },
    { value: 'CodySpuckler', name: 'CodySpuckler', class: CodySpuckler },
    { value: 'DylanSpuckler', name: 'DylanSpuckler', class: DylanSpuckler },
    { value: 'DermotSpuckler', name: 'DermotSpuckler', class: DermotSpuckler },
    { value: 'JordanSpuckler', name: 'JordanSpuckler', class: JordanSpuckler },
    { value: 'TaylorSpuckler', name: 'TaylorSpuckler', class: TaylorSpuckler },
    { value: 'BrittanySpuckler', name: 'BrittanySpuckler', class: BrittanySpuckler },
    { value: 'WesleySpuckler', name: 'WesleySpuckler', class: WesleySpuckler },
    { value: 'RumerSpuckler', name: 'RumerSpuckler', class: RumerSpuckler },
    { value: 'ScoutSpuckler', name: 'ScoutSpuckler', class: ScoutSpuckler },
    { value: 'ZoeSpuckler', name: 'ZoeSpuckler', class: ZoeSpuckler },
    { value: 'ChloeSpuckler', name: 'ChloeSpuckler', class: ChloeSpuckler },
    { value: 'MorganSpuckler', name: 'MorganSpuckler', class: MorganSpuckler },
];

export default botRegistry;