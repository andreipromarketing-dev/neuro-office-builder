import { jest } from '@jest/globals';

describe('LLMCache', () => {
  let LLMCache;
  let cache;

  beforeEach(async () => {
    const module = await import('../../cache/llmCache.js');
    LLMCache = module.LLMCache;
    cache = new LLMCache({ maxSize: 3, ttl: 1000 }); // 1 секунда TTL для тестов
  });

  afterEach(() => {
    cache.stop();
    jest.useRealTimers();
  });

  test('should store and retrieve values', () => {
    cache.set('llm1', [{ role: 'user', content: 'Hello' }], 'Response 1');
    cache.set('llm2', [{ role: 'user', content: 'Hi' }], 'Response 2');

    expect(cache.get('llm1', [{ role: 'user', content: 'Hello' }])).toBe('Response 1');
    expect(cache.get('llm2', [{ role: 'user', content: 'Hi' }])).toBe('Response 2');
    expect(cache.get('llm3', [{ role: 'user', content: 'Hey' }])).toBeNull();
  });

  test('should respect maxSize limit', () => {
    // Добавляем больше элементов, чем maxSize
    cache.set('llm1', [{ role: 'user', content: 'Message 1' }], 'Response 1');
    cache.set('llm2', [{ role: 'user', content: 'Message 2' }], 'Response 2');
    cache.set('llm3', [{ role: 'user', content: 'Message 3' }], 'Response 3');
    cache.set('llm4', [{ role: 'user', content: 'Message 4' }], 'Response 4'); // Вытеснит первый

    // Первый элемент должен быть вытеснен
    expect(cache.get('llm1', [{ role: 'user', content: 'Message 1' }])).toBeNull();
    expect(cache.get('llm4', [{ role: 'user', content: 'Message 4' }])).toBe('Response 4');
  });

  test('should respect TTL', async () => {
    jest.useFakeTimers();
    cache.set('llm1', [{ role: 'user', content: 'Hello' }], 'Response');

    // Перед TTL - значение есть
    jest.advanceTimersByTime(500);
    expect(cache.get('llm1', [{ role: 'user', content: 'Hello' }])).toBe('Response');

    // После TTL - значение удалено
    jest.advanceTimersByTime(600); // Всего 1100ms > TTL 1000ms
    expect(cache.get('llm1', [{ role: 'user', content: 'Hello' }])).toBeNull();
  });

  test('generateKey creates consistent keys', () => {
    const key1 = cache.generateKey('llama', [{ role: 'user', content: 'Hello' }]);
    const key2 = cache.generateKey('llama', [{ role: 'user', content: 'Hello' }]);
    const key3 = cache.generateKey('llama', [{ role: 'user', content: 'Hi' }]);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  test('cleanup removes expired entries', () => {
    jest.useFakeTimers();

    // Добавляем два элемента
    cache.set('llm1', [{ role: 'user', content: 'Msg1' }], 'Resp1');
    jest.advanceTimersByTime(600); // Частично прошедшее время

    cache.set('llm2', [{ role: 'user', content: 'Msg2' }], 'Resp2');

    // Очищаем - только первый элемент должен быть удален
    cache.cleanup();

    // Второй элемент еще должен быть
    expect(cache.get('llm2', [{ role: 'user', content: 'Msg2' }])).toBe('Resp2');
  });

  test('clear method empties cache', () => {
    cache.set('llm1', [{ role: 'user', content: 'Hello' }], 'Response');
    expect(cache.get('llm1', [{ role: 'user', content: 'Hello' }])).toBe('Response');

    cache.clear();
    expect(cache.get('llm1', [{ role: 'user', content: 'Hello' }])).toBeNull();
  });

  test('getStats returns correct statistics', () => {
    cache.set('llm1', [{ role: 'user', content: 'Hello' }], 'Response 1');
    cache.set('llm2', [{ role: 'user', content: 'Hi' }], 'Response 2');

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(3);
    expect(stats.ttl).toBe(1000);
  });
});