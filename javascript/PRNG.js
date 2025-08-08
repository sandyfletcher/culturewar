// ===========================================
// root/javascript/PRNG.js — simple pseudo-random number (Mulberry32 algorithm)
// ===========================================

export default class PRNG {
    constructor(seed) {
        this.seed = seed;
    }
    next() { // returns a random float between 0 (inclusive) and 1 (exclusive)
        let t = this.seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}