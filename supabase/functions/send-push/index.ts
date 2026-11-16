import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  try {
    const body = await req.json();
    const record = body.record || body;
    const { user_id, id, title, body: notifBody, data } = record;
    if (!user_id || !title) return new Response("bad payload", { status: 400 });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokens } = await admin.from("push_tokens").select("token").eq("user_id", user_id);
    if (!tokens || tokens.length === 0) return new Response(JSON.stringify({ ok: true, skipped: "no tokens" }), { headers: { "Content-Type": "application/json" } });

    const messages = tokens.map((t: any) => ({
      to: t.token, sound: "default", title, body: notifBody || "",
      data: { notification_id: id, ...(data || {}) }, priority: "high", channelId: "default",
    }));
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Accept": "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await resp.json();
    return new Response(JSON.stringify({ ok: true, result }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("push error:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});