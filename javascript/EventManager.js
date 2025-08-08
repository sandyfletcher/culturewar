// ===========================================
// root/javascript/EventManager.js
// ===========================================

class EventManager {
    constructor() {
        this.events = {};
    }
    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }
    off(eventName, listener) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName] = this.events[eventName].filter(
            l => l !== listener
        );
    }
    emit(eventName, data) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName].forEach(listener => listener(data));
    }
}
// Create a single, shared instance of the EventManager.
const eventManager = new EventManager();
// Export the INSTANCE as the default, not the class.
export default eventManager;