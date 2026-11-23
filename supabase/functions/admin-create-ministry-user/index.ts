import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("not authenticated");

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("admin only");

    const body = await req.json();
    const { email, password, level, scope_state, organization, full_name } = body;

    if (!email || !password) throw new Error("email and password required");
    if (!["national","federal","ifad","state"].includes(level)) throw new Error("invalid level");
    if (level === "state" && !scope_state) throw new Error("scope_state required for state level");
    if (password.length < 6) throw new Error("password must be at least 6 characters");

    // 1. Create auth user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "", role: "ministry" },
    });
    if (createErr) {
      if (createErr.message.includes("already")) {
        throw new Error("A user with that email already exists");
      }
      throw new Error(createErr.message);
    }
    if (!created.user) throw new Error("user creation returned no data");

    // 2. Insert ministry_access
    const { error: insErr } = await admin.from("ministry_access").insert({
      user_id: created.user.id,
      email: email.toLowerCase().trim(),
      level,
      scope_state: level === "state" ? scope_state : null,
      organization: organization || null,
      is_active: true,
      granted_by: user.id,
      granted_at: new Date().toISOString(),
    });

    if (insErr) {
      // rollback
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error("access insert failed: " + insErr.message);
    }

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id, email: created.user.email }),
      { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
