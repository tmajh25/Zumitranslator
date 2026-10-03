/**
 * OpenAI Reasoning Models Adapter (o1, o3, o4, gpt-5, gpt-6) (OCP)
 */

const BasePayloadAdapter = require('./baseAdapter');

class OpenAIReasoningAdapter extends BasePayloadAdapter {
  supports({ model }) {
    if (!model) return false;
    const m = model.toLowerCase();
    return (
      m.startsWith('o1') ||
      m.startsWith('o3') ||
      m.startsWith('o4') ||
      m.startsWith('gpt-5') ||
      m.startsWith('gpt-6')
    );
  }

  buildPayload(params) {
    const { model, messages, thinkingLevel, reasoningEffort, reasoningMode, endpoint = '' } = params;
    
    let effort = (reasoningEffort || '').toLowerCase().trim();
    if (!effort && thinkingLevel) {
      const effortMap = {
        'MINIMAL': 'minimal',
        'LOW': 'low',
        'MEDIUM': 'medium',
        'HIGH': 'high'
      };
      effort = effortMap[thinkingLevel] || 'medium';
    }
    if (!effort) effort = 'medium';

    // GPT-6 Astra restriction: setting reasoning_effort to 'none' returns HTTP 400
    if (model && model.includes('gpt-6-astra') && effort === 'none') {
      console.warn('[OpenAI] GPT-6 Astra does not support reasoning_effort "none". Automatically adjusting to "low".');
      effort = 'low';
    }

    const body = {
      model: model || 'gpt-4o-mini',
      messages
    };

    if (endpoint.includes('/v1/responses')) {
      body.reasoning = {
        mode: reasoningMode || 'standard',
        effort: effort
      };
    } else {
      body.reasoning_effort = effort;
    }

    return body;
  }
}

module.exports = OpenAIReasoningAdapter;
