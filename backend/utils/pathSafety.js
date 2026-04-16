import { join, resolve, relative, normalize } from 'path';
import fs from 'fs';

// Базовые директории, разрешённые для доступа
const ALLOWED_BASE_DIRS = [
  process.cwd(), // Текущая рабочая директория
  join(process.cwd(), 'data'), // Директория данных
  join(process.cwd(), 'uploads') // Директория загрузок (если есть)
];

/**
 * Безопасно разрешает путь, проверяя что он находится внутри разрешённых директорий
 * @param {string} userPath - Путь от пользователя
 * @param {string} [baseDir] - Базовый каталог (по умолчанию process.cwd())
 * @returns {string|null} Безопасный абсолютный путь или null если доступ запрещён
 */
export function safeResolvePath(userPath, baseDir = process.cwd()) {
  if (!userPath || typeof userPath !== 'string') {
    return null;
  }

  try {
    // Нормализуем путь (убираем ../ и ./)
    const normalized = normalize(userPath);

    // Если путь абсолютный, используем как есть, иначе разрешаем относительно baseDir
    let absolutePath;
    if (normalized.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(normalized)) {
      absolutePath = resolve(normalized);
    } else {
      absolutePath = resolve(baseDir, normalized);
    }

    // Проверяем, что путь находится внутри одной из разрешённых директорий
    const isAllowed = ALLOWED_BASE_DIRS.some(allowedDir => {
      const relativePath = relative(allowedDir, absolutePath);
      return relativePath && !relativePath.startsWith('..') && !relativePath.includes('..\\');
    });

    if (!isAllowed) {
      console.warn(`[SECURITY] Попытка доступа к запрещённому пути: ${userPath} -> ${absolutePath}`);
      return null;
    }

    return absolutePath;
  } catch (error) {
    console.error(`[SECURITY] Ошибка разрешения пути ${userPath}:`, error.message);
    return null;
  }
}

/**
 * Проверяет, существует ли путь и является ли файлом
 * @param {string} filePath - Путь к файлу
 * @returns {boolean}
 */
export function isSafeFile(filePath) {
  const safePath = safeResolvePath(filePath);
  if (!safePath) return false;

  try {
    const stat = fs.statSync(safePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Проверяет, существует ли путь и является ли директорией
 * @param {string} dirPath - Путь к директории
 * @returns {boolean}
 */
export function isSafeDirectory(dirPath) {
  const safePath = safeResolvePath(dirPath);
  if (!safePath) return false;

  try {
    const stat = fs.statSync(safePath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Создаёт безопасный путь для загрузки файлов
 * @param {string} fileName - Имя файла
 * @returns {string|null}
 */
export function createSafeUploadPath(fileName) {
  const uploadsDir = join(process.cwd(), 'data', 'uploads');

  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Очищаем имя файла от опасных символов
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = join(uploadsDir, safeFileName);

    return safeResolvePath(filePath) ? filePath : null;
  } catch {
    return null;
  }
}