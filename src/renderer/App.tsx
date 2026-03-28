import { useState, useEffect, useRef } from 'react'

type Tab = 'llm' | 'roles' | 'launch'

interface LLMConfig {
  id: string
  name: string
  type: string
  apiKey?: string
  endpoint?: string
}

interface KnowledgeBase {
  id: string
  name: string
  type: 'file' | 'url'
  content?: string
  url?: string
  parseInterval?: 'hourly' | 'daily' | 'weekly'
}

interface Role {
  id: string
  name: string
  description: string
  systemPrompt: string
  systemPromptFile?: string
  llmId: string
  knowledgeBases: KnowledgeBase[]
}

const LLM_TYPES = [
  { value: 'openai', label: 'OpenAI (GPT-4, GPT-4o)' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'ollama', label: 'Ollama (локальный)' },
  { value: 'lmstudio', label: 'LM Studio (локальный)' },
  { value: 'aya', label: 'Cohere Aya Expanse' },
  { value: 'custom', label: 'Свой API' },
]

type LogEntry = { time: string; action: string; details: string }

function save(key: string, data: any) { 
  try { 
    const json = JSON.stringify(data)
    localStorage.setItem(key, json)
    console.log(`[SAVE] ${key}:`, data)
  } catch (e) { 
    console.error('Save error:', e) 
  } 
}
function load<T>(key: string, def: T): T { 
  try { 
    const v = localStorage.getItem(key)
    if (!v || v === 'undefined' || v === 'null') {
      console.log(`[LOAD] ${key}: using default (empty)`)
      return def 
    }
    const parsed = JSON.parse(v)
    console.log(`[LOAD] ${key}:`, parsed)
    return parsed
  } catch (e) { 
    console.error('Load error:', e)
    return def 
  } 
}

function getTime() {
  const now = new Date()
  return now.toLocaleTimeString('ru-RU', { hour12: false })
}

export default function App() {
  const [tab, setTab] = useState<Tab>('llm')
  // Функция для удаления дублей по имени
  const deduplicate = <T extends {name?: string}>(arr: T[]): T[] => {
    const seen = new Set()
    return arr.filter(item => {
      const key = item.name || item.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  
  const [llms, setLlms] = useState<LLMConfig[]>(deduplicate(load('nob_llms', [])))
  const [roles, setRoles] = useState<Role[]>(deduplicate(load('nob_roles', [])))
  const [newLLM, setNewLLM] = useState<{name: string, type: string, apiKey: string, endpoint: string}>(load('nob_newLLM', { name: '', type: '', apiKey: '', endpoint: '' }))
  const [showAddLLMForm, setShowAddLLMForm] = useState(false)
  const [showAddRoleForm, setShowAddRoleForm] = useState(false)
  const [newRole, setNewRole] = useState<{ name: string; llmId: string; description: string; systemPrompt: string; systemPromptFile?: string; knowledgeBases: KnowledgeBase[] }>(() => {
    const saved = load('nob_newRole', { name: '', llmId: '', description: '', systemPrompt: '', knowledgeBases: [] })
    return saved
  })
  
  // Автоматически выбираем первый LLM если не выбран
  useEffect(() => {
    if (llms.length > 0 && !newRole.llmId) {
      setNewRole(prev => ({ ...prev, llmId: llms[0].id }))
    }
  }, [llms.length])
  
  // Автосохранение всех ролей и LLM (с дедупликацией)
  useEffect(() => {
    save('nob_llms', deduplicate(llms))
  }, [llms])
  
  useEffect(() => {
    save('nob_roles', deduplicate(roles))
  }, [roles])
  
  // Синхронизация с бэкендом - только по кнопке
  const manualSync = async () => {
    try {
      // Получаем текущее состояние из бэкенда
      const [backendLlms, backendRoles] = await Promise.all([
        fetch(`${API_BASE}/llms`).then(r => r.json()),
        fetch(`${API_BASE}/roles`).then(r => r.json())
      ])
      
      const backendLlmNames = backendLlms.map((l: any) => l.name)
      const backendRoleNames = backendRoles.map((r: any) => r.name)
      
      // Добавляем только новые LLM
      for (const llm of llms) {
        if (!backendLlmNames.includes(llm.name)) {
          await fetch(`${API_BASE}/llms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(llm)
          })
        }
      }
      
      // Добавляем только новые роли
      for (const role of roles) {
        if (!backendRoleNames.includes(role.name)) {
          await fetch(`${API_BASE}/roles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: role.name,
              description: role.description,
              systemPrompt: role.systemPrompt,
              llmId: role.llmId,
              knowledgeBases: role.knowledgeBases.map((kb: any) => kb.id)
            })
          })
        }
      }
      
      addLog('СИНХРОН', `Сохранено в бэкенд: ${llms.length} LLM, ${roles.length} ролей`)
    } catch (e: any) {
      console.error('Sync error:', e)
      addLog('ОШИБКА', `Синхронизация: ${e.message}`)
    }
  }
  
  const cleanDuplicates = async () => {
    try {
      // Получаем все из бэкенда
      const [backendLlms, backendRoles] = await Promise.all([
        fetch(`${API_BASE}/llms`).then(r => r.json()),
        fetch(`${API_BASE}/roles`).then(r => r.json())
      ])
      
      // Уникальные по имени
      const uniqueLlms = backendLlms.filter((l: any, i: number, arr: any[]) => 
        arr.findIndex((x: any) => x.name === l.name) === i
      )
      const uniqueRoles = backendRoles.filter((r: any, i: number, arr: any[]) => 
        arr.findIndex((x: any) => x.name === r.name) === i
      )
      
      // Удаляем все и добавляем уникальные
      for (const l of backendLlms) {
        await fetch(`${API_BASE}/llms/${l.id}`, { method: 'DELETE' })
      }
      for (const r of backendRoles) {
        await fetch(`${API_BASE}/roles/${r.id}`, { method: 'DELETE' })
      }
      
      // Добавляем уникальные
      for (const llm of uniqueLlms) {
        await fetch(`${API_BASE}/llms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(llm)
        })
      }
      for (const role of uniqueRoles) {
        await fetch(`${API_BASE}/roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: role.name,
            description: role.description,
            systemPrompt: role.systemPrompt,
            llmId: role.llmId,
            knowledgeBases: role.knowledgeBases || []
          })
        })
      }
      
      addLog('ЧИСТКА', `Оставлено: ${uniqueLlms.length} LLM, ${uniqueRoles.length} ролей`)
      showMsg('✓ Дубликаты удалены')
    } catch (e: any) {
      addLog('ОШИБКА', `Чистка: ${e.message}`)
    }
  }
  
  useEffect(() => {
    if (newRole.knowledgeBases.length > 0 || newRole.systemPrompt || newRole.name) {
      save('nob_newRole', newRole)
    }
  }, [newRole])
  
  useEffect(() => {
    if (newLLM.name || newLLM.type) {
      save('nob_newLLM', newLLM)
    }
  }, [newLLM])
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [msg, setMsg] = useState('')
  const [showModal, setShowModal] = useState<string | null>(null)
  const [aiThinking, setAiThinking] = useState<{role: string, status: string, input: string, output: string, documents?: any[]}[]>([])
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [agentRunning, setAgentRunning] = useState(false)
  const [agentReady, setAgentReady] = useState(false)
  const [captainRoleId, setCaptainRoleId] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [chainLog, setChainLog] = useState<{from: string, to: string, message: string}[]>([])
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  const [fileSearchResults, setFileSearchResults] = useState<any[]>([])
  const [folderPath, setFolderPath] = useState('')
  const [folderScanResults, setFolderScanResults] = useState<any[]>([])
  const [scanning, setScanning] = useState(false)

  const addLog = (action: string, details: string) => {
    const entry: LogEntry = { time: getTime(), action, details }
    setLogs(prev => {
      const updated = [...prev, entry].slice(-100)
      save('nob_logs', updated)
      return updated
    })
    console.log(`[${entry.time}] ${action}: ${details}`)
  }

  useEffect(() => {
    try {
      const savedLogs = load<LogEntry[]>('nob_logs', [])
      setLogs(savedLogs)
      addLog('СИСТЕМА', 'NeuroOffice Builder запущен')
      // НЕ синхронизируем автоматически - только по кнопке!
    } catch (e) {
      console.error('Init error:', e)
      setError('Ошибка загрузки данных')
    }
  }, [])

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      console.error('Global error:', e.error)
      setError(e.message)
    }
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  const addLLMToBackend = async (llm: any) => {
    try {
      await fetch(`${API_BASE}/llms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(llm)
      })
    } catch (e: any) {
      console.error('Backend sync error:', e)
    }
  }

  const syncRoleToBackend = async (role: any) => {
    try {
      // Находим LLM - сначала по ID, потом по имени
      let llmName = ''
      let llm = llms.find(l => l.id === role.llmId)
      if (!llm) {
        // Пробуем найти по любому совпадению
        llm = llms.find(l => l.name && role.llmId && role.llmId.includes(l.name))
      }
      if (!llm && llms.length > 0) {
        // Берём первый доступный LLM
        llm = llms[0]
      }
      if (llm) {
        llmName = llm.name
      }
      
      // Отправляем полные данные KB (не только ID)
      const kbsToSync = role.knowledgeBases.map((kb: any) => ({
        id: kb.id,
        name: kb.name,
        type: kb.type || 'file',
        content: kb.content || kb.name, // Содержимое или хотя бы имя для поиска
        url: kb.url
      }))
      
      await fetch(`${API_BASE}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: role.name,
          description: role.description,
          systemPrompt: role.systemPrompt,
          llmId: role.llmId,
          llmName: llmName,
          knowledgeBases: kbsToSync
        })
      })
      addLog('СИНХРОН', `Роль: ${role.name} | LLM: ${llmName}`)
      addLog('БД', `Сохранено ${kbsToSync.length} баз знаний`)
    } catch (e: any) {
      console.error('Backend sync error:', e)
    }
  }

  const syncAllToBackend = async () => {
    for (const llm of llms) {
      await addLLMToBackend(llm)
    }
    for (const role of roles) {
      await syncRoleToBackend(role)
    }
    addLog('СИНХРОН', `Сохранено: ${llms.length} LLM, ${roles.length} ролей`)
  }

  const addLLM = () => {
    try {
      if (!newLLM.name || !newLLM.type) { showMsg('Заполните название и тип!'); return }
      const llm = { id: Date.now().toString(), ...newLLM }
      const updated = [...llms, llm]
      setLlms(updated); save('nob_llms', updated)
      addLLMToBackend(llm)
      setNewLLM({ name: '', type: '', apiKey: '', endpoint: '' })
      showMsg('✓ LLM добавлен')
      addLog('LLM', `Добавлен: ${llm.name} (${llm.type})`)
    } catch (e: any) {
      addLog('ОШИБКА', `addLLM: ${e.message}`)
      showMsg('Ошибка добавления LLM')
    }
  }

  const addPreset = () => {
    try {
      const llm = { id: Date.now().toString(), name: 'aya-expanse-8b', type: 'aya', endpoint: 'http://127.0.0.1:1234' }
      const updated = [...llms, llm]
      setLlms(updated); save('nob_llms', updated)
      addLLMToBackend(llm)
      showMsg('✓ Aya Expanse добавлен')
      addLog('LLM', 'Добавлен пресет: aya-expanse-8b')
    } catch (e: any) {
      addLog('ОШИБКА', `addPreset: ${e.message}`)
    }
  }

  const exportData = () => {
    try {
      const data = { llms, roles, exportTime: new Date().toISOString() }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `neurooffice-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      addLog('ЭКСПОРТ', 'Данные экспортированы в файл')
      showMsg('✓ Экспорт выполнен')
    } catch (e: any) {
      addLog('ОШИБКА', `Экспорт: ${e.message}`)
    }
  }

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string)
          if (data.llms) { setLlms(data.llms); save('nob_llms', data.llms) }
          if (data.roles) { setRoles(data.roles); save('nob_roles', data.roles) }
          addLog('ИМПОРТ', `Загружено: ${data.llms?.length || 0} LLM, ${data.roles?.length || 0} ролей`)
          showMsg('✓ Импорт выполнен')
        } catch (e: any) {
          addLog('ОШИБКА', `Импорт: ${e.message}`)
        }
      }
      reader.readAsText(file)
    } catch (e: any) {
      addLog('ОШИБКА', `Импорт: ${e.message}`)
    }
    event.target.value = ''
  }

  const handlePromptFileUpload = (event: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const content = reader.result as string
          if (target === 'new') {
            setNewRole(prev => ({ ...prev, systemPrompt: content, systemPromptFile: file.name }))
          } else if (editingRole) {
            setEditingRole(prev => prev ? { ...prev, systemPrompt: content, systemPromptFile: file.name } : null)
          }
          showMsg('✓ Промпт загружен')
        } catch (e) {
          showMsg('Ошибка чтения файла')
        }
      }
      reader.onerror = () => showMsg('Ошибка чтения файла')
      reader.readAsText(file)
    } catch (e: any) {
      addLog('ОШИБКА', `Загрузка промпта: ${e.message}`)
      showMsg('Ошибка загрузки файла')
    }
    event.target.value = ''
  }

  const handleKnowledgeFileUpload = (event: React.ChangeEvent<HTMLInputElement>, target: 'new' | 'edit') => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    try {
      Array.from(files).forEach(file => {
        try {
          const reader = new FileReader()
          reader.onload = () => {
            try {
              // Сохраняем ПОЛНОЕ содержимое файла!
              const content = reader.result as string
              const kb: KnowledgeBase = { 
                id: Date.now().toString() + Math.random(), 
                name: file.name, 
                type: 'file', 
                content: content, // Теперь сохраняем реальное содержимое!
                parseInterval: 'daily' 
              }
              if (target === 'new') {
                setNewRole(prev => ({ ...prev, knowledgeBases: [...prev.knowledgeBases, kb] }))
              } else if (editingRole) {
                setEditingRole(prev => prev ? { ...prev, knowledgeBases: [...prev.knowledgeBases, kb] } : null)
              }
              addLog('БАЗА', `Загружен файл: ${file.name} (${content.length} символов)`)
            } catch (e: any) {
              addLog('ОШИБКА', `Чтение KB: ${e.message}`)
              console.error('KB reader error:', e)
            }
          }
          reader.onerror = () => {
            addLog('ОШИБКА', `Ошибка чтения файла: ${file.name}`)
            console.error('File read error')
          }
          reader.readAsText(file)
        } catch (e: any) {
          addLog('ОШИБКА', `Обработка файла: ${e.message}`)
          console.error('File processing error:', e)
        }
      })
    } catch (e: any) {
      addLog('ОШИБКА', `Загрузка файлов: ${e.message}`)
      showMsg('Ошибка загрузки файлов')
    }
    event.target.value = ''
  }

  const addRole = async () => {
    try {
      if (!newRole.name || !newRole.llmId || !newRole.systemPrompt) { 
        addLog('РОЛЬ', 'Ошибка: не заполнены обязательные поля')
        showMsg('Заполните название, LLM и системный промпт!'); 
        return 
      }
      // Сначала синхронизируем LLM
      const llm = llms.find(l => l.id === newRole.llmId)
      if (llm) {
        await addLLMToBackend(llm)
      }
      const role: Role = { id: Date.now().toString(), ...newRole }
      const updated = [...roles, role]
      setRoles(updated)
      save('nob_roles', updated)
      await syncRoleToBackend(role)
      // Очищаем только имя, сохраняем промпт и базы для удобства
      setNewRole({ name: '', llmId: newRole.llmId, description: '', systemPrompt: newRole.systemPrompt, knowledgeBases: [] })
      showMsg('✓ Роль создана')
      addLog('РОЛЬ', `Создана: ${role.name} (LLM: ${role.llmId}, БД: ${role.knowledgeBases.length})`)
    } catch (e: any) {
      addLog('ОШИБКА', `addRole: ${e.message}`)
      console.error('Add role error:', e)
      showMsg('Ошибка при создании роли')
    }
  }

  const updateRole = async () => {
    try {
      if (!editingRole) return
      // Находим LLM
      let llmName = ''
      let llm = llms.find(l => l.id === editingRole.llmId)
      if (!llm) {
        llm = llms.find(l => l.name && editingRole.llmId && editingRole.llmId.includes(l.name))
      }
      if (!llm && llms.length > 0) {
        llm = llms[0]
      }
      if (llm) {
        llmName = llm.name
        await addLLMToBackend(llm)
      }
      // Синхронизируем с бэкендом
      const kbsToSync = editingRole.knowledgeBases.map((kb: any) => ({
        id: kb.id,
        name: kb.name,
        type: kb.type || 'file',
        content: kb.content || kb.name,
        url: kb.url
      }))
      await fetch(`${API_BASE}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingRole.name,
          description: editingRole.description,
          systemPrompt: editingRole.systemPrompt,
          llmId: editingRole.llmId,
          llmName: llmName,
          knowledgeBases: kbsToSync
        })
      })
      const updated = roles.map(r => r.id === editingRole.id ? editingRole : r)
      setRoles(updated); save('nob_roles', updated)
      setEditingRole(null)
      showMsg('✓ Роль обновлена')
      addLog('РОЛЬ', `Обновлена: ${editingRole.name}`)
    } catch (e: any) {
      addLog('ОШИБКА', `updateRole: ${e.message}`)
    }
  }

  const deleteRole = (id: string) => {
    try {
      const roleName = roles.find(r => r.id === id)?.name || id
      setRoles(roles.filter(r => r.id !== id)); 
      save('nob_roles', roles.filter(r => r.id !== id))
      addLog('РОЛЬ', `Удалена: ${roleName}`)
    } catch (e: any) {
      addLog('ОШИБКА', `deleteRole: ${e.message}`)
    }
  }

  const deleteKnowledgeBase = (target: 'new' | 'edit', roleId: string, kbId: string) => {
    if (target === 'new') {
      setNewRole(prev => ({ ...prev, knowledgeBases: prev.knowledgeBases.filter(k => k.id !== kbId) }))
    } else if (editingRole) {
      setEditingRole(prev => prev ? { ...prev, knowledgeBases: prev.knowledgeBases.filter(k => k.id !== kbId) } : null)
    }
  }

  const addKnowledgeBaseByUrl = (target: 'new' | 'edit', roleId: string, urlInput: HTMLInputElement | null) => {
    if (!urlInput?.value) return
    const kb: KnowledgeBase = { id: Date.now().toString(), name: 'URL', type: 'url', url: urlInput.value, parseInterval: 'daily' }
    if (target === 'new') {
      setNewRole(prev => ({ ...prev, knowledgeBases: [...prev.knowledgeBases, kb] }))
    } else if (editingRole) {
      setEditingRole(prev => prev ? { ...prev, knowledgeBases: [...prev.knowledgeBases, kb] } : null)
    }
    addLog('БАЗА', `Добавлен URL: ${urlInput.value}`)
    urlInput.value = ''
  }

  const [userInput, setUserInput] = useState('')
  const [activeRole, setActiveRole] = useState<Role | null>(null)

  const simulateLaunch = (roleId: string) => {
    const role = roles.find(r => r.id === roleId)
    if (!role) {
      addLog('ОШИБКА', 'Роль не найдена')
      return
    }
    setActiveRole(role)
    setAgentReady(true)
    setAgentRunning(false)
    setAiThinking([])
    setUserInput('')
    addLog('ЗАПУСК', `Агент "${role.name}" готов к работе`)
    showMsg('✓ Агент активирован')
  }

  const stopAgent = () => {
    setAgentReady(false)
    setAgentRunning(false)
    setActiveRole(null)
    setAiThinking([])
    addLog('СТОП', 'Агент остановлен')
  }

  const API_BASE = 'http://localhost:3001/api'

  const callBackendChat = async (roleId: string, message: string): Promise<{response: string, documents: any[], llm: string, subRole?: string | null}> => {
    // Сначала получаем роли из бэкенда чтобы найти правильный ID
    try {
      const rolesRes = await fetch(`${API_BASE}/roles`)
      const backendRoles = await rolesRes.json()
      
      // Ищем роль по ID во фронтенде
      const frontendRole = roles.find(r => r.id === roleId)
      if (!frontendRole) {
        throw new Error('Роль не найдена')
      }
      
      // Ищем по имени (с учётом что могут быть пробелы)
      const frontendName = (frontendRole.name || '').trim().toLowerCase()
      let backendRole = backendRoles.find((r: any) => 
        r.name && (r.name.trim().toLowerCase().includes(frontendName) || frontendName.includes(r.name.trim().toLowerCase()))
      )
      
      // Если не найдено - ищем по llmName
      if (!backendRole) {
        backendRole = backendRoles.find((r: any) => r.llmName)
      }
      
      if (!backendRole) {
        throw new Error('Роль не синхронизирована с бэкендом')
      }
      
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: backendRole.id, message, includeHistory: true })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `API Error: ${response.status}`)
      }
      return response.json()
    } catch (e: any) {
      throw new Error(e.message)
    }
  }

  const syncWithBackend = async () => {
    try {
      const [llmsRes, rolesRes, kbsRes] = await Promise.all([
        fetch(`${API_BASE}/llms`),
        fetch(`${API_BASE}/roles`),
        fetch(`${API_BASE}/knowledge-bases`)
      ])
      const backendLlms = await llmsRes.json()
      const backendRoles = await rolesRes.json()
      const backendKbs = await kbsRes.json()
      
      setLlms(backendLlms)
      setRoles(backendRoles)
      save('nob_llms', backendLlms)
      save('nob_roles', backendRoles)
      
      addLog('СИНХРОН', `LLM: ${backendLlms.length}, Роли: ${backendRoles.length}, Базы: ${backendKbs.length}`)
    } catch (e: any) {
      addLog('ОШИБКА', `Синхронизация: ${e.message}`)
    }
  }

  const callLLM = async (messages: {role: string, content: string}[], endpoint: string): Promise<string> => {
    try {
      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'model',
          messages,
          temperature: 0.7,
          max_tokens: 2000
        })
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      return data.choices?.[0]?.message?.content || 'Пустой ответ от LLM'
    } catch (e: any) {
      addLog('ОШИБКА', `LLM: ${e.message}`)
      return `Ошибка: ${e.message}`
    }
  }

  const searchFiles = async () => {
    if (!fileSearchQuery.trim()) return
    try {
      const response = await fetch(`${API_BASE}/search/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: fileSearchQuery, limit: 10 })
      })
      const results = await response.json()
      setFileSearchResults(results)
      addLog('ПОИСК', `Найдено: ${results.length} файлов`)
    } catch (e: any) {
      addLog('ОШИБКА', `Поиск: ${e.message}`)
    }
  }

  const scanFolder = async () => {
    if (!folderPath.trim()) return
    setScanning(true)
    addLog('ПАПКА', `Сканирование: ${folderPath}`)
    try {
      const response = await fetch(`${API_BASE}/folders/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, roleId: '' })
      })
      const data = await response.json()
      setFolderScanResults(data.files || [])
      addLog('ПАПКА', `Найдено файлов: ${data.count}`)
    } catch (e: any) {
      addLog('ОШИБКА', `Папка: ${e.message}`)
    }
    setScanning(false)
  }

  const importFromFolder = async () => {
    if (folderScanResults.length === 0) return
    try {
      const response = await fetch(`${API_BASE}/folders/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: folderScanResults, roleId: '' })
      })
      const data = await response.json()
      addLog('ИМПОРТ', `Добавлено: ${data.count} файлов`)
      await syncWithBackend()
      setFolderScanResults([])
      setFolderPath('')
      showMsg(`Импортировано ${data.count} файлов!`)
    } catch (e: any) {
      addLog('ОШИБКА', `Импорт: ${e.message}`)
    }
  }

  const runAgent = async () => {
    if (!userInput.trim() || !activeRole) return
    
    setAgentRunning(true)
    setProgress(10)
    addLog('ВХОД', `Пользователь: ${userInput}`)
    
    setAiThinking([{ role: '👔 Руководитель', status: 'Анализирует запрос...', input: userInput, output: '' }])
    
    setTimeout(() => {
      setProgress(30)
      setAiThinking(prev => prev.map((t, i) => i === 0 ? { 
        ...t, 
        output: `Анализирую запрос: "${userInput.substring(0, 30)}..."`,
        status: 'Работает' 
      } : t))
    }, 300)
    
    // Сразу к подчинённому - ноProgress честный
    setTimeout(() => {
      setProgress(50)
    }, 600)
    
    setTimeout(() => {
      setProgress(70)
    }, 900)
    
    try {
      setAiThinking(prev => [...prev, { 
        role: `👤 ${activeRole.name}`, 
        status: '⏳ Ожидание ответа от AI...', 
        input: `Контекст: ${activeRole.knowledgeBases.length} баз знаний`, 
        output: '' 
      }])
      setAiThinking(prev => prev.map((t, i) => i === 1 ? { 
        ...t, 
        output: `Отправляю запрос к AI...`,
        status: 'Ожидание ответа...' 
      } : t))
      
      const result = await callBackendChat(activeRole.id, userInput)
      
      // Если был вызван подчинённый - добавляем блок
      if (result.subRole) {
        setAiThinking(prev => [...prev, { 
          role: `👤 ${result.subRole}`, 
          status: 'Выполняет задачу...', 
          input: userInput, 
          output: '' 
        }])
      }
      
      // Добавляем блок о вызванном подчинённом
      let finalOutput = result.response
      if (result.subRole) {
        finalOutput = `📋 Поручил: ${result.subRole}\n\n${result.response}`
      }
      
      setProgress(100)
      setAiThinking(prev => prev.map((t, i) => i === 1 ? { 
        ...t, 
        output: finalOutput,
        status: result.subRole ? `Вызвал: ${result.subRole}` : 'Готово',
        documents: result.documents || []
      } : t))
      
      if (result.documents && result.documents.length > 0) {
        addLog('RAG', `Найдено документов: ${result.documents.length}`)
      }
      addLog('ВЫХОД', `Ответ от ${activeRole.name}: ${result.response.substring(0, 100)}...`)
    } catch (e: any) {
      setAiThinking(prev => prev.map((t, i) => i === 1 ? { 
        ...t, 
        output: `Ошибка: ${e.message}. Проверьте, что бэкенд запущен на порту 3001`,
        status: 'Ошибка' 
      } : t))
      addLog('ОШИБКА', e.message)
    }
    
    setAgentRunning(false)
    setTimeout(() => setProgress(0), 2000)
  }

  const tabs = [
    { id: 'llm', label: '🤖 LLM' },
    { id: 'roles', label: '👥 Роли + Базы' },
    { id: 'launch', label: '🚀 Старт' },
  ]

  const next = () => { const o: Tab[] = ['llm', 'roles', 'launch']; const i = o.indexOf(tab); if (i < o.length - 1) setTab(o[i + 1]) }
  const prev = () => { const o: Tab[] = ['llm', 'roles', 'launch']; const i = o.indexOf(tab); if (i > 0) setTab(o[i - 1]) }

  const exportLogs = () => {
    const logText = logs.map(l => `[${l.time}] ${l.action}: ${l.details}`).join('\n')
    navigator.clipboard.writeText(logText).then(() => showMsg('Лог скопирован!'))
  }

  return (
    <div style={{ minHeight: '100vh', maxHeight: '100vh', overflow: 'auto', background: 'linear-gradient(135deg, #003144 0%, #021c28 100%)', color: '#fff', fontFamily: "'Golos Text', sans-serif", padding: '20px', paddingBottom: '120px' }}>
      {msg && <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)', padding: '12px 24px', borderRadius: 30, fontSize: 14, zIndex: 9999, border: '1px solid rgba(61,219,127,0.3)' }}>{msg}</div>}



      {showLogs && (
        <div style={{ position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 400, maxHeight: '50vh', background: '#021c28', border: '1px solid rgba(61,219,127,0.3)', borderRadius: 12, padding: 12, zIndex: 999, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>📋 Лог событий</span>
            <button onClick={exportLogs} style={{ background: '#3ddb7f', border: 'none', borderRadius: 6, color: '#000', padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Копировать</button>
          </div>
          {logs.length === 0 ? <div style={{ opacity: 0.5, fontSize: 11 }}>Нет записей</div> : (
            <div style={{ fontSize: 10, fontFamily: 'monospace' }}>
              {logs.slice().reverse().map((l, i) => (
                <div key={i} style={{ marginBottom: 6, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#888' }}>[{l.time}]</span> <span style={{ color: '#3ddb7f' }}>{l.action}</span>: {l.details}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <img src="/logo.svg" alt="NeuroOffice" style={{ width: 60, height: 60, borderRadius: 14, margin: '0 auto 12px', display: 'block' }} />
        <h1 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 20, fontWeight: 700 }}>NeuroOffice Builder</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
        {tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id as Tab)} style={{ padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', background: tab === t.id ? '#3ddb7f' : 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 10, fontWeight: 600 }}>{t.label}</button>))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, border: '1px solid rgba(255,255,255,0.12)', overflow: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
        
        {tab === 'llm' && (
          <div>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, marginBottom: 14 }}>🤖 Подключения LLM</h2>
            {llms.length === 0 ? <div style={{ textAlign: 'center', padding: 30, opacity: 0.6 }}>Нет подключений</div> : (
              <div style={{ marginBottom: 16 }}>
                {llms.map(l => (<div key={l.id} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ fontWeight: 600 }}>{l.name}</div><div style={{ fontSize: 11, opacity: 0.6 }}>{LLM_TYPES.find(t => t.value === l.type)?.label}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: 'rgba(61,219,127,0.2)', color: '#3ddb7f', padding: '4px 10px', borderRadius: 20, fontSize: 11 }}>✓</span>
                    <button onClick={() => { setLlms(llms.filter(x => x.id !== l.id)); save('nob_llms', llms.filter(x => x.id !== l.id)); addLog('LLM', `Удалён: ${l.name}`) }} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                </div>))}
              </div>
            )}
            {!showAddLLMForm ? (
              <button onClick={() => setShowAddLLMForm(true)} style={{ width: '100%', padding: 14, background: 'rgba(61,219,127,0.15)', border: '1px solid rgba(61,219,127,0.3)', borderRadius: 12, color: '#3ddb7f', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Добавить LLM</button>
            ) : (
              <>
                <button onClick={addPreset} style={{ width: '100%', padding: 10, background: 'rgba(61,219,127,0.15)', border: '1px solid rgba(61,219,127,0.3)', borderRadius: 10, color: '#3ddb7f', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}>✨ Aya Expanse 8B</button>
                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Название *</label><input value={newLLM.name} onChange={e => setNewLLM({...newLLM, name: e.target.value})} placeholder="GPT-4o" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14 }} /></div>
                <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Тип *</label><select value={newLLM.type} onChange={e => setNewLLM({...newLLM, type: e.target.value})} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14 }}><option value="" style={{ color: '#888' }}>Выберите...</option>{LLM_TYPES.map(t => <option key={t.value} value={t.value} style={{ color: '#fff', background: '#003144' }}>{t.label}</option>)}</select></div>
                {['ollama', 'lmstudio', 'custom', 'aya'].includes(newLLM.type) && <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Endpoint</label><input value={newLLM.endpoint} onChange={e => setNewLLM({...newLLM, endpoint: e.target.value})} placeholder="http://localhost:11434" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14 }} /></div>}
                {!newLLM.type || !['ollama', 'lmstudio', 'custom', 'aya'].includes(newLLM.type) ? <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6 }}>API Key</label><input type="password" value={newLLM.apiKey} onChange={e => setNewLLM({...newLLM, apiKey: e.target.value})} placeholder="sk-..." style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14 }} /></div> : null}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button onClick={addLLM} style={{ padding: 14, background: '#3ddb7f', border: 'none', borderRadius: 12, color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Добавить</button>
                  <button onClick={() => { setShowAddLLMForm(false); setNewLLM({ name: '', type: '', apiKey: '', endpoint: '' }) }} style={{ padding: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, color: '#fff', fontSize: 14, cursor: 'pointer' }}>Отмена</button>
                </div>
              </>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 }}>
              <button onClick={manualSync} style={{ padding: 10, background: 'rgba(61,219,127,0.2)', border: '1px solid rgba(61,219,127,0.4)', borderRadius: 10, color: '#3ddb7f', fontSize: 11, cursor: 'pointer' }}>🔄 Синхр</button>
              <button onClick={exportData} style={{ padding: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#fff', fontSize: 11, cursor: 'pointer' }}>📥 Эксп</button>
              <input type="file" onChange={importData} accept=".json" style={{ display: 'none' }} id="import-data" />
              <button onClick={() => document.getElementById('import-data')?.click()} style={{ padding: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#fff', fontSize: 11, cursor: 'pointer' }}>📤 Импорт</button>
            </div>
            
            <button onClick={() => { if(confirm('Удалить дубликаты в бэкенде?')) { cleanDuplicates() } }} style={{ width: '100%', marginTop: 8, padding: 8, background: 'rgba(244,67,54,0.2)', border: '1px solid rgba(244,67,54,0.4)', borderRadius: 8, color: '#f44336', fontSize: 11, cursor: 'pointer' }}>🗑 Удалить дубли</button>
            
            <button onClick={next} disabled={llms.length === 0} style={{ width: '100%', marginTop: 14, padding: 14, background: llms.length ? '#3ddb7f' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, color: llms.length ? '#000' : '#666', fontSize: 14, fontWeight: 600, cursor: llms.length ? 'pointer' : 'default' }}>Далее →</button>
          </div>
        )}

        {tab === 'roles' && (
          <div>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, marginBottom: 14 }}>👥 Роли + Базы знаний</h2>
            
            {roles.length > 0 && roles.map(role => (
              <div key={role.id} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{role.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setEditingRole(role)} style={{ background: 'none', border: 'none', color: '#21b9f4', cursor: 'pointer', fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #21b9f4' }}>✏️</button>
                    <button onClick={() => deleteRole(role.id)} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>LLM: {llms.find(l => l.id === role.llmId)?.name}</div>
                <div style={{ fontSize: 10, opacity: 0.5 }}>Базы знаний: {role.knowledgeBases.length}</div>
              </div>
            ))}

            {/* 🔍 Поиск по файлам */}
            <div style={{ background: 'rgba(255,140,66,0.1)', border: '1px solid rgba(255,140,66,0.3)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#ff8c42' }}>🔍 Быстрый поиск по файлам</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 10, color: 'rgba(255,255,255,0.7)' }}>Ищет по всем загруженным документам (PDF, DOCX, XLSX, TXT, MD)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input 
                  value={fileSearchQuery} 
                  onChange={e => setFileSearchQuery(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && searchFiles()}
                  placeholder="Введите запрос для поиска..." 
                  style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12 }} 
                />
                <button onClick={searchFiles} style={{ padding: '10px 14px', background: '#ff8c42', border: 'none', borderRadius: 8, color: '#000', fontSize: 12, cursor: 'pointer' }}>🔍</button>
              </div>
              {fileSearchResults.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#ff8c42', marginBottom: 6 }}>Найдено: {fileSearchResults.length}</div>
                  {fileSearchResults.map((r, i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 8, marginBottom: 6, fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{r.name}</div>
                      <div style={{ opacity: 0.6, marginTop: 4 }}>{r.snippet?.substring(0, 150)}...</div>
                      <div style={{ fontSize: 9, color: r.source === 'Файл' ? '#ff8c42' : '#3ddb7f', marginTop: 4 }}>{r.source}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 📂 Индексация папки */}
            <div style={{ background: 'rgba(156,39,176,0.1)', border: '1px solid rgba(156,39,176,0.3)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: '#ce93d8' }}>📂 Индексация папки</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 10, color: 'rgba(255,255,255,0.7)' }}>Сканирует папку и добавляет все документы в базу знаний (PDF, DOCX, XLSX, TXT, MD)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input 
                  value={folderPath} 
                  onChange={e => setFolderPath(e.target.value)} 
                  placeholder="Путь к папке (например: C:\Договоры)" 
                  style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12 }} 
                />
                <button onClick={scanFolder} disabled={scanning} style={{ padding: '10px 14px', background: '#ce93d8', border: 'none', borderRadius: 8, color: '#000', fontSize: 12, cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.5 : 1 }}>{scanning ? '...' : '🔍'}</button>
              </div>
              {folderScanResults.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#ce93d8', marginBottom: 6 }}>Найдено файлов: {folderScanResults.length}</div>
                  {folderScanResults.slice(0, 5).map((f, i) => (
                    <div key={i} style={{ fontSize: 10, opacity: 0.7, marginBottom: 4 }}>📄 {f.name}</div>
                  ))}
                  {folderScanResults.length > 5 && <div style={{ fontSize: 10, opacity: 0.5 }}>... и ещё {folderScanResults.length - 5}</div>}
                  <button onClick={importFromFolder} style={{ width: '100%', marginTop: 10, padding: 10, background: '#3ddb7f', border: 'none', borderRadius: 8, color: '#000', fontSize: 12, cursor: 'pointer' }}>➕ Добавить все в базу знаний</button>
                </div>
              )}
            </div>

            {/* Редактирование */}
            {editingRole && (
              <div style={{ background: 'rgba(33,185,244,0.1)', border: '1px solid rgba(33,185,244,0.3)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12, color: '#21b9f4' }}>✏️ Редактирование: {editingRole.name}</h3>
                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Название</label><input value={editingRole.name} onChange={e => setEditingRole({...editingRole, name: e.target.value})} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 13 }} /></div>
                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 4 }}>LLM</label><select value={editingRole.llmId} onChange={e => setEditingRole({...editingRole, llmId: e.target.value})} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 13 }}><option value="" style={{ color: '#888' }}>Выберите...</option>{llms.map(l => <option key={l.id} value={l.id} style={{ color: '#fff', background: '#003144' }}>{l.name}</option>)}</select></div>
                
                {/* Системный промпт */}
                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 4, color: '#fff' }}>Системный промпт *</label><textarea value={editingRole.systemPrompt} onChange={e => setEditingRole({...editingRole, systemPrompt: e.target.value})} rows={3} placeholder="Инструкции для AI..." style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 13, resize: 'none' }} /></div>
                <input type="file" onChange={(e) => handlePromptFileUpload(e, 'edit')} accept=".md,.txt" style={{ display: 'none' }} id="edit-prompt-file" />
                <button onClick={() => document.getElementById('edit-prompt-file')?.click()} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>📄 Загрузить промпт из файла</button>
                {editingRole.systemPromptFile && <div style={{ fontSize: 10, color: '#3ddb7f', marginBottom: 10 }}>✓ {editingRole.systemPromptFile}</div>}
                
                {/* Базы знаний */}
                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 4, color: '#21b9f4' }}>База данных</label>
                  {editingRole.knowledgeBases.map(kb => (
                    <div key={kb.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 8, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><span style={{ fontSize: 11 }}>{kb.type === 'file' ? '📄' : '🔗'}</span> <span style={{ fontSize: 11 }}>{kb.name}</span></div>
                      <button onClick={() => deleteKnowledgeBase('edit', editingRole.id, kb.id)} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 10 }}>✕</button>
                    </div>
                  ))}
                </div>
                <input type="file" multiple onChange={(e) => handleKnowledgeFileUpload(e, 'edit')} accept=".md,.txt,.json,.pdf" style={{ display: 'none' }} id="edit-kb-files" />
                <button onClick={() => document.getElementById('edit-kb-files')?.click()} style={{ width: '100%', padding: 10, background: 'rgba(33,185,244,0.15)', border: '1px solid rgba(33,185,244,0.3)', borderRadius: 8, color: '#21b9f4', fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>📚 Загрузить БД из файла (можно несколько)</button>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input id="edit-kb-url" placeholder="URL (Google Drive...)" style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                  <button onClick={() => addKnowledgeBaseByUrl('edit', editingRole.id, document.getElementById('edit-kb-url') as HTMLInputElement)} style={{ padding: '10px 14px', background: '#3ddb7f', border: 'none', borderRadius: 8, color: '#000', fontSize: 12, cursor: 'pointer' }}>→</button>
                </div>
                
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={updateRole} style={{ flex: 1, padding: 10, background: '#21b9f4', border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Сохранить</button>
                  <button onClick={() => setEditingRole(null)} style={{ flex: 1, padding: 10, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                </div>
              </div>
            )}

            {/* Новая роль */}
            {!showAddRoleForm ? (
              <button onClick={() => setShowAddRoleForm(true)} style={{ width: '100%', padding: 14, background: 'rgba(61,219,127,0.15)', border: '1px solid rgba(61,219,127,0.3)', borderRadius: 12, color: '#3ddb7f', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>+ Добавить роль</button>
            ) : (
              <>
                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Название роли *</label><input value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} placeholder="Юрист-консультант" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14 }} /></div>
                <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6 }}>LLM *</label><select value={newRole.llmId} onChange={e => setNewRole({...newRole, llmId: e.target.value})} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14 }}><option value="" style={{ color: '#888' }}>Выберите...</option>{llms.map(l => <option key={l.id} value={l.id} style={{ color: '#fff', background: '#003144' }}>{l.name}</option>)}</select></div>
            
            {/* Системный промпт */}
            <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6, color: '#fff' }}>Системный промпт *</label><textarea value={newRole.systemPrompt} onChange={e => setNewRole({...newRole, systemPrompt: e.target.value})} placeholder="Инструкции для AI..." rows={3} style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 14, resize: 'none' }} /></div>
            <input type="file" onChange={(e) => handlePromptFileUpload(e, 'new')} accept=".md,.txt" style={{ display: 'none' }} id="new-prompt-file" />
            <button onClick={() => document.getElementById('new-prompt-file')?.click()} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: '#fff', fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>📄 Загрузить промпт из файла</button>
            {newRole.systemPromptFile && <div style={{ fontSize: 10, color: '#3ddb7f', marginBottom: 16 }}>✓ {newRole.systemPromptFile}</div>}
            
            {/* Базы знаний */}
            <div style={{ marginBottom: 10 }}><label style={{ display: 'block', fontSize: 11, opacity: 0.7, marginBottom: 6, color: '#21b9f4' }}>База данных</label>
              {newRole.knowledgeBases.map(kb => (
                <div key={kb.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 8, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><span style={{ fontSize: 11 }}>{kb.type === 'file' ? '📄' : '🔗'}</span> <span style={{ fontSize: 11 }}>{kb.name}</span></div>
                  <button onClick={() => deleteKnowledgeBase('new', '', kb.id)} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 10 }}>✕</button>
                </div>
              ))}
            </div>
            <input type="file" multiple onChange={(e) => handleKnowledgeFileUpload(e, 'new')} accept=".md,.txt,.json,.pdf" style={{ display: 'none' }} id="new-kb-files" />
            <button onClick={() => document.getElementById('new-kb-files')?.click()} style={{ width: '100%', padding: 10, background: 'rgba(33,185,244,0.15)', border: '1px solid rgba(33,185,244,0.3)', borderRadius: 10, color: '#21b9f4', fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>📚 Загрузить БД из файла (можно несколько)</button>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <input id="new-kb-url" placeholder="URL (Google Drive...)" style={{ flex: 1, padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 13 }} />
              <button onClick={() => addKnowledgeBaseByUrl('new', '', document.getElementById('new-kb-url') as HTMLInputElement)} style={{ padding: '12px 16px', background: '#3ddb7f', border: 'none', borderRadius: 10, color: '#000', fontSize: 13, cursor: 'pointer' }}>→</button>
            </div>
            
            <button onClick={addRole} style={{ width: '100%', padding: 14, background: '#3ddb7f', border: 'none', borderRadius: 12, color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Создать роль</button>
            <button onClick={() => { setShowAddRoleForm(false); setNewRole({ name: '', llmId: newRole.llmId, description: '', systemPrompt: '', knowledgeBases: [] }) }} style={{ width: '100%', marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            </>
            )}
            
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={prev} style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, cursor: 'pointer' }}>← Назад</button>
              <button onClick={next} style={{ flex: 1, padding: 14, background: '#3ddb7f', border: 'none', borderRadius: 12, color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Далее →</button>
            </div>
          </div>
        )}

        {tab === 'launch' && (
          <div>
            <h2 style={{ fontFamily: "'Unbounded', sans-serif", fontSize: 16, marginBottom: 14 }}>🚀 Запуск</h2>
            
            {/* Выбор Руководителя */}
            {!agentReady && (
              <div style={{ background: 'rgba(33,185,244,0.1)', border: '1px solid rgba(33,185,244,0.3)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>👔 Выберите Руководителя</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>Руководитель - главная роль, которая управляет подчинёнными</div>
                <select 
                  value={captainRoleId} 
                  onChange={e => setCaptainRoleId(e.target.value)}
                  style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(33,185,244,0.3)', borderRadius: 10, color: '#fff', fontSize: 13 }}
                >
                  <option value="" style={{ color: '#888' }}>Выберите руководителя...</option>
                  {roles.map(r => <option key={r.id} value={r.id} style={{ color: '#fff', background: '#003144' }}>👔 {r.name}</option>)}
                </select>
                
                {/* Визуальное дерево иерархии */}
                {captainRoleId && (
                  <div style={{ marginTop: 16, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>📊 Структура команды:</div>
                    {/* Руководитель */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                      <div style={{ background: '#21b9f4', color: '#000', padding: '8px 16px', borderRadius: 20, fontWeight: 600, fontSize: 13 }}>
                        👔 {roles.find(r => r.id === captainRoleId)?.name}
                      </div>
                    </div>
                    {/* Линия */}
                    <div style={{ width: 2, height: 20, background: 'rgba(255,255,255,0.3)', margin: '0 auto' }} />
                    {/* Подчинённые */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {roles.filter(r => r.id !== captainRoleId).slice(0, 5).map(r => (
                        <div key={r.id} style={{ background: 'rgba(61,219,127,0.2)', color: '#3ddb7f', padding: '6px 12px', borderRadius: 15, fontSize: 11, border: '1px solid rgba(61,219,127,0.3)' }}>
                          👤 {r.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => { const role = roles.find(r => r.id === captainRoleId); if (role) { setActiveRole(role); setAgentReady(true); setChainLog([]); addLog('РУКОВОДИТЕЛЬ', `Выбран: ${role.name}`) }}}
                  disabled={!captainRoleId}
                  style={{ width: '100%', marginTop: 10, padding: 12, background: captainRoleId ? '#21b9f4' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: captainRoleId ? '#000' : '#666', fontSize: 13, fontWeight: 600, cursor: captainRoleId ? 'pointer' : 'default' }}
                >
                  🚀 Активировать
                </button>
              </div>
            )}
            
            {/* Progress Bar */}
            {agentRunning && (
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>⏳ Выполнение</span>
                  <span style={{ fontSize: 12, color: '#3ddb7f' }}>{progress}%</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #21b9f4, #3ddb7f)', transition: 'width 0.3s', borderRadius: 4 }} />
                </div>
              </div>
            )}
            
            {/* Inline Agent Panel */}
            {agentReady && activeRole && (
              <div style={{ background: 'rgba(61,219,127,0.1)', border: '2px solid #3ddb7f', borderRadius: 16, padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#3ddb7f' }}>👔 Руководитель: {activeRole.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>🤖 {llms.find(l => l.id === activeRole.llmId)?.name || 'LLM не выбран'} | 📚 {activeRole.knowledgeBases.length} баз</div>
                  </div>
                  <button onClick={stopAgent} style={{ background: 'rgba(244,67,54,0.2)', border: '1px solid #f44336', borderRadius: 8, color: '#f44336', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>⏹ Остановить</button>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <textarea 
                    value={userInput} 
                    onChange={e => setUserInput(e.target.value)}
                    placeholder={`Задайте вопрос капитану "${activeRole.name}"...`}
                    rows={3}
                    disabled={agentRunning}
                    style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 13, resize: 'none', opacity: agentRunning ? 0.6 : 1 }}
                  />
                </div>
                
                <button 
                  onClick={runAgent} 
                  disabled={!userInput.trim() || agentRunning}
                  style={{ width: '100%', padding: 12, background: userInput.trim() && !agentRunning ? '#3ddb7f' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, color: userInput.trim() && !agentRunning ? '#000' : '#666', fontSize: 13, fontWeight: 600, cursor: userInput.trim() && !agentRunning ? 'pointer' : 'default' }}
                >
                  {agentRunning ? '⏳ Обработка...' : '▶️ Отправить запрос'}
                </button>
                
                {/* AI Monitoring */}
                {aiThinking.length > 0 && (
                  <div style={{ marginTop: 16, borderTop: '1px solid rgba(61,219,127,0.3)', paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>🧠 Мониторинг AI <span style={{ background: 'rgba(61,219,127,0.2)', color: '#3ddb7f', padding: '2px 8px', borderRadius: 10, fontSize: 10 }}>LIVE</span></div>
                    <div style={{ maxHeight: 250, overflow: 'auto' }}>
                      {aiThinking.map((item, i) => (
                        <div key={i} style={{ 
                          background: item.status === 'Готово' || item.status === 'Ошибка' ? 'rgba(61,219,127,0.1)' : 'rgba(0,0,0,0.3)', 
                          borderRadius: 10, 
                          padding: 12, 
                          marginBottom: 8, 
                          borderLeft: `4px solid ${item.status === 'Готово' ? '#3ddb7f' : item.status === 'Ошибка' ? '#f44336' : item.status === 'Ожидание ответа...' ? '#ff8c42' : '#21b9f4'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{item.role}</span>
                            <span style={{ fontSize: 10, color: item.status === 'Готово' ? '#3ddb7f' : item.status === 'Ошибка' ? '#f44336' : '#21b9f4' }}>{item.status}</span>
                          </div>
                          {item.input && <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>📥 {item.input.substring(0, 80)}{item.input.length > 80 ? '...' : ''}</div>}
                          {item.output && <div style={{ fontSize: 12, color: '#3ddb7f', whiteSpace: 'pre-wrap' }}>{item.output.substring(0, 500)}{item.output.length > 500 ? '...' : ''}</div>}
                          {item.documents && item.documents.length > 0 && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(61,219,127,0.2)' }}>
                              <div style={{ fontSize: 10, color: '#21b9f4', marginBottom: 4 }}>📚 Источники (цитаты):</div>
                              {item.documents.map((doc: any, idx: number) => (
                                <div key={idx} style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginLeft: 8, marginBottom: 4 }}>
                                  <span style={{ color: doc.source === 'Файл' ? '#ff8c42' : '#3ddb7f' }}>•</span> {doc.name} <span style={{ opacity: 0.5 }}>({doc.source})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Кнопки экспорта */}
                    {aiThinking.length > 0 && aiThinking[aiThinking.length-1]?.output && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
                        <button onClick={() => {
                          const text = aiThinking.map(t => `${t.role}: ${t.input}\n${t.output}`).join('\n\n---\n\n');
                          navigator.clipboard.writeText(text);
                          showMsg('Скопировано в буфер!');
                        }} style={{ padding: 10, background: 'rgba(33,185,244,0.2)', border: '1px solid #21b9f4', borderRadius: 8, color: '#21b9f4', fontSize: 11, cursor: 'pointer' }}>📋 Копировать</button>
                        <button onClick={() => {
                          const text = aiThinking.map(t => `${t.role}: ${t.input}\n${t.output}`).join('\n\n---\n\n');
                          const blob = new Blob([text], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `dialog_${new Date().toISOString().slice(0,10)}.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }} style={{ padding: 10, background: 'rgba(61,219,127,0.2)', border: '1px solid #3ddb7f', borderRadius: 8, color: '#3ddb7f', fontSize: 11, cursor: 'pointer' }}>💾 TXT</button>
                        <button onClick={() => {
                          const html = `<html><body><pre>${aiThinking.map(t => `<b>${t.role}</b>\n📥 ${t.input}\n\n📤 ${t.output}`).join('\n\n<hr>\n\n')}</pre></body></html>`;
                          const blob = new Blob([html], { type: 'text/html' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `dialog_${new Date().toISOString().slice(0,10)}.html`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }} style={{ padding: 10, background: 'rgba(255,140,66,0.2)', border: '1px solid #ff8c42', borderRadius: 8, color: '#ff8c42', fontSize: 11, cursor: 'pointer' }}>🌐 HTML</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Telegram & Web UI buttons - hide when agent running */}
            {!agentReady && (
              <>


                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>📊 Статус системы</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                    <div style={{ background: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 10 }}><div style={{ fontSize: 24, fontWeight: 700, color: '#3ddb7f' }}>{llms.length}</div><div style={{ fontSize: 10, opacity: 0.6 }}>LLM</div></div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 10 }}><div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{roles.length}</div><div style={{ fontSize: 10, opacity: 0.6 }}>Ролей</div></div>
                    <div style={{ background: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 10 }}><div style={{ fontSize: 24, fontWeight: 700, color: '#21b9f4' }}>{roles.reduce((a, r) => a + r.knowledgeBases.length, 0)}</div><div style={{ fontSize: 10, opacity: 0.6 }}>Базы</div></div>
                  </div>
                </div>

                {roles.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>🧪 Тест роли:</div>
                    <select id="testRoleSelect" style={{ width: '100%', padding: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 13, marginBottom: 10 }}>
                      <option value="" style={{ color: '#888' }}>Выберите роль...</option>
                      {roles.map(r => <option key={r.id} value={r.id} style={{ color: '#fff', background: '#003144' }}>{r.name}</option>)}
                    </select>
                    <button onClick={() => { const select = document.getElementById('testRoleSelect') as HTMLSelectElement; if (select?.value) simulateLaunch(select.value) }} style={{ width: '100%', padding: 12, background: '#ff8c42', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>▶️ Запустить и наблюдать</button>
                  </div>
                )}
              </>
            )}

            <button onClick={prev} style={{ width: '100%', padding: 14, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, color: '#fff', fontSize: 14, cursor: 'pointer' }}>← Назад</button>
          </div>
        )}
      </div>

      <button onClick={() => setShowLogs(!showLogs)} style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(61,219,127,0.4)', borderRadius: 20, color: '#3ddb7f', padding: '10px 20px', fontSize: 12, cursor: 'pointer', zIndex: 1000 }}>
        📋 Лог ({logs.length})
      </button>
    </div>
  )
}
