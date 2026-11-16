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

    const body = await req.json();
    const purpose = body.purpose === "gift" ? "gift" : "buy";
    const product_id = body.product_id;
    const quantity = Number(body.quantity);

    if (!product_id) throw new Error("product_id required");
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("invalid quantity");
    if (quantity > 10000) throw new Error("quantity too large");

    const { data: product, error: pErr } = await admin.from("organic_products")
      .select("id, title, price, stock_quantity, status")
      .eq("id", product_id).single();
    if (pErr || !product) throw new Error("product not found");
    if ((product as any).status !== "active") throw new Error("product inactive");
    if (Number((product as any).stock_quantity) < quantity) throw new Error("insufficient stock");

    const productTotal = Number((product as any).price) * quantity;
    const deliveryFee = purpose === "gift" ? 2500 : 0;
    const total = productTotal + deliveryFee;

    const ref = `GAIA_ORG_${String(product_id).slice(0,8)}_${Date.now()}`;
    const amountKobo = Math.round(total * 100);
    if (amountKobo < 100) throw new Error("amount too small");

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const origin = req.headers.get("origin") || "https://gaia.app";

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: amountKobo,
        reference: ref,
        callback_url: `${origin}/organic-storefront?status=success`,
        metadata: {
          type: purpose === "gift" ? "diaspora_gift" : "organic_order",
          product_id,
          quantity,
          buyer_id: user.id,
        },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson.status) throw new Error(initJson.message || "Paystack init failed");

    await admin.from("pending_payments").upsert({
      reference: ref,
      user_id: user.id,
      amount: total,
      currency: "NGN",
      purpose: purpose === "gift" ? "diaspora_gift" : "organic_order",
      metadata: { product_id, quantity },
      status: "pending",
    }, { onConflict: "reference" });

    return new Response(JSON.stringify({ ok: true, authorization_url: initJson.data.authorization_url, reference: ref, total }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});