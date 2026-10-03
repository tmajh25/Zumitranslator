/**
 * DeepSeek Payload Adapter (OCP - Open/Closed Principle)
 * Implements official DeepSeek thinking mode specifications
 */

const BasePayloadAdapter = require('./baseAdapter');

class DeepSeekPayloadAdapter extends BasePayloadAdapter {
  supports({ apiProvider, model, endpoint }) {
    return (
      apiProvider === 'deepseek' ||
      (endpoint && endpoint.includes('api.deepseek.com')) ||
      (model && model.toLowerCase().startsWith('deepseek'))
    );
  }

  buildPayload(params) {
    const { model, messages, temperature, thinkingLevel } = params;
    const body = {
      model: model || 'deepseek-chat',
      messages,
      temperature: temperature === undefined ? 1.0 : parseFloat(temperature)
    };

    const level = (thinkingLevel || 'MEDIUM').toUpperCase().trim();
    if (level === 'MINIMAL' || level === 'OFF') {
      body.thinking = { type: 'disabled' };
    } else {
      body.thinking = { type: 'enabled' };
      if (level === 'LOW') {
        body.reasoning_effort = 'low';
      } else if (level === 'HIGH') {
        body.reasoning_effort = 'max';
      } else {
        body.reasoning_effort = 'high'; // default for MEDIUM
      }
      delete body.temperature;
    }

    return body;
  }
}

module.exports = DeepSeekPayloadAdapter;
