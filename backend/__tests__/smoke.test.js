// Простой smoke тест для проверки работы Jest
describe('Smoke Tests', () => {
  test('Jest should work', () => {
    expect(true).toBe(true);
  });

  test('Basic arithmetic', () => {
    expect(1 + 1).toBe(2);
    expect(2 * 2).toBe(4);
  });

  test('String operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
    expect('world'.length).toBe(5);
  });
});

// Простой тест для проверки экспортов из server.js
import { parseFile, parseFileFromContent, scanFolder } from '../server.js';

describe('Server Exports', () => {
  test('parseFile should be exported', () => {
    expect(typeof parseFile).toBe('function');
  });

  test('parseFileFromContent should be exported', () => {
    expect(typeof parseFileFromContent).toBe('function');
  });

  test('scanFolder should be exported', () => {
    expect(typeof scanFolder).toBe('function');
  });
});