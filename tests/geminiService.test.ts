import { describe, expect, it, vi } from 'vitest';

const generateContentMock = vi.fn(async (args: any) => {
  (generateContentMock as any).lastArgs = args;
  const fakePlan = {
    planName: 'Test Plan',
    caloriesPerDay: 2000,
    mealFrequency: 3,
    groceryTips: [],
    shoppingList: ['Item'],
    days: Array.from({ length: 7 }, (_, i) => ({
      day: `Day ${i + 1}`,
      meals: [{ name: 'Meal', description: 'desc', calories: 500 }]
    }))
  };
  return { text: JSON.stringify(fakePlan) };
});

vi.mock('../utils/genaiClient', () => ({
  getGenAIClient: vi.fn(async () => ({
    models: {
      generateContent: generateContentMock
    }
  }))
}));

import { generateMealPlan } from '../services/geminiService';

describe('generateMealPlan prompt', () => {
  it('injects prepMode and returns parsed plan', async () => {
    const plan = await generateMealPlan({
      goal: 'Lean muscle',
      calories: 2200,
      mealFrequency: 4,
      dietStyle: 'Omnivore',
      allergies: ['peanut'],
      preferences: 'No spicy',
      language: 'fr',
      sex: 'male',
      prepMode: 'batch'
    });

    expect(plan.planName).toBe('Test Plan');
    expect(plan.days).toHaveLength(7);
    const promptText = (generateContentMock as any).lastArgs?.contents;
    expect(promptText).toContain('batch cooking');
    expect(promptText).toContain('Lean muscle');
    expect(promptText).toContain('peanut');
  });
});
