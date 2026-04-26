import request from 'supertest';
import { createApp } from '../src/server';
import { AppConfig } from '../src/types';

const testConfig: AppConfig = {
  routes: [
    {
      route: '/echo',
      command: 'echo',
      method: 'GET',
      params: ['message'],
      description: 'Echo test',
    },
    {
      route: '/echo/post',
      command: 'echo',
      method: 'POST',
      params: ['message'],
    },
    {
      route: '/fail',
      command: 'false',
      method: 'GET',
      params: [],
    },
  ],
  security: {
    rateLimitWindowMs: 60000,
    rateLimitMax: 1000,
  },
  logging: { requests: false },
};

const securedConfig: AppConfig = {
  ...testConfig,
  security: {
    apiKey: 'test-secret-key',
    rateLimitWindowMs: 60000,
    rateLimitMax: 1000,
  },
};

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.routes).toBe(3);
  });
});

describe('GET /openapi.json', () => {
  it('returns valid OpenAPI spec', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/echo']).toBeDefined();
  });
});

describe('CLI route execution', () => {
  it('executes echo command via GET query param', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/echo?message=hello');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.output).toContain('hello');
    expect(res.body.requestId).toBeTruthy();
  }, 15000);

  it('returns dry-run preview without executing', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/echo?message=hello&dry_run=true');
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.command).toBe('echo');
    expect(res.body.fullCommand).toContain('echo');
  });

  it('accepts POST body params', async () => {
    const app = createApp(testConfig);
    const res = await request(app)
      .post('/echo/post')
      .send({ message: 'from body' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 15000);

  it('returns 400 on unknown param', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/echo?injected=evil');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('blocks shell injection in param value', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/echo?message=%3B%20rm%20-rf%20%2F'); // ; rm -rf /
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when command exits non-zero', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/fail');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  }, 15000);

  it('returns 404 for unknown route', async () => {
    const app = createApp(testConfig);
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('API key authentication', () => {
  it('returns 401 without API key', async () => {
    const app = createApp(securedConfig);
    const res = await request(app).get('/echo?message=test');
    expect(res.status).toBe(401);
  });

  it('allows request with correct API key header', async () => {
    const app = createApp(securedConfig);
    const res = await request(app)
      .get('/echo?message=test')
      .set('X-API-Key', 'test-secret-key');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  }, 15000);

  it('returns 401 with wrong API key', async () => {
    const app = createApp(securedConfig);
    const res = await request(app)
      .get('/echo')
      .set('X-API-Key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  it('allows health endpoint without API key', async () => {
    const app = createApp(securedConfig);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
