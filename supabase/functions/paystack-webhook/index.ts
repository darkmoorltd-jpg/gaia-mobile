import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;

  // Verify HMAC SHA-512
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const expectedBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(expectedBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected !== sig) return new Response("invalid signature", { status: 401 });

  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return new Response("ignored", { status: 200 });

  const { reference, amount, metadata } = event.data;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (metadata?.type === "warehouse_registration") {
      const { data, error } = await admin.rpc("mark_registration_fee_paid", {
        p_company_id: metadata.company_id,
        p_paystack_ref: reference,
        p_amount: amount / 100,
      });
      if (error) throw error;
      await admin.from("pending_payments").update({ status: "completed" }).eq("reference", reference);
      console.log("registration paid", reference, "idempotent:", !data);
    } else if (metadata?.type === "warehouse_listing") {
      const { data, error } = await admin.rpc("mark_listing_fee_paid", {
        p_payment_id: metadata.payment_id,
        p_paystack_ref: reference,
      });
      if (error) throw error;
      await admin.from("pending_payments").update({ status: "completed" }).eq("reference", reference);
      console.log("listing paid", reference);
    } else if (metadata?.type === "booking") {
      const paystackFee = (amount / 100) * 0.015 + 100;
      const { data, error } = await admin.rpc("settle_booking", {
        p_booking_id: metadata.booking_id,
        p_paystack_ref: reference,
        p_gross_amount: amount / 100,
        p_paystack_fee: Math.min(paystackFee, 2000),
      });
      if (error) throw error;
      await admin.from("pending_payments").update({ status: "completed" }).eq("reference", reference);
      console.log("booking settled", reference);
    } else {
      console.log("unknown metadata type", metadata?.type);
    }
  } catch (e: any) {
    console.error("webhook handler error:", e.message);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
