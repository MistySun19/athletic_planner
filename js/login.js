import { supabase } from "./supabaseClient.js";
import { ROLE, upsertProfile, fetchProfile } from "./auth.js";

const authForm = document.getElementById("auth-form");
const messageEl = document.getElementById("auth-message");

function showMessage(text, isError = false) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.toggle("error", Boolean(isError));
}

async function redirectByRole(profile) {
  if (!profile) {
    window.location.href = "student.html";
    return;
  }

  if (profile.role === ROLE.admin) {
    window.location.href = "admin.html";
    return;
  }
  if (profile.role === ROLE.teacher) {
    window.location.href = "index.html";
    return;
  }
  window.location.href = "student.html";
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showMessage("请输入邮箱和密码", true);
    return;
  }

  showMessage("正在登录…");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    showMessage(error.message, true);
    return;
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (!user) {
    showMessage("登录后未找到用户信息", true);
    return;
  }

  let profile;
  try {
    profile = await fetchProfile(user.id);
    if (!profile) {
      const preferredRole =
        user.user_metadata?.role || user.user_metadata?.requested_role || ROLE.student;
      profile = await upsertProfile(user, preferredRole);
    }
  } catch (profileError) {
    console.error(profileError);
    showMessage("同步账户信息失败", true);
    return;
  }

  showMessage("登录成功，正在跳转…");
  await redirectByRole(profile);
}

async function redirectIfLoggedIn() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error(error);
      return;
    }
    if (!data?.user) return;
    let profile = await fetchProfile(data.user.id);
    if (!profile) {
      const preferredRole =
        data.user.user_metadata?.role || data.user.user_metadata?.requested_role || ROLE.student;
      profile = await upsertProfile(data.user, preferredRole);
    }
    await redirectByRole(profile);
  } catch (error) {
    console.error(error);
  }
}

authForm?.addEventListener("submit", handleLogin);
redirectIfLoggedIn();
