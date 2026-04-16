import { fetchWithTimeout } from '../utils/llmUtils.js';
import { LLMAdapter } from './adapter.js';

/**
 * Адаптер для Anthropic API
 */
export class AnthropicAdapter extends LLMAdapter {
  supports(llmType) {
    return llmType === 'anthropic';
  }

  validateConfig(config) {
    super.validateConfig(config);
    if (!config.apiKey) {
      throw new Error('Anthropic адаптер требует apiKey в конфигурации');
    }
  }

  async call(messages, config) {
    this.validateConfig(config);
    const apiKey = config.apiKey;
    const model = config.model || 'claude-3-opus-20240229';

    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic error: ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'Пустой ответ';
  }
}