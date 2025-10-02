import { supabase } from "./supabaseClient.js";
import { ROLE } from "./auth.js";

const form = document.getElementById("register-form");
const messageEl = document.getElementById("register-message");
const emailInput = document.getElementById("register-email");
const passwordInput = document.getElementById("register-password");
const passwordConfirmInput = document.getElementById("register-password-confirm");
const roleSelect = document.getElementById("register-role");

function showMessage(text, type = "info") {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.toggle("error", type === "error");
  messageEl.classList.toggle("success", type === "success");
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

async function handleRegistration(event) {
  event.preventDefault();

  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  const confirmPassword = passwordConfirmInput.value;
  const selectedRole = roleSelect?.value === ROLE.teacher ? ROLE.teacher : ROLE.student;

  if (!email || !password) {
    showMessage("请填写邮箱和密码", "error");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("两次输入的密码不一致", "error");
    passwordConfirmInput.focus();
    return;
  }

  showMessage("正在提交注册请求…");

  const redirectUrl = new URL("./login.html", window.location.href).toString();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: { requested_role: selectedRole },
    },
  });

  if (error) {
    console.error("注册失败", error);
    showMessage(error.message || "注册失败", "error");
    return;
  }

  if (data?.user) {
    showMessage("注册成功，确认邮件已发送，请查收邮箱并点击链接完成注册。", "success");
  } else {
    showMessage("确认邮件已发送，请查收邮箱完成注册。", "success");
  }

  form?.reset();
}

form?.addEventListener("submit", handleRegistration);
