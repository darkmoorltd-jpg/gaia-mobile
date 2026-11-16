import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");
  if (!sig) return new Response("missing signature", { status: 400 });

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const expectedBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = Array.from(new Uint8Array(expectedBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
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
      const { error } = await admin.rpc("mark_registration_fee_paid", {
        p_company_id: metadata.company_id,
        p_paystack_ref: reference,
        p_amount: amount / 100,
      });
      if (error) throw error;
      await admin.from("pending_payments").update({ status: "completed" }).eq("reference", reference);
      console.log("registration paid", reference);

    } else if (metadata?.type === "warehouse_listing") {
      const { error } = await admin.rpc("mark_listing_fee_paid", {
        p_payment_id: metadata.payment_id,
        p_paystack_ref: reference,
      });
      if (error) throw error;
      await admin.from("pending_payments").update({ status: "completed" }).eq("reference", reference);
      console.log("listing paid", reference);

    } else if (metadata?.type === "booking") {
      const paystackFee = Math.min((amount / 100) * 0.015 + 100, 2000);
      const { error } = await admin.rpc("settle_booking", {
        p_booking_id: metadata.booking_id,
        p_paystack_ref: reference,
        p_gross_amount: amount / 100,
        p_paystack_fee: paystackFee,
      });
      if (error) throw error;
      await admin.from("pending_payments").update({ status: "completed" }).eq("reference", reference);
      console.log("booking settled", reference);

    } else if (metadata?.type === "organic_order" || metadata?.type === "diaspora_gift") {
      // Order creation happens client-side after browser return via RPC.
      // Webhook only marks the payment as completed so the RPC can consume it.
      await admin.from("pending_payments")
        .update({ status: "completed" })
        .eq("reference", reference)
        .eq("status", "pending");
      console.log("organic payment completed", reference, metadata?.type);

    } else {
      // Safe fallback: mark any reference as completed so RPCs can consume it.
      // Amount is verified by Paystack's signed payload — RPCs double-check against total.
      await admin.from("pending_payments")
        .update({ status: "completed" })
        .eq("reference", reference)
        .eq("status", "pending");
      console.log("unknown metadata, marked completed:", reference, metadata?.type);
    }
  } catch (e: any) {
    console.error("webhook handler error:", e.message);
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});