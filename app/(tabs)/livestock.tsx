import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';

export default function Tab() {
  return <DiagnoseScreen config={{
    key: 'livestock',
    title: 'LIVESTOCK HEALTH',
    subtitle: 'Protect your herd',
    emoji: '🐄',
    color: '#b47aff',
    modelKey: 'cattle',
    contextType: 'livestock',
    options: [
      { key: 'cattle',  label: 'Cattle' },
      { key: 'poultry', label: 'Poultry' },
    ],
  }} />;
}
