import { supabase } from '../api/supabase';

export async function hold(ownerType: string, amount: number): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase.rpc('escrow_hold', { p_owner_type: ownerType, p_owner_id: uid, p_amount: amount });
  return !error && !!data;
}

export async function release(
  toType: string, toId: string, amount: number,
  referenceType: string, referenceId: string, description: string,
): Promise<boolean> {
  const { error } = await supabase.rpc('escrow_release', {
    p_from_type: 'gaia', p_from_id: null,
    p_to_type: toType, p_to_id: toId,
    p_amount: amount,
    p_reference_type: referenceType, p_reference_id: referenceId,
    p_description: description,
  });
  return !error;
}

export async function topup(ownerType: string, amount: number, paystackRef: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const { error } = await supabase.rpc('wallet_topup', {
    p_owner_type: ownerType, p_owner_id: uid, p_amount: amount, p_paystack_ref: paystackRef,
  });
  return !error;
}
