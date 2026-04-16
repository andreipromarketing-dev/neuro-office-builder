import { fetchWithTimeout, withRetry } from '../utils/llmUtils.js';
import { LLMAdapter } from './adapter.js';

/**
 * Адаптер для Groq API
 */
export class GroqAdapter extends LLMAdapter {
  supports(llmType) {
    return llmType === 'groq';
  }

  validateConfig(config) {
    super.validateConfig(config);
    if (!config.apiKey) {
      throw new Error('Groq адаптер требует apiKey в конфигурации');
    }
  }

  async call(messages, config) {
    this.validateConfig(config);
    const apiKey = config.apiKey;
    const endpoint = config.endpoint || 'https://api.groq.com/openai/v1/chat/completions';
    const model = config.model || 'llama-3.3-70b-versatile';

    return await withRetry(async () => {
      const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`Groq error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Пустой ответ';
    });
  }
}