import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("not authenticated");

    const { company_id } = await req.json();
    if (!company_id) throw new Error("company_id required");

    const { data: company, error: cErr } = await admin
      .from("warehouse_companies")
      .select("id, owner_id, registration_fee_paid_at, verification_status, company_name")
      .eq("id", company_id)
      .single();
    if (cErr || !company) throw new Error("company not found");
    if (company.owner_id !== user.id) throw new Error("not your company");
    if (company.registration_fee_paid_at) throw new Error("already paid");
    if (company.verification_status !== "approved") throw new Error("company not approved");

    const ref = `GAIA_REG_${company_id}_${Date.now()}`;
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const origin = req.headers.get("origin") || "https://gaia.app";

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: 20000 * 100, // kobo
        reference: ref,
        callback_url: `${origin}/warehouse-pay-fee?status=success&company_id=${company_id}`,
        metadata: {
          type: "warehouse_registration",
          company_id,
          company_name: company.company_name,
        },
      }),
    });

    const initJson = await initRes.json();
    if (!initJson.status) throw new Error(initJson.message || "Paystack init failed");

    await admin.from("pending_payments").upsert({
      reference: ref,
      user_id: user.id,
      amount: 20000,
      currency: "NGN",
      purpose: "warehouse_registration",
      metadata: { company_id },
      status: "pending",
    }, { onConflict: "reference" });

    return new Response(
      JSON.stringify({
        ok: true,
        authorization_url: initJson.data.authorization_url,
        reference: ref,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
