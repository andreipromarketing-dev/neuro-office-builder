// ==================== DELEGATE - Делегация задач подчиненным ботам ====================

import Fuse from 'fuse.js';

let roles = [];
let documents = [];
let searchIndex = null;

export function setRoles(r) {
  roles = r;
  rebuildSearchIndex();
}

export function setDocuments(d) {
  documents = d;
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
  const CALL_PATTERNS = [
    /CALL\s*\[([^\]]+)\]\s*\[([^\]]+)\]/gi,
    /CALL\s+(\w+)\s*[-–—]?\s*(.+?)(?:\.|$)/gi
  ];
  
  let match = null;
  for (const pattern of CALL_PATTERNS) {
    match = bossMessage.match(pattern);
    if (match) break;
  }
  
  if (!match) return { delegated: false };
  
  const subRoleName = match[1].trim();
  const subTask = match[2].trim();
  
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
    const response = await llmCallFn(subRole.llmName, messages);
    return { delegated: true, subRole: subRole.name, output: response };
  } catch (e) {
    return { delegated: false, error: e.message };
  }
}
