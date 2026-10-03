/**
 * Payload Adapter Registry (OCP - Open/Closed Principle)
 * Finds and returns the appropriate adapter for a given provider and model
 */

const DeepSeekPayloadAdapter = require('./deepseekAdapter');
const OpenAIReasoningAdapter = require('./openaiReasoningAdapter');
const ClaudeAdapter = require('./claudeAdapter');
const DefaultAdapter = require('./defaultAdapter');

class PayloadAdapterRegistry {
  constructor() {
    this.adapters = [];
    this.registerDefaults();
  }

  registerDefaults() {
    // Specific adapters registered first (evaluated in order)
    this.register(new DeepSeekPayloadAdapter());
    this.register(new OpenAIReasoningAdapter());
    this.register(new ClaudeAdapter());
    // Fallback adapter always at the end
    this.register(new DefaultAdapter());
  }

  /**
   * Register a new custom adapter
   * @param {BasePayloadAdapter} adapter
   */
  register(adapter) {
    this.adapters.push(adapter);
  }

  /**
   * Resolve the best matching adapter
   * @param {Object} context { apiProvider, model, endpoint }
   * @returns {BasePayloadAdapter}
   */
  getAdapter(context) {
    for (const adapter of this.adapters) {
      if (adapter.supports(context)) {
        return adapter;
      }
    }
    return this.adapters[this.adapters.length - 1];
  }
}

const payloadAdapterRegistry = new PayloadAdapterRegistry();

module.exports = {
  PayloadAdapterRegistry,
  payloadAdapterRegistry
};
