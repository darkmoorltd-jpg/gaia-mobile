import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import FeatureGate from '../../src/components/FeatureGate';

export default function Tab() {
  return (
    <FeatureGate flag="pests">
      <DiagnoseScreen config={{
    key: 'pests',
    title: 'PEST DETECTION',
    subtitle: 'Identify any pest',
    emoji: '🐛',
    color: '#ff8a3d',
    modelKey: 'pests_102class',
    contextType: 'pest',
    options: [
      { key: 'pests_102class', label: 'All Pests' },
    ],
  }} />
    </FeatureGate>
  );
}
