// =====================================================================
// admin-delete-user — Edge Function
// Allows an authenticated admin to delete a user and their data.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SERVICE_ROLE_KEY) return json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, 500);

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (profErr) return json({ error: profErr.message }, 500);
    if (!profile?.is_admin) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json() as { user_id?: string };
    const targetId = body.user_id?.trim();
    if (!targetId) return json({ error: "user_id مطلوب" }, 400);
    if (targetId === userData.user.id) return json({ error: "لا يمكنك حذف نفسك" }, 400);

    // Cleanup app rows then delete auth user
    await adminClient.from("user_permissions").delete().eq("user_id", targetId);
    await adminClient.from("profiles").delete().eq("user_id", targetId);
    const { error: delErr } = await adminClient.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
