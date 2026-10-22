import { DiagnoseScreen } from '../../src/screens/DiagnoseScreen';
import FeatureGate from '../../src/components/FeatureGate';
import { useTranslation } from 'react-i18next';

export default function Tab() {
  const { t } = useTranslation();
  return (
    <FeatureGate flag="livestock">
      <DiagnoseScreen config={{
    key: 'livestock',
    title: t('livestock.title'),
    subtitle: t('livestock.subtitle'),
    emoji: '🐄',
    color: '#b47aff',
    modelKey: 'cattle',
    contextType: 'livestock',
    options: [
      { key: 'cattle',  label: t('livestock.cattle') },
      { key: 'poultry', label: t('livestock.poultry') },
    ],
  }} />
    </FeatureGate>
  );
}