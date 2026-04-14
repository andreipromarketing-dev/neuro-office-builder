#!/usr/bin/env node
/**
 * Конвертер pm-claude-skills -> NeuroOffice пресеты
 * 
 * Парсит все папки из presets/source/skills/
 * и создаёт готовые пресеты в presets/ready/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.join(__dirname, '..', 'source', 'skills');
const READY_DIR = path.join(__dirname, '..', 'ready');

// Категории профессий
const CATEGORIES = {
  // Product Management
  'prd-template': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'user-research-synthesis': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'job-story-mapper': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'okr-builder': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'feature-prioritisation': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'rice-prioritisation': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'roadmap-presentation': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'sprint-planning': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'technical-spec-template': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'ab-test-planner': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'go-to-market-planner': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'product-launch-checklist': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'sprint-brief': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'retro-analysis': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'data-analysis-standard': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'retention-analysis': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'product-health-analysis': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'competitor-signal-tracker': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'competitive-intelligence-monitor': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'stakeholder-influence-mapper': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'strategic-narrative-generator': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'executive-update': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'ambiguity-resolver': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'ai-product-canvas': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'multi-source-signal-synthesiser': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'experiment-designer': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'design-handoff-brief': { category: 'product', ru: 'Product Manager', en: 'PM' },
  'pm-weekly-review': { category: 'product', ru: 'Product Manager', en: 'PM' },
  
  // Marketing
  'go-to-market': { category: 'marketing', ru: 'Маркетинг', en: 'Marketing' },
  'content-calendar': { category: 'marketing', ru: 'Маркетинг', en: 'Marketing' },
  'competitor-teardown': { category: 'marketing', ru: 'Маркетинг', en: 'Marketing' },
  'email-campaign': { category: 'marketing', ru: 'Маркетинг', en: 'Marketing' },
  'competitive-analysis': { category: 'marketing', ru: 'Маркетинг', en: 'Marketing' },
  'pricing-strategy': { category: 'marketing', ru: 'Маркетинг', en: 'Marketing' },
  'launch-readiness': { category: 'marketing', ru: 'Маркетинг', en: 'Marketing' },
  
  // Legal
  'contract-review': { category: 'legal', ru: '��рист', en: 'Legal PM' },
  'nda-analyser': { category: 'legal', ru: 'Юрист', en: 'Legal PM' },
  'legal-brief': { category: 'legal', ru: 'Юрист', en: 'Legal PM' },
  'compliance-checklist': { category: 'legal', ru: 'Юрист', en: 'Legal PM' },
  
  // Finance
  'financial-model-narrative': { category: 'finance', ru: 'Финансы', en: 'Finance PM' },
  'budget-variance-analysis': { category: 'finance', ru: 'Финансы', en: 'Finance PM' },
  'investor-pitch-deck': { category: 'finance', ru: 'Финансы', en: 'Finance PM' },
  'financial-due-diligence': { category: 'finance', ru: 'Финансы', en: 'Finance PM' },
  'metrics-framework': { category: 'finance', ru: 'Финансы', en: 'Finance PM' },
  'sql-query-explainer': { category: 'finance', ru: 'Финансы', en: 'Finance PM' },
  
  // HR
  'job-description-writer': { category: 'hr', ru: 'HR', en: 'HR PM' },
  'onboarding-plan': { category: 'hr', ru: 'HR', en: 'HR PM' },
  'employee-engagement-survey': { category: 'hr', ru: 'HR', en: 'HR PM' },
  'redundancy-consultation': { category: 'hr', ru: 'HR', en: 'HR PM' },
  'performance-review': { category: 'hr', ru: 'HR', en: 'HR PM' },
  'hiring-rubric': { category: 'hr', ru: 'HR', en: 'HR PM' },
  
  // Sales
  'sales-battlecard': { category: 'sales', ru: 'Продажи', en: 'Sales PM' },
  'discovery-call-prep': { category: 'sales', ru: 'Продажи', en: 'Sales PM' },
  'proposal-writer': { category: 'sales', ru: 'Продажи', en: 'Sales PM' },
  'account-plan': { category: 'sales', ru: 'Продажи', en: 'Sales PM' },
  
  // Operations
  'process-documentation': { category: 'operations', ru: 'Операции', en: 'Operations PM' },
  'sop-writer': { category: 'operations', ru: 'Операции', en: 'Operations PM' },
  'vendor-evaluation': { category: 'operations', ru: 'Операции', en: 'Operations PM' },
  'project-status-report': { category: 'operations', ru: 'Операции', en: 'Operations PM' },
  
  // Engineering
  'code-review-checklist': { category: 'engineering', ru: 'Инженер', en: 'Engineering' },
  'incident-postmortem': { category: 'engineering', ru: 'Инженер', en: 'Engineering' },
  'api-docs-writer': { category: 'engineering', ru: 'Инженер', en: 'Engineering' },
  'architecture-decision-record': { category: 'engineering', ru: 'Инженер', en: 'Engineering' },
  
  // Design
  'ux-research-plan': { category: 'design', ru: 'Дизайн', en: 'Design PM' },
  'design-critique': { category: 'design', ru: 'Дизайн', en: 'Design PM' },
  'accessibility-audit': { category: 'design', ru: 'Дизайн', en: 'Design PM' },
  
  // Business
  'investor-update': { category: 'business', ru: 'Бизнес', en: 'Business PM' },
  'board-deck-narrative': { category: 'business', ru: 'Бизнес', en: 'Business PM' },
  'job-application': { category: 'business', ru: 'Бизнес', en: 'Business PM' },
  
  // Research & Healthcare
  'clinical-case-summary': { category: 'research', ru: 'Медицина', en: 'Research' },
  'research-protocol': { category: 'research', ru: 'Медицина', en: 'Research' },
  'patient-communication': { category: 'research', ru: 'Медицина', en: 'Research' },
  'literature-review': { category: 'research', ru: 'Медицина', en: 'Research' },
  
  // Cross Profession
  'press-release': { category: 'cross', ru: 'Мульти', en: 'Cross Profession' },
  'grant-proposal': { category: 'cross', ru: 'Мульти', en: 'Cross Profession' },
  'executive-summary': { category: 'cross', ru: 'Мульти', en: 'Cross Profession' },
};

// Функция для парсинга SKILL.md файла
function parseSkillFile(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf-8');
  
  // Извлекаем name
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  const skillName = nameMatch ? nameMatch[1].trim() : path.basename(skillPath, '.md');
  
  // Извлекаем description  
  const descMatch = content.match(/^description:\s*(.+)$/m);
  const description = descMatch ? descMatch[1].trim() : '';
  
  // Извлекаем инструкции (всё после первого заголовка)
  const lines = content.split('\n');
  let skipHeader = false;
  let instructions = [];
  
  for (const line of lines) {
    if (line.startsWith('# ') && line.includes('Skill')) {
      skipHeader = true;
      continue;
    }
    if (skipHeader && line.startsWith('# ')) {
      break;
    }
    if (skipHeader && line.trim()) {
      instructions.push(line);
    }
  }
  
  // Первые 50 строк инструкций как промпт (с ограничением по длине)
  let systemPrompt = instructions.slice(0, 80).join('\n').trim();
  
  // Ограничиваем длину
  if (systemPrompt.length > 8000) {
    systemPrompt = systemPrompt.substring(0, 8000) + '\n\n[Инструкции обрезаны - полная версия доступна в базе знаний]';
  }
  
  return { skillName, description, systemPrompt };
}

// Основная функция
function convertSkills() {
  console.log('🔄 Конвертер pm-claude-skills -> NeuroOffice пресеты\n');
  
  // Создаём папку ready если нет
  if (!fs.existsSync(READY_DIR)) {
    fs.mkdirSync(READY_DIR, { recursive: true });
  }
  
  // Читаем все папки в skills/
  const skillFolders = fs.readdirSync(SOURCE_DIR)
    .filter(f => fs.statSync(path.join(SOURCE_DIR, f)).isDirectory());
  
  console.log(`📁 Найдено скиллов: ${skillFolders.length}\n`);
  
  let converted = 0;
  let grouped = {};
  
  for (const folder of skillFolders) {
    const skillPath = path.join(SOURCE_DIR, folder, 'SKILL.md');
    
    if (!fs.existsSync(skillPath)) {
      console.log(`  ⚠️ Пропущен (нет SKILL.md): ${folder}`);
      continue;
    }
    
    try {
      const { skillName, description, systemPrompt } = parseSkillFile(skillPath);
      
      // Определяем категорию
      const categoryInfo = CATEGORIES[folder] || { category: 'other', ru: 'Другое', en: 'Other' };
      const category = categoryInfo.category;
      
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      // Создаём пресет
      const preset = {
        id: folder,
        name: skillName,
        description: description,
        systemPrompt: systemPrompt,
        llmId: 'default',
        category: categoryInfo,
        knowledgeBases: [],
        source: 'pm-claude-skills',
        originalFolder: folder
      };
      
      // Сохраняем пресет
      const outputPath = path.join(READY_DIR, `${folder}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2), 'utf-8');
      
      grouped[category].push(folder);
      converted++;
      
      console.log(`  ✅ ${folder} -> ${categoryInfo.ru}`);
      
    } catch (e) {
      console.log(`  ❌ Ошибка ${folder}: ${e.message}`);
    }
  }
  
  // Итоговый отчёт
  console.log('\n📊 По категориям:');
  for (const [cat, items] of Object.entries(grouped)) {
    console.log(`  ${cat}: ${items.length} навыков`);
  }
  
  console.log(`\n✅ Готово! Создано пресетов: ${converted}`);
  console.log(`📁 Папка: ${READY_DIR}`);
  
  // Создаём индексный файл
  const index = {
    generated: new Date().toISOString(),
    total: converted,
    categories: Object.keys(grouped),
    byCategory: grouped
  };
  
  fs.writeFileSync(path.join(READY_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log('📋 Индекс сохранён: index.json');
}

convertSkills();