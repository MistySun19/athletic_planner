import { supabase } from "./supabaseClient.js";
import { ROLE, upsertProfile } from "./auth.js";

const form = document.getElementById("register-form");
const sendCodeBtn = document.getElementById("send-code");
const messageEl = document.getElementById("register-message");
const emailInput = document.getElementById("register-email");
const passwordInput = document.getElementById("register-password");
const passwordConfirmInput = document.getElementById("register-password-confirm");
const roleSelect = document.getElementById("register-role");
const codeInput = document.getElementById("register-code");

let pendingEmail = "";
let pendingRole = ROLE.student;
let codeSentAt = null;

function showMessage(text, type = "info") {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.toggle("error", type === "error");
  messageEl.classList.toggle("success", type === "success");
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

async function sendVerificationCode() {
  const email = normalizeEmail(emailInput.value);
  if (!email) {
    showMessage("请先填写邮箱", "error");
    emailInput.focus();
    return;
  }

  pendingRole = roleSelect?.value === ROLE.teacher ? ROLE.teacher : ROLE.student;

  showMessage("正在发送验证码…");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { requested_role: pendingRole },
    },
  });

  if (error) {
    console.error("发送验证码失败", error);
    showMessage(error.message || "发送验证码失败", "error");
    return;
  }

  pendingEmail = email;
  codeSentAt = Date.now();
  showMessage("验证码已发送，请查收邮箱。", "success");
}

async function completeRegistration(event) {
  event.preventDefault();

  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  const passwordConfirm = passwordConfirmInput.value;
  const token = codeInput.value.trim();
  pendingRole = roleSelect?.value === ROLE.teacher ? ROLE.teacher : ROLE.student;

  if (!email || !password || !token) {
    showMessage("请完整填写邮箱、密码和验证码", "error");
    return;
  }

  if (password !== passwordConfirm) {
    showMessage("两次输入的密码不一致", "error");
    passwordConfirmInput.focus();
    return;
  }

  if (!pendingEmail || pendingEmail !== email) {
    showMessage("请先发送验证码并使用同一邮箱", "error");
    return;
  }

  showMessage("正在验证验证码…");
  let verifyError;
  try {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "signup",
    });
    verifyError = error ?? null;
  } catch (error) {
    verifyError = error;
  }

  if (verifyError) {
    console.error("验证码验证失败", verifyError);
    showMessage(verifyError.message || "验证码验证失败", "error");
    return;
  }

  showMessage("正在设置密码…");
  const { error: updateError } = await supabase.auth.updateUser({
    password,
    data: { role: pendingRole },
  });

  if (updateError) {
    console.error("设置密码失败", updateError);
    showMessage(updateError.message || "设置密码失败", "error");
    return;
  }

  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  if (!user) {
    showMessage("注册成功但无法获取用户信息", "error");
    return;
  }

  try {
    await upsertProfile(user, pendingRole);
  } catch (profileError) {
    console.error("同步用户资料失败", profileError);
    showMessage("同步账户信息失败", "error");
    return;
  }

  await supabase.auth.signOut();
  showMessage("注册成功，请使用新账户登录。", "success");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 1500);
}

sendCodeBtn?.addEventListener("click", sendVerificationCode);
form?.addEventListener("submit", completeRegistration);
