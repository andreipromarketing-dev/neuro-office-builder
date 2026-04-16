import { fetchWithTimeout } from '../utils/llmUtils.js';
import { LLMAdapter } from './adapter.js';

/**
 * Адаптер для LM Studio и совместимых API (Aya, Llama, Mistral и др.)
 */
export class LMStudioAdapter extends LLMAdapter {
  supports(llmType) {
    const supportedTypes = [
      'lmstudio', 'aya', 'llama', 'mistral',
      'deepseek', 'qwen', 'grok'
    ];
    return supportedTypes.includes(llmType);
  }

  validateConfig(config) {
    super.validateConfig(config);
    if (!config.endpoint) {
      throw new Error('LM Studio адаптер требует endpoint в конфигурации');
    }
  }

  async call(messages, config) {
    this.validateConfig(config);
    const endpoint = config.endpoint || 'http://localhost:1234';
    const model = config.model || 'model';

    const response = await fetchWithTimeout(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LM Studio error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Пустой ответ';
  }
}