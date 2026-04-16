# Чек-лист тестирования интеграции LLM адаптеров

## 🚨 Перед тестированием

### 1. Создай backup текущего состояния
```bash
# Скопируй папку проекта
cp -r neuro-office-builder neuro-office-builder-backup
```

### 2. Убедись что зависимости установлены
```bash
cd backend
npm list jest supertest 2>/dev/null || npm install
```

### 3. Проверь что старые функции всё ещё существуют (fallback)
```bash
grep -n "callOllama\|callLMStudio\|callOpenAI" server.js | head -5
```
**Должно показать:** определения функций и вызовы в fallback функциях

## 🧪 Шаги тестирования

### Шаг 1: Проверка компиляции кода
```bash
cd backend
node --experimental-vm-modules test-adapters-integration.js
```
**Ожидаемый результат:** Все тесты проходят, нет ошибок импорта

### Шаг 2: Запуск существующих тестов
```bash
cd backend
NODE_OPTIONS="--experimental-vm-modules" npm test -- smoke.test.js security.test.js
```
**Ожидаемый результат:** Тесты проходят (может быть предупреждение о SECURITY логах)

### Шаг 3: Запуск приложения
```bash
# В отдельном терминале/окне:
cd backend
npm start

# В другом терминале/окне:
cd ..
npm run dev
```

### Шаг 4: Тестирование в браузере
1. Открой `http://localhost:5173`
2. **Вкладка LLM:** Создай новое подключение:
   - Тип: `ollama` (если запущен Ollama)
   - Endpoint: `http://localhost:11434`
   - Имя: `Test Ollama`
3. **Вкладка Роли:** Создай тестовую роль:
   - Название: `Тестовый помощник`
   - LLM: выбери созданный `Test Ollama`
   - Системный промпт: `Ты тестовый помощник. Отвечай "Тест пройден"`
4. **Вкладка Запуск:** Выбери роль и нажми "Запустить и наблюдать"
5. **Чат:** Отправь сообщение `Привет`

**Ожидаемый результат:**
- LLM создаётся без ошибок
- Роль создаётся без ошибок
- Чат открывается
- Ответ содержит "Тест пройден" или ответ от LLM

## 🔍 Что проверять в логах backend

### Нормальные логи:
```
[LLM Factory] Зарегистрировано X адаптеров
[CACHE HIT] Test Ollama: 1 сообщений
[LLM ADAPTER] ollama → Test Ollama: ответ получен (Y chars)
```

### Критические ошибки:
```
Error: Адаптер для типа X не найден
Error: LLM не найден: X
TypeError: adapter.call is not a function
```

## 🛠 Действия при ошибках

### Ошибка 1: "Адаптер для типа X не найден"
**Решение:** Проверь что тип LLM есть в списке поддерживаемых:
```javascript
// В консоли backend:
node -e "import('./llm-adapters/factory.js').then(m => console.log(m.getAdapterFactory().getSupportedTypes()))"
```

### Ошибка 2: "LLM не найден: X"
**Решение:** Проверь что LLM создан в UI и сохранился в `backend/data/llms.json`

### Ошибка 3: Ошибка fetch/таймаута
**Решение:** Проверь что LLM сервер запущен (Ollama/LM Studio)

## 🔄 Откат изменений

Если приложение не работает:

### Вариант A: Временный откат
```javascript
// В server.js закомментируй вызов callLLMByConfig и раскомментируй старый код
// ИЛИ просто переименуй callLLMNew обратно в callLLM
```

### Вариант B: Полный откат
```bash
# Восстанови backup
rm -rf neuro-office-builder
cp -r neuro-office-builder-backup neuro-office-builder
cd neuro-office-builder
```

## 📊 Что изменилось

### Новые функции:
1. `callLLMNew()` - основная функция с адаптерами и кэшем
2. `callLLMByConfig()` - вызов по объекту llm конфигурации
3. `callLLMDirect()` - fallback на старые функции

### Изменённые endpoints:
1. `/api/chat` - теперь использует `callLLMByConfig`
2. Автоматическая оркестрация - использует `callLLMByConfig`
3. Обработка CALL маркеров - использует `callLLMByConfig`

### Старые функции (остались для совместимости):
- `callLLM()` - старая функция (используется в fallback)
- `callOllama()`, `callLMStudio()` и др. - используются в `callLLMDirect`

## ✅ Критерии успешной интеграции

1. **✅** Приложение запускается (`npm start` и `npm run dev`)
2. **✅** UI открывается (`http://localhost:5173`)
3. **✅** LLM создаются в UI
4. **✅** Роли создаются в UI
5. **✅** Чат работает и возвращает ответы
6. **✅** В логах видны записи `[LLM ADAPTER]` или `[CACHE HIT]`

## 📝 Что сообщить если есть проблемы

1. **Текст ошибки** из консоли backend
2. **Шаги которые выполнил** (какой LLM создавал, какую роль)
3. **Скриншот UI** если есть
4. **Содержимое логов** последние 20 строк

---
*Создано: 2026-04-13*
*Для: NeuroOffice Builder интеграция LLM адаптеров*