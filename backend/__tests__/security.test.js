// Простые тесты для security utilities
import { jest } from '@jest/globals';
import { safeResolvePath } from '../utils/pathSafety.js';

describe('Security Utilities', () => {
  test('safeResolvePath should handle null/undefined', () => {
    expect(safeResolvePath(null)).toBeNull();
    expect(safeResolvePath(undefined)).toBeNull();
    expect(safeResolvePath('')).toBeNull();
  });

  test('safeResolvePath should reject obvious traversal attempts', () => {
    // Эти пути должны быть заблокированы
    expect(safeResolvePath('../../../etc/passwd')).toBeNull();
    expect(safeResolvePath('..\\..\\..\\windows\\system32')).toBeNull();
    expect(safeResolvePath('/etc/passwd')).toBeNull();
    expect(safeResolvePath('C:\\Windows\\System32')).toBeNull();
  });

  test('safeResolvePath should accept relative paths in project', () => {
    // Эти пути должны быть разрешены (если они внутри проекта)
    const result = safeResolvePath('data/test.txt');
    expect(result).toContain('data/test.txt');
  });

  test('safeResolvePath should normalize paths', () => {
    const result1 = safeResolvePath('data/../data/test.txt');
    const result2 = safeResolvePath('data/test.txt');
    // После нормализации они должны быть эквивалентны
    expect(result1).toBe(result2);
  });
});

// Тесты для валидации
import { validateString, requireFields } from '../middleware/validation.js';

describe('Validation Middleware', () => {
  test('validateString should validate string fields', () => {
    const req = { body: { name: 'Test' } };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = validateString('name', 10);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('validateString should reject empty strings', () => {
    const req = { body: { name: '   ' } };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = validateString('name');
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'name не может быть пустым' });
  });

  test('requireFields should validate required fields', () => {
    const req = { body: { name: 'Test', type: 'ollama' } };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = requireFields(['name', 'type']);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('requireFields should reject missing fields', () => {
    const req = { body: { name: 'Test' } };
    const res = {
      status: jest.fn(() => res),
      json: jest.fn()
    };
    const next = jest.fn();

    const middleware = requireFields(['name', 'type']);
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Не указаны обязательные поля: type' });
  });
});