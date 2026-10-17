/**
 * Puerto de pagos y su implementación simulada (regla dura 8, DEC-035, DEC-056).
 *
 * MovexNet no cobra: el flujo Premium es completo y demostrable, pero `MockPaymentProvider`
 * nunca pide ni recibe datos de tarjeta y la interfaz debe decir que el pago es simulado.
 * Una pasarela real necesitaría una DEC nueva y viviría en `api-client` y una Edge Function.
 */

export type PlanId = 'premium';

export interface Entitlement {
  premium: boolean;
  /** Instante de activación, ISO 8601. */
  since: string | null;
  /** Siempre true mientras solo exista el proveedor simulado. */
  simulated: boolean;
}

export const FREE_ENTITLEMENT: Entitlement = { premium: false, since: null, simulated: true };

export interface CheckoutResult {
  status: 'approved' | 'cancelled';
  entitlement: Entitlement;
  /** Comprobante simulado, para mostrar en el perfil. */
  receiptId: string | null;
}

export interface PaymentProvider {
  checkout(plan: PlanId, now: Date): Promise<CheckoutResult>;
  cancel(now: Date): Promise<Entitlement>;
}

export class MockPaymentProvider implements PaymentProvider {
  async checkout(plan: PlanId, now: Date): Promise<CheckoutResult> {
    return {
      status: 'approved',
      entitlement: { premium: true, since: now.toISOString(), simulated: true },
      receiptId: `SIM-${plan.toUpperCase()}-${now.getTime().toString(36).toUpperCase()}`,
    };
  }

  async cancel(): Promise<Entitlement> {
    return FREE_ENTITLEMENT;
  }
}

export function isEntitlement(v: unknown): v is Entitlement {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.premium === 'boolean' && (e.since === null || typeof e.since === 'string') && e.simulated === true;
}
