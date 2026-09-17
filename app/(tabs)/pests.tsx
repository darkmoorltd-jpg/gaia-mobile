
import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import { palette } from '../../src/theme';

export default function PestsTab() {
  return (
    <DiagnoseScreen
      config={{
        key: 'pests',
        title: 'Pest Detection',
        subtitle: 'Identify 102 pest species instantly',
        emoji: '🐛',
        color: palette.pests,
        modelKey: 'pests_102class',
        contextType: 'pest',
        options: [
          { key: 'pests_102class', label: 'Rice / Wheat Pests', emoji: '🐛' },
          { key: 'pests_102class', label: 'Vegetable Pests',    emoji: '🥬' },
          { key: 'pests_102class', label: 'Fruit Tree Pests',   emoji: '🍎' },
        ],
      }}
    />
  );
}
