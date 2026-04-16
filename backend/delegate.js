// ==================== DELEGATE - Делегация задач подчиненным ботам ====================

import Fuse from 'fuse.js';

let roles = [];
let documents = [];
let searchIndex = null;

export function setRoles(r) {
  roles = r;
  console.log(`[DELEGATE] Загружено ролей: ${roles.length}, имена: ${roles.map(r => r.name).join(', ')}`);
  rebuildSearchIndex();
}

export function setDocuments(d) {
  documents = d;
  console.log(`[DELEGATE] Загружено документов: ${documents.length}`);
  rebuildSearchIndex();
}

function rebuildSearchIndex() {
  if (!documents.length) return;
  const docs = documents.map(d => ({
    id: d.id,
    name: d.name,
    content: d.content,
    roleId: d.roleId
  }));
  searchIndex = new Fuse(docs, {
    keys: ['name', 'content'],
    threshold: 0.4,
    ignoreLocation: true
  });
}

function searchDocuments(query, roleId = null, limit = 5) {
  if (!searchIndex) return [];
  let results = searchIndex.search(query);
  if (roleId) results = results.filter(r => r.item.roleId === roleId);
  return results.slice(0, limit).map(r => ({ ...r.item, score: r.score }));
}

export async function delegate(bossMessage, bossRoleId, llmCallFn) {
  console.log(`[DELEGATE] Вход: bossRoleId=${bossRoleId}, message=${bossMessage.substring(0, 100)}`);
  const CALL_PATTERNS = [
    /CALL\s*\[([^\]]+)\]\s*\[([^\]]+)\]/gi,
    /CALL\s+(\w+)\s*[-–—]?\s*(.+?)(?:\.|$)/gi,
    /CALL\s*:\s*(\w+)\s*[:-]\s*(.+)/gi,
    /CALL\s+(\w+)\s+для\s+(.+)/gi,
    /CALL\s+(\w+)\s*\((.*?)\)/gi
  ];
  
  // Ищем паттерн CALL
  let subRoleName = null;
  let subTask = null;

  for (const pattern of CALL_PATTERNS) {
    const regex = new RegExp(pattern.source, 'i'); // без глобального флага для exec
    const match = regex.exec(bossMessage);
    if (match && match.length >= 3) {
      subRoleName = match[1].trim();
      subTask = match[2].trim();
      console.log(`[DELEGATE] Найдена команда CALL: ${subRoleName} -> ${subTask}`);
      break;
    }
  }

  if (!subRoleName || !subTask) {
    console.log('[DELEGATE] Не найдена команда CALL в сообщении:', bossMessage.substring(0, 100));
    return { delegated: false };
  }
  
  const subRole = roles.find(r => 
    r.name?.toLowerCase() === subRoleName.toLowerCase() ||
    r.name?.toLowerCase().includes(subRoleName.toLowerCase())
  );
  
  if (!subRole) return { delegated: false, error: `Роль ${subRoleName} не найдена` };
  
  console.log(`[DELEGATE] ${bossRoleId} -> ${subRole.name}`);
  
  const ragDocs = searchDocuments(subTask, subRole.id, 3);
  const context = ragDocs.length ? '\nКонтекст:\n' + ragDocs.map(d => d.content.substring(0, 500)).join('\n') : '';
  
  const messages = [
    { role: 'system', content: subRole.systemPrompt + context },
    { role: 'user', content: subTask }
  ];
  
  try {
    console.log(`[DELEGATE] Вызов подчиненного ${subRole.name} с задачей: ${subTask.substring(0, 50)}...`);
    const response = await llmCallFn(subRole.llmName, messages);
    console.log(`[DELEGATE] Ответ от ${subRole.name}: ${response.substring(0, 100)}...`);
    return { delegated: true, subRole: subRole.name, output: response };
  } catch (e) {
    console.error(`[DELEGATE] Ошибка вызова LLM: ${e.message}`);
    return { delegated: false, error: e.message };
  }
}
