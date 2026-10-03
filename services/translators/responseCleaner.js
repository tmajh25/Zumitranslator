/**
 * Response Cleaner Service (SRP - Single Responsibility Principle)
 * Handles sanitization of AI model outputs:
 * - Strips CoT / internal thoughts (<think>...</think>, <thought>...</thought>)
 * - Extracts clean text from markdown code blocks if erroneously wrapped
 */

class ResponseCleaner {
  /**
   * Sanitizes translated text from reasoning models
   * @param {string} rawText 
   * @returns {string} Cleaned translation
   */
  static clean(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText;

    // Remove closed think/thought blocks
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

    // Remove unclosed leading think tag if truncated
    if (/^<think>[\s\S]*/i.test(text) && !text.includes('</think>')) {
      text = text.replace(/^<think>[\s\S]*/i, '').trim();
    }

    // Remove markdown codeblock wrapper if AI erroneously outputs ```markdown ... ```
    const codeBlockMatch = text.match(/^```(?:markdown|text)?\s*\n?([\s\S]*?)\n?```$/i);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
    }

    return text || rawText;
  }
}

module.exports = ResponseCleaner;
