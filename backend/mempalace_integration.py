#!/usr/bin/env python3
"""
Интеграция MemPalace для NeuroOffice Builder с механизмом загрузки/выгрузки.

Реализует систему как в LM Studio:
- Загрузка пресетов в оперативную память
- Выгрузка с сохранением состояния
- Мониторинг ресурсов (память, CPU)
- Несколько активных пресетов одновременно
- Сохранение истории при выгрузке

Структура MemPalace:
- Пресеты → крылья (wings)
- Типы данных → комнаты (rooms)
- Данные → ящики (drawers)
"""

import json
import os
import sys
import time
import psutil
import threading
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime

# Попытка импортировать MemPalace
try:
    import mempalace as mp
    from mempalace import MemoryPalace
    MEMPALACE_AVAILABLE = True
except ImportError:
    mp = None
    MemoryPalace = None
    MEMPALACE_AVAILABLE = False
    print("[MemPalace] Пакет не установлен, используется файловая эмуляция")

# Путь к дворцу (памяти)
default_path = os.path.join(os.path.dirname(__file__), ".mempalace")
PALACE_PATH = Path(os.getenv("MEMORY_PALACE_PATH", default_path))

@dataclass
class PresetResourceStats:
    """Статистика ресурсов пресета."""
    memory_mb: float = 0.0
    cpu_percent: float = 0.0
    loaded_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    access_count: int = 0
    data_size_bytes: int = 0

@dataclass
class ActivePreset:
    """Активный пресет в памяти."""
    preset_id: str
    wing_name: str
    data: Dict[str, Any] = field(default_factory=dict)  # {room_name: data}
    resources: PresetResourceStats = field(default_factory=PresetResourceStats)
    is_loaded: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)

class MemPalaceIntegration:
    def __init__(self, palace_path: str = None):
        """Инициализация интеграции с MemPalace."""
        self.palace_path = Path(palace_path) if palace_path else PALACE_PATH
        self.palace_path.mkdir(parents=True, exist_ok=True)

        # Активные пресеты в памяти
        self.active_presets: Dict[str, ActivePreset] = {}
        self.active_presets_lock = threading.Lock()

        # Максимальное количество активных пресетов
        self.max_active_presets = 3

        # Инициализируем клиент MemPalace если доступен
        self.client = None
        if MEMPALACE_AVAILABLE:
            try:
                self.client = MemoryPalace(str(self.palace_path))
                print(f"[MemPalace] Инициализирован дворец: {self.palace_path}")
            except Exception as e:
                print(f"[MemPalace] Ошибка инициализации: {e}")
        else:
            print("[MemPalace] Используется файловая эмуляция")

        # Мониторинг ресурсов
        self.monitor_thread = threading.Thread(target=self._monitor_resources, daemon=True)
        self.monitor_thread.start()

    def get_wing_name(self, preset_id: str) -> str:
        """Генерирует имя крыла для пресета."""
        return f"preset_{preset_id}"

    def get_room_name(self, data_type: str) -> str:
        """Генерирует имя комнаты для типа данных."""
        return {
            "roles": "roles",
            "knowledge_bases": "knowledge_bases",
            "conversation_history": "conversation_history",
            "llms": "llms"
        }.get(data_type, data_type)

    def load_preset(self, preset_id: str) -> bool:
        """Загружает пресет в оперативную память."""
        with self.active_presets_lock:
            # Проверяем лимит активных пресетов
            if len(self.active_presets) >= self.max_active_presets:
                # Выгружаем наименее используемый пресет
                self._unload_least_used_preset()

            if preset_id in self.active_presets:
                preset = self.active_presets[preset_id]
                preset.resources.last_accessed = time.time()
                preset.resources.access_count += 1
                return True

            # Создаем новый активный пресет
            wing_name = self.get_wing_name(preset_id)
            preset = ActivePreset(
                preset_id=preset_id,
                wing_name=wing_name,
                resources=PresetResourceStats()
            )

            # Загружаем данные из MemPalace
            try:
                data_loaded = self._load_all_preset_data(preset)
                if data_loaded:
                    preset.is_loaded = True
                    preset.resources.loaded_at = time.time()
                    preset.resources.last_accessed = time.time()
                    preset.resources.access_count = 1

                    # Вычисляем размер данных
                    data_size = sum(len(json.dumps(data)) for data in preset.data.values())
                    preset.resources.data_size_bytes = data_size

                    self.active_presets[preset_id] = preset
                    print(f"[MemPalace] Загружен пресет: {preset_id}, размер: {data_size/1024:.1f} KB")
                    return True
                else:
                    print(f"[MemPalace] Ошибка загрузки пресета: {preset_id}")
                    return False

            except Exception as e:
                print(f"[MemPalace] Исключение при загрузке пресета {preset_id}: {e}")
                return False

    def unload_preset(self, preset_id: str) -> bool:
        """Выгружает пресет из памяти с сохранением состояния."""
        with self.active_presets_lock:
            if preset_id not in self.active_presets:
                return True  # Уже выгружен

            preset = self.active_presets[preset_id]
            if not preset.is_loaded:
                return True

            try:
                # Сохраняем все изменения
                self._save_all_preset_data(preset)

                # Очищаем данные из памяти
                preset.data.clear()
                preset.is_loaded = False

                # Удаляем из активных
                del self.active_presets[preset_id]

                print(f"[MemPalace] Выгружен пресет: {preset_id}")
                return True

            except Exception as e:
                print(f"[MemPalace] Ошибка выгрузки пресета {preset_id}: {e}")
                return False

    def get_preset_data(self, preset_id: str, data_type: str) -> Optional[Any]:
        """Получает данные из активного пресета."""
        with self.active_presets_lock:
            if preset_id not in self.active_presets:
                # Автоматически загружаем если не загружен
                if not self.load_preset(preset_id):
                    return None

            preset = self.active_presets[preset_id]
            room_name = self.get_room_name(data_type)

            if room_name in preset.data:
                preset.resources.last_accessed = time.time()
                preset.resources.access_count += 1
                return preset.data[room_name]
            else:
                # Пытаемся загрузить из MemPalace
                data = self._load_preset_data(preset, data_type)
                if data:
                    preset.data[room_name] = data
                    preset.resources.last_accessed = time.time()
                    preset.resources.access_count += 1
                return data

    def save_preset_data(self, preset_id: str, data_type: str, data: Any) -> bool:
        """Сохраняет данные в активный пресет."""
        with self.active_presets_lock:
            if preset_id not in self.active_presets:
                # Создаем новый пресет если не существует
                wing_name = self.get_wing_name(preset_id)
                preset = ActivePreset(
                    preset_id=preset_id,
                    wing_name=wing_name,
                    resources=PresetResourceStats()
                )
                preset.is_loaded = True
                self.active_presets[preset_id] = preset

            preset = self.active_presets[preset_id]
            room_name = self.get_room_name(data_type)

            # Сохраняем в память
            preset.data[room_name] = data

            # Обновляем размер данных
            data_size = sum(len(json.dumps(d)) for d in preset.data.values())
            preset.resources.data_size_bytes = data_size

            # Сохраняем в MemPalace
            return self._save_preset_data(preset, data_type, data)

    def get_active_presets(self) -> List[Dict[str, Any]]:
        """Возвращает список активных пресетов с информацией о ресурсах."""
        with self.active_presets_lock:
            result = []
            for preset_id, preset in self.active_presets.items():
                # Получаем текущее использование CPU и памяти
                process = psutil.Process()
                cpu_percent = process.cpu_percent(interval=0.1) / len(self.active_presets) if len(self.active_presets) > 0 else 0
                memory_mb = preset.resources.data_size_bytes / (1024 * 1024)

                result.append({
                    "preset_id": preset_id,
                    "wing_name": preset.wing_name,
                    "is_loaded": preset.is_loaded,
                    "memory_mb": round(memory_mb, 1),
                    "cpu_percent": round(cpu_percent, 1),
                    "loaded_seconds_ago": round(time.time() - preset.resources.loaded_at, 1),
                    "last_access_seconds_ago": round(time.time() - preset.resources.last_accessed, 1),
                    "access_count": preset.resources.access_count,
                    "data_size_kb": preset.resources.data_size_bytes / 1024,
                    "rooms": list(preset.data.keys())
                })
            return result

    def _load_all_preset_data(self, preset: ActivePreset) -> bool:
        """Загружает все данные пресета из MemPalace."""
        try:
            room_types = ["roles", "knowledge_bases", "conversation_history", "llms"]

            for room_type in room_types:
                data = self._load_preset_data(preset, room_type)
                if data is not None:
                    preset.data[room_type] = data

            return len(preset.data) > 0

        except Exception as e:
            print(f"[MemPalace] Ошибка загрузки всех данных пресета {preset.preset_id}: {e}")
            return False

    def _save_all_preset_data(self, preset: ActivePreset) -> bool:
        """Сохраняет все данные пресета в MemPalace."""
        try:
            success = True
            for room_type, data in preset.data.items():
                if not self._save_preset_data(preset, room_type, data):
                    success = False

            return success

        except Exception as e:
            print(f"[MemPalace] Ошибка сохранения всех данных пресета {preset.preset_id}: {e}")
            return False

    def _load_preset_data(self, preset: ActivePreset, data_type: str) -> Optional[Any]:
        """Загружает данные пресета из MemPalace (реальная или файловая эмуляция)."""
        wing_name = preset.wing_name
        room_name = self.get_room_name(data_type)

        if self.client and MEMPALACE_AVAILABLE:
            # Реальная интеграция с MemPalace API
            try:
                # TODO: Реализовать реальный API вызов
                # data = self.client.get_room_data(wing_name, room_name)
                # return data
                pass
            except Exception as e:
                print(f"[MemPalace] API ошибка загрузки {wing_name}/{room_name}: {e}")
                return None

        # Файловая эмуляция
        wing_dir = self.palace_path / wing_name
        room_file = wing_dir / f"{room_name}.json"

        if not room_file.exists():
            print(f"[MemPalace] Файл не найден: {room_file}")
            return []

        try:
            with open(room_file, 'r', encoding='utf-8') as f:
                data_str = f.read()

            data = json.loads(data_str)
            print(f"[MemPalace] Загружено из файла: {wing_name}/{room_name}, {len(data_str)} байт")
            return data

        except Exception as e:
            print(f"[MemPalace] Ошибка чтения файла {room_file}: {e}")
            return None

    def _save_preset_data(self, preset: ActivePreset, data_type: str, data: Any) -> bool:
        """Сохраняет данные пресета в MemPalace (реальная или файловая эмуляция)."""
        wing_name = preset.wing_name
        room_name = self.get_room_name(data_type)

        if self.client and MEMPALACE_AVAILABLE:
            # Реальная интеграция с MemPalace API
            try:
                # TODO: Реализовать реальный API вызов
                # self.client.save_room_data(wing_name, room_name, data)
                pass
            except Exception as e:
                print(f"[MemPalace] API ошибка сохранения {wing_name}/{room_name}: {e}")
                return False

        # Файловая эмуляция
        try:
            wing_dir = self.palace_path / wing_name
            wing_dir.mkdir(exist_ok=True)

            room_file = wing_dir / f"{room_name}.json"
            data_str = json.dumps(data, ensure_ascii=False, indent=2)

            with open(room_file, 'w', encoding='utf-8') as f:
                f.write(data_str)

            print(f"[MemPalace] Сохранено в файл: {wing_name}/{room_name}, {len(data_str)} байт")
            return True

        except Exception as e:
            print(f"[MemPalace] Ошибка записи файла {room_file}: {e}")
            return False

    def _unload_least_used_preset(self):
        """Выгружает наименее используемый пресет по LRU."""
        if not self.active_presets:
            return

        least_used = None
        least_access_time = float('inf')

        for preset_id, preset in self.active_presets.items():
            if preset.resources.last_accessed < least_access_time:
                least_access_time = preset.resources.last_accessed
                least_used = preset_id

        if least_used:
            self.unload_preset(least_used)

    def _monitor_resources(self):
        """Фоновый мониторинг ресурсов."""
        while True:
            time.sleep(5)  # Каждые 5 секунд

            with self.active_presets_lock:
                if not self.active_presets:
                    continue

                process = psutil.Process()
                total_cpu = process.cpu_percent(interval=1)

                # Распределяем CPU между активными пресетами
                cpu_per_preset = total_cpu / len(self.active_presets) if len(self.active_presets) > 0 else 0

                for preset in self.active_presets.values():
                    preset.resources.cpu_percent = cpu_per_preset
                    # Память вычисляем из размера данных
                    preset.resources.memory_mb = preset.resources.data_size_bytes / (1024 * 1024)

# Синглтон для использования в приложении
_mempalace_instance = None

def get_mempalace() -> MemPalaceIntegration:
    """Возвращает экземпляр интеграции MemPalace."""
    global _mempalace_instance
    if _mempalace_instance is None:
        _mempalace_instance = MemPalaceIntegration()
    return _mempalace_instance

# Пример использования
if __name__ == "__main__":
    mp_integration = get_mempalace()

    # Тест загрузки пресета
    test_preset_id = "test_preset_1"
    test_roles = [
        {"id": "1", "name": "Тестовая роль", "systemPrompt": "Тест"}
    ]

    # Сохраняем данные
    success = mp_integration.save_preset_data(test_preset_id, "roles", test_roles)
    print(f"Сохранение ролей: {'успешно' if success else 'ошибка'}")

    # Загружаем пресет
    loaded = mp_integration.load_preset(test_preset_id)
    print(f"Загрузка пресета: {'успешно' if loaded else 'ошибка'}")

    # Получаем данные
    loaded_roles = mp_integration.get_preset_data(test_preset_id, "roles")
    print(f"Загружено ролей: {len(loaded_roles) if loaded_roles else 0}")

    # Список активных пресетов
    active_presets = mp_integration.get_active_presets()
    print(f"Активные пресеты: {len(active_presets)}")
    for preset in active_presets:
        print(f"  - {preset['preset_id']}: {preset['memory_mb']} MB, CPU: {preset['cpu_percent']}%")

    # Выгружаем пресет
    unloaded = mp_integration.unload_preset(test_preset_id)
    print(f"Выгрузка пресета: {'успешно' if unloaded else 'ошибка'}")