import { supabase } from '../api/supabase';

export interface PayoutResult {
  ok: boolean;
  error?: string;
  reference?: string;
  mode?: 'real' | 'test';
}

// Wrapper for the Edge Function `process-payout`
export async function initiateDriverPayout(movementId: string): Promise<PayoutResult> {
  return invoke('driver', movementId);
}

export async function initiateWarehousePayout(bookingId: string): Promise<PayoutResult> {
  return invoke('warehouse', bookingId);
}

async function invoke(kind: 'driver' | 'warehouse', id: string): Promise<PayoutResult> {
  try {
    const { data, error } = await supabase.functions.invoke('process-payout', {
      body: { kind, id },
    });
    if (error) return { ok: false, error: error.message };
    if (!data?.ok) return { ok: false, error: data?.error || 'payout failed' };
    return { ok: true, reference: data.reference, mode: data.mode };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'network error' };
  }
}
