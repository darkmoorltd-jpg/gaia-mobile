// Supabase Edge Function: process-payout
// Deploy: supabase functions deploy process-payout
// Secrets required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//   PAYSTACK_SECRET_KEY  (set with: supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...)
//   ENABLE_REAL_PAYOUTS  (set to "false" for test mode, "true" for live transfers)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYSTACK = 'https://api.paystack.co';

serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ ok: false, error: 'auth required' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const kind = body.kind as 'driver' | 'warehouse' | undefined;
    const id = body.id as string | undefined;
    if (!kind || !id) return json({ ok: false, error: 'kind and id required' }, 400);

    const realMode = (Deno.env.get('ENABLE_REAL_PAYOUTS') || 'false').toLowerCase() === 'true';

    let recipientUserId: string | null = null;
    let amountNaira = 0;
    let movementId: string | null = null;
    let bookingId: string | null = null;
    let bankName = '';
    let accountNumber = '';
    let accountName = '';
    let bankCode = '';
    let recipientType = kind;

    if (kind === 'driver') {
      const { data: mv, error } = await admin.from('batch_movements')
        .select('*, driver_profiles(bank_name, bank_account_number, bank_account_name, bank_code)')
        .eq('id', id).maybeSingle();
      if (error || !mv) return json({ ok: false, error: 'movement not found' }, 404);
      if (mv.payout_status === 'paid') return json({ ok: false, error: 'already paid' }, 400);

      const { data: expenses } = await admin.from('trip_expenses')
        .select('amount_naira').eq('movement_id', id);
      const expTotal = (expenses || []).reduce((s: number, r: any) => s + Number(r.amount_naira || 0), 0);

      amountNaira = Math.max(0, Number(mv.delivery_fee || 0) - Number(mv.gaia_commission || 0) - expTotal);
      recipientUserId = mv.driver_id;
      movementId = mv.id;
      const dp = mv.driver_profiles;
      bankName = dp?.bank_name || '';
      accountNumber = dp?.bank_account_number || '';
      accountName = dp?.bank_account_name || '';
      bankCode = dp?.bank_code || '058';
    } else {
      const { data: bk, error } = await admin.from('warehouse_bookings')
        .select('*, warehouse_units(company_id, warehouse_companies(owner_id))')
        .eq('id', id).maybeSingle();
      if (error || !bk) return json({ ok: false, error: 'booking not found' }, 404);
      if (bk.payment_status !== 'paid') return json({ ok: false, error: 'booking not paid' }, 400);
      amountNaira = Number(bk.company_payout || 0);
      recipientUserId = bk.warehouse_units?.warehouse_companies?.owner_id || null;
      bookingId = bk.id;

      if (recipientUserId) {
        const { data: prof } = await admin.from('user_profiles')
          .select('bank_name, account_number, account_name')
          .eq('user_id', recipientUserId).maybeSingle();
        bankName = prof?.bank_name || '';
        accountNumber = prof?.account_number || '';
        accountName = prof?.account_name || '';
        bankCode = '058';
      }
    }

    if (!recipientUserId) return json({ ok: false, error: 'no recipient' }, 400);
    if (amountNaira <= 0) return json({ ok: false, error: 'amount is zero' }, 400);

    let paystackRef: string | null = null;
    let transferCode: string | null = null;
    let status: 'success' | 'failed' | 'test' = 'test';
    let errMsg: string | null = null;

    if (realMode) {
      if (!accountNumber || accountNumber.length < 10 || !bankCode) {
        return json({ ok: false, error: 'recipient bank details incomplete' }, 400);
      }
      const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!secret) return json({ ok: false, error: 'PAYSTACK_SECRET_KEY missing' }, 500);

      try {
        const recRes = await fetch(`${PAYSTACK}/transferrecipient`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nuban',
            name: accountName || 'GAIA Recipient',
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN',
          }),
        });
        const recJson = await recRes.json();
        if (!recJson.status) throw new Error(recJson.message || 'recipient create failed');

        const recipientCode = recJson.data.recipient_code;

        const trRes = await fetch(`${PAYSTACK}/transfer`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'balance',
            amount: Math.round(amountNaira * 100),
            recipient: recipientCode,
            reason: `GAIA ${kind} payout ${id.slice(0, 8)}`,
            reference: `GAIA-PAY-${id.slice(0, 8)}-${Date.now()}`,
          }),
        });
        const trJson = await trRes.json();
        if (!trJson.status) throw new Error(trJson.message || 'transfer failed');
        paystackRef = trJson.data.reference;
        transferCode = trJson.data.transfer_code;
        status = 'success';
      } catch (e: any) {
        status = 'failed';
        errMsg = e?.message || 'paystack error';
      }
    }

    await admin.rpc('record_payout_transfer', {
      p_recipient_type: recipientType,
      p_recipient_id: recipientUserId,
      p_amount: amountNaira,
      p_paystack_ref: paystackRef,
      p_status: status,
      p_error: errMsg,
      p_movement_id: movementId,
      p_booking_id: bookingId,
    });

    if (status === 'success') {
      return json({ ok: true, mode: 'real', reference: paystackRef, amount: amountNaira });
    } else if (status === 'test') {
      return json({ ok: true, mode: 'test', reference: `TEST-${Date.now()}`, amount: amountNaira });
    } else {
      return json({ ok: false, error: errMsg || 'transfer failed' }, 500);
    }
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'unexpected' }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
