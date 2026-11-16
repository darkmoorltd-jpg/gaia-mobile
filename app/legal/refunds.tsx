import LegalDoc from '../../src/legal/LegalDoc';
import { REFUND_POLICY } from '../../src/legal/content';
export default function Page() {
  return <LegalDoc doc={REFUND_POLICY} />;
}
