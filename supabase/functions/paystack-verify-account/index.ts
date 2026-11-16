import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { account_number, bank_code } = await req.json();
    if (!account_number || !bank_code) throw new Error("account_number and bank_code required");

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
    const res = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    const json = await res.json();
    if (!json.status) throw new Error(json.message || "resolve failed");

    return new Response(
      JSON.stringify({ ok: true, account_name: json.data.account_name }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
