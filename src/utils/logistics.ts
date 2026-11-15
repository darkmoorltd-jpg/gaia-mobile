import { supabase } from '../api/supabase';

export function eudrPdfUrl(batchCode: string): string {
  return `https://gaia.ng/trace/${batchCode}`;
}

export async function apiDispatch(payload: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('dispatch-logistics', { body: payload });
    if (error) throw error;
    return { ok: true };
  } catch (e: any) {
    console.warn('Logistics API failed', e.message);
    return { ok: false, error: e.message };
  }
}
