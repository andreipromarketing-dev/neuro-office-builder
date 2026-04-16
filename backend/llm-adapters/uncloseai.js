import { fetchWithTimeout, withRetry } from '../utils/llmUtils.js';
import { LLMAdapter } from './adapter.js';

/**
 * Адаптер для UncloseAI API
 */
export class UncloseAIAdapter extends LLMAdapter {
  supports(llmType) {
    return llmType === 'uncloseai';
  }

  validateConfig(config) {
    super.validateConfig(config);
    if (!config.endpoint) {
      throw new Error('UncloseAI адаптер требует endpoint в конфигурации');
    }
  }

  async call(messages, config) {
    this.validateConfig(config);
    const endpoint = config.endpoint || 'https://hermes.ai.unturf.com/v1/chat/completions';
    const model = config.model || 'hermes-3-llama-3.1-405b';

    return await withRetry(async () => {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`UncloseAI error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Пустой ответ';
    });
  }
}