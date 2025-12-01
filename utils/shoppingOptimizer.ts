export type Unit = 'kg' | 'g' | 'lb' | 'l' | 'ml' | 'unit';

export interface OptimizedItem {
  category: string;
  name: string;
  quantity: number;
  unit: Unit | null;
  originalItems: string[];
  suggestions: string[];
  estimatedCost: number;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  protein: ['chicken', 'beef', 'turkey', 'tofu', 'tempeh', 'fish', 'salmon', 'tuna', 'shrimp', 'egg', 'eggs', 'lentil', 'beans'],
  produce: ['spinach', 'broccoli', 'carrot', 'pepper', 'tomato', 'onion', 'garlic', 'lettuce', 'kale', 'apple', 'banana', 'berries', 'orange', 'avocado'],
  carbs: ['rice', 'pasta', 'oats', 'quinoa', 'bread', 'tortilla', 'potato', 'sweet potato', 'couscous'],
  dairy: ['milk', 'yogurt', 'cheese', 'cottage', 'greek yogurt'],
  fats: ['olive oil', 'avocado oil', 'butter', 'nuts', 'almond', 'peanut', 'seeds', 'chia', 'flax'],
  pantry: ['spice', 'salt', 'pepper', 'herb', 'cumin', 'paprika', 'soy', 'tamari', 'vinegar', 'stock', 'broth'],
  snacks: ['bar', 'protein bar', 'dark chocolate', 'granola', 'trail mix']
};

const PRICE_PER_KG: Record<string, number> = {
  protein: 11,
  produce: 4,
  carbs: 3,
  dairy: 6,
  fats: 8,
  pantry: 2.5,
  snacks: 5
};

const PRICE_PER_UNIT: Record<string, number> = {
  protein: 2.5,
  produce: 0.8,
  carbs: 0.7,
  dairy: 1.2,
  fats: 1.5,
  pantry: 0.6,
  snacks: 1.3
};

const SUBSTITUTIONS_BY_CATEGORY: Record<string, string[]> = {
  protein: ['Swap to frozen chicken thighs', 'Use lentils/chickpeas instead of meat once', 'Canned tuna in water as a budget swap'],
  produce: ['Prefer seasonal veggies (carrots, cabbage, onions)', 'Use frozen mixed vegetables for price stability'],
  carbs: ['Bulk rice or oats instead of specialty grains', 'Potatoes/sweet potatoes for cheap complex carbs'],
  dairy: ['Use store-brand Greek yogurt', 'Replace cheese with cottage cheese for protein per €'],
  fats: ['Buy oil in larger format; use peanuts instead of mixed nuts'],
  pantry: ['Use dried herbs/spices in bulk', 'Keep soy sauce/tamari store brand'],
  snacks: ['Swap bars for homemade oat + peanut butter bites']
};

const normalizeUnit = (unit: string | undefined | null): Unit | null => {
  if (!unit) return null;
  const u = unit.toLowerCase();
  if (['kg', 'kgs'].includes(u)) return 'kg';
  if (['g', 'gram', 'grams'].includes(u)) return 'g';
  if (['lb', 'lbs'].includes(u)) return 'lb';
  if (['l', 'litre', 'liter', 'liters', 'litres'].includes(u)) return 'l';
  if (['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres'].includes(u)) return 'ml';
  if (['un', 'unit', 'units', 'x'].includes(u)) return 'unit';
  return 'unit';
};

export const parseQuantity = (text: string): { quantity: number; unit: Unit | null } => {
  const match = text.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gram|grams|lb|lbs|l|litre|liter|liters|litres|ml|milliliter|millilitre|milliliters|millilitres|un|unit|units|x)?/);
  if (!match) return { quantity: 1, unit: null };
  const quantity = parseFloat(match[1].replace(',', '.')) || 1;
  const unit = normalizeUnit(match[2]);
  return { quantity, unit };
};

export const inferCategory = (name: string): string => {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lower.includes(keyword))) return category;
  }
  return 'pantry';
};

export const stripQuantityFromName = (text: string) =>
  text.replace(/\(.*?\)/g, '').replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|gram|grams|lb|lbs|l|ml|un|unit|units|x)?/gi, '').trim();

export const normalizeQuantityToKg = (quantity: number, unit: Unit | null) => {
  if (!quantity || quantity <= 0) return 1;
  switch (unit) {
    case 'kg':
      return quantity;
    case 'g':
      return quantity / 1000;
    case 'lb':
      return quantity * 0.453592;
    case 'l':
      return quantity;
    case 'ml':
      return quantity / 1000;
    default:
      return quantity;
  }
};

export const estimateCost = (category: string, quantity: number, unit: Unit | null) => {
  const normalizedKg = normalizeQuantityToKg(quantity, unit);
  const isWeight = unit && ['kg', 'g', 'lb', 'l', 'ml'].includes(unit);
  const price = isWeight ? PRICE_PER_KG[category] ?? 5 : PRICE_PER_UNIT[category] ?? 1;
  return normalizedKg * price;
};

export const buildOptimizedList = (items: string[]): { aggregated: OptimizedItem[]; totalCost: number } => {
  const map = new Map<string, OptimizedItem>();
  items.forEach(original => {
    const { quantity, unit } = parseQuantity(original);
    const name = stripQuantityFromName(original) || original;
    const category = inferCategory(name);
    const key = `${category}|${name.toLowerCase()}`;
    const suggestions = SUBSTITUTIONS_BY_CATEGORY[category] ?? [];
    const isWeightUnit = Boolean(unit && ['kg', 'g', 'lb', 'l', 'ml'].includes(unit));
    const normalizedQuantity = isWeightUnit ? normalizeQuantityToKg(quantity, unit) : quantity;
    const displayUnit: Unit | null = isWeightUnit ? 'kg' : unit;
    const estimatedCost = estimateCost(category, quantity, unit);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += normalizedQuantity;
      existing.estimatedCost += estimatedCost;
      existing.originalItems.push(original);
      existing.suggestions = Array.from(new Set([...existing.suggestions, ...suggestions]));
    } else {
      map.set(key, {
        category,
        name,
        quantity: normalizedQuantity,
        unit: displayUnit,
        originalItems: [original],
        suggestions,
        estimatedCost
      });
    }
  });

  const aggregated = Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const totalCost = aggregated.reduce((sum, item) => sum + item.estimatedCost, 0);
  return { aggregated, totalCost };
};

export const formatQuantity = (quantity: number, unit: Unit | null) => {
  if (!unit || unit === 'unit') return `${quantity.toFixed(1)} pcs`;
  if (unit === 'g' || unit === 'ml') return `${quantity.toFixed(0)} ${unit}`;
  return `${quantity.toFixed(2)} ${unit}`;
};
