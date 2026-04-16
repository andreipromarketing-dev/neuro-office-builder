/**
 * Middleware для валидации входных данных
 */

/**
 * Проверяет, что строка не пустая и имеет максимальную длину
 */
export function validateString(fieldName, maxLength = 500) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined) {
      if (typeof value !== 'string') {
        return res.status(400).json({ error: `${fieldName} должно быть строкой` });
      }
      if (value.trim().length === 0) {
        return res.status(400).json({ error: `${fieldName} не может быть пустым` });
      }
      if (value.length > maxLength) {
        return res.status(400).json({ error: `${fieldName} слишком длинное (макс ${maxLength} символов)` });
      }
    }
    next();
  };
}

/**
 * Проверяет, что значение является допустимым enum
 */
export function validateEnum(fieldName, allowedValues) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined && !allowedValues.includes(value)) {
      return res.status(400).json({
        error: `${fieldName} должно быть одним из: ${allowedValues.join(', ')}`
      });
    }
    next();
  };
}

/**
 * Проверяет, что значение является допустимым URL
 */
export function validateUrl(fieldName) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined && typeof value === 'string') {
      try {
        new URL(value);
      } catch {
        return res.status(400).json({ error: `${fieldName} должно быть валидным URL` });
      }
    }
    next();
  };
}

/**
 * Проверяет, что путь безопасен (не содержит traversal)
 */
export function validateSafePath(fieldName) {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value !== undefined && typeof value === 'string') {
      // Проверяем на явные traversal попытки
      if (value.includes('..') || value.includes('//') || value.includes('\\\\')) {
        return res.status(400).json({ error: `${fieldName} содержит недопустимые символы` });
      }
    }
    next();
  };
}

/**
 * Проверяет LLM тип
 */
export const validateLLMType = validateEnum('type', [
  'openai', 'anthropic', 'google', 'groq', 'uncloseai',
  'ollama', 'lmstudio', 'aya', 'deepseek', 'llama',
  'mistral', 'grok', 'qwen', 'custom'
]);

/**
 * Middleware для проверки обязательных полей
 */
export function requireFields(fieldNames) {
  return (req, res, next) => {
    const missing = [];
    for (const field of fieldNames) {
      if (req.body[field] === undefined || req.body[field] === null) {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Не указаны обязательные поля: ${missing.join(', ')}`
      });
    }
    next();
  };
}

/**
 * Проверяет размер загружаемых файлов
 */
export function validateFileSize(maxSizeMB = 10) {
  return (req, res, next) => {
    const content = req.body.content;
    if (content && typeof content === 'string') {
      // Примерная проверка размера base64
      const sizeInBytes = content.length * 0.75; // Примерно для base64
      const maxSizeBytes = maxSizeMB * 1024 * 1024;
      if (sizeInBytes > maxSizeBytes) {
        return res.status(400).json({
          error: `Файл слишком большой (максимум ${maxSizeMB}MB)`
        });
      }
    }
    next();
  };
}