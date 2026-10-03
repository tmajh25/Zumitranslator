/**
 * Claude / Anthropic Thinking Adapter (OCP)
 */

const BasePayloadAdapter = require('./baseAdapter');

class ClaudeAdapter extends BasePayloadAdapter {
  supports({ model }) {
    return Boolean(model && model.toLowerCase().includes('claude-3-7'));
  }

  buildPayload(params) {
    const { model, messages, temperature, thinkingLevel } = params;
    const body = {
      model: model || 'claude-3-7-sonnet',
      messages,
      temperature: temperature === undefined ? 1.0 : parseFloat(temperature),
      thinking: {
        type: 'enabled',
        budget_tokens: thinkingLevel === 'HIGH' ? 16000 : (thinkingLevel === 'MEDIUM' ? 8000 : 2000)
      }
    };
    return body;
  }
}

module.exports = ClaudeAdapter;
