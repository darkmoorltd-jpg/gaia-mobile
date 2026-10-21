import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import FeatureGate from '../../src/components/FeatureGate';
import { useTranslation } from 'react-i18next';

export default function Tab() {
  const { t } = useTranslation();
  return (
    <FeatureGate flag="crops">
      <DiagnoseScreen config={{
    key: 'crops',
    title: 'CROP DISEASE',
    subtitle: 'Protect your harvest',
    emoji: '🌿',
    color: '#00ff88',
    modelKey: 'maize',
    contextType: 'crop',
    options: [
      { key: 'maize',    label: 'Maize' },
      { key: 'groundnut', label: 'Groundnut' },
      { key: 'rice_6class', label: 'Rice' },
      { key: 'millet', label: 'Millet' },
      { key: 'cotton', label: 'Cotton' },
      { key: 'okra', label: 'Okra' },
      { key: 'cassava', label: 'Cassava' },
      { key: 'apple',   label: 'Apple' },
      { key: 'coffee',  label: 'Coffee' },
    ],
  }} />
    </FeatureGate>
  );
}