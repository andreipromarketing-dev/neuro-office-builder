import { fetchWithTimeout } from '../utils/llmUtils.js';
import { LLMAdapter } from './adapter.js';

/**
 * Адаптер для Ollama API
 */
export class OllamaAdapter extends LLMAdapter {
  supports(llmType) {
    return llmType === 'ollama';
  }

  validateConfig(config) {
    super.validateConfig(config);
    if (!config.endpoint) {
      throw new Error('Ollama адаптер требует endpoint в конфигурации');
    }
  }

  async call(messages, config) {
    this.validateConfig(config);
    const endpoint = config.endpoint || 'http://localhost:11434';
    const model = config.model || 'llama2';

    const response = await fetchWithTimeout(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || 'Пустой ответ';
  }
}