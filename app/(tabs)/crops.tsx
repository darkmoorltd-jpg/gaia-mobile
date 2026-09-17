
import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import { palette } from '../../src/theme';

export default function CropsTab() {
  return (
    <DiagnoseScreen
      config={{
        key: 'crops',
        title: 'Crop Disease',
        subtitle: 'Snap a leaf — get instant AI diagnosis',
        emoji: '🌿',
        color: palette.crops,
        modelKey: 'maize',
        contextType: 'crop',
        options: [
          { key: 'maize',   label: 'Maize',   emoji: '🌽' },
          { key: 'rice_10class', label: 'Rice', emoji: '🌾' },
          { key: 'millet_3class', label: 'Millet', emoji: '🌾' },
          { key: 'soybean_14class', label: 'Soybean', emoji: '🫘' },
          { key: 'pepper_13class', label: 'Pepper', emoji: '🌶' },
          { key: 'cabbage_8class', label: 'Cabbage', emoji: '🥬' },
          { key: 'apple',    label: 'Apple',   emoji: '🍎' },
          { key: 'cassava',  label: 'Cassava', emoji: '🥔' },
          { key: 'coffee',   label: 'Coffee',  emoji: '☕' },
          { key: 'grape',    label: 'Grape',   emoji: '🍇' },
          { key: 'sugarcane', label: 'Sugarcane', emoji: '🎋' },
          { key: 'tea',      label: 'Tea',     emoji: '🍵' },
        ],
      }}
    />
  );
}
