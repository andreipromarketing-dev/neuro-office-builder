#!/usr/bin/env node
/**
 * Менеджер пресетов для NeuroOffice Builder
 *
 * Реализует механизм загрузки/выгрузки пресетов как в LM Studio:
 * - Загрузка пресетов в оперативную память
 * - Выгрузка с сохранением состояния
 * - Мониторинг ресурсов (память, CPU)
 * - Несколько активных пресетов одновременно
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class PresetResourceStats {
    constructor() {
        this.memoryMb = 0.0;
        this.cpuPercent = 0.0;
        this.loadedAt = Date.now();
        this.lastAccessed = Date.now();
        this.accessCount = 0;
        this.dataSizeBytes = 0;
    }

    updateAccess() {
        this.lastAccessed = Date.now();
        this.accessCount++;
    }

    updateResources(dataSizeBytes) {
        this.dataSizeBytes = dataSizeBytes;
        this.memoryMb = dataSizeBytes / (1024 * 1024);
        // CPU вычисляется отдельно
    }
}

class ActivePreset {
    constructor(presetId, wingName) {
        this.presetId = presetId;
        this.wingName = wingName;
        this.data = new Map(); // roomName -> data
        this.resources = new PresetResourceStats();
        this.isLoaded = false;
        this.lock = false;
    }

    getData(roomName) {
        this.resources.updateAccess();
        return this.data.get(roomName);
    }

    setData(roomName, data) {
        this.data.set(roomName, data);
        this.resources.updateAccess();

        // Пересчитываем размер данных
        let totalSize = 0;
        for (const [key, value] of this.data) {
            totalSize += Buffer.byteLength(JSON.stringify(value), 'utf8');
        }
        this.resources.updateResources(totalSize);
    }

    getAllData() {
        this.resources.updateAccess();
        return Object.fromEntries(this.data);
    }
}

class PresetManager {
    constructor(palacePath = null) {
        this.palacePath = palacePath || path.join(__dirname, '.mempalace');
        this.activePresets = new Map();
        this.maxActivePresets = 3;

        // Создаем директорию если не существует
        fs.mkdir(this.palacePath, { recursive: true }).catch(console.error);
    }

    getWingName(presetId) {
        return `preset_${presetId}`;
    }

    getRoomName(dataType) {
        const mapping = {
            "roles": "roles",
            "knowledgeBases": "knowledge_bases",
            "conversationHistory": "conversation_history",
            "llms": "llms"
        };
        return mapping[dataType] || dataType;
    }

    async loadPreset(presetId) {
        // Проверяем лимит активных пресетов
        if (this.activePresets.size >= this.maxActivePresets) {
            await this.unloadLeastUsedPreset();
        }

        if (this.activePresets.has(presetId)) {
            const preset = this.activePresets.get(presetId);
            preset.resources.updateAccess();
            return preset;
        }

        const wingName = this.getWingName(presetId);
        const preset = new ActivePreset(presetId, wingName);

        try {
            // Загружаем данные из файлов
            const dataLoaded = await this.loadAllPresetData(preset);
            if (dataLoaded) {
                preset.isLoaded = true;
                preset.resources.loadedAt = Date.now();
                preset.resources.updateAccess();
                this.activePresets.set(presetId, preset);

                console.log(`[PresetManager] Загружен пресет: ${presetId}, размер: ${preset.resources.dataSizeBytes} байт`);
                return preset;
            } else {
                console.log(`[PresetManager] Ошибка загрузки пресета: ${presetId}`);
                return null;
            }
        } catch (error) {
            console.error(`[PresetManager] Исключение при загрузке пресета ${presetId}:`, error);
            return null;
        }
    }

    async unloadPreset(presetId) {
        if (!this.activePresets.has(presetId)) {
            return true;
        }

        const preset = this.activePresets.get(presetId);
        if (!preset.isLoaded) {
            return true;
        }

        try {
            // Сохраняем все изменения
            await this.saveAllPresetData(preset);

            // Очищаем данные из памяти
            preset.data.clear();
            preset.isLoaded = false;
            this.activePresets.delete(presetId);

            console.log(`[PresetManager] Выгружен пресет: ${presetId}`);
            return true;
        } catch (error) {
            console.error(`[PresetManager] Ошибка выгрузки пресета ${presetId}:`, error);
            return false;
        }
    }

    async getPresetData(presetId, dataType) {
        let preset = this.activePresets.get(presetId);

        if (!preset) {
            // Автоматически загружаем если не загружен
            preset = await this.loadPreset(presetId);
            if (!preset) {
                return null;
            }
        }

        const roomName = this.getRoomName(dataType);
        let data = preset.getData(roomName);

        if (!data) {
            // Пытаемся загрузить из файлов
            data = await this.loadPresetData(preset, dataType);
            if (data) {
                preset.setData(roomName, data);
            }
        }

        return data;
    }

    async savePresetData(presetId, dataType, data) {
        let preset = this.activePresets.get(presetId);

        if (!preset) {
            // Создаем новый пресет если не существует
            const wingName = this.getWingName(presetId);
            preset = new ActivePreset(presetId, wingName);
            preset.isLoaded = true;
            this.activePresets.set(presetId, preset);
        }

        const roomName = this.getRoomName(dataType);
        preset.setData(roomName, data);

        // Сохраняем в файлы
        return await this.savePresetDataToFile(preset, dataType, data);
    }

    getActivePresets() {
        const result = [];
        const cpuUsage = os.loadavg()[0]; // 1-минутная нагрузка

        for (const [presetId, preset] of this.activePresets) {
            const cpuPerPreset = cpuUsage / this.activePresets.size || 0;

            result.push({
                presetId: presetId,
                wingName: preset.wingName,
                isLoaded: preset.isLoaded,
                memoryMb: preset.resources.memoryMb,
                cpuPercent: cpuPerPreset,
                loadedSecondsAgo: Math.round((Date.now() - preset.resources.loadedAt) / 1000),
                lastAccessSecondsAgo: Math.round((Date.now() - preset.resources.lastAccessed) / 1000),
                accessCount: preset.resources.accessCount,
                dataSizeKb: preset.resources.dataSizeBytes / 1024,
                rooms: Array.from(preset.data.keys())
            });
        }

        return result;
    }

    async loadAllPresetData(preset) {
        const roomTypes = ["roles", "knowledgeBases", "conversationHistory", "llms"];

        for (const roomType of roomTypes) {
            const data = await this.loadPresetData(preset, roomType);
            if (data !== null) {
                preset.setData(this.getRoomName(roomType), data);
            }
        }

        return preset.data.size > 0;
    }

    async saveAllPresetData(preset) {
        let success = true;

        for (const [roomName, data] of preset.data) {
            // Находим dataType по roomName
            let dataType = null;
            for (const [key, value] of Object.entries({
                "roles": "roles",
                "knowledgeBases": "knowledge_bases",
                "conversationHistory": "conversation_history",
                "llms": "llms"
            })) {
                if (value === roomName) {
                    dataType = key;
                    break;
                }
            }

            if (dataType && !await this.savePresetDataToFile(preset, dataType, data)) {
                success = false;
            }
        }

        return success;
    }

    async loadPresetData(preset, dataType) {
        const wingName = preset.wingName;
        const roomName = this.getRoomName(dataType);
        const roomFile = path.join(this.palacePath, wingName, `${roomName}.json`);

        try {
            await fs.access(roomFile);

            const dataStr = await fs.readFile(roomFile, 'utf-8');
            const data = JSON.parse(dataStr);

            console.log(`[PresetManager] Загружено из файла: ${wingName}/${roomName}, ${dataStr.length} байт`);
            return data;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`[PresetManager] Файл не найден: ${roomFile}`);
                return [];
            }
            console.error(`[PresetManager] Ошибка чтения файла ${roomFile}:`, error);
            return null;
        }
    }

    async savePresetDataToFile(preset, dataType, data) {
        const wingName = preset.wingName;
        const roomName = this.getRoomName(dataType);
        const wingDir = path.join(this.palacePath, wingName);
        const roomFile = path.join(wingDir, `${roomName}.json`);

        try {
            await fs.mkdir(wingDir, { recursive: true });

            const dataStr = JSON.stringify(data, null, 2);
            await fs.writeFile(roomFile, dataStr, 'utf-8');

            console.log(`[PresetManager] Сохранено в файл: ${wingName}/${roomName}, ${dataStr.length} байт`);
            return true;
        } catch (error) {
            console.error(`[PresetManager] Ошибка записи файла ${roomFile}:`, error);
            return false;
        }
    }

    async unloadLeastUsedPreset() {
        if (this.activePresets.size === 0) return;

        let leastUsedId = null;
        let leastAccessTime = Infinity;

        for (const [presetId, preset] of this.activePresets) {
            if (preset.resources.lastAccessed < leastAccessTime) {
                leastAccessTime = preset.resources.lastAccessed;
                leastUsedId = presetId;
            }
        }

        if (leastUsedId) {
            await this.unloadPreset(leastUsedId);
        }
    }
}

// Экспорт синглтона
let presetManagerInstance = null;

function getPresetManager() {
    if (!presetManagerInstance) {
        presetManagerInstance = new PresetManager();
    }
    return presetManagerInstance;
}

export {
    PresetManager,
    getPresetManager
};

// Пример использования
if (import.meta.url === `file://${process.argv[1]}`) {
    async function test() {
        const manager = getPresetManager();

        // Тест загрузки пресета
        const testPresetId = "test_preset_1";
        const testRoles = [
            { id: "1", name: "Тестовая роль", systemPrompt: "Тест" }
        ];

        // Сохраняем данные
        const saveSuccess = await manager.savePresetData(testPresetId, "roles", testRoles);
        console.log(`Сохранение ролей: ${saveSuccess ? 'успешно' : 'ошибка'}`);

        // Загружаем пресет
        const preset = await manager.loadPreset(testPresetId);
        console.log(`Загрузка пресета: ${preset ? 'успешно' : 'ошибка'}`);

        // Получаем данные
        const loadedRoles = await manager.getPresetData(testPresetId, "roles");
        console.log(`Загружено ролей: ${loadedRoles ? loadedRoles.length : 0}`);

        // Список активных пресетов
        const activePresets = manager.getActivePresets();
        console.log(`Активные пресеты: ${activePresets.length}`);
        activePresets.forEach(p => {
            console.log(`  - ${p.presetId}: ${p.memoryMb} MB, CPU: ${p.cpuPercent}%`);
        });

        // Выгружаем пресет
        const unloadSuccess = await manager.unloadPreset(testPresetId);
        console.log(`Выгрузка пресета: ${unloadSuccess ? 'успешно' : 'ошибка'}`);
    }

    test().catch(console.error);
}