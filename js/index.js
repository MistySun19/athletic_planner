import { supabase } from "./supabaseClient.js";
import { ROLE, requireRole, setUserRole } from "./auth.js";
import { generateId } from "./storage.js";
import { METRICS } from "./modules/constants.js";
import { initTeacherStudents } from "./teacherStudents.js";
import {
  createWeekValues,
  getDefaultSchedule,
  ensureScheduleStructure,
  syncWeekValues,
} from "./modules/state.js";
import { initGeneralPlanner } from "./modules/generalPlanner.js";
import { initWeeklyPlanner } from "./modules/weeklyPlanner.js";

const state = {
  currentUser: null,
  scheduleRecordId: null,
  schedule: getDefaultSchedule(),
  database: { types: [] },
  profile: null,
};

const elementsGeneral = {
  weekInput: document.getElementById("week-count"),
  dayInput: document.getElementById("day-count"),
  setWeeksBtn: document.getElementById("set-weeks"),
  addWeekBtn: document.getElementById("add-week"),
  setDaysBtn: document.getElementById("set-days"),
  addDayBtn: document.getElementById("add-day"),
  daysContainer: document.getElementById("days-container"),
};

const elementsWeekly = {
  weekInput: document.getElementById("weekly-week"),
  prevBtn: document.getElementById("weekly-prev"),
  nextBtn: document.getElementById("weekly-next"),
  container: document.getElementById("weekly-container"),
};

const elementsStudentManager = {
  form: document.getElementById("bind-form"),
  emailInput: document.getElementById("student-email"),
  message: document.getElementById("student-bind-message"),
  list: document.getElementById("student-list"),
  syncButton: document.getElementById("sync-week"),
};

const adminLink = document.getElementById("admin-link");
const requestAdminBtn = document.getElementById("request-admin");

let weeklyPlanner;
let teacherStudentManager;

const generalPlanner = initGeneralPlanner({
  state,
  elements: elementsGeneral,
  metrics: METRICS,
  createWeekValues,
  ensureScheduleStructure,
  syncWeekValues,
  persistSchedule,
  generateId,
  onScheduleChange: () => {
    if (weeklyPlanner) weeklyPlanner.render();
  },
});

weeklyPlanner = initWeeklyPlanner({
  state,
  elements: elementsWeekly,
  metrics: METRICS,
  createWeekValues,
  persistSchedule,
  onScheduleChange: () => {
    generalPlanner.render();
  },
});

teacherStudentManager = initTeacherStudents({
  state,
  elements: elementsStudentManager,
  getSelectedWeek: () => weeklyPlanner?.getSelectedWeek?.() ?? 0,
});

const signOutBtn = document.getElementById("sign-out");
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

initializeTabs();
bindSignOut();

window.addEventListener("focus", () => {
  if (!state.currentUser) return;
  loadTypes().then(() => {
    generalPlanner.render();
    if (weeklyPlanner) weeklyPlanner.render();
  });
});

init();

async function init() {
  const session = await requireRole([ROLE.teacher, ROLE.admin]);
  if (!session) return;
  state.currentUser = session.user;
  state.profile = session.profile;
  applyRoleControls(session.profile);
  bindAdminRequest();
  await Promise.all([loadTypes(), loadSchedule()]);

  ensureScheduleStructure(state.schedule);
  syncWeekValues(state.schedule);

  if (elementsGeneral.weekInput) {
    elementsGeneral.weekInput.value = String(state.schedule.weeks);
  }
  if (elementsGeneral.dayInput) {
    elementsGeneral.dayInput.value = String(state.schedule.days);
  }

  generalPlanner.render();
  if (weeklyPlanner) weeklyPlanner.render();
  teacherStudentManager?.reload?.();
}

function applyRoleControls(profile) {
  const isAdmin = profile?.role === ROLE.admin;
  if (adminLink) {
    adminLink.classList.toggle("hidden", !isAdmin);
  }
  if (requestAdminBtn) {
    requestAdminBtn.classList.toggle("hidden", isAdmin);
  }
}

function bindAdminRequest() {
  if (!requestAdminBtn) return;
  requestAdminBtn.addEventListener("click", async () => {
    const answer = window.prompt("请输入管理员密码：");
    if (answer == null) return;
    if (answer !== "admin") {
      window.alert("密码错误，无法升级为管理员。");
      return;
    }
    try {
      await setUserRole(state.currentUser.id, ROLE.admin);
      state.profile = { ...state.profile, role: ROLE.admin };
      applyRoleControls(state.profile);
      window.alert("已升级为管理员，可访问管理员面板。");
    } catch (error) {
      console.error("升级管理员失败", error);
      window.alert(error?.message || "升级管理员失败，请稍后再试。");
    }
  });
}

function persistSchedule() {
  if (!state.currentUser) return;
  const payload = {
    user_id: state.currentUser.id,
    data: state.schedule,
  };
  if (state.scheduleRecordId) {
    payload.id = state.scheduleRecordId;
  }

  supabase
    .from("training_schedules")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.error("保存训练计划失败", error);
        return;
      }
      if (data?.id) {
        state.scheduleRecordId = data.id;
      }
    })
    .catch((error) => {
      console.error("保存训练计划失败", error);
    });
}

async function loadTypes() {
  const { data, error } = await supabase
    .from("training_types")
    .select("id, name, training_actions(id, name)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("加载训练类型失败", error);
    state.database.types = [];
    return;
  }

  state.database.types = (data || []).map((type) => ({
    id: type.id,
    name: type.name,
    actions: Array.isArray(type.training_actions)
      ? type.training_actions
          .map((action) => ({ id: action.id, name: action.name }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      : [],
  }));
}

async function loadSchedule() {
  const { data, error } = await supabase
    .from("training_schedules")
    .select("id, data")
    .eq("user_id", state.currentUser.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("加载训练计划失败", error);
    state.scheduleRecordId = null;
    state.schedule = getDefaultSchedule();
    return;
  }

  if (data) {
    state.scheduleRecordId = data.id;
    state.schedule = data.data || getDefaultSchedule();
  } else {
    state.scheduleRecordId = null;
    state.schedule = getDefaultSchedule();
  }
}

function initializeTabs() {
  if (!tabButtons.length || !tabPanels.length) return;
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === target));
      tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === target));
    });
  });
}

function bindSignOut() {
  if (!signOutBtn) return;
  signOutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}
