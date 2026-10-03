/**
 * Default OpenAI Compatible Payload Adapter (Fallback)
 */

const BasePayloadAdapter = require('./baseAdapter');

class DefaultAdapter extends BasePayloadAdapter {
  supports() {
    return true; // Fallback matches everything
  }

  buildPayload(params) {
    const { model, messages, temperature } = params;
    return {
      model: model || 'gpt-4o-mini',
      messages,
      temperature: temperature === undefined ? 1.0 : parseFloat(temperature)
    };
  }
}

module.exports = DefaultAdapter;
