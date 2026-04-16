#!/usr/bin/env node
/**
 * Тест менеджера пресетов
 */

import { getPresetManager } from './preset-manager.js';

async function test() {
    console.log('=== Тест менеджера пресетов ===\n');

    const manager = getPresetManager();

    // 1. Тест сохранения данных
    console.log('1. Сохранение тестовых данных в пресет...');
    const testPresetId = 'test_preset_1';
    const testRoles = [
        { id: 'test-1', name: 'Тестовая роль 1', systemPrompt: 'Тестовый промпт 1' },
        { id: 'test-2', name: 'Тестовая роль 2', systemPrompt: 'Тестовый промпт 2' }
    ];

    const saveSuccess = await manager.savePresetData(testPresetId, 'roles', testRoles);
    console.log(`   Результат сохранения: ${saveSuccess ? 'успешно' : 'ошибка'}`);

    // 2. Тест загрузки пресета
    console.log('\n2. Загрузка пресета в память...');
    const preset = await manager.loadPreset(testPresetId);
    console.log(`   Результат загрузки: ${preset ? 'успешно' : 'ошибка'}`);
    if (preset) {
        console.log(`   ID пресета: ${preset.presetId}`);
        console.log(`   Загружено комнат: ${preset.data.size}`);
    }

    // 3. Тест получения данных
    console.log('\n3. Получение данных из пресета...');
    const loadedRoles = await manager.getPresetData(testPresetId, 'roles');
    console.log(`   Загружено ролей: ${loadedRoles ? loadedRoles.length : 0}`);
    if (loadedRoles && loadedRoles.length > 0) {
        console.log(`   Первая роль: ${loadedRoles[0].name}`);
    }

    // 4. Тест списка активных пресетов
    console.log('\n4. Список активных пресетов:');
    const activePresets = manager.getActivePresets();
    console.log(`   Количество активных: ${activePresets.length}`);
    activePresets.forEach(p => {
        console.log(`   - ${p.presetId}: ${p.memoryMb.toFixed(1)} MB, доступов: ${p.accessCount}`);
    });

    // 5. Тест выгрузки пресета
    console.log('\n5. Выгрузка пресета из памяти...');
    const unloadSuccess = await manager.unloadPreset(testPresetId);
    console.log(`   Результат выгрузки: ${unloadSuccess ? 'успешно' : 'ошибка'}`);

    // 6. Проверка после выгрузки
    console.log('\n6. Проверка после выгрузки:');
    const activeAfter = manager.getActivePresets();
    console.log(`   Активных пресетов: ${activeAfter.length}`);

    console.log('\n=== Тест завершен ===');
}

test().catch(error => {
    console.error('Ошибка теста:', error);
    process.exit(1);
});