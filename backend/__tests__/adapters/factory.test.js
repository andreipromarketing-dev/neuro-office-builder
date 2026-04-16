import { jest } from '@jest/globals';

describe('LLMAdapterFactory', () => {
  let LLMAdapterFactory;
  let factory;

  beforeEach(async () => {
    // Импортируем фабрику
    const module = await import('../../llm-adapters/factory.js');
    LLMAdapterFactory = module.LLMAdapterFactory;
    factory = new LLMAdapterFactory();
  });

  test('should register default adapters', () => {
    const supportedTypes = factory.getSupportedTypes();
    expect(supportedTypes).toContain('ollama');
    expect(supportedTypes).toContain('lmstudio');
    expect(supportedTypes).toContain('openai');
    expect(supportedTypes).toContain('anthropic');
    expect(supportedTypes).toContain('groq');
    expect(supportedTypes).toContain('uncloseai');
  });

  test('should get adapter for supported type', () => {
    const ollamaAdapter = factory.getAdapter('ollama');
    expect(ollamaAdapter).toBeDefined();
    expect(ollamaAdapter.supports('ollama')).toBe(true);

    const lmstudioAdapter = factory.getAdapter('lmstudio');
    expect(lmstudioAdapter).toBeDefined();
    expect(lmstudioAdapter.supports('lmstudio')).toBe(true);
  });

  test('should throw error for unsupported type', () => {
    expect(() => factory.getAdapter('unknown-type')).toThrow(
      "Адаптер для типа LLM 'unknown-type' не найден"
    );
  });

  test('should support LMStudio-compatible types', () => {
    const lmstudioAdapter = factory.getAdapter('lmstudio');
    const ayaAdapter = factory.getAdapter('aya');
    const llamaAdapter = factory.getAdapter('llama');
    const mistralAdapter = factory.getAdapter('mistral');

    // Все должны быть тем же адаптером LMStudioAdapter
    expect(lmstudioAdapter).toBe(ayaAdapter);
    expect(lmstudioAdapter).toBe(llamaAdapter);
    expect(lmstudioAdapter).toBe(mistralAdapter);
  });

  test('registerAdapter validates adapter interface', () => {
    const invalidAdapter = {};
    expect(() => factory.registerAdapter('test', invalidAdapter)).toThrow(
      'Адаптер должен быть экземпляром LLMAdapter'
    );

    const validAdapter = {
      supports: jest.fn(),
      call: jest.fn()
    };
    expect(() => factory.registerAdapter('test', validAdapter)).not.toThrow();
  });

  test('supports method returns correct boolean', () => {
    expect(factory.supports('ollama')).toBe(true);
    expect(factory.supports('openai')).toBe(true);
    expect(factory.supports('anthropic')).toBe(true);
    expect(factory.supports('unknown')).toBe(false);
  });

  test('getSupportedTypes returns all registered types', () => {
    const types = factory.getSupportedTypes();
    expect(Array.isArray(types)).toBe(true);
    expect(types.length).toBeGreaterThan(0);
    expect(types).toEqual(expect.arrayContaining(['ollama', 'lmstudio', 'openai']));
  });

  test('singleton getAdapterFactory returns same instance', async () => {
    const { getAdapterFactory } = await import('../../llm-adapters/factory.js');
    const factory1 = getAdapterFactory();
    const factory2 = getAdapterFactory();
    expect(factory1).toBe(factory2);
  });
});