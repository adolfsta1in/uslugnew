import { Suspense } from "react";
import CertificateEditor from "../../components/CertificateEditor";

// «Новый сертификат» — редактор бланка A4.
// Suspense нужен, т.к. CertificateEditor использует useSearchParams.
export default function NewCertificatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Загрузка…</div>}>
      <CertificateEditor />
    </Suspense>
  );
}
