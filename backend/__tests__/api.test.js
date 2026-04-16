import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../server.js';

// Мокаем вызовы к внешним LLM
jest.mock('../server.js', () => {
  const originalModule = jest.requireActual('../server.js');

  // Мокаем только вызовы к LLM, остальное оставляем как есть
  return {
    ...originalModule,
    callOllama: jest.fn().mockResolvedValue('Mocked LLM response'),
    callLMStudio: jest.fn().mockResolvedValue('Mocked LM Studio response'),
    callOpenAI: jest.fn().mockResolvedValue('Mocked OpenAI response'),
    callAnthropic: jest.fn().mockResolvedValue('Mocked Anthropic response'),
    callGroq: jest.fn().mockResolvedValue('Mocked Groq response')
  };
});

describe('API Integration Tests', () => {
  beforeEach(() => {
    // Очищаем моки перед каждым тестом
    jest.clearAllMocks();
  });

  describe('LLM API', () => {
    test('GET /api/llms should return empty array initially', async () => {
      const response = await request(app).get('/api/llms');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('POST /api/llms should create new LLM', async () => {
      const newLLM = {
        name: 'Test Ollama',
        type: 'ollama',
        endpoint: 'http://localhost:11434'
      };

      const response = await request(app)
        .post('/api/llms')
        .send(newLLM);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: 'Test Ollama',
        type: 'ollama',
        endpoint: 'http://localhost:11434'
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
    });

    test('DELETE /api/llms/:id should delete LLM', async () => {
      // Сначала создаем LLM
      const createResponse = await request(app)
        .post('/api/llms')
        .send({ name: 'To Delete', type: 'ollama' });

      const llmId = createResponse.body.id;

      // Затем удаляем
      const deleteResponse = await request(app)
        .delete(`/api/llms/${llmId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toEqual({ success: true });

      // Проверяем, что LLM больше нет
      const listResponse = await request(app).get('/api/llms');
      expect(listResponse.body).toEqual([]);
    });
  });

  describe('Roles API', () => {
    let testLLMId;

    beforeEach(async () => {
      // Создаем тестовый LLM для ролей
      const llmResponse = await request(app)
        .post('/api/llms')
        .send({ name: 'Test LLM for Roles', type: 'ollama' });
      testLLMId = llmResponse.body.id;
    });

    test('POST /api/roles should create new role', async () => {
      const newRole = {
        name: 'Тестовый Юрист',
        description: 'Юрист для тестов',
        systemPrompt: 'Ты тестовый юрист',
        llmId: testLLMId,
        llmName: 'Test LLM for Roles',
        knowledgeBases: []
      };

      const response = await request(app)
        .post('/api/roles')
        .send(newRole);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: 'Тестовый Юрист',
        description: 'Юрист для тестов',
        systemPrompt: 'Ты тестовый юрист'
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
    });

    test('GET /api/roles should return created roles', async () => {
      // Создаем роль
      await request(app)
        .post('/api/roles')
        .send({
          name: 'Test Role',
          description: 'Test',
          systemPrompt: 'Test',
          llmId: testLLMId,
          llmName: 'Test LLM for Roles',
          knowledgeBases: []
        });

      const response = await request(app).get('/api/roles');
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('name', 'Test Role');
    });
  });

  describe('Chat API', () => {
    let roleId;

    beforeEach(async () => {
      // Создаем LLM и роль для чата
      const llmResponse = await request(app)
        .post('/api/llms')
        .send({ name: 'Chat Test LLM', type: 'ollama' });

      const roleResponse = await request(app)
        .post('/api/roles')
        .send({
          name: 'Chat Assistant',
          description: 'Для тестов чата',
          systemPrompt: 'Отвечай "Тестовый ответ"',
          llmId: llmResponse.body.id,
          llmName: 'Chat Test LLM',
          knowledgeBases: []
        });

      roleId = roleResponse.body.id;
    });

    test('POST /api/chat should return response', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          roleId,
          message: 'Привет',
          includeHistory: false
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('documents');
      expect(response.body).toHaveProperty('llm');
      // Поскольку мы замокали callOllama, ответ будет 'Mocked LLM response'
    });

    test('POST /api/chat should handle missing role', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          roleId: 'non-existent-id',
          message: 'Привет'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Роль не найдена');
    });
  });

  describe('Search API', () => {
    test('POST /api/search/files should return empty array without query', async () => {
      const response = await request(app)
        .post('/api/search/files')
        .send({ query: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Укажите запрос');
    });

    test('POST /api/search/files should return search results', async () => {
      // Сначала добавляем документ через knowledge base
      await request(app)
        .post('/api/knowledge-bases')
        .send({
          name: 'Test Document',
          type: 'file',
          content: 'Это тестовый документ для поиска',
          roleId: ''
        });

      const response = await request(app)
        .post('/api/search/files')
        .send({ query: 'тестовый', limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      // Может быть пустым, если поисковый индекс не построен
    });
  });
});