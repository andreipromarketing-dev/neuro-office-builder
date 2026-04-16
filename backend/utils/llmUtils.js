/**
 * Утилиты для работы с LLM адаптерами
 */

const LLM_TIMEOUT = 120 * 1000; // 120 секунд

/**
 * Повторная попытка выполнения функции с экспоненциальным backoff
 * @param {Function} fn - Функция для выполнения
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} delay - Начальная задержка в миллисекундах
 * @returns {Promise<any>}
 */
export async function withRetry(fn, maxRetries = 3, delay = 2000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      console.log(`[RETRY] Попытка ${i + 1}/${maxRetries}: ${e.message}`);
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Fetch с таймаутом
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции fetch
 * @param {number} timeout - Таймаут в миллисекундах
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options, timeout = LLM_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    if (e.name === 'AbortError') {
      throw new Error('Превышен таймаут ожидания ответа от LLM');
    }
    throw e;
  }
}