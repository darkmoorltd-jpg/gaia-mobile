
export const INPUT_CATEGORIES = [
  { key: 'fertilizer', label: 'Fertilizer', emoji: '💩' },
  { key: 'seeds', label: 'Seeds', emoji: '🌱' },
  { key: 'pesticides', label: 'Pesticides', emoji: '🧪' },
  { key: 'herbicides', label: 'Herbicides', emoji: '🌿' },
  { key: 'equipment', label: 'Equipment', emoji: '🚜' },
  { key: 'vet', label: 'Veterinary', emoji: '💊' },
  { key: 'feed', label: 'Feed', emoji: '🌾' },
];
export function categoryEmoji(key: string) { return INPUT_CATEGORIES.find(c => c.key === key)?.emoji || '📦'; }
export function categoryLabel(key: string) { return INPUT_CATEGORIES.find(c => c.key === key)?.label || 'Other'; }
