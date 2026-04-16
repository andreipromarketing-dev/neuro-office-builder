/**
 * Базовый класс LLM адаптера
 */
export class LLMAdapter {
  /**
   * Проверяет, поддерживает ли адаптер указанный тип LLM
   * @param {string} llmType - Тип LLM (ollama, openai, anthropic и т.д.)
   * @returns {boolean}
   */
  supports(llmType) {
    return false;
  }

  /**
   * Вызывает LLM API
   * @param {Array} messages - Массив сообщений в формате OpenAI
   * @param {Object} config - Конфигурация адаптера
   * @param {string} [config.apiKey] - API ключ (если требуется)
   * @param {string} [config.endpoint] - URL эндпоинта
   * @param {string} [config.model] - Имя модели (если требуется)
   * @returns {Promise<string>} Ответ от LLM
   */
  async call(messages, config) {
    throw new Error('Метод call должен быть реализован в наследнике');
  }

  /**
   * Валидирует конфигурацию адаптера
   * @param {Object} config - Конфигурация для проверки
   * @throws {Error} Если конфигурация невалидна
   */
  validateConfig(config) {
    if (!config) {
      throw new Error('Конфигурация обязательна');
    }
    // Базовая проверка - может быть расширена в наследниках
  }

  /**
   * Создаёт тело запроса для API
   * @param {Array} messages - Массив сообщений
   * @param {Object} [options] - Дополнительные опции
   * @returns {Object}
   */
  createRequestBody(messages, options = {}) {
    return {
      messages,
      stream: false,
      ...options
    };
  }

  /**
   * Извлекает текст ответа из ответа API
   * @param {Object} responseData - Данные ответа от API
   * @returns {string}
   */
  extractResponseText(responseData) {
    // Базовая реализация для OpenAI-совместимых API
    return responseData.choices?.[0]?.message?.content ||
           responseData.message?.content ||
           responseData.content ||
           'Пустой ответ';
  }
}