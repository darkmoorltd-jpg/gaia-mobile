import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const auth = req.headers.get('Authorization') || '';
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await userSupabase.auth.getUser();
    if (!user) return json({ ok: false, error: 'auth' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const tripId = body.trip_id;
    if (!tripId) return json({ ok: false, error: 'trip_id required' }, 400);

    const { data: trip } = await admin.from('trips')
      .select('*, driver_profiles(bank_account_number, bank_account_name, bank_code)')
      .eq('id', tripId).maybeSingle();
    if (!trip) return json({ ok: false, error: 'trip not found' }, 404);

    const finalFee = Number(trip.final_fee_naira || trip.offered_fee_naira || 0) * 0.8;
    if (finalFee <= 0) return json({ ok: false, error: 'no fee' }, 400);

    const realMode = (Deno.env.get('ENABLE_REAL_PAYOUTS') || 'false').toLowerCase() === 'true';
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    const acct = trip.driver_profiles?.bank_account_number;
    const bank = trip.driver_profiles?.bank_code || '058';
    const name = trip.driver_profiles?.bank_account_name || 'GAIA Driver';

    let status: 'success' | 'test' | 'failed' = 'test';
    let paystackRef: string | null = null;
    let errMsg: string | null = null;

    if (realMode && secret && acct) {
      try {
        const recRes = await fetch('https://api.paystack.co/transferrecipient', {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'nuban', name, account_number: acct, bank_code: bank, currency: 'NGN' }),
        });
        const recJson = await recRes.json();
        if (!recJson.status) throw new Error(recJson.message);

        const trRes = await fetch('https://api.paystack.co/transfer', {
          method: 'POST',
          headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'balance', amount: Math.round(finalFee * 100),
            recipient: recJson.data.recipient_code,
            reason: `GAIA trip ${trip.trip_code}`,
            reference: `GAIA-${tripId.slice(0, 8)}-${Date.now()}`,
          }),
        });
        const trJson = await trRes.json();
        if (!trJson.status) throw new Error(trJson.message);
        paystackRef = trJson.data.reference;
        status = 'success';
      } catch (e: any) { status = 'failed'; errMsg = e?.message; }
    }

    await admin.from('payout_transfers').insert({
      recipient_type: 'driver', recipient_id: trip.driver_id,
      amount_naira: finalFee, paystack_ref: paystackRef,
      status, error_message: errMsg, initiated_by: user.id,
      completed_at: status === 'success' ? new Date().toISOString() : null,
    });

    if (status === 'failed') return json({ ok: false, error: errMsg }, 500);
    return json({ ok: true, mode: status === 'success' ? 'real' : 'test', reference: paystackRef, amount: finalFee });
  } catch (e: any) {
    return json({ ok: false, error: e?.message }, 500);
  }
});

function json(o: unknown, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
