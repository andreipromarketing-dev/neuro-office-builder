import { useState, useEffect, useRef } from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Input,
  TextArea,
  Select,
  TabNavigation,
  StatusIndicator,
  StatusBadge
} from './components';

// Types and constants from original App.tsx
type Tab = 'llm' | 'roles' | 'launch' | 'settings';

interface LLMConfig {
  id: string;
  name: string;
  type: string;
  apiKey?: string;
  endpoint?: string;
}

interface KnowledgeBase {
  id: string;
  name: string;
  type: 'file' | 'url';
  content?: string;
  url?: string;
  parseInterval?: 'hourly' | 'daily' | 'weekly';
}

interface Role {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  systemPromptFile?: string;
  llmId: string;
  knowledgeBases: KnowledgeBase[];
}

interface Document {
  id: string;
  name: string;
  type?: string;
  content?: string;
  filePath?: string;
  score?: number;
  snippet?: string;
  source?: string;
}

interface LLMTypeOption {
  value: string;
  label: string;
}

const LLM_TYPES: LLMTypeOption[] = [
  { value: 'openai', label: 'OpenAI (GPT-5.4, GPT-5)' },
  { value: 'anthropic', label: 'Anthropic Claude (Opus 4.6, Sonnet 4.6)' },
  { value: 'google', label: 'Google Gemini (3.1 Pro, 2.5 Pro)' },
  { value: 'groq', label: 'Groq (Llama 3.1, DeepSeek R1) - бесплатно' },
  { value: 'uncloseai', label: 'UncloseAI (Hermes, Qwen) - бесплатно' },
  { value: 'ollama', label: 'Ollama (локальный)' },
  { value: 'lmstudio', label: 'LM Studio (локальный)' },
  { value: 'aya', label: 'Cohere Aya Expanse' },
  { value: 'deepseek', label: 'DeepSeek (V3.2, R1)' },
  { value: 'llama', label: 'Meta Llama 4 Maverick' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'grok', label: 'xAI Grok 4' },
  { value: 'qwen', label: 'Qwen3-Max' },
  { value: 'custom', label: 'Свой API' },
];

type LogEntry = { time: string; action: string; details: string };

// Utility functions
function save(key: string, data: any) {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    console.log(`[SAVE] ${key}:`, data);
  } catch (e) {
    console.error('Save error:', e);
  }
}

function load<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    if (!v || v === 'undefined' || v === 'null') {
      console.log(`[LOAD] ${key}: using default (empty)`);
      return def;
    }
    const parsed = JSON.parse(v);
    console.log(`[LOAD] ${key}:`, parsed);
    return parsed;
  } catch (e) {
    console.error('Load error:', e);
    return def;
  }
}

function getTime() {
  const now = new Date();
  return now.toLocaleTimeString('ru-RU', { hour12: false });
}

const API_BASE = 'http://localhost:3001/api';

// Tab configuration
const TABS = [
  { id: 'llm' as Tab, label: '🤖 LLM', icon: '🤖' },
  { id: 'roles' as Tab, label: '👥 Роли', icon: '👥' },
  { id: 'launch' as Tab, label: '🚀 Запуск', icon: '🚀' },
  { id: 'settings' as Tab, label: '⚙️ Настройки', icon: '⚙️' },
];

export default function AppNew() {
  // State from original App
  const [tab, setTab] = useState<Tab>('llm');
  const [llms, setLlms] = useState<LLMConfig[]>([]);
  const [newLLM, setNewLLM] = useState<Omit<LLMConfig, 'id'>>({ name: '', type: '', apiKey: '', endpoint: '' });
  const [showAddLLMForm, setShowAddLLMForm] = useState(false);
  const [llmStatus, setLlmStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [newRole, setNewRole] = useState<Omit<Role, 'id'>>({
    name: '',
    llmId: '',
    description: '',
    systemPrompt: '',
    knowledgeBases: [],
  });
  const [showAddRoleForm, setShowAddRoleForm] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [kbEnabled, setKbEnabled] = useState<Record<string, boolean>>({});
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [msg, setMsg] = useState('');
  const [showModal, setShowModal] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState<{role: string, status: string, input: string, output: string, documents?: Document[]}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [captainRoleId, setCaptainRoleId] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [chainLog, setChainLog] = useState<{from: string, to: string, message: string}[]>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileSearchResults, setFileSearchResults] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);

  const addLog = (action: string, details: string) => {
    const entry: LogEntry = { time: getTime(), action, details };
    setLogs(prev => {
      const updated = [...prev, entry].slice(-100);
      save('nob_logs', updated);
      return updated;
    });
    console.log(`[${entry.time}] ${action}: ${details}`);
  };

  const showMsg = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 2500);
  };

  // Load initial data
  useEffect(() => {
    try {
      const savedLlms = load<LLMConfig[]>('nob_llms', []);
      const savedRoles = load<Role[]>('nob_roles', []);
      const savedLogs = load<LogEntry[]>('nob_logs', []);

      setLlms(savedLlms);
      setRoles(savedRoles);
      setLogs(savedLogs);
      addLog('СИСТЕМА', 'NeuroOffice Builder запущен');
    } catch (e) {
      console.error('Init error:', e);
      setError('Ошибка загрузки данных');
    }
  }, []);

  // Simple placeholder functions for now
  const addLLM = () => {
    if (!newLLM.name || !newLLM.type) {
      showMsg('Заполните название и тип!');
      return;
    }
    const llm: LLMConfig = { id: Date.now().toString(), ...newLLM };
    const updated = [...llms, llm];
    setLlms(updated);
    save('nob_llms', updated);
    setNewLLM({ name: '', type: '', apiKey: '', endpoint: '' });
    setShowAddLLMForm(false);
    showMsg('✓ LLM добавлен');
    addLog('LLM', `Добавлен: ${llm.name} (${llm.type})`);
  };

  const deleteLLM = (id: string) => {
    const updated = llms.filter(l => l.id !== id);
    setLlms(updated);
    save('nob_llms', updated);
    showMsg('✓ LLM удалён');
    addLog('LLM', `Удалён: ${llms.find(l => l.id === id)?.name}`);
  };

  const addRole = () => {
    if (!newRole.name || !newRole.llmId || !newRole.systemPrompt) {
      showMsg('Заполните все обязательные поля!');
      return;
    }
    const role: Role = { id: Date.now().toString(), ...newRole };
    const updated = [...roles, role];
    setRoles(updated);
    save('nob_roles', updated);
    setNewRole({ name: '', llmId: '', description: '', systemPrompt: '', knowledgeBases: [] });
    setShowAddRoleForm(false);
    showMsg('✓ Роль создана');
    addLog('РОЛЬ', `Создана: ${role.name}`);
  };

  const deleteRole = (id: string) => {
    const updated = roles.filter(r => r.id !== id);
    setRoles(updated);
    save('nob_roles', updated);
    showMsg('✓ Роль удалена');
    addLog('РОЛЬ', `Удалена: ${roles.find(r => r.id === id)?.name}`);
  };

  const updateRole = () => {
    if (!editingRole) return;
    const updated = roles.map(r => r.id === editingRole.id ? editingRole : r);
    setRoles(updated);
    save('nob_roles', updated);
    setEditingRole(null);
    showMsg('✓ Роль обновлена');
    addLog('РОЛЬ', `Обновлена: ${editingRole.name}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-container-lowest to-surface-container text-on-surface font-sans overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface-container-high/80 backdrop-blur-md border-b border-outline-variant">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30">
                <img
                  src="/logo.png"
                  alt="NeuroOffice"
                  className="w-8 h-8 filter brightness-0 invert"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-container bg-clip-text text-transparent">
                  NeuroOffice Builder
                </h1>
                <p className="text-sm text-on-surface-variant">
                  Конструктор AI-агентов и нейроофисов
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowLogs(!showLogs)}
              >
                📋 Логи ({logs.length})
              </Button>
              <Button
                variant="filled"
                size="small"
                onClick={() => {/* Sync function */}}
              >
                🔄 Синхронизировать
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="mb-8">
          <TabNavigation
            tabs={TABS}
            activeTab={tab}
            onChange={(tabId) => setTab(tabId as Tab)}
            variant="contained"
            fullWidth
          />
        </div>

        {/* Notification */}
        {msg && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-fadeIn">
            <Card variant="elevated" className="bg-primary text-on-primary px-6 py-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">✓</span>
                <span>{msg}</span>
              </div>
            </Card>
          </div>
        )}

        {/* Tab Content */}
        <div className="animate-fadeIn">
          {tab === 'llm' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">🤖 Подключения LLM</h2>
                <div className="flex items-center gap-2">
                  <StatusIndicator type="online" label="Готов" />
                  <span className="text-sm text-on-surface-variant">
                    {llms.length} подключений
                  </span>
                </div>
              </div>

              {/* LLM List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {llms.length === 0 ? (
                  <Card className="col-span-full text-center py-12">
                    <div className="text-4xl mb-4">🤖</div>
                    <h3 className="text-lg font-semibold mb-2">Нет подключений</h3>
                    <p className="text-on-surface-variant mb-4">
                      Добавьте ваше первое LLM подключение
                    </p>
                    <Button
                      variant="filled"
                      onClick={() => setShowAddLLMForm(true)}
                    >
                      + Добавить LLM
                    </Button>
                  </Card>
                ) : (
                  llms.map((llm) => (
                    <Card key={llm.id} hoverable className="relative">
                      <div className="absolute top-3 right-3">
                        <StatusIndicator
                          type={llmStatus[llm.id] || 'checking'}
                          pulse={llmStatus[llm.id] === 'checking'}
                        />
                      </div>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{llm.name}</h3>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => deleteLLM(llm.id)}
                            className="text-error hover:bg-error/10"
                          >
                            ✕
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                              {LLM_TYPES.find(t => t.value === llm.type)?.label}
                            </span>
                          </div>
                          {llm.endpoint && (
                            <p className="text-sm text-on-surface-variant truncate">
                              {llm.endpoint}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Add LLM Form */}
              {showAddLLMForm && (
                <Card variant="elevated" className="mt-6">
                  <CardHeader>
                    <h3 className="font-semibold text-lg">➕ Добавить новое LLM подключение</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Название подключения"
                        placeholder="GPT-4o, Claude 3.5, и т.д."
                        value={newLLM.name}
                        onChange={(e) => setNewLLM({...newLLM, name: e.target.value})}
                        fullWidth
                      />
                      <Select
                        label="Тип LLM"
                        options={LLM_TYPES}
                        value={newLLM.type}
                        onChange={(e) => setNewLLM({...newLLM, type: e.target.value})}
                        fullWidth
                      />
                      {['ollama', 'lmstudio', 'custom', 'aya', 'groq', 'uncloseai'].includes(newLLM.type) && (
                        <Input
                          label="Endpoint URL"
                          placeholder={
                            newLLM.type === 'groq' ? 'https://api.groq.com/openai/v1' :
                            newLLM.type === 'uncloseai' ? 'https://hermes.ai.unturf.com/v1' :
                            'http://localhost:1234'
                          }
                          value={newLLM.endpoint}
                          onChange={(e) => setNewLLM({...newLLM, endpoint: e.target.value})}
                          fullWidth
                        />
                      )}
                      {newLLM.type && !['ollama', 'lmstudio', 'custom', 'aya', 'uncloseai'].includes(newLLM.type) && (
                        <Input
                          label="API Key"
                          type="password"
                          placeholder={
                            newLLM.type === 'groq' ? 'Не обязательно, если есть в .env' :
                            'Не обязательно - используется из .env'
                          }
                          value={newLLM.apiKey}
                          onChange={(e) => setNewLLM({...newLLM, apiKey: e.target.value})}
                          fullWidth
                        />
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-3">
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setShowAddLLMForm(false);
                        setNewLLM({ name: '', type: '', apiKey: '', endpoint: '' });
                      }}
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="filled"
                      onClick={addLLM}
                      disabled={!newLLM.name || !newLLM.type}
                    >
                      Добавить подключение
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {/* Quick Actions */}
              {!showAddLLMForm && (
                <div className="flex flex-wrap gap-3 mt-6">
                  <Button
                    variant="filled"
                    onClick={() => setShowAddLLMForm(true)}
                    startIcon="+"
                  >
                    Добавить LLM
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {/* Export function */}}
                  >
                    📥 Экспорт данных
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {/* Import function */}}
                  >
                    📤 Импорт данных
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === 'roles' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">👥 Роли и базы знаний</h2>
                <div className="flex items-center gap-2">
                  <StatusIndicator type="online" label="Готов" />
                  <span className="text-sm text-on-surface-variant">
                    {roles.length} ролей, {knowledgeBases.length} баз знаний
                  </span>
                </div>
              </div>

              {/* Roles List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.length === 0 ? (
                  <Card className="col-span-full text-center py-12">
                    <div className="text-4xl mb-4">👥</div>
                    <h3 className="text-lg font-semibold mb-2">Нет созданных ролей</h3>
                    <p className="text-on-surface-variant mb-4">
                      Создайте свою первую роль AI-агента
                    </p>
                    <Button
                      variant="filled"
                      onClick={() => setShowAddRoleForm(true)}
                    >
                      + Создать роль
                    </Button>
                  </Card>
                ) : (
                  roles.map((role) => (
                    <Card key={role.id} hoverable className="relative">
                      <div className="absolute top-3 right-3">
                        <StatusBadge type="online" />
                      </div>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg">{role.name}</h3>
                          <div className="flex gap-1">
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => setEditingRole(role)}
                            >
                              ✏️
                            </Button>
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => deleteRole(role.id)}
                              className="text-error hover:bg-error/10"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <p className="text-sm text-on-surface-variant line-clamp-2">
                            {role.description || 'Без описания'}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                              {llms.find(l => l.id === role.llmId)?.name || 'LLM не выбран'}
                            </span>
                            <span className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded-full">
                              {role.knowledgeBases.length} баз знаний
                            </span>
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            Промпт: {role.systemPrompt.substring(0, 100)}...
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Add Role Form */}
              {showAddRoleForm && (
                <Card variant="elevated" className="mt-6">
                  <CardHeader>
                    <h3 className="font-semibold text-lg">👥 Создать новую роль</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Название роли"
                        placeholder="Юрист-консультант, Маркетолог, и т.д."
                        value={newRole.name}
                        onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                        fullWidth
                      />
                      <Select
                        label="LLM для роли"
                        options={llms.map(l => ({ value: l.id, label: l.name }))}
                        value={newRole.llmId}
                        onChange={(e) => setNewRole({...newRole, llmId: e.target.value})}
                        fullWidth
                      />
                      <div className="md:col-span-2">
                        <TextArea
                          label="Системный промпт"
                          placeholder="Инструкции для AI-агента..."
                          value={newRole.systemPrompt}
                          onChange={(e) => setNewRole({...newRole, systemPrompt: e.target.value})}
                          rows={4}
                          fullWidth
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end gap-3">
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setShowAddRoleForm(false);
                        setNewRole({ name: '', llmId: '', description: '', systemPrompt: '', knowledgeBases: [] });
                      }}
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="filled"
                      onClick={addRole}
                      disabled={!newRole.name || !newRole.llmId || !newRole.systemPrompt}
                    >
                      Создать роль
                    </Button>
                  </CardFooter>
                </Card>
              )}

              {/* Quick Actions */}
              {!showAddRoleForm && roles.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-6">
                  <Button
                    variant="filled"
                    onClick={() => setShowAddRoleForm(true)}
                    startIcon="+"
                  >
                    Создать роль
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {/* File search function */}}
                  >
                    🔍 Поиск по файлам
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => {/* File upload function */}}
                  >
                    📁 Загрузить файлы
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === 'launch' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">🚀 Запуск нейроофиса</h2>
                <StatusIndicator
                  type={agentRunning ? 'online' : agentReady ? 'checking' : 'offline'}
                  label={agentRunning ? 'Запущен' : agentReady ? 'Готов' : 'Не готов'}
                  pulse={agentRunning}
                />
              </div>

              <Card className="text-center py-12">
                <div className="text-6xl mb-6">🚀</div>
                <h3 className="text-2xl font-bold mb-4">Запуск команды AI-агентов</h3>
                <p className="text-on-surface-variant mb-8 max-w-2xl mx-auto">
                  Запустите созданные роли как автономных агентов, которые будут работать вместе
                  как полноценный нейроофис. Выберите руководителя и настройте взаимодействие.
                </p>

                <div className="max-w-md mx-auto space-y-6">
                  <Select
                    label="Выберите руководителя (Captain)"
                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                    value={captainRoleId}
                    onChange={(e) => setCaptainRoleId(e.target.value)}
                    fullWidth
                  />

                  <div className="flex flex-col gap-3">
                    <Button
                      variant="filled"
                      size="large"
                      fullWidth
                      disabled={!captainRoleId || agentRunning}
                      loading={agentRunning}
                      onClick={() => {
                        setAgentRunning(true);
                        addLog('ЗАПУСК', 'Запуск нейроофиса...');
                        showMsg('🚀 Нейроофис запускается...');
                      }}
                    >
                      {agentRunning ? 'Запуск...' : '🚀 Запустить нейроофис'}
                    </Button>

                    {agentRunning && (
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => {
                          setAgentRunning(false);
                          addLog('ОСТАНОВ', 'Нейроофис остановлен');
                          showMsg('Нейроофис остановлен');
                        }}
                      >
                        ⏹ Остановить
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Progress and Logs */}
              {agentRunning && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">📊 Прогресс запуска</h4>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Инициализация...</span>
                          <span>{progress}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">📋 Журнал действий</h4>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {chainLog.length === 0 ? (
                          <div className="text-center py-8 text-on-surface-variant">
                            Журнал действий появится здесь...
                          </div>
                        ) : (
                          chainLog.map((log, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low"
                            >
                              <div className="w-2 h-2 mt-2 bg-primary rounded-full"></div>
                              <div className="flex-1">
                                <div className="font-medium">
                                  {log.from} → {log.to}
                                </div>
                                <div className="text-sm text-on-surface-variant">
                                  {log.message}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">⚙️ Настройки системы</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">🔐 Безопасность</h3>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-on-surface-variant">
                      API ключи лучше хранить в файле <code className="bg-surface-container-high px-1 rounded">backend/.env</code>
                    </div>
                    <div className="text-xs bg-surface-container-high p-3 rounded-lg font-mono">
                      GROQ_API_KEY=gsk_...<br/>
                      OPENAI_API_KEY=sk-...<br/>
                      ANTHROPIC_API_KEY=sk-...
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">📊 Системная информация</h3>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">LLM подключений:</span>
                      <span className="font-medium">{llms.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Созданных ролей:</span>
                      <span className="font-medium">{roles.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Баз знаний:</span>
                      <span className="font-medium">{knowledgeBases.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Записей в логе:</span>
                      <span className="font-medium">{logs.length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <h3 className="font-semibold">🔄 Управление данными</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outlined">
                        📥 Экспорт всех данных
                      </Button>
                      <Button variant="outlined">
                        📤 Импорт данных
                      </Button>
                      <Button variant="outlined" className="text-error border-error/30 hover:bg-error/10">
                        🗑 Удалить дубликаты
                      </Button>
                      <Button variant="outlined" className="text-error border-error/30 hover:bg-error/10">
                        ⚠️ Очистить все данные
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Logs Panel */}
      {showLogs && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">📋 Журнал событий</h3>
                <div className="flex gap-2">
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        logs.map(l => `[${l.time}] ${l.action}: ${l.details}`).join('\n')
                      );
                      showMsg('Логи скопированы');
                    }}
                  >
                    📋 Копировать
                  </Button>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => setShowLogs(false)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant">
                    Нет записей в журнале
                  </div>
                ) : (
                  [...logs].reverse().map((log, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-surface-container-low border-l-4 border-primary"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-on-surface-variant">[{log.time}]</span>
                        <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                          {log.action}
                        </span>
                      </div>
                      <div className="text-sm">{log.details}</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => setShowLogs(false)}
              >
                Закрыть
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-outline-variant text-center text-sm text-on-surface-variant">
        <div className="container mx-auto px-4">
          <p>NeuroOffice Builder v0.1.0 • Создано с ❤️ для управления AI-агентами</p>
          <p className="mt-2">
            💡 Совет: Регулярно синхронизируйте данные с бэкендом для сохранения прогресса
          </p>
        </div>
      </footer>
    </div>
  );
}