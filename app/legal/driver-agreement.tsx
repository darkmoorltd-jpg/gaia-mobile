import LegalDoc from '../../src/legal/LegalDoc';
import { DRIVER_AGREEMENT } from '../../src/legal/content';
export default function Page() {
  return <LegalDoc doc={DRIVER_AGREEMENT} />;
}
