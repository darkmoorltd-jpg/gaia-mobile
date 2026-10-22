import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import FeatureGate from '../../src/components/FeatureGate';
import { useTranslation } from 'react-i18next';

export default function SoilTab() {
  const { t } = useTranslation();
  return (
    <FeatureGate flag="soil">
      <DiagnoseScreen
      config={{
        key: 'soil',
        title: t('soil.title'),
        subtitle: t('soil.subtitle'),
        emoji: '🏞',
        color: '#c68a5c',
        modelKey: 'soil_11class',
        contextType: 'soil',
        options: [
          { key: 'soil_11class', label: t('soil.fieldSample') },
        ],
      }}
    />
    </FeatureGate>
  );
}