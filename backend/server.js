import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Fuse from 'fuse.js';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import { safeResolvePath, isSafeFile, isSafeDirectory } from './utils/pathSafety.js';
import { validateString, validateEnum, validateUrl, validateSafePath, validateLLMType, requireFields, validateFileSize } from './middleware/validation.js';
import { getAdapterFactory } from './llm-adapters/factory.js';
import { getLLMCache } from './cache/llmCache.js';

dotenv.config();

// ==================== API KEYS FROM ENV ====================
function getApiKey(llmType, llmApiKey) {
  // Если ключ передан прямо в LLM - используем его
  if (llmApiKey) return llmApiKey;
  
  // Иначе ищем в .env
  switch (llmType) {
    case 'openai': return process.env.OPENAI_API_KEY;
    case 'anthropic': return process.env.ANTHROPIC_API_KEY;
    case 'google': return process.env.GOOGLE_API_KEY;
    case 'groq': return process.env.GROQ_API_KEY;
    default: return null;
  }
}

function getEndpoint(llmType, llmEndpoint) {
  if (llmEndpoint) return llmEndpoint;
  
  switch (llmType) {
    case 'ollama': return process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    case 'lmstudio':
    case 'aya':
    case 'llama':
    case 'mistral':
    case 'deepseek':
    case 'qwen':
    case 'grok':
      return process.env.LMSTUDIO_ENDPOINT || 'http://localhost:1234';
    default: return null;
  }
}

// Импорт модулей оркестрации (могут быть отключены)
import { setRoles, setDocuments, delegate } from './delegate.js';
import { orchestrate } from './orchestrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==================== ДАННЫЕ В ПАМЯТИ (для скорости) ====================
let llms = [];
let roles = [];
let knowledgeBases = [];
let documents = [];
let conversationHistory = [];
let orchestrationEnabled = false;

// ==================== ИСТОРИЯ ЧАТА С ДИСКОМ ====================
const HISTORY_FILE = join(__dirname, 'data', 'conversation-history.json');
let historySaveTimer = null;

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      conversationHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      console.log(`[ИСТОРИЯ] Загружено ${conversationHistory.length} сообщений`);
    }
  } catch (e) {
    console.error('[ИСТОРИЯ] Ошибка загрузки:', e.message);
    conversationHistory = [];
  }
}

function saveHistory() {
  if (historySaveTimer) {
    clearTimeout(historySaveTimer);
  }
  historySaveTimer = setTimeout(() => {
    try {
      const dir = join(__dirname, 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(conversationHistory, null, 2));
      console.log(`[ИСТОРИЯ] Сохранено ${conversationHistory.length} сообщений`);
    } catch (e) {
      console.error('[ИСТОРИЯ] Ошибка сохранения:', e.message);
    }
  }, 5000);
}

loadHistory();

// ==================== ПОДДЕРЖКА ФАЙЛОВ PDF, DOCX, XLSX ====================
async function parseFile(filePath) {
  const safePath = safeResolvePath(filePath);
  if (!safePath || !isSafeFile(safePath)) {
    console.error(`[SECURITY] Небезопасный путь к файлу: ${filePath}`);
    return null;
  }

  const ext = filePath.toLowerCase().split('.').pop();

  try {
    if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ path: safePath });
      return result.value;
    } else if (ext === 'pdf') {
      const dataBuffer = fs.readFileSync(safePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } else if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.readFile(safePath);
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_csv(sheet) + '\n';
      });
      return text;
    } else if (ext === 'txt' || ext === 'md') {
      return fs.readFileSync(safePath, 'utf-8');
    }
    return null;
  } catch (e) {
    console.error(`[ФАЙЛ] Ошибка парсинга ${filePath}:`, e.message);
    return null;
  }
}

async function parseFileFromContent(filename, content, mimeType) {
  const ext = filename.toLowerCase().split('.').pop();
  
  try {
    if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(content) });
      return result.value;
    } else if (ext === 'pdf') {
      const data = await pdf(Buffer.from(content));
      return data.text;
    } else if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(Buffer.from(content), { type: 'buffer' });
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_csv(sheet) + '\n';
      });
      return text;
    }
    return null;
  } catch (e) {
    console.error(`[ФАЙЛ] Ошибка парсинга ${filename}:`, e.message);
    return null;
  }
}

// ==================== ИНДЕКСАЦИЯ ПАПОК ====================
async function scanFolder(folderPath, roleId = '') {
  const safePath = safeResolvePath(folderPath);
  if (!safePath || !isSafeDirectory(safePath)) {
    console.error(`[SECURITY] Небезопасный путь к папке: ${folderPath}`);
    return [];
  }

  const supportedExts = ['.txt', '.md', '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv'];
  const results = [];

  function walkDir(dir) {
    try {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          const ext = '.' + item.toLowerCase().split('.').pop();
          if (supportedExts.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (e) {
      console.error(`[ПАПКА] Ошибка сканирования ${dir}:`, e.message);
    }
  }

  walkDir(safePath);
  return results;
}

// ==================== FUSE.JS ПОИСК ====================
let searchIndex = null;

function rebuildSearchIndex() {
  const docs = documents.map(d => ({
    id: d.id,
    name: d.name,
    content: d.content,
    roleId: d.roleId,
    type: d.type || 'text',
    filePath: d.filePath || ''
  }));
  searchIndex = new Fuse(docs, {
    keys: ['name', 'content'],
    includeScore: true,
    threshold: 0.4,
    ignoreLocation: true
  });
}

function searchDocuments(query, roleId = null, limit = 5) {
  if (!searchIndex) return [];
  let results = searchIndex.search(query);
  if (roleId) {
    results = results.filter(r => r.item.roleId === roleId);
  }
  return results.slice(0, limit).map(r => ({
    id: r.item.id,
    name: r.item.name,
    type: r.item.type || 'text',
    filePath: r.item.filePath || '',
    score: r.score,
    snippet: r.item.content.substring(0, 300),
    source: r.item.type === 'file' ? 'Файл' : 'База знаний'
  }));
}

// ==================== API: LLM ====================

// Получить все LLM
app.get('/api/llms', (req, res) => {
  res.json(llms);
});

// Добавить LLM
app.post('/api/llms', [
  requireFields(['name', 'type']),
  validateString('name', 100),
  validateLLMType,
  validateString('apiKey', 500),
  validateUrl('endpoint')
], (req, res) => {
  const { name, type, apiKey, endpoint } = req.body;
  const llm = { id: uuidv4(), name, type, apiKey, endpoint, createdAt: new Date().toISOString() };
  llms.push(llm);
  console.log(`[LLM] Добавлен: ${name} (${type})`);
  res.json(llm);
});

// Удалить LLM
app.delete('/api/llms/:id', (req, res) => {
  llms = llms.filter(l => l.id !== req.params.id);
  res.json({ success: true });
});

// ==================== API: РОЛИ ====================

app.get('/api/roles', (req, res) => {
  res.json(roles);
});

app.post('/api/roles', [
  requireFields(['name', 'systemPrompt', 'llmId']),
  validateString('name', 100),
  validateString('description', 500),
  validateString('systemPrompt', 10000),
  validateString('llmId', 100),
  validateString('llmName', 100)
], (req, res) => {
  const { name, description, systemPrompt, llmId, llmName, knowledgeBases: kbs } = req.body;
  
  // Если пришли полные KB - сохраняем их
  const savedKbs = []
  if (kbs && Array.isArray(kbs)) {
    for (const kb of kbs) {
      // Сохраняем если есть id, name и content не undefined
      if (kb.id && kb.name && kb.content !== undefined) {
        // Проверяем, есть ли уже такая KB
        let existing = knowledgeBases.find(k => k.name === kb.name)
        if (!existing) {
          existing = { 
            id: kb.id || uuidv4(), 
            name: kb.name, 
            type: kb.type || 'file', 
            content: kb.content || '', 
            url: kb.url,
            createdAt: new Date().toISOString() 
          }
          knowledgeBases.push(existing)
          documents.push({ id: existing.id, name: existing.name, content: existing.content, roleId: '', type: 'text' })
        }
        savedKbs.push(existing)
      }
    }
    rebuildSearchIndex()
  }
  
  const role = { 
    id: uuidv4(), 
    name, 
    description, 
    systemPrompt, 
    llmId, 
    llmName,
    knowledgeBases: savedKbs,
    createdAt: new Date().toISOString() 
  };
  roles.push(role);
  if (orchestrationEnabled) setRoles(roles);
  console.log(`[РОЛЬ] Создана: ${name} (${savedKbs.length} БД)`);
  res.json(role);
});

app.put('/api/roles/:id', (req, res) => {
  const { name, description, systemPrompt, llmId, llmName, knowledgeBases: kbs } = req.body;
  const idx = roles.findIndex(r => r.id === req.params.id);
  if (idx !== -1) {
    roles[idx] = { ...roles[idx], name, description, systemPrompt, llmId, knowledgeBases: kbs };
    if (orchestrationEnabled) setRoles(roles);
    console.log(`[РОЛЬ] Обновлена: ${name}`);
  }
  res.json(roles[idx]);
});

app.delete('/api/roles/:id', (req, res) => {
  roles = roles.filter(r => r.id !== req.params.id);
  if (orchestrationEnabled) setRoles(roles);
  res.json({ success: true });
});

// ==================== API: БАЗЫ ЗНАНИЙ ====================

app.get('/api/knowledge-bases', (req, res) => {
  res.json(knowledgeBases);
});

app.post('/api/knowledge-bases', (req, res) => {
  const { name, type, content, url, roleId } = req.body;
  const kb = { id: uuidv4(), name, type, content, url, roleId, createdAt: new Date().toISOString() };
  knowledgeBases.push(kb);
  
  if (content) {
    documents.push({ id: kb.id, name, content, roleId, type: 'text' });
    rebuildSearchIndex();
    if (orchestrationEnabled) setDocuments(documents);
  }
  
  console.log(`[БАЗА] Добавлена: ${name}`);
  res.json(kb);
});

app.delete('/api/knowledge-bases/:id', (req, res) => {
  const id = req.params.id;
  knowledgeBases = knowledgeBases.filter(kb => kb.id !== id);
  documents = documents.filter(d => d.id !== id);
  rebuildSearchIndex();
  if (orchestrationEnabled) setDocuments(documents);
  res.json({ success: true });
});

// ==================== API: ИНДЕКСАЦИЯ ПАПОК ====================
app.post('/api/folders/scan', [
  requireFields(['folderPath']),
  validateSafePath('folderPath')
], async (req, res) => {
  const { folderPath, roleId = '' } = req.body;

  const files = await scanFolder(folderPath, roleId);
  const results = [];
  
  for (const filePath of files) {
    const content = await parseFile(filePath);
    if (content) {
      const name = filePath.split(/[/\\]/).pop();
      results.push({
        id: uuidv4(),
        name,
        filePath,
        content: content.substring(0, 50000),
        roleId,
        type: 'file',
        addedAt: new Date().toISOString()
      });
    }
  }
  
  res.json({ files: results, count: results.length });
});

app.post('/api/folders/import', async (req, res) => {
  const { files, roleId = '' } = req.body;
  
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'Укажите файлы' });
  }
  
  const imported = [];
  
  for (const file of files) {
    const { name, content } = file;
    const text = await parseFileFromContent(name, content);
    if (text) {
      const kb = {
        id: uuidv4(),
        name,
        content: text.substring(0, 50000),
        roleId,
        type: 'file',
        addedAt: new Date().toISOString()
      };
      knowledgeBases.push(kb);
      documents.push({ id: kb.id, name: kb.name, content: kb.content, roleId: kb.roleId, type: 'file' });
      imported.push(kb);
    }
  }
  
  rebuildSearchIndex();
  res.json({ imported, count: imported.length });
});

// ==================== API: БЫСТРЫЙ ПОИСК ПО ФАЙЛАМ ====================
app.post('/api/search/files', (req, res) => {
  const { query, limit = 10 } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Укажите запрос' });
  }
  
  const results = searchDocuments(query, '', limit);
  res.json(results);
});

// ==================== API: RAG (ПОИСК) ====================

app.post('/api/rag/search', (req, res) => {
  const { query, roleId, limit = 5 } = req.body;
  const results = searchDocuments(query, roleId);
  res.json(results.slice(0, limit));
});

// ==================== API: LLM ЗАПРОСЫ ====================

app.post('/api/chat', async (req, res) => {
  const { roleId, message, includeHistory = true } = req.body;
  
  const role = roles.find(r => r.id === roleId);
  if (!role) {
    return res.status(404).json({ error: 'Роль не найдена' });
  }
  
  // Ищем LLM по имени (т.к. ID могут не совпадать между фронтендом и бэкендом)
  const llm = llms.find(l => l.name === role.llmName);
  if (!llm) {
    // Пробуем найти по любому LLM если имя не найдено
    return res.status(404).json({ error: `LLM не найден: ${role.llmName}` });
  }
  
  // Поиск релевантных документов
  const relevantDocs = searchDocuments(message, roleId);
  
  // === АВТОМАТИЧЕСКАЯ ОРКЕСТРАЦИЯ ===
  let subResponse = '';
  let subRoleName = '';
  
  const msgLower = message.toLowerCase();
  
  // Проверяем - если в сообщении есть "советник" - вызываем советника
  // если есть "юрист" - вызываем юриста
  // если есть "секретарь" или "расчет/смета" - вызываем секретаря
  let targetRole = null;
  
  if (/советник|руководитель|директор/i.test(msgLower)) {
    targetRole = roles.find(r => r.name && /советник/i.test(r.name) && r.llmName);
    if (targetRole && targetRole.id === roleId) {
      targetRole = roles.find(r => r.name && /советник/i.test(r.name) && r.llmName && r.id !== roleId);
    }
  } else if (/юрист|договор|акт|судебн|претенз/i.test(msgLower)) {
    targetRole = roles.find(r => r.name && /юрист/i.test(r.name) && r.llmName);
    if (targetRole && targetRole.id === roleId) {
      targetRole = roles.find(r => r.name && /юрист/i.test(r.name) && r.llmName && r.id !== roleId);
    }
  } else if (/секретар|расчет|смет|кп|цен|прайс/i.test(msgLower)) {
    targetRole = roles.find(r => r.name && /секретар/i.test(r.name) && r.llmName);
    if (targetRole && targetRole.id === roleId) {
      targetRole = roles.find(r => r.name && /секретар/i.test(r.name) && r.llmName && r.id !== roleId);
    }
  }
  
  if (targetRole) {
    console.log(`[ОРКЕСТРАЦИЯ] -> ${targetRole.name}`);
    const targetLlm = llms.find(l => l.name === targetRole.llmName);
    if (targetLlm) {
      const targetEndpoint = getEndpoint(targetLlm.type, targetLlm.endpoint);
      const targetMsgs = [
        { role: 'system', content: targetRole.systemPrompt },
        { role: 'user', content: message + '\n\nКонтекст из базы знаний:\n' + relevantDocs.map(d => d.snippet).join('\n') }
      ];
      subResponse = await callLLMByConfig(targetLlm, targetMsgs);
      subRoleName = targetRole.name;
    }
  }
    
  // Формируем контекст из найденных документов
  let context = '';
  if (relevantDocs.length > 0) {
    context = '\n\n📚 Релевантные документы из базы знаний:\n';
    relevantDocs.forEach((doc, i) => {
      context += `\n[${i + 1}] ${doc.name}:\n${doc.snippet}...\n`;
    });
  }
  
  // Если была оркестрация - возвращаем ответ подчинённого, не вызываем руководителя
  if (subResponse && subRoleName) {
    console.log(`[ОРКЕСТРАЦИЯ] Возвращаю ответ от ${subRoleName}`);
    conversationHistory.push({ roleId, message, response: subResponse, timestamp: new Date().toISOString() });
    if (conversationHistory.length > 100) conversationHistory = conversationHistory.slice(-100);
    saveHistory();
    const subRoleLlm = roles.find(r => r.name && r.name.includes(subRoleName))?.llmName;
    return res.json({ 
      response: subResponse, 
      documents: relevantDocs,
      llm: llms.find(l => l.name === subRoleLlm)?.name || 'unknown',
      subRole: subRoleName
    });
  }
   
  // Формируем сообщения
  const messages = [];
  
  // Инструкция по оркестрации (кратко)
  const availableRoles = ['Юрист', 'Секретарь'].filter(name => roles.some(r => r.name && r.name.includes(name)))
  const orchInstructions = availableRoles.length > 0 ? `\n\nВАЖНО! Если нужен ДОГОВОР, АКТ, СЧЕТ или юридическая помощь - сразу вызывай Юриста: [CALL:Юрист:текст запроса]\nЕсли нужен РАСЧЕТ, КП или СМЕТА - сразу вызывай Секретаря: [CALL:Секретарь:текст запроса]\n` : '';
  
  // System prompt + контекст + инструкции по оркестрации
  const fullSystem = role.systemPrompt + context + orchInstructions;
  messages.push({ role: 'system', content: fullSystem });
  
  // История чата (последние 5 сообщений)
  if (includeHistory) {
    const history = conversationHistory.filter(h => h.roleId === roleId).slice(-10);
    history.forEach(h => {
      messages.push({ role: 'user', content: h.message });
      messages.push({ role: 'assistant', content: h.response });
    });
  }
  
  // Текущее сообщение
  messages.push({ role: 'user', content: message });
  
  console.log(`[CHAT] Запрос к ${llm.name}: ${message.substring(0, 50)}...`);

  try {
    let response;
    const apiKey = getApiKey(llm.type, llm.apiKey);
    const endpoint = getEndpoint(llm.type, llm.endpoint);
    
    response = await callLLMByConfig(llm, messages);

    // ОРКЕСТРАЦИЯ: проверяем есть ли вызовы других ролей
    const calls = response.match(/\[CALL:([^:]+):([^\]]+)\]/g);
    if (calls) {
      console.log(`[ОРКЕСТРАЦИЯ] Найдено вызовов: ${calls.length}`);
      for (const call of calls) {
        const match = call.match(/\[CALL:([^:]+):([^\]]+)\]/);
        if (match) {
          const targetRoleName = match[1].trim();
          const targetMessage = match[2].trim();
          
          // Ищем роль по имени
          const targetRole = roles.find(r => r.name && r.name.toLowerCase().includes(targetRoleName.toLowerCase()));
          if (targetRole && targetRole.llmName) {
            console.log(`[ОРКЕСТРАЦИЯ] Вызов ${targetRoleName}: ${targetMessage.substring(0, 30)}...`);
            
            // Рекурсивно вызываем другую роль
            const targetLlm = llms.find(l => l.name === targetRole.llmName);
            if (targetLlm) {
              const targetMessages = [
                { role: 'system', content: targetRole.systemPrompt },
                { role: 'user', content: targetMessage }
              ];
              
              const targetResponse = await callLLMByConfig(targetLlm, targetMessages);
              
              // Заменяем маркер на результат
              response = response.replace(call, `\n\n[Ответ от ${targetRoleName}]:\n${targetResponse}\n`);
            }
          }
        }
      }
    }
    
    // Сохраняем в историю
    conversationHistory.push({ roleId, message, response, timestamp: new Date().toISOString() });
    if (conversationHistory.length > 100) {
      conversationHistory = conversationHistory.slice(-100);
    }
    saveHistory();
    // Очистка от Markdown разметки
    const cleanResponse = response
      .replace(/^#{1,6}\s+/gm, '') // Заголовки
      .replace(/\*\*(.+?)\*\*/g, '$1') // Жирный
      .replace(/\*(.+?)\*/g, '$1') // Курсив
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Ссылки
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // Код
      .replace(/^\s*[-*+]\s+/gm, '') // Списки
      .replace(/^\s*\d+\.\s+/gm, '') // Нумерованные списки
      .replace(/\|.+\|/g, '') // Таблицы
      .trim();
    
    console.log(`[CHAT] Ответ: ${cleanResponse.substring(0, 50)}...`);
    
    res.json({ 
      response: cleanResponse, 
      documents: relevantDocs,
      llm: llm.name,
      subRole: subRoleName || null
    });
    
  } catch (error) {
    console.error('[CHAT] Ошибка:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== LLM АДАПТЕРЫ ====================

// Таймаут для запросов (120 секунд)
const LLM_TIMEOUT = 120 * 1000;

// Retry логика для LLM вызовов
async function withRetry(fn, maxRetries = 3, delay = 2000) {
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

async function fetchWithTimeout(url, options, timeout = LLM_TIMEOUT) {
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

async function callOllama(endpoint, messages) {
  const response = await fetchWithTimeout(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama2',
      messages,
      stream: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.message?.content || 'Пустой ответ';
}

async function callLMStudio(endpoint, messages) {
  const response = await fetchWithTimeout(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'model',
      messages,
      temperature: 0.7,
      max_tokens: 8000
    })
  });
  
  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.status} - ${await response.text()}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Пустой ответ';
}

async function callOpenAI(apiKey, messages, endpoint) {
  const response = await fetchWithTimeout(endpoint || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Пустой ответ';
}

async function callAnthropic(apiKey, messages) {
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-opus-20240229',
      messages,
      max_tokens: 2000
    })
  });
  
  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.content?.[0]?.text || 'Пустой ответ';
}

async function callGroq(apiKey, messages, endpoint) {
  return await withRetry(async () => {
    const response = await fetchWithTimeout(endpoint || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`Groq error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Пустой ответ';
  });
}

async function callUncloseAI(endpoint, messages) {
  return await withRetry(async () => {
    const response = await fetchWithTimeout(endpoint || 'https://hermes.ai.unturf.com/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'hermes-3-llama-3.1-405b',
        messages,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`UncloseAI error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'Пустой ответ';
  });
}

// ==================== LLM WRAPPER ====================

async function callLLM(llmName, messages) {
  const llm = llms.find(l => l.name === llmName);
  if (!llm) {
    throw new Error(`LLM не найден: ${llmName}`);
  }

  if (llm.type === 'ollama') {
    return await callOllama(llm.endpoint || 'http://localhost:11434', messages);
  } else if (llm.type === 'lmstudio' || llm.type === 'aya' || llm.type === 'llama' || llm.type === 'mistral' || llm.type === 'deepseek' || llm.type === 'qwen' || llm.type === 'grok') {
    return await callLMStudio(llm.endpoint || 'http://localhost:1234', messages);
  } else if (llm.type === 'groq') {
    return await callGroq(llm.apiKey, messages, llm.endpoint);
  } else if (llm.type === 'uncloseai') {
    return await callUncloseAI(llm.endpoint, messages);
  } else if (llm.type === 'openai') {
    return await callOpenAI(llm.apiKey, messages, llm.endpoint);
  } else if (llm.type === 'anthropic') {
    return await callAnthropic(llm.apiKey, messages);
  } else {
    return await callLMStudio(llm.endpoint || 'http://localhost:1234', messages);
  }
}

/**
 * Новая версия callLLM с использованием адаптеров и кэша
 */
async function callLLMNew(llmName, messages) {
  const llm = llms.find(l => l.name === llmName);
  if (!llm) {
    throw new Error(`LLM не найден: ${llmName}`);
  }

  // Получаем фабрику адаптеров и кэш
  const adapterFactory = getAdapterFactory();
  const cache = getLLMCache();

  // Проверяем кэш
  const cachedResponse = cache.get(llmName, messages);
  if (cachedResponse) {
    console.log(`[CACHE HIT] ${llmName}: ${messages.length} сообщений`);
    return cachedResponse;
  }

  // Получаем адаптер для типа LLM
  let adapter;
  try {
    adapter = adapterFactory.getAdapter(llm.type);
  } catch (error) {
    console.warn(`[LLM ADAPTER] Адаптер для типа ${llm.type} не найден, используем fallback`);
    // Fallback на старую функцию
    return await callLLM(llmName, messages);
  }

  // Подготавливаем конфигурацию
  const config = {
    apiKey: getApiKey(llm.type, llm.apiKey),
    endpoint: getEndpoint(llm.type, llm.endpoint),
    model: llm.model
  };

  try {
    // Вызываем LLM через адаптер
    const response = await adapter.call(messages, config);

    // Сохраняем в кэш
    cache.set(llmName, messages, response);
    console.log(`[LLM ADAPTER] ${llm.type} → ${llmName}: ответ получен (${response.length} chars)`);

    return response;
  } catch (error) {
    console.error(`[LLM ADAPTER] Ошибка адаптера ${llm.type}:`, error.message);
    // Fallback на старую реализацию
    return await callLLM(llmName, messages);
  }
}

/**
 * Вызывает LLM по конфигурации объекта llm (использует новую систему адаптеров)
 */
async function callLLMByConfig(llm, messages) {
  if (!llm || !llm.type) {
    throw new Error('Некорректная конфигурация LLM');
  }

  // Получаем фабрику адаптеров и кэш
  const adapterFactory = getAdapterFactory();
  const cache = getLLMCache();

  // Генерируем уникальный ключ для кэша (используем имя LLM если есть, иначе комбинацию параметров)
  const llmKey = llm.name || `${llm.type}:${llm.endpoint || 'default'}`;

  // Проверяем кэш
  const cachedResponse = cache.get(llmKey, messages);
  if (cachedResponse) {
    console.log(`[CACHE HIT] ${llmKey}: ${messages.length} сообщений`);
    return cachedResponse;
  }

  // Получаем адаптер для типа LLM
  let adapter;
  try {
    adapter = adapterFactory.getAdapter(llm.type);
  } catch (error) {
    console.warn(`[LLM ADAPTER] Адаптер для типа ${llm.type} не найден, используем fallback`);
    // Fallback на старую логику вызовов
    return await callLLMDirect(llm, messages);
  }

  // Подготавливаем конфигурацию
  const config = {
    apiKey: getApiKey(llm.type, llm.apiKey),
    endpoint: getEndpoint(llm.type, llm.endpoint),
    model: llm.model
  };

  try {
    // Вызываем LLM через адаптер
    const response = await adapter.call(messages, config);

    // Сохраняем в кэш
    cache.set(llmKey, messages, response);
    console.log(`[LLM ADAPTER] ${llm.type} → ${llmKey}: ответ получен (${response.length} chars)`);

    return response;
  } catch (error) {
    console.error(`[LLM ADAPTER] Ошибка адаптера ${llm.type}:`, error.message);
    // Fallback на старую реализацию
    return await callLLMDirect(llm, messages);
  }
}

/**
 * Прямой вызов LLM без адаптеров (fallback функция)
 */
async function callLLMDirect(llm, messages) {
  const apiKey = getApiKey(llm.type, llm.apiKey);
  const endpoint = getEndpoint(llm.type, llm.endpoint);

  if (llm.type === 'ollama') {
    return await callOllama(endpoint, messages);
  } else if (llm.type === 'lmstudio' || llm.type === 'aya' || llm.type === 'llama' || llm.type === 'mistral' || llm.type === 'deepseek' || llm.type === 'qwen' || llm.type === 'grok') {
    return await callLMStudio(endpoint, messages);
  } else if (llm.type === 'groq') {
    return await callGroq(apiKey, messages, endpoint);
  } else if (llm.type === 'uncloseai') {
    return await callUncloseAI(endpoint, messages);
  } else if (llm.type === 'openai') {
    return await callOpenAI(apiKey, messages, endpoint);
  } else if (llm.type === 'anthropic') {
    return await callAnthropic(apiKey, messages);
  } else if (llm.type === 'google') {
    return await callOpenAI(apiKey, messages, endpoint || 'https://generativelanguage.googleapis.com/v1');
  } else {
    return await callLMStudio(endpoint, messages);
  }
}

// ==================== API: DELEGATE (ОТКЛЮЧЕНО) ====================
// Раскомментируй для включения
// ==================== ОРКЕСТРАЦИЯ ====================
// Глобальная настройка - включить/выключить оркестрацию

app.get('/api/orchestration/status', (req, res) => {
  res.json({ enabled: orchestrationEnabled });
});

app.post('/api/orchestration/enable', (req, res) => {
  orchestrationEnabled = true;
  setRoles(roles);
  setDocuments(documents);
  console.log('[ОРКЕСТРАЦИЯ] Включена');
  res.json({ enabled: true });
});

app.post('/api/orchestration/disable', (req, res) => {
  orchestrationEnabled = false;
  console.log('[ОРКЕСТРАЦИЯ] Выключена');
  res.json({ enabled: false });
});

app.post('/api/delegate', async (req, res) => {
  if (!orchestrationEnabled) {
    return res.status(403).json({ error: 'Оркестрация выключена. Включите её в настройках.' });
  }
  const { bossMessage, bossRoleId } = req.body;
  const result = await delegate(bossMessage, bossRoleId, callLLM);
  res.json(result);
});

app.post('/api/orchestrate', async (req, res) => {
  if (!orchestrationEnabled) {
    return res.status(403).json({ error: 'Оркестрация выключена. Включите её в настройках.' });
  }
  const { task, bossRoleId } = req.body;
  const result = await orchestrate(task, bossRoleId, roles, callLLM);
  res.json(result);
});

// ==================== API: СОСТОЯНИЕ ====================

app.get('/api/status', (req, res) => {
  res.json({
    llms: llms.length,
    roles: roles.length,
    knowledgeBases: knowledgeBases.length,
    documents: documents.length,
    uptime: process.uptime()
  });
});

// ==================== API: ИСТОРИЯ ЧАТА ====================

app.get('/api/chat-history/:roleId', (req, res) => {
  const { roleId } = req.params;
  const limit = parseInt(req.query.limit) || 20;
  const history = conversationHistory
    .filter(h => h.roleId === roleId)
    .slice(-limit);
  res.json(history);
});

app.delete('/api/chat-history/:roleId', (req, res) => {
  const { roleId } = req.params;
  conversationHistory = conversationHistory.filter(h => h.roleId !== roleId);
  saveHistory();
  res.json({ success: true });
});

// ==================== ЗАГРУЗКА ДАННЫХ ====================

function loadData() {
  const dataDir = join(__dirname, 'data');
  const llmsFile = join(dataDir, 'llms.json');
  const rolesFile = join(dataDir, 'roles.json');
  const kbsFile = join(dataDir, 'knowledge-bases.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  try {
    if (fs.existsSync(llmsFile)) {
      llms = JSON.parse(fs.readFileSync(llmsFile, 'utf-8'));
      console.log(`[ЗАГРУЗКА] LLM: ${llms.length}`);
    }
    
    if (fs.existsSync(rolesFile)) {
      roles = JSON.parse(fs.readFileSync(rolesFile, 'utf-8'));
      console.log(`[ЗАГРУЗКА] Роли: ${roles.length}`);
    }
    
    if (fs.existsSync(kbsFile)) {
      knowledgeBases = JSON.parse(fs.readFileSync(kbsFile, 'utf-8'));
      documents = knowledgeBases
        .filter(kb => kb.content)
        .map(kb => ({ id: kb.id, name: kb.name, content: kb.content, roleId: kb.roleId, type: 'text' }));
      rebuildSearchIndex();
      console.log(`[ЗАГРУЗКА] Базы знаний: ${knowledgeBases.length}`);
    }
    
    setRoles(roles);
    setDocuments(documents);
  } catch (e) {
    console.error('[ОШИБКА] Загрузка данных:', e.message);
  }
}

function saveData() {
  const dataDir = join(__dirname, 'data');
  
  fs.writeFileSync(join(dataDir, 'llms.json'), JSON.stringify(llms, null, 2));
  fs.writeFileSync(join(dataDir, 'roles.json'), JSON.stringify(roles, null, 2));
  fs.writeFileSync(join(dataDir, 'knowledge-bases.json'), JSON.stringify(knowledgeBases, null, 2));
  
  console.log('[СОХРАНЕНИЕ] Данные сохранены');
}

// Сохраняем каждые 30 секунд
setInterval(saveData, 30000);

// ==================== ЗАПУСК ====================

loadData();

// Запускаем сервер только если файл запущен напрямую, а не импортирован
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`\n🚀 NeuroOffice Backend запущен на http://localhost:${PORT}`);
    console.log(`📊 LLM: ${llms.length} | Роли: ${roles.length} | Базы: ${knowledgeBases.length}`);
    console.log(`\nAPI Endpoints:`);
    console.log(`  GET  /api/status    - Статус системы`);
    console.log(`  GET  /api/llms     - Список LLM`);
    console.log(`  POST /api/llms     - Добавить LLM`);
    console.log(`  GET  /api/roles    - Список ролей`);
    console.log(`  POST /api/roles   - Создать роль`);
    console.log(`  POST /api/chat    - Отправить сообщение`);
    console.log(`  POST /api/rag/search - Поиск по документам\n`);
  });
}

// Экспорт функций для тестирования
export { parseFile, parseFileFromContent, scanFolder, searchDocuments, rebuildSearchIndex };

export default app;
