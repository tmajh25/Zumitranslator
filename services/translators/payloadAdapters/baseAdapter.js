/**
 * Base Payload Adapter Interface (OCP & ISP)
 */

class BasePayloadAdapter {
  /**
   * Determine whether this adapter handles the given request
   * @param {Object} context { apiProvider, model, endpoint }
   * @returns {boolean}
   */
  supports({ apiProvider, model, endpoint }) {
    return false;
  }

  /**
   * Builds the request body object
   * @param {Object} params
   * @returns {Object} JSON payload body
   */
  buildPayload(params) {
    const { model, messages, temperature } = params;
    return {
      model: model || 'gpt-4o-mini',
      messages,
      temperature: temperature === undefined ? 1.0 : parseFloat(temperature)
    };
  }
}

module.exports = BasePayloadAdapter;
