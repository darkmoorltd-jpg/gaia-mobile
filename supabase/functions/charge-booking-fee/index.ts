import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("not authenticated");

    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("booking_id required");

    const { data: booking, error: bErr } = await admin.from("warehouse_bookings")
      .select("id, farmer_id, total_cost, payment_status, unit_id").eq("id", booking_id).single();
    if (bErr || !booking) throw new Error("booking not found");
    if ((booking as any).farmer_id !== user.id) throw new Error("not your booking");
    if ((booking as any).payment_status === "paid") throw new Error("already paid");
    if (!(booking as any).total_cost || Number((booking as any).total_cost) <= 0) throw new Error("invalid total");

    const ref = `GAIA_STOR_${booking_id.slice(0,8)}_${Date.now()}`;
    const amountKobo = Math.round(Number((booking as any).total_cost) * 100);
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const origin = req.headers.get("origin") || "https://gaia.app";

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email, amount: amountKobo, reference: ref,
        callback_url: `${origin}/warehouse-network?status=success`,
        metadata: { type: "booking", booking_id },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson.status) throw new Error(initJson.message || "Paystack init failed");

    await admin.from("pending_payments").upsert({
      reference: ref, user_id: user.id, amount: Number((booking as any).total_cost), currency: "NGN",
      purpose: "booking", metadata: { booking_id }, status: "pending",
    }, { onConflict: "reference" });

    return new Response(JSON.stringify({ ok: true, authorization_url: initJson.data.authorization_url, reference: ref }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});