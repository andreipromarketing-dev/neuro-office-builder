import { jest } from '@jest/globals';

describe('LLMAdapter Base Class', () => {
  let Adapter;

  beforeEach(async () => {
    // Импортируем LLMAdapter
    const module = await import('../../llm-adapters/adapter.js');
    Adapter = module.LLMAdapter;
  });

  test('should be abstract class', () => {
    const adapter = new Adapter();
    expect(() => adapter.call([], {})).toThrow('Метод call должен быть реализован в наследнике');
  });

  test('supports method returns false by default', () => {
    const adapter = new Adapter();
    expect(adapter.supports('ollama')).toBe(false);
    expect(adapter.supports('openai')).toBe(false);
  });

  test('validateConfig throws error for empty config', () => {
    const adapter = new Adapter();
    expect(() => adapter.validateConfig(null)).toThrow('Конфигурация обязательна');
    expect(() => adapter.validateConfig(undefined)).toThrow('Конфигурация обязательна');
  });

  test('validateConfig does not throw for valid config', () => {
    const adapter = new Adapter();
    expect(() => adapter.validateConfig({ endpoint: 'test' })).not.toThrow();
  });

  test('createRequestBody returns messages and stream false', () => {
    const adapter = new Adapter();
    const messages = [{ role: 'user', content: 'Hello' }];
    const body = adapter.createRequestBody(messages);

    expect(body).toEqual({
      messages,
      stream: false
    });
  });

  test('createRequestBody merges with options', () => {
    const adapter = new Adapter();
    const messages = [{ role: 'user', content: 'Hello' }];
    const options = { temperature: 0.7, max_tokens: 100 };
    const body = adapter.createRequestBody(messages, options);

    expect(body).toEqual({
      messages,
      stream: false,
      temperature: 0.7,
      max_tokens: 100
    });
  });

  test('extractResponseText extracts from OpenAI format', () => {
    const adapter = new Adapter();
    const responseData = {
      choices: [{
        message: { content: 'OpenAI response' }
      }]
    };
    expect(adapter.extractResponseText(responseData)).toBe('OpenAI response');
  });

  test('extractResponseText extracts from message.content format', () => {
    const adapter = new Adapter();
    const responseData = {
      message: { content: 'Ollama response' }
    };
    expect(adapter.extractResponseText(responseData)).toBe('Ollama response');
  });

  test('extractResponseText extracts from content field', () => {
    const adapter = new Adapter();
    const responseData = {
      content: 'Direct content response'
    };
    expect(adapter.extractResponseText(responseData)).toBe('Direct content response');
  });

  test('extractResponseText returns fallback for empty response', () => {
    const adapter = new Adapter();
    expect(adapter.extractResponseText({})).toBe('Пустой ответ');
    expect(adapter.extractResponseText({ choices: [] })).toBe('Пустой ответ');
    expect(adapter.extractResponseText({ choices: [{}] })).toBe('Пустой ответ');
  });
});