
import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import { palette } from '../../src/theme';

export default function SoilTab() {
  return (
    <DiagnoseScreen
      config={{
        key: 'soil',
        title: 'Soil Analysis',
        subtitle: 'Analyze 11 soil types from a photo',
        emoji: '🏞',
        color: palette.soil,
        modelKey: 'soil_11class',
        contextType: 'soil',
        options: [
          { key: 'soil_11class', label: 'Field Sample',  emoji: '🏞' },
          { key: 'soil_11class', label: 'Garden Sample', emoji: '🌱' },
          { key: 'soil_11class', label: 'Pot Sample',    emoji: '🪴' },
        ],
      }}
    />
  );
}
