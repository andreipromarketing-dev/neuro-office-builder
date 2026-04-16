import { jest } from '@jest/globals';

describe('OllamaAdapter', () => {
  let OllamaAdapter;
  let mockFetchWithTimeout;

  beforeEach(async () => {
    // Мокаем fetchWithTimeout
    mockFetchWithTimeout = jest.fn();
    jest.unstable_mockModule('../../utils/llmUtils.js', () => ({
      fetchWithTimeout: mockFetchWithTimeout
    }));

    // Импортируем адаптер после моков
    const module = await import('../../llm-adapters/ollama.js');
    OllamaAdapter = module.OllamaAdapter;
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('should support ollama type', () => {
    const adapter = new OllamaAdapter();
    expect(adapter.supports('ollama')).toBe(true);
    expect(adapter.supports('openai')).toBe(false);
    expect(adapter.supports('anthropic')).toBe(false);
    expect(adapter.supports('lmstudio')).toBe(false);
  });

  test('validateConfig requires endpoint', () => {
    const adapter = new OllamaAdapter();
    expect(() => adapter.validateConfig({})).toThrow('Ollama адаптер требует endpoint в конфигурации');
    expect(() => adapter.validateConfig({ endpoint: 'http://localhost:11434' })).not.toThrow();
  });

  test('call method makes correct API request', async () => {
    const adapter = new OllamaAdapter();
    const mockResponse = {
      ok: true,
      json: async () => ({ message: { content: 'Ollama test response' } })
    };
    mockFetchWithTimeout.mockResolvedValue(mockResponse);

    const messages = [{ role: 'user', content: 'Hello Ollama' }];
    const config = { endpoint: 'http://localhost:11434', model: 'llama2' };

    const result = await adapter.call(messages, config);

    expect(result).toBe('Ollama test response');
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama2',
          messages,
          stream: false
        })
      }
    );
  });

  test('call method uses default endpoint if not provided', async () => {
    const adapter = new OllamaAdapter();
    const mockResponse = {
      ok: true,
      json: async () => ({ message: { content: 'Response' } })
    };
    mockFetchWithTimeout.mockResolvedValue(mockResponse);

    const messages = [{ role: 'user', content: 'Hello' }];
    const config = { endpoint: undefined, model: 'llama2' };

    await adapter.call(messages, config);

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.any(Object)
    );
  });

  test('call method uses custom model from config', async () => {
    const adapter = new OllamaAdapter();
    const mockResponse = {
      ok: true,
      json: async () => ({ message: { content: 'Response' } })
    };
    mockFetchWithTimeout.mockResolvedValue(mockResponse);

    const messages = [{ role: 'user', content: 'Hello' }];
    const config = { endpoint: 'http://localhost:11434', model: 'mistral' };

    await adapter.call(messages, config);

    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'mistral',
          messages,
          stream: false
        })
      })
    );
  });

  test('call method throws error on API failure', async () => {
    const adapter = new OllamaAdapter();
    const mockResponse = {
      ok: false,
      status: 500
    };
    mockFetchWithTimeout.mockResolvedValue(mockResponse);

    const messages = [{ role: 'user', content: 'Hello' }];
    const config = { endpoint: 'http://localhost:11434', model: 'llama2' };

    await expect(adapter.call(messages, config)).rejects.toThrow('Ollama error: 500');
  });

  test('call method handles empty response', async () => {
    const adapter = new OllamaAdapter();
    const mockResponse = {
      ok: true,
      json: async () => ({ message: {} }) // Нет content
    };
    mockFetchWithTimeout.mockResolvedValue(mockResponse);

    const messages = [{ role: 'user', content: 'Hello' }];
    const config = { endpoint: 'http://localhost:11434', model: 'llama2' };

    const result = await adapter.call(messages, config);
    expect(result).toBe('Пустой ответ');
  });
});