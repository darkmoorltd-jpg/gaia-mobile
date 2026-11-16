import LegalDoc from '../../src/legal/LegalDoc';
import { WAREHOUSE_AGREEMENT } from '../../src/legal/content';
export default function Page() {
  return <LegalDoc doc={WAREHOUSE_AGREEMENT} />;
}
