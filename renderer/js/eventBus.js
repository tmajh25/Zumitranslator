/**
 * EventBus - Mediator Pattern (DIP - Dependency Inversion Principle)
 * Provides decoupled publish-subscribe communication between UI components,
 * controllers, and services without tight coupling.
 */

const EventBus = {
  listeners: new Map(),

  /**
   * Subscribe to an event
   * @param {string} event Event name
   * @param {Function} callback Handler callback
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unbind function
    return () => this.off(event, callback);
  },

  /**
   * Subscribe to an event for one-time execution
   * @param {string} event Event name
   * @param {Function} callback Handler callback
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    this.on(event, wrapper);
  },

  /**
   * Unsubscribe from an event
   * @param {string} event Event name
   * @param {Function} callback Handler callback
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  },

  /**
   * Emit an event with data
   * @param {string} event Event name
   * @param {*} data Payload
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EventBus] Error in listener for "${event}":`, err);
        }
      });
    }
  },

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }
};

if (typeof window !== 'undefined') {
  window.EventBus = EventBus;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus;
}
