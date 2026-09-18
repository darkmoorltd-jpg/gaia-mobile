import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';

export default function Tab() {
  return <DiagnoseScreen config={{
    key: 'crops',
    title: 'CROP DISEASE',
    subtitle: 'Protect your harvest',
    emoji: '🌿',
    color: '#00ff88',
    modelKey: 'maize',
    contextType: 'crop',
    options: [
      { key: 'maize',    label: 'Maize' },
      { key: 'rice_10class', label: 'Rice' },
      { key: 'millet_3class', label: 'Millet' },
      { key: 'cassava', label: 'Cassava' },
      { key: 'apple',   label: 'Apple' },
      { key: 'coffee',  label: 'Coffee' },
    ],
  }} />;
}
