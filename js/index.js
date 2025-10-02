import { supabase } from "./supabaseClient.js";
import { generateId } from "./storage.js";
import { METRICS } from "./modules/constants.js";
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

let weeklyPlanner;

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
  state.currentUser = await requireUser();
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

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "login.html";
    throw (error || new Error("未登录"));
  }
  return data.user;
}
