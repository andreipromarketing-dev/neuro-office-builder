import { fetchWithTimeout } from '../utils/llmUtils.js';
import { LLMAdapter } from './adapter.js';

/**
 * Адаптер для Google Gemini API
 */
export class GoogleAdapter extends LLMAdapter {
  supports(llmType) {
    return llmType === 'google';
  }

  validateConfig(config) {
    super.validateConfig(config);
    if (!config.apiKey) {
      throw new Error('Google Gemini адаптер требует apiKey в конфигурации');
    }
  }

  async call(messages, config) {
    this.validateConfig(config);
    const apiKey = config.apiKey;
    const model = config.model || 'gemini-pro';
    const endpoint = config.endpoint || `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;

    // Конвертируем сообщения OpenAI в формат Gemini
    const contents = this.convertMessagesToGeminiFormat(messages);

    const response = await fetchWithTimeout(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Gemini error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return this.extractGeminiResponse(data);
  }

  /**
   * Конвертирует сообщения OpenAI в формат Gemini
   * @param {Array} messages - Массив сообщений OpenAI
   * @returns {Array} Массив содержимого Gemini
   */
  convertMessagesToGeminiFormat(messages) {
    const contents = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Системные сообщения в Gemini добавляются как часть контекста
        // Можно добавить как первое user сообщение с инструкцией
        if (contents.length === 0) {
          contents.push({
            role: 'user',
            parts: [{ text: `Системная инструкция: ${message.content}` }]
          });
          contents.push({
            role: 'model',
            parts: [{ text: 'Понял, буду следовать инструкциям.' }]
          });
        }
      } else {
        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        });
      }
    }

    return contents;
  }

  /**
   * Извлекает текст ответа из ответа Gemini API
   * @param {Object} responseData - Данные ответа от Gemini API
   * @returns {string}
   */
  extractGeminiResponse(responseData) {
    try {
      if (responseData.candidates && responseData.candidates.length > 0) {
        const candidate = responseData.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          return candidate.content.parts[0].text || 'Пустой ответ';
        }
      }
      return 'Пустой ответ';
    } catch (error) {
      console.error('Ошибка извлечения ответа Gemini:', error);
      return 'Пустой ответ';
    }
  }
}