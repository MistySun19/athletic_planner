import { supabase } from "./supabaseClient.js";
import { ROLE, requireRole } from "./auth.js";
import { initTeacherStudents } from "./teacherStudents.js";

const signOutBtn = document.getElementById("sign-out");
const totalEl = document.getElementById("student-admin-total");
const adminLink = document.getElementById("admin-link");

const elementsStudentManager = {
  form: document.getElementById("bind-form"),
  emailInput: document.getElementById("student-email"),
  message: document.getElementById("student-bind-message"),
  list: document.getElementById("student-list"),
  syncButton: null,
};

function bindSignOut() {
  if (!signOutBtn) return;
  signOutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

function updateTotal(count) {
  if (!totalEl) return;
  totalEl.textContent = `共 ${count} 名学生`;
}

async function init() {
  const session = await requireRole([ROLE.teacher, ROLE.admin]);
  if (!session) return;

  bindSignOut();
  if (adminLink) {
    adminLink.classList.toggle("hidden", session.profile?.role !== ROLE.admin);
  }
  initTeacherStudents({
    state: { currentUser: session.user },
    elements: elementsStudentManager,
    getSelectedWeek: () => 0,
    onStudentsChange: (students) => {
      updateTotal(students.length);
    },
  });
}

init().catch((error) => {
  console.error(error);
  const message = elementsStudentManager.message;
  if (message) {
    message.textContent = error?.message || "初始化失败";
    message.classList.add("error");
  }
});
