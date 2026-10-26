import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import FeatureGate from '../../src/components/FeatureGate';
import { useTranslation } from 'react-i18next';

export default function Tab() {
  const { t } = useTranslation();
  return (
    <FeatureGate flag="crops">
      <DiagnoseScreen config={{
    key: 'crops',
    title: t('crops.title'),
    subtitle: t('crops.subtitle'),
    emoji: '🌿',
    color: '#00ff88',
    modelKey: 'maize',
    contextType: 'crop',
    options: [
      { key: 'maize',    label: t('crops.maize') },
      { key: 'groundnut', label: 'Groundnut' },
      { key: 'rice_6class', label: t('crops.rice') },
      { key: 'millet', label: 'Millet' },
      { key: 'cotton', label: 'Cotton' },
      { key: 'okra', label: 'Okra' },
      { key: 'cassava', label: t('crops.cassava') },
      { key: 'pineapple', label: t('crops.pineapple') },
      { key: 'apple',   label: t('crops.apple') },
      { key: 'coffee',  label: t('crops.coffee') },
    ],
  }} />
    </FeatureGate>
  );
}