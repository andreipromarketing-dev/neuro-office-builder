/**
 * Простой LRU кэш для LLM запросов
 */
export class LLMCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 минут по умолчанию
    this.cache = new Map();
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 минута
    this.hits = 0;
    this.misses = 0;

    // Запускаем периодическую очистку
    this.cleanupTimer = setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Генерирует ключ кэша
   * @param {string} llmName - Имя LLM
   * @param {Array} messages - Массив сообщений
   * @returns {string}
   */
  generateKey(llmName, messages) {
    // Простой ключ для начала - можно улучшить с использованием хэша
    return `${llmName}:${JSON.stringify(messages)}`;
  }

  /**
   * Получает значение из кэша
   * @param {string} llmName - Имя LLM
   * @param {Array} messages - Массив сообщений
   * @returns {string|null} Значение или null если не найдено
   */
  get(llmName, messages) {
    const key = this.generateKey(llmName, messages);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Проверяем не устарела ли запись
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Обновляем порядок использования (перемещаем в конец)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Сохраняет значение в кэш
   * @param {string} llmName - Имя LLM
   * @param {Array} messages - Массив сообщений
   * @param {string} value - Значение для сохранения
   */
  set(llmName, messages, value) {
    const key = this.generateKey(llmName, messages);

    // Если достигли максимального размера, удаляем самую старую запись
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Очищает устаревшие записи
   */
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Очищает весь кэш
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Возвращает статистику кэша
   * @returns {Object}
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }

  /**
   * Останавливает таймер очистки
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Синглтон кэша
let cacheInstance = null;

/**
 * Возвращает экземпляр кэша
 * @param {Object} options - Опции кэша
 * @returns {LLMCache}
 */
export function getLLMCache(options = {}) {
  if (!cacheInstance) {
    cacheInstance = new LLMCache(options);
  }
  return cacheInstance;
}