import LegalDoc from '../../src/legal/LegalDoc';
import { PRIVACY_POLICY } from '../../src/legal/content';
export default function Page() {
  return <LegalDoc doc={PRIVACY_POLICY} />;
}
