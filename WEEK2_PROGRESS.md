# Неделя 2: Рефакторинг LLM адаптеров - Прогресс

## 📋 Что сделано

### ✅ 1. Создана модульная структура LLM адаптеров

#### **Базовый класс адаптера** (`llm-adapters/adapter.js`)
- `LLMAdapter` - абстрактный класс с методами:
  - `supports(llmType)` - проверка поддержки типа
  - `call(messages, config)` - вызов LLM API
  - `validateConfig(config)` - валидация конфигурации
  - `createRequestBody(messages, options)` - создание тела запроса
  - `extractResponseText(responseData)` - извлечение текста ответа

#### **Конкретные адаптеры**
1. **OllamaAdapter** (`llm-adapters/ollama.js`)
   - Поддерживает тип `'ollama'`
   - Требует `endpoint` в конфигурации
   - Использует `/api/chat` endpoint

2. **LMStudioAdapter** (`llm-adapters/lmstudio.js`)
   - Поддерживает типы: `'lmstudio'`, `'aya'`, `'llama'`, `'mistral'`, `'deepseek'`, `'qwen'`, `'grok'`
   - Требует `endpoint` в конфигурации
   - Использует `/v1/chat/completions` endpoint (OpenAI-совместимый)

3. **OpenAIAdapter** (`llm-adapters/openai.js`)
   - Поддерживает тип `'openai'`
   - Требует `apiKey` в конфигурации
   - Использует OpenAI API

4. **AnthropicAdapter** (`llm-adapters/anthropic.js`)
   - Поддерживает тип `'anthropic'`
   - Требует `apiKey` в конфигурации
   - Использует Anthropic Messages API

5. **GroqAdapter** (`llm-adapters/groq.js`)
   - Поддерживает тип `'groq'`
   - Требует `apiKey` в конфигурации
   - Использует retry логику через `withRetry`

6. **UncloseAIAdapter** (`llm-adapters/uncloseai.js`)
   - Поддерживает тип `'uncloseai'`
   - Требует `endpoint` в конфигурации
   - Использует retry логику

#### **Фабрика адаптеров** (`llm-adapters/factory.js`)
- `LLMAdapterFactory` - регистрирует и предоставляет адаптеры
- `getAdapterFactory()` - синглтон фабрики
- Автоматическая регистрация всех адаптеров
- Поддерживает 11 типов LLM

#### **Кэширование** (`cache/llmCache.js`)
- `LLMCache` - LRU кэш с TTL
- `getLLMCache()` - синглтон кэша
- Автоматическая очистка устаревших записей
- Генерация ключей на основе llmName и messages

#### **Утилиты** (`utils/llmUtils.js`)
- `fetchWithTimeout()` - fetch с таймаутом (120 сек)
- `withRetry()` - повторные попытки с exponential backoff

#### **Экспорт модулей**
- `llm-adapters/index.js` - экспорт всех адаптеров и фабрики
- `cache/index.js` - экспорт кэша

## 🔧 Что осталось сделать

### ⚠️ 1. Интеграция с server.js (ВАЖНО)
**Текущая ситуация:**
- Старые функции `callOllama`, `callLMStudio` и др. всё ещё используются в `server.js`
- API endpoint `/api/chat` вызывает старые функции напрямую
- Фабрика и кэш подключены, но не используются

**Необходимые изменения:**
1. **Заменить вызовы в `/api/chat` endpoint** (строки ~550-570)
   ```javascript
   // Было:
   if (llm.type === 'ollama') {
     response = await callOllama(endpoint, messages);
   }
   
   // Стало:
   const adapter = adapterFactory.getAdapter(llm.type);
   response = await adapter.call(messages, { endpoint, apiKey: llm.apiKey });
   ```

2. **Обновить функцию `callLLM`** (строка 834)
   - Добавить использование фабрики
   - Добавить кэширование через `getLLMCache()`

3. **Удалить старые функции** (callOllama, callLMStudio, callOpenAI, callAnthropic, callGroq, callUncloseAI)
   - Можно оставить для обратной совместимости на время перехода

### ⚠️ 2. Написание тестов (по запросу пользователя)
**Требуется создать:**
1. `__tests__/adapters/adapter.test.js` - базовый класс
2. `__tests__/adapters/ollamaAdapter.test.js` - OllamaAdapter
3. `__tests__/adapters/lmstudioAdapter.test.js` - LMStudioAdapter
4. `__tests__/adapters/factory.test.js` - фабрика адаптеров
5. `__tests__/adapters/cache.test.js` - кэш LLMCache
6. `__tests__/adapters/integration.test.js` - интеграционные тесты

**Особенности:**
- Использовать Jest с ES модулями
- Мокать fetch запросы
- Тестировать кэширование (hit/miss, TTL)
- Проверить валидацию конфигурации

### ⚠️ 3. Добавление зависимостей
**Рекомендуется добавить:**
```json
"dependencies": {
  "lru-cache": "^10.0.0"
}
```
Для более продвинутого кэширования (опционально)

## 🧪 Как протестировать текущую реализацию

### **Тест 1: Фабрика адаптеров**
```javascript
import { getAdapterFactory } from './llm-adapters/factory.js';

const factory = getAdapterFactory();
console.log(factory.getSupportedTypes()); // ['ollama', 'lmstudio', ...]

const ollamaAdapter = factory.getAdapter('ollama');
console.log(ollamaAdapter.supports('ollama')); // true
```

### **Тест 2: Кэширование**
```javascript
import { getLLMCache } from './cache/llmCache.js';

const cache = getLLMCache();
cache.set('test-llm', [{role: 'user', content: 'Hello'}], 'Test response');
const cached = cache.get('test-llm', [{role: 'user', content: 'Hello'}]);
console.log(cached); // 'Test response'
```

### **Тест 3: Адаптер Ollama**
```javascript
import { OllamaAdapter } from './llm-adapters/ollama.js';

const adapter = new OllamaAdapter();
console.log(adapter.supports('ollama')); // true
console.log(adapter.supports('openai')); // false

// Требует мока fetch
```

## 🚀 Следующие шаги

### **Приоритет 1: Интеграция с server.js**
1. Создать функцию `callLLMNew` использующую фабрику и кэш
2. Заменить вызовы в `/api/chat` endpoint
3. Протестировать что приложение работает

### **Приоритет 2: Написание тестов**
1. Создать структуру тестовых файлов
2. Написать unit тесты для адаптеров
3. Написать интеграционные тесты

### **Приоритет 3: Улучшение кэширования**
1. Добавить хэширование ключей (вместо JSON.stringify)
2. Добавить статистику использования кэша
3. Добавить конфигурацию через environment variables

## 📊 Статистика изменений

- **Добавлено:** 12 новых файлов
- **Изменено:** 3 существующих файла (package.json, server.js, factory.js)
- **Удалено:** 0 файлов
- **Строки кода:** ~500 строк

## 👥 Для вайбкодера

**Текущий статус:** Архитектура готова, требуется интеграция

**Твоя задача:** Протестировать что приложение **всё ещё работает** после изменений:
1. Запусти `run.bat`
2. Открой `http://localhost:5173`
3. Проверь создание LLM (Ollama, LM Studio и др.)
4. Проверь отправку сообщений в чат

**Если работает** → можно продолжить интеграцию
**Если не работает** → откати изменения в server.js до интеграции

**Рекомендация:** Сначала протестировать текущее состояние (без изменений в server.js), затем поэтапно интегрировать.

---

*Создано: 2026-04-13*
*Автор: Claude Code*
*Проект: NeuroOffice Builder*
*Этап: Неделя 2 (рефакторинг LLM адаптеров)*