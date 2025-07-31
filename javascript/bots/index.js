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
// MODIFIED: Added description and creationDate fields for the new Combatants screen.
const botRegistry = [
    { value: 'TiffanySpuckler', name: 'TiffanySpuckler', class: TiffanySpuckler, creationDate: 'Est. 2024', description: 'A baseline model. Focuses on reinforcing its strongest planets and launching large, straightforward attacks. Predictable but effective.' },
    { value: 'HeatherSpuckler', name: 'HeatherSpuckler', class: HeatherSpuckler, creationDate: 'Est. 2024', description: 'Highly aggressive. Prioritizes early expansion and will attack enemy planets with even a slight advantage, often spreading its forces thin.' },
    { value: 'CodySpuckler', name: 'CodySpuckler', class: CodySpuckler, creationDate: 'Est. 2024', description: 'Calculated and defensive. Prefers to build up a massive force on a few key planets before launching a decisive, overwhelming assault.' },
    { value: 'DylanSpuckler', name: 'DylanSpuckler', class: DylanSpuckler, creationDate: 'Est. 2024', description: 'An opportunist. Scans for the weakest neutral or enemy planets and attempts to capture them with minimal force required.' },
    { value: 'DermotSpuckler', name: 'DermotSpuckler', class: DermotSpuckler, creationDate: 'Est. 2024', description: 'Focuses on strategic value, heavily weighing planet size and production rate. Aims to build a superior economy before engaging.' },
    { value: 'JordanSpuckler', name: 'JordanSpuckler', class: JordanSpuckler, creationDate: 'Est. 2024', description: 'Risk-averse. Will only attack when victory is all but guaranteed, making it a slow but steady opponent.' },
    { value: 'TaylorSpuckler', name: 'TaylorSpuckler', class: TaylorSpuckler, creationDate: 'Est. 2024', description: 'Aims for map control by prioritizing planets in central locations, hoping to cut off enemy expansion routes.' },
    { value: 'BrittanySpuckler', name: 'BrittanySpuckler', class: BrittanySpuckler, creationDate: 'Est. 2024', description: 'Employs swarm tactics, sending smaller fleets from multiple planets to converge on a single target.' },
    { value: 'WesleySpuckler', name: 'WesleySpuckler', class: WesleySpuckler, creationDate: 'Est. 2024', description: 'The "Gambler". Not afraid to send its entire force from one planet to another in a high-stakes, all-or-nothing maneuver.' },
    { value: 'RumerSpuckler', name: 'RumerSpuckler', class: RumerSpuckler, creationDate: 'Est. 2024', description: 'A territorial bot that heavily reinforces its own planets and is slow to attack unless its own territory is threatened.' },
    { value: 'ScoutSpuckler', name: 'ScoutSpuckler', class: ScoutSpuckler, creationDate: 'Est. 2024', description: 'Expands rapidly to nearby neutral planets at the start of the game, trying to secure a resource advantage early on.' },
    { value: 'ZoeSpuckler', name: 'ZoeSpuckler', class: ZoeSpuckler, creationDate: 'Est. 2024', description: 'Analyzes threats carefully, prioritizing the reinforcement of planets that are most at risk from nearby enemy forces.' },
    { value: 'ChloeSpuckler', name: 'ChloeSpuckler', class: ChloeSpuckler, creationDate: 'Est. 2024', description: 'Unpredictable. Its decision-making includes a high degree of randomness, making it a chaotic and wild opponent.' },
    { value: 'MorganSpuckler', name: 'MorganSpuckler', class: MorganSpuckler, creationDate: 'Est. 2024', description: 'A balanced strategist. It dynamically shifts between offensive and defensive postures based on the overall state of the game.' },
];

export default botRegistry;