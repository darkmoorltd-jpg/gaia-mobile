export interface InputCategory {
  key: string;
  label: string;
  emoji: string;
  description: string;
}

export const INPUT_CATEGORIES: InputCategory[] = [
  { key: 'fertilizer', label: 'Fertilizer', emoji: '💩', description: 'NPK, Urea, organic' },
  { key: 'seed',       label: 'Seeds',      emoji: '🌱', description: 'Certified seed, hybrid, OPV' },
  { key: 'pesticide',  label: 'Pesticide',  emoji: '🧪', description: 'Insecticides, acaricides' },
  { key: 'herbicide',  label: 'Herbicide',  emoji: '🌾', description: 'Weed control' },
  { key: 'fungicide',  label: 'Fungicide',  emoji: '🍄', description: 'Disease control' },
  { key: 'tool',       label: 'Tools',      emoji: '🔧', description: 'Hoes, cutlasses, sprayers' },
  { key: 'equipment',  label: 'Equipment',  emoji: '🚜', description: 'Planters, pumps, irrigation' },
  { key: 'feed',       label: 'Animal Feed',emoji: '🌽', description: 'Poultry, cattle, fish feed' },
  { key: 'vet',        label: 'Veterinary', emoji: '💊', description: 'Vaccines, dewormers' },
  { key: 'other',      label: 'Other',      emoji: '📦', description: 'Anything else' },
];

export function categoryLabel(key: string): string {
  return INPUT_CATEGORIES.find(c => c.key === key)?.label || key;
}
export function categoryEmoji(key: string): string {
  return INPUT_CATEGORIES.find(c => c.key === key)?.emoji || '📦';
}
