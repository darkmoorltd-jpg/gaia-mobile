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

    const { unit_id } = await req.json();
    if (!unit_id) throw new Error("unit_id required");

    const { data: unit, error: uErr } = await admin.from("warehouse_units")
      .select("id, unit_name, company_id, warehouse_companies(owner_id)").eq("id", unit_id).single();
    if (uErr || !unit) throw new Error("unit not found");
    if ((unit as any).warehouse_companies?.owner_id !== user.id) throw new Error("not your unit");

    const { data: pending } = await admin.from("warehouse_listing_payments")
      .select("id").eq("unit_id", unit_id).eq("status", "pending").limit(1);
    if (pending && pending.length > 0) throw new Error("a pending payment already exists");

    const now = new Date();
    const end = new Date(Date.now() + 30 * 86400000);
    const { data: pay, error: payErr } = await admin.from("warehouse_listing_payments").insert({
      unit_id, company_id: (unit as any).company_id, amount_naira: 10000,
      period_start: now.toISOString(), period_end: end.toISOString(), status: "pending",
    }).select().single();
    if (payErr) throw payErr;

    const ref = `GAIA_LIST_${pay.id}_${Date.now()}`;
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const origin = req.headers.get("origin") || "https://gaia.app";

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email, amount: 10000 * 100, reference: ref,
        callback_url: `${origin}/warehouse-listing-pay?status=success&unit_id=${unit_id}`,
        metadata: { type: "warehouse_listing", payment_id: pay.id, unit_id, unit_name: (unit as any).unit_name },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson.status) throw new Error(initJson.message || "Paystack init failed");

    await admin.from("pending_payments").upsert({
      reference: ref, user_id: user.id, amount: 10000, currency: "NGN",
      purpose: "warehouse_listing", metadata: { payment_id: pay.id, unit_id }, status: "pending",
    }, { onConflict: "reference" });

    return new Response(JSON.stringify({ ok: true, authorization_url: initJson.data.authorization_url, reference: ref }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});