import { useState } from 'react';
import { Sheet } from './Sheet';
import { IconAlert, IconCheck } from './icons';
import { MockPaymentProvider } from '../../domain/payment';
import { appActions } from '../state/appStore';

/** Único proveedor mientras MovexNet no factura (regla dura 8, DEC-035). */
const payments = new MockPaymentProvider();

export function PremiumSheet({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    const r = await payments.checkout('premium', new Date());
    if (r.status === 'approved') {
      appActions.setEntitlement(r.entitlement);
      setReceipt(r.receiptId);
    }
    setBusy(false);
  }

  return (
    <Sheet label="MovexNet Premium" onClose={onClose}>
      <div>
        <p className="eyebrow is-volt">MovexNet Premium</p>
        <h2 className="card-title">{receipt ? 'Premium de prueba activo' : 'Desbloquea las 8 semanas'}</h2>
      </div>
      <ul className="benefits">
        <li><IconCheck />Progresión semana a semana, con descarga</li>
        <li><IconCheck />El programa completo de 8 semanas</li>
        <li><IconCheck />Historial de técnica y fatiga</li>
      </ul>
      <p className="notice notice--amber" role="note">
        <IconAlert />
        Pago simulado: MovexNet es un proyecto académico. No se cobra nada ni se piden datos de tarjeta.
      </p>
      {receipt ? (
        <p className="muted">Comprobante simulado {receipt}. Puedes desactivarlo desde tu perfil.</p>
      ) : (
        <button className="btn btn--primary btn--block" onClick={activate} disabled={busy} data-autofocus>
          Activar Premium de prueba
        </button>
      )}
    </Sheet>
  );
}
