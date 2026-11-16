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
    if (!user.email) throw new Error("user has no email");

    const { reference } = await req.json();
    if (!reference) throw new Error("reference required");

    const { data: pending, error: pErr } = await admin.from("pending_payments")
      .select("*").eq("reference", reference).eq("user_id", user.id).eq("purpose", "tier_subscription").single();
    if (pErr || !pending) throw new Error("payment intent not found");
    if (pending.status !== "pending") throw new Error("payment intent already used");
    if (!pending.amount || pending.amount <= 0) throw new Error("invalid amount");

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const origin = req.headers.get("origin") || "https://gaia.app";

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: Math.round(pending.amount * 100),
        reference: pending.reference,
        callback_url: `${origin}/seller-subscribe`,
        metadata: {
          type: "tier_subscription",
          tier_id: pending.metadata?.tier_id,
          billing_cycle: pending.metadata?.billing_cycle,
          buyer_id: user.id,
        },
      }),
    });

    const initJson = await initRes.json();
    if (!initJson.status) throw new Error(initJson.message || "Paystack init failed");

    return new Response(JSON.stringify({ ok: true, authorization_url: initJson.data.authorization_url, reference }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
