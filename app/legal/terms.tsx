import LegalDoc from '../../src/legal/LegalDoc';
import { TERMS_OF_SERVICE } from '../../src/legal/content';
export default function Page() {
  return <LegalDoc doc={TERMS_OF_SERVICE} />;
}
