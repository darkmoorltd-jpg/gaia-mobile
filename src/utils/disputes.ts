import { supabase } from '../api/supabase';

export interface Dispute {
  id: string;
  dispute_code: string;
  dispute_type: string;
  description: string;
  claimed_amount_naira: number | null;
  status: string;
  created_at: string;
}

export async function fileDispute(params: {
  dispute_type: 'quality' | 'weight' | 'payment' | 'damage' | 'theft' | 'other';
  description: string;
  against_user?: string;
  batch_id?: string;
  trip_id?: string;
  booking_id?: string;
  claimed_amount_naira?: number;
}): Promise<{ ok: boolean; id?: string; code?: string; error?: string }> {
  const code = 'DSP-' + Date.now().toString(36).toUpperCase();
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase.from('disputes').insert({
    dispute_code: code, dispute_type: params.dispute_type,
    raised_by: uid, against_user: params.against_user,
    batch_id: params.batch_id, trip_id: params.trip_id, booking_id: params.booking_id,
    claimed_amount_naira: params.claimed_amount_naira,
    description: params.description, status: 'open',
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, code };
}

export async function addEvidence(disputeId: string, type: string, urlOrText: string): Promise<boolean> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  const { error } = await supabase.from('dispute_evidence').insert({
    dispute_id: disputeId, evidence_type: type, url_or_text: urlOrText, submitted_by: uid,
  });
  return !error;
}

export async function myDisputes(): Promise<Dispute[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const { data } = await supabase.from('disputes').select('*').eq('raised_by', uid).order('created_at', { ascending: false });
  return (data || []) as Dispute[];
}


export async function fileOrderDispute(params: {
  order_id: string;
  kind: 'marketplace' | 'organic';
  reason: string;
  description: string;
  claimed_amount?: number;
  evidence_paths?: string[];
}): Promise<{ ok: boolean; dispute_code?: string; dispute_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('file_marketplace_dispute', {
    p_order_id: params.order_id,
    p_kind: params.kind,
    p_reason: params.reason,
    p_description: params.description,
    p_claimed_amount: params.claimed_amount || null,
    p_evidence_paths: params.evidence_paths || [],
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, dispute_code: data.dispute_code, dispute_id: data.dispute_id };
}

export async function respondToDispute(params: {
  dispute_id: string;
  response: string;
  proposal: 'full_refund' | 'partial_refund' | 'no_refund';
  evidence_paths?: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('respond_to_marketplace_dispute', {
    p_dispute_id: params.dispute_id,
    p_response: params.response,
    p_proposal: params.proposal,
    p_evidence_paths: params.evidence_paths || [],
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function resolveDispute(params: {
  dispute_id: string;
  resolution: 'refund_buyer' | 'award_seller' | 'split';
  notes?: string;
}): Promise<{ ok: boolean; to_buyer?: number; to_seller?: number; error?: string }> {
  const { data, error } = await supabase.rpc('resolve_marketplace_dispute', {
    p_dispute_id: params.dispute_id,
    p_resolution: params.resolution,
    p_notes: params.notes || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, to_buyer: data.to_buyer, to_seller: data.to_seller };
}
