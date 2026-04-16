import { fetchWithTimeout } from '../utils/llmUtils.js';
import { LLMAdapter } from './adapter.js';

/**
 * Адаптер для OpenAI API
 */
export class OpenAIAdapter extends LLMAdapter {
  supports(llmType) {
    return llmType === 'openai';
  }

  validateConfig(config) {
    super.validateConfig(config);
    if (!config.apiKey) {
      throw new Error('OpenAI адаптер требует apiKey в конфигурации');
    }
  }

  async call(messages, config) {
    this.validateConfig(config);
    const apiKey = config.apiKey;
    const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
    const model = config.model || 'gpt-4o';

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
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Пустой ответ';
  }
}