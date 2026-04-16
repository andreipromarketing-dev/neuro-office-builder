import { OllamaAdapter } from './ollama.js';
import { LMStudioAdapter } from './lmstudio.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { GroqAdapter } from './groq.js';
import { UncloseAIAdapter } from './uncloseai.js';
import { GoogleAdapter } from './google.js';

/**
 * Фабрика LLM адаптеров
 */
export class LLMAdapterFactory {
  constructor() {
    this.adapters = new Map();
    this.registerDefaultAdapters();
  }

  /**
   * Регистрирует адаптер для определённого типа LLM
   * @param {string} llmType - Тип LLM
   * @param {LLMAdapter} adapter - Адаптер
   */
  registerAdapter(llmType, adapter) {
    if (!adapter || typeof adapter.supports !== 'function' || typeof adapter.call !== 'function') {
      throw new Error('Адаптер должен быть экземпляром LLMAdapter');
    }
    this.adapters.set(llmType, adapter);
    console.log(`[LLM Factory] Зарегистрирован адаптер для ${llmType}`);
  }

  /**
   * Регистрирует адаптеры по умолчанию
   */
  registerDefaultAdapters() {
    const lmStudioAdapter = new LMStudioAdapter();

    // Регистрируем Ollama
    this.registerAdapter('ollama', new OllamaAdapter());

    // Регистрируем LM Studio и совместимые типы
    this.registerAdapter('lmstudio', lmStudioAdapter);
    this.registerAdapter('aya', lmStudioAdapter);
    this.registerAdapter('llama', lmStudioAdapter);
    this.registerAdapter('mistral', lmStudioAdapter);
    this.registerAdapter('deepseek', lmStudioAdapter);
    this.registerAdapter('qwen', lmStudioAdapter);
    this.registerAdapter('grok', lmStudioAdapter);

    // Регистрируем облачные API
    this.registerAdapter('openai', new OpenAIAdapter());
    this.registerAdapter('anthropic', new AnthropicAdapter());
    this.registerAdapter('google', new GoogleAdapter());
    this.registerAdapter('groq', new GroqAdapter());
    this.registerAdapter('uncloseai', new UncloseAIAdapter());

    console.log(`[LLM Factory] Зарегистрировано ${this.adapters.size} адаптеров для типов: ${this.getSupportedTypes().join(', ')}`);
  }

  /**
   * Возвращает адаптер для указанного типа LLM
   * @param {string} llmType - Тип LLM
   * @returns {LLMAdapter}
   * @throws {Error} Если адаптер не найден
   */
  getAdapter(llmType) {
    const adapter = this.adapters.get(llmType);
    if (!adapter) {
      throw new Error(`Адаптер для типа LLM '${llmType}' не найден`);
    }
    return adapter;
  }

  /**
   * Проверяет, поддерживается ли тип LLM
   * @param {string} llmType - Тип LLM
   * @returns {boolean}
   */
  supports(llmType) {
    return this.adapters.has(llmType);
  }

  /**
   * Список зарегистрированных типов LLM
   * @returns {string[]}
   */
  getSupportedTypes() {
    return Array.from(this.adapters.keys());
  }
}

// Синглтон фабрики
let factoryInstance = null;

/**
 * Возвращает экземпляр фабрики адаптеров
 * @returns {LLMAdapterFactory}
 */
export function getAdapterFactory() {
  if (!factoryInstance) {
    factoryInstance = new LLMAdapterFactory();
  }
  return factoryInstance;
}