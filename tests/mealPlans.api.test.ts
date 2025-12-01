process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

import request from 'supertest';

let app: any;
let db: any;
let ready: Promise<void>;

const signupPayload = {
  email: 'test@example.com',
  password: 'password123',
  firstName: 'Test',
  birthDate: '1990-01-01',
  heightCm: 180,
  weightKg: 80,
  sex: 'male'
};

const samplePlan = {
  planName: 'Weekly Fuel',
  planData: {
    planName: 'Weekly Fuel',
    caloriesPerDay: 2000,
    mealFrequency: 3,
    groceryTips: [],
    shoppingList: ['Chicken breast (1 kg)', 'Rice 1kg'],
    days: [
      {
        day: 'Day 1',
        meals: [{ name: 'Meal 1', description: 'desc', calories: 500 }]
      }
    ]
  }
};

describe('Meal plan API (supertest)', () => {
  let agent: any;

  beforeAll(async () => {
    const server = require('../server');
    app = server.app;
    db = server.db;
    ready = server.ready;
    agent = request.agent(app);
    await ready;
  });

  afterAll(async () => {
    if (db) {
      await new Promise<void>((resolve) => db.close(() => resolve()));
    }
  });

  it('rejects unauthenticated meal plan access', async () => {
    await request(app).get('/api/meal-plans').expect(401);
  });

  it('supports CRUD and share flow for meal plans', async () => {
    const signupRes = await agent.post('/api/signup').send(signupPayload).expect(201);
    expect(signupRes.body?.user?.id).toBeTruthy();

    const createRes = await agent.post('/api/meal-plans').send(samplePlan).expect(201);
    expect(createRes.body?.id).toBeTruthy();

    const listRes = await agent.get('/api/meal-plans').expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBe(1);
    const planId = listRes.body[0].id;

    await agent.put(`/api/meal-plans/${planId}`).send({ planName: 'Updated Plan' }).expect(200);

    const shareRes = await agent.post(`/api/meal-plans/${planId}/share`).send({}).expect(201);
    expect(shareRes.body?.shareUrl).toBeTruthy();

    await agent.delete(`/api/meal-plans/${planId}`).expect(200);

    const finalList = await agent.get('/api/meal-plans').expect(200);
    expect(finalList.body.length).toBe(0);
  });
});
