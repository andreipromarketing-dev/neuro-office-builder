// ==================== ORCHESTRATE - Boss цикл с делегацией ====================

import { delegate } from './delegate.js';

const MAX_ITERATIONS = 5;
const FINAL_KEYWORDS = ['FINAL ANSWER', 'ГОТОВО', 'ЗАВЕРШЕНО', 'ИТОГ'];

export async function orchestrate(task, bossRoleId, roles, llmCallFn) {
  const bossRole = roles.find(r => r.id === bossRoleId || r.name === bossRoleId);
  if (!bossRole) return { error: `Роль ${bossRoleId} не найдена` };
  
  console.log(`[ORCHESTRATE] Start: ${task.substring(0, 30)}... with ${bossRole.name}`);

  // Собираем список доступных ролей для делегирования
  const availableRoles = roles.filter(r => r.id !== bossRoleId).map(r => r.name).join(', ');
  const delegationInstruction = `\n\n=== ИНСТРУКЦИЯ ДЕЛЕГИРОВАНИЯ ===
Ты руководитель. У тебя есть подчиненные (боты) с ролями: ${availableRoles}.
Чтобы делегировать задачу подчиненному, используй команду CALL в формате:
CALL[название_роли][задача]
Пример: CALL[Секретарь][Рассчитайте стоимость проекта для клиента]
ИЛИ: CALL Секретарь - рассчитать стоимость проекта.
После получения результата от подчиненного, продолжай работу или заверши задачу.
Когда задача полностью решена, напиши FINAL ANSWER (или ГОТОВО, ЗАВЕРШЕНО, ИТОГ).`;

  const enhancedSystemPrompt = bossRole.systemPrompt + delegationInstruction;

  let messages = [
    { role: 'system', content: enhancedSystemPrompt },
    { role: 'user', content: task }
  ];
  
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`[ORCHESTRATE] Итерация ${i + 1}/${MAX_ITERATIONS}`);
    const response = await llmCallFn(bossRole.llmName, messages);
    console.log(`[ORCHESTRATE] Ответ руководителя: ${response.substring(0, 150)}...`);

    const isFinal = FINAL_KEYWORDS.some(k => response.toUpperCase().includes(k));
    if (isFinal) {
      console.log(`[ORCHESTRATE] Найдено ключевое слово финала: ${response.substring(0, 50)}`);
      return { success: true, iterations: i + 1, finalAnswer: response };
    }

    const del = await delegate(response, bossRoleId, llmCallFn);
    if (del.delegated) {
      console.log(`[ORCHESTRATE] Делегирование успешно: ${del.subRole}`);
      messages.push({ role: 'assistant', content: response });
      messages.push({ role: 'user', content: `\nРезультат от ${del.subRole}:\n${del.output}\n\nПродолжи или заверши.` });
    } else {
      console.log(`[ORCHESTRATE] Делегирование не удалось: ${del.error || 'неизвестно'}`);
      break;
    }
  }
  
  return { error: 'Достигнут лимит итераций (5)' };
}
