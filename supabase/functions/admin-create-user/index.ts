// =====================================================================
// admin-create-user — Edge Function
// Allows an authenticated admin to create a new user (without being
// signed out) and assign permissions atomically.
// =====================================================================
// Deploy from your local machine with the Supabase CLI:
//   supabase functions deploy admin-create-user --no-verify-jwt
//
// Then set the SERVICE_ROLE secret in Supabase Dashboard:
//   Project Settings → Edge Functions → Secrets → add
//     SERVICE_ROLE_KEY = <your service_role key>
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  permissions: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // 1. Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!SERVICE_ROLE_KEY) {
      return json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, 500);
    }

    // Client bound to the caller's JWT — used to identify them
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Invalid session" }, 401);
    }
    const callerId = userData.user.id;

    // Service-role client — used for privileged operations
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confirm caller is admin (read profile via service role to bypass RLS noise)
    const { data: profile, error: profErr } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("user_id", callerId)
      .maybeSingle();

    if (profErr) return json({ error: profErr.message }, 500);
    if (!profile?.is_admin) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    // 2. Parse and validate payload
    const body = (await req.json()) as Partial<CreateUserPayload>;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const fullName = body.full_name?.trim() ?? "";
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "بريد إلكتروني غير صالح" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, 400);
    }
    if (!fullName) {
      return json({ error: "الاسم مطلوب" }, 400);
    }

    // 3. Create the user (auto-confirmed so they can login immediately).
    //    The on_auth_user_created trigger will create the profile row.
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "فشل إنشاء المستخدم" }, 400);
    }

    const newUserId = created.user.id;

    // 4. Ensure profile.full_name is set (in case trigger raced)
    await adminClient
      .from("profiles")
      .update({ full_name: fullName, is_admin: false })
      .eq("user_id", newUserId);

    // 5. Insert permissions (best-effort).
    //    Always include dashboard.view so the new user can access the home page.
    const finalPerms = Array.from(new Set<string>(["dashboard.view", ...permissions]));
    const rows = finalPerms.map((p) => ({
      user_id: newUserId,
      permission: p,
      granted_by: callerId,
    }));
    const { error: permErr } = await adminClient.from("user_permissions").insert(rows);
    if (permErr) {
      // Roll back user on permission failure
      await adminClient.auth.admin.deleteUser(newUserId);
      return json({ error: `فشل منح الصلاحيات: ${permErr.message}` }, 500);
    }

    return json({ success: true, user_id: newUserId, email });
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
