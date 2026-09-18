import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';

export default function SoilTab() {
  return (
    <DiagnoseScreen
      config={{
        key: 'soil',
        title: 'SOIL ANALYSIS',
        subtitle: 'Know your soil',
        emoji: '🏞',
        color: '#c68a5c',
        modelKey: 'soil_11class',
        contextType: 'soil',
        options: [
          { key: 'soil_11class', label: 'Field Sample' },
        ],
      }}
    />
  );
}
