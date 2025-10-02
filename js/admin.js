import { supabase } from "./supabaseClient.js";
import { ROLE, requireRole, setUserRole } from "./auth.js";

const signOutBtn = document.getElementById("admin-sign-out");

const teacherListEl = document.getElementById("teachers-list");
const teacherMessageEl = document.getElementById("teachers-message");
const refreshTeachersBtn = document.getElementById("refresh-teachers");

const studentListEl = document.getElementById("students-list");
const studentMessageEl = document.getElementById("students-message");
const refreshStudentsBtn = document.getElementById("refresh-students");

function showMessage(el, message, type = "info") {
  if (!el) return;
  el.textContent = message;
  const isError = type === "error";
  const isSuccess = type === "success";
  el.classList.toggle("error", isError);
  el.classList.toggle("success", isSuccess);
  if (!message) {
    el.classList.remove("error", "success");
  }
}

function renderUserList(container, users, { allowDemote = false, allowPromote = false, onPromote, onDemote } = {}) {
  if (!container) return;
  container.innerHTML = "";

  if (!users.length) {
    const empty = document.createElement("p");
    empty.className = "tip";
    empty.textContent = "暂无数据";
    container.appendChild(empty);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const info = document.createElement("div");
    info.className = "admin-user-info";

    const name = document.createElement("strong");
    name.textContent = user.full_name || user.email || "未命名";
    info.appendChild(name);

    const email = document.createElement("span");
    email.textContent = user.email || "无邮箱";
    info.appendChild(email);

    const roleBadge = document.createElement("span");
    roleBadge.className = "role-badge";
    roleBadge.textContent = user.role === ROLE.teacher ? "教师" : user.role === ROLE.student ? "学生" : "未知";
    info.appendChild(roleBadge);

    const created = document.createElement("span");
    if (user.created_at) {
      created.className = "admin-meta";
      created.textContent = `创建于 ${new Date(user.created_at).toLocaleString()}`;
      info.appendChild(created);
    }

    row.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    if (allowPromote) {
      const promoteBtn = document.createElement("button");
      promoteBtn.type = "button";
      promoteBtn.textContent = "设为教师";
      promoteBtn.addEventListener("click", () => onPromote?.(user));
      actions.appendChild(promoteBtn);
    }

    if (allowDemote) {
      const demoteBtn = document.createElement("button");
      demoteBtn.type = "button";
      demoteBtn.className = "secondary";
      demoteBtn.textContent = "设为学生";
      demoteBtn.addEventListener("click", () => onDemote?.(user));
      actions.appendChild(demoteBtn);
    }

    row.appendChild(actions);
    container.appendChild(row);
  });
}

async function updateUserRole(userId, nextRole, messageEl) {
  showMessage(messageEl, "正在更新角色…");
  try {
    await setUserRole(userId, nextRole);
    showMessage(messageEl, "角色已更新。", "success");
    return true;
  } catch (error) {
    console.error("更新角色失败", error);
    showMessage(messageEl, error?.message || "更新角色失败", "error");
    return false;
  }
}

async function fetchUsersByRole(role, messageEl) {
  showMessage(messageEl, "正在加载…");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("role", role)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("加载用户失败", error);
    showMessage(messageEl, "加载失败：" + error.message, "error");
    return [];
  }

  showMessage(messageEl, "共 " + (data?.length ?? 0) + " 人");
  return data || [];
}

async function loadTeachers() {
  const teachers = await fetchUsersByRole(ROLE.teacher, teacherMessageEl);
  renderUserList(teacherListEl, teachers, {
    allowDemote: true,
    onDemote: async (user) => {
      const ok = window.confirm(`确定将 ${user.email} 调整为学生吗？`);
      if (!ok) return;
      const success = await updateUserRole(user.id, ROLE.student, teacherMessageEl);
      if (success) {
        loadTeachers();
        loadStudents();
      }
    },
  });
}

async function loadStudents() {
  const students = await fetchUsersByRole(ROLE.student, studentMessageEl);
  renderUserList(studentListEl, students, {
    allowPromote: true,
    onPromote: async (user) => {
      const ok = window.confirm(`确定将 ${user.email} 设置为教师吗？`);
      if (!ok) return;
      const success = await updateUserRole(user.id, ROLE.teacher, studentMessageEl);
      if (success) {
        loadTeachers();
        loadStudents();
      }
    },
  });
}

function bindActions() {
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "login.html";
    });
  }

  if (refreshTeachersBtn) {
    refreshTeachersBtn.addEventListener("click", () => {
      loadTeachers();
    });
  }

  if (refreshStudentsBtn) {
    refreshStudentsBtn.addEventListener("click", () => {
      loadStudents();
    });
  }
}

async function init() {
  const session = await requireRole(ROLE.admin);
  if (!session) return;
  bindActions();
  loadTeachers();
  loadStudents();
}

init().catch((error) => {
  console.error(error);
  showMessage(teacherMessageEl, error?.message || "初始化失败", "error");
  showMessage(studentMessageEl, error?.message || "初始化失败", "error");
});
