// Тест интеграции новой системы LLM адаптеров
import { getAdapterFactory } from './llm-adapters/factory.js';
import { getLLMCache } from './cache/llmCache.js';

console.log('=== Тест интеграции LLM адаптеров ===\n');

// Тест 1: Фабрика адаптеров
console.log('1. Проверка фабрики адаптеров:');
const factory = getAdapterFactory();
const supportedTypes = factory.getSupportedTypes();
console.log(`   Поддерживаемые типы: ${supportedTypes.join(', ')}`);
console.log(`   Всего типов: ${supportedTypes.length}\n`);

// Тест 2: Получение адаптеров
console.log('2. Получение адаптеров:');
const testTypes = ['ollama', 'lmstudio', 'openai', 'anthropic', 'groq', 'uncloseai'];
for (const type of testTypes) {
  try {
    const adapter = factory.getAdapter(type);
    console.log(`   ✓ ${type}: доступен (класс: ${adapter.constructor.name})`);
  } catch (error) {
    console.log(`   ✗ ${type}: ${error.message}`);
  }
}
console.log('');

// Тест 3: Кэш
console.log('3. Проверка кэша:');
const cache = getLLMCache({ maxSize: 10, ttl: 60000 });

// Сохраняем тестовые данные
const testMessages = [{ role: 'user', content: 'Hello' }];
cache.set('test-llm', testMessages, 'Test response from cache');
const cached = cache.get('test-llm', testMessages);
if (cached === 'Test response from cache') {
  console.log('   ✓ Кэш работает: данные сохраняются и извлекаются');
} else {
  console.log('   ✗ Кэш не работает');
}

// Очистка
cache.clear();
console.log('   Кэш очищен\n');

// Тест 4: Статистика кэша
const stats = cache.getStats();
console.log(`4. Статистика кэша:`);
console.log(`   Размер: ${stats.size}/${stats.maxSize}`);
console.log(`   TTL: ${stats.ttl}ms\n`);

// Тест 5: Проверка совместимости типов LMStudio
console.log('5. Проверка совместимости LMStudio адаптера:');
const lmstudioAdapter = factory.getAdapter('lmstudio');
const compatibleTypes = ['aya', 'llama', 'mistral', 'deepseek', 'qwen', 'grok'];
for (const type of compatibleTypes) {
  const adapter = factory.getAdapter(type);
  if (adapter === lmstudioAdapter) {
    console.log(`   ✓ ${type}: использует LMStudioAdapter`);
  } else {
    console.log(`   ✗ ${type}: не использует LMStudioAdapter`);
  }
}

console.log('\n=== Тест завершен ===');
console.log('\nРекомендации:');
console.log('1. Запусти приложение: npm start');
console.log('2. Проверь создание LLM в UI');
console.log('3. Проверь отправку сообщений в чат');
console.log('4. Если есть ошибки - проверь логи backend');