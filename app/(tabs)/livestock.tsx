
import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import { palette } from '../../src/theme';

export default function LivestockTab() {
  return (
    <DiagnoseScreen
      config={{
        key: 'livestock',
        title: 'Livestock Health',
        subtitle: 'Diagnose cattle and poultry diseases',
        emoji: '🐄',
        color: palette.livestock,
        modelKey: 'cattle',
        contextType: 'livestock',
        options: [
          { key: 'cattle',  label: 'Cattle',  emoji: '🐄' },
          { key: 'poultry', label: 'Poultry', emoji: '🐔' },
        ],
      }}
    />
  );
}
