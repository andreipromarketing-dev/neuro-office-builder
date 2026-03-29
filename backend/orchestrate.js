// ==================== ORCHESTRATE - Boss цикл с делегацией ====================

import { delegate } from './delegate.js';

const MAX_ITERATIONS = 5;
const FINAL_KEYWORDS = ['FINAL ANSWER', 'ГОТОВО', 'ЗАВЕРШЕНО', 'ИТОГ'];

export async function orchestrate(task, bossRoleId, roles, llmCallFn) {
  const bossRole = roles.find(r => r.id === bossRoleId || r.name === bossRoleId);
  if (!bossRole) return { error: `Роль ${bossRoleId} не найдена` };
  
  console.log(`[ORCHESTRATE] Start: ${task.substring(0, 30)}... with ${bossRole.name}`);
  
  let messages = [
    { role: 'system', content: bossRole.systemPrompt },
    { role: 'user', content: task + '\n\nИспользуй CALL[роль][задача] для вызова ботов. Завершай ответ FINAL ANSWER когда готово.' }
  ];
  
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await llmCallFn(bossRole.llmName, messages);
    
    const isFinal = FINAL_KEYWORDS.some(k => response.toUpperCase().includes(k));
    if (isFinal) {
      return { success: true, iterations: i + 1, finalAnswer: response };
    }
    
    const del = await delegate(response, bossRoleId, llmCallFn);
    if (del.delegated) {
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: `\nРезультат от ${del.subRole}:\n${del.output}\n\nПродолжи или заверши.` });
    } else {
      break;
    }
  }
  
  return { error: 'Достигнут лимит итераций (5)' };
}
