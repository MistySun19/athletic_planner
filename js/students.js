import { supabase } from "./supabaseClient.js";

const STORAGE_KEY = "students:list";

const signOutBtn = document.getElementById("sign-out");
const studentListEl = document.getElementById("student-admin-list");
const studentForm = document.getElementById("student-admin-form");
const studentEmailInput = document.getElementById("student-admin-email");
const feedbackEl = document.getElementById("student-admin-feedback");
const totalEl = document.getElementById("student-admin-total");

const state = {
  students: [],
};

function loadStoredStudents() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === "string");
  } catch (error) {
    console.warn("读取学生列表失败", error);
    return [];
  }
}

function saveStudents() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.students));
  } catch (error) {
    console.warn("保存学生列表失败", error);
  }
}

function showFeedback(message, type = "info") {
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.classList.remove("error");
  if (type === "error") {
    feedbackEl.classList.add("error");
  }
}

function renderStudents() {
  if (totalEl) {
    totalEl.textContent = `共 ${state.students.length} 名学生`;
  }

  if (!studentListEl) return;
  studentListEl.innerHTML = "";

  if (!state.students.length) {
    const empty = document.createElement("p");
    empty.className = "tip";
    empty.textContent = "暂无学生，添加后会显示在这里。";
    studentListEl.appendChild(empty);
    return;
  }

  state.students.forEach((email) => {
    const item = document.createElement("div");
    item.className = "student-item";

    const info = document.createElement("span");
    info.className = "student-email";
    info.textContent = email;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "danger";
    removeBtn.textContent = "删除";
    removeBtn.addEventListener("click", () => {
      state.students = state.students.filter((itemEmail) => itemEmail !== email);
      saveStudents();
      renderStudents();
      showFeedback(`已移除学生 ${email}`);
    });

    item.appendChild(info);
    item.appendChild(removeBtn);
    studentListEl.appendChild(item);
  });
}

function bindSignOut() {
  if (!signOutBtn) return;
  signOutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "login.html";
    throw (error || new Error("未登录"));
  }
  return data.user;
}

function setupForm() {
  if (!studentForm || !studentEmailInput) return;
  studentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = studentEmailInput.value.trim();
    if (!raw) {
      studentEmailInput.focus();
      return;
    }
    const email = raw.toLowerCase();
    if (state.students.includes(email)) {
      showFeedback("该学生已存在", "error");
      return;
    }
    state.students.push(email);
    state.students.sort((a, b) => a.localeCompare(b));
    studentEmailInput.value = "";
    saveStudents();
    renderStudents();
    showFeedback(`已添加学生 ${email}`);
    studentEmailInput.focus();
  });
}

async function init() {
  await requireUser();
  bindSignOut();
  state.students = loadStoredStudents();
  setupForm();
  renderStudents();
}

init().catch((error) => {
  console.error(error);
  showFeedback(error?.message || "初始化失败", "error");
});
