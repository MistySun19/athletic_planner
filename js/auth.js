import { supabase } from "./supabaseClient.js";

export const ROLE = {
  teacher: "teacher",
  student: "student",
  admin: "admin",
};

const DEFAULT_ADMIN_EMAIL = "sjs2294603251@gmail.com";

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user ?? null;
}

export async function fetchProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    if (error.code === "42P01") {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (user && user.id === userId) {
        const fallbackRole =
          user.user_metadata?.role || user.user_metadata?.requested_role || ROLE.student;
        return {
          id: user.id,
          email: user.email,
          role: fallbackRole,
          full_name: user.user_metadata?.full_name ?? null,
        };
      }
      return {
        id: userId,
        email: null,
        role: ROLE.student,
        full_name: null,
      };
    }
    throw error;
  }

  return data ?? null;
}

export async function upsertProfile(user, role = ROLE.student) {
  if (!user) return null;
  let resolvedRole = role;
  const metadataRole =
    user.user_metadata?.role || user.user_metadata?.requested_role || null;
  try {
    const existing = await fetchProfile(user.id);
    if (existing?.role) {
      resolvedRole = existing.role;
    } else if (metadataRole) {
      resolvedRole = metadataRole;
    }
  } catch (error) {
    console.warn("查询现有档案失败，将使用默认角色", error);
    if (metadataRole) {
      resolvedRole = metadataRole;
    }
  }
  if (!metadataRole && resolvedRole === ROLE.student && user.user_metadata?.requested_role) {
    resolvedRole = user.user_metadata.requested_role;
  }
  const normalizedEmail = (user.email || "").toLowerCase();
  if (normalizedEmail === DEFAULT_ADMIN_EMAIL) {
    resolvedRole = ROLE.admin;
  }
  const payload = {
    id: user.id,
    email: user.email,
    role: resolvedRole,
    full_name: user.user_metadata?.full_name ?? null,
    updated_at: new Date().toISOString(),
  };

  let data = null;
  try {
    const result = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" })
      .select("id, role, full_name, email")
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }
    data = result.data;
  } catch (error) {
    if (error.code === "42P01") {
      await supabase.auth.updateUser({ data: { role: resolvedRole } });
      return {
        id: user.id,
        email: user.email,
        role: resolvedRole,
        full_name: user.user_metadata?.full_name ?? null,
      };
    }
    throw error;
  }

  const metadataRoleFinal =
    user.user_metadata?.role || user.user_metadata?.requested_role || null;
  if (metadataRoleFinal !== resolvedRole) {
    await supabase.auth.updateUser({ data: { role: resolvedRole } });
  }

  return data;
}

export async function setUserRole(userId, role) {
  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    if (error.code === "42P01") {
      throw new Error("profiles 表不存在，请先在数据库中创建。");
    }
    throw error;
  }

  const current = await getCurrentUser();
  if (current?.id === userId) {
    await supabase.auth.updateUser({ data: { role } });
  }

  return true;
}

export async function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  let profile = null;
  try {
    profile = await fetchProfile(user.id);
    if (!profile) {
      const preferredRole =
        user.user_metadata?.role || user.user_metadata?.requested_role || ROLE.student;
      profile = await upsertProfile(user, preferredRole);
    }
  } catch (error) {
    console.error("加载/创建用户档案失败", error);
    window.alert("无法加载账户信息，请稍后再试");
    throw error;
  }

  if (!roles.includes(profile.role)) {
    let fallback = "login.html";
    if (profile.role === ROLE.teacher) fallback = "index.html";
    else if (profile.role === ROLE.student) fallback = "student.html";
    else if (profile.role === ROLE.admin) fallback = "admin.html";
    window.location.href = fallback;
    return null;
  }

  return { user, profile };
}

export async function ensureSessionRedirect() {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await fetchProfile(user.id);
  return { user, profile };
}
