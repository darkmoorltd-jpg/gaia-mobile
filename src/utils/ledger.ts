import { supabase } from '../api/supabase';

export interface WalletSnapshot {
  balance: number;
  held: number;
  available: number;
  currency: string;
}

export async function getWallet(ownerType: 'farmer' | 'driver' | 'warehouse' | 'gaia'): Promise<WalletSnapshot | null> {
  const uid = ownerType === 'gaia' ? null : (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase.rpc('wallet_get', { p_owner_type: ownerType, p_owner_id: uid });
  if (error || !data) return null;
  return data as WalletSnapshot;
}

export interface LedgerEntry {
  transaction_id: string;
  debit: number;
  credit: number;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
  direction: 'in' | 'out';
  amount: number;
}

export async function getLedgerHistory(ownerType: string, limit = 50): Promise<LedgerEntry[]> {
  const uid = ownerType === 'gaia' ? null : (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase.rpc('ledger_history', { p_owner_type: ownerType, p_owner_id: uid, p_limit: limit });
  if (error || !Array.isArray(data)) return [];
  return data as LedgerEntry[];
}
