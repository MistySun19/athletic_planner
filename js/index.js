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
  selectedStudentId: "",
  students: [],
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
  select: document.getElementById("student-select"),
  selectMessage: document.getElementById("student-select-message"),
  publishButton: document.getElementById("publish-week"),
};

const adminLink = document.getElementById("admin-link");
const requestAdminBtn = document.getElementById("request-admin");
const studentCountEl = document.getElementById("student-count");
const studentGuard = document.getElementById("student-guard");
const plannerSections = document.querySelector(".planner-sections");

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
  elements: {
    form: elementsStudentManager.form,
    emailInput: elementsStudentManager.emailInput,
    message: elementsStudentManager.message,
    list: elementsStudentManager.list,
  },
  onStudentsChange: handleStudentsChange,
});

const signOutBtn = document.getElementById("sign-out");
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

initializeTabs();
bindSignOut();
bindStudentControls();

window.addEventListener("focus", () => {
  if (!state.currentUser) return;
  loadTypes().then(() => {
    if (state.selectedStudentId) {
      loadScheduleForStudent(state.selectedStudentId);
    } else {
      ensureScheduleStructure(state.schedule);
      syncWeekValues(state.schedule);
      updateScheduleInputs();
      generalPlanner.render();
      if (weeklyPlanner) weeklyPlanner.render();
    }
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
  await loadTypes();

  ensureScheduleStructure(state.schedule);
  syncWeekValues(state.schedule);
  updateScheduleInputs();
  togglePlannerAvailability(Boolean(state.selectedStudentId));
  if (!state.selectedStudentId) {
    setStudentSelectMessage("请选择学生以开始制定计划。", "error");
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
  if (!state.currentUser || !state.selectedStudentId) {
    setStudentSelectMessage("请选择学生后再保存计划。", "error");
    return;
  }

  const payload = {
    teacher_id: state.currentUser.id,
    student_id: state.selectedStudentId,
    data: state.schedule,
  };

  supabase
    .from("student_schedules")
    .upsert(payload, { onConflict: "teacher_id,student_id" })
    .select("id")
    .then(({ data, error }) => {
      if (error) {
        console.error("保存训练计划失败", error);
        if (error.code === "42P01") {
          setStudentSelectMessage(
            "未找到 student_schedules 表，请在 Supabase 中创建后重试。",
            "error"
          );
        } else {
          setStudentSelectMessage(error.message || "保存失败", "error");
        }
        return;
      }
      if (Array.isArray(data) && data[0]?.id) {
        state.scheduleRecordId = data[0].id;
      }
      setStudentSelectMessage("已保存该学生的计划。", "success");
    })
    .catch((error) => {
      console.error("保存训练计划失败", error);
      setStudentSelectMessage(error?.message || "保存失败", "error");
    });
}

async function loadScheduleForStudent(studentId) {
  if (!state.currentUser) return;

  if (!studentId) {
    state.scheduleRecordId = null;
    state.schedule = getDefaultSchedule();
    ensureScheduleStructure(state.schedule);
    syncWeekValues(state.schedule);
    updateScheduleInputs();
    generalPlanner.render();
    if (weeklyPlanner) weeklyPlanner.render();
    setStudentSelectMessage("请选择学生以开始制定计划。", "error");
    togglePlannerAvailability(false);
    return;
  }

  setStudentSelectMessage("正在加载该学生的计划…");

  let recordId = null;
  let scheduleData = getDefaultSchedule();

  try {
    const { data, error } = await supabase
      .from("student_schedules")
      .select("id, data")
      .eq("teacher_id", state.currentUser.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") {
        setStudentSelectMessage(
          "未找到 student_schedules 表，请在 Supabase 中创建后重试。",
          "error"
        );
        state.scheduleRecordId = null;
        state.schedule = getDefaultSchedule();
        updateScheduleInputs();
        generalPlanner.render();
        if (weeklyPlanner) weeklyPlanner.render();
        return;
      }
      console.error("加载学生计划失败", error);
      setStudentSelectMessage(error.message || "加载计划失败", "error");
    } else if (data) {
      recordId = data.id;
      scheduleData = data.data || getDefaultSchedule();
    }
  } catch (error) {
    console.error("加载学生计划失败", error);
    setStudentSelectMessage(error?.message || "加载计划失败", "error");
  }

  state.scheduleRecordId = recordId;
  state.schedule = scheduleData;

  ensureScheduleStructure(state.schedule);
  syncWeekValues(state.schedule);
  updateScheduleInputs();

  generalPlanner.render();
  if (weeklyPlanner) weeklyPlanner.render();

  const currentStudent = state.students.find((item) => item.student_id === studentId);
  setStudentSelectMessage(`当前学生：${formatStudentLabel(currentStudent)}`);
  togglePlannerAvailability(true);
}

function updateScheduleInputs() {
  if (elementsGeneral.weekInput) {
    elementsGeneral.weekInput.value = String(state.schedule.weeks);
  }
  if (elementsGeneral.dayInput) {
    elementsGeneral.dayInput.value = String(state.schedule.days);
  }
}

function setStudentSelectMessage(message, type = "info") {
  const el = elementsStudentManager.selectMessage;
  if (!el) return;
  el.textContent = message;
  if (!message) {
    el.classList.remove("error", "success");
    return;
  }
  el.classList.toggle("error", type === "error");
  el.classList.toggle("success", type === "success");
}

function updateStudentCount(count) {
  if (!studentCountEl) return;
  studentCountEl.textContent = `共 ${count} 名学生`;
}

function togglePlannerAvailability(hasStudent) {
  if (plannerSections) {
    plannerSections.classList.toggle("disabled", !hasStudent);
  }
  if (studentGuard) {
    studentGuard.classList.toggle("hidden", hasStudent);
  }

  const generalControls = [
    elementsGeneral.weekInput,
    elementsGeneral.dayInput,
    elementsGeneral.setWeeksBtn,
    elementsGeneral.addWeekBtn,
    elementsGeneral.setDaysBtn,
    elementsGeneral.addDayBtn,
  ];
  generalControls.forEach((el) => {
    if (el) el.disabled = !hasStudent;
  });

  const weeklyControls = [
    elementsWeekly.weekInput,
    elementsWeekly.prevBtn,
    elementsWeekly.nextBtn,
  ];
  weeklyControls.forEach((el) => {
    if (el) el.disabled = !hasStudent;
  });

  if (elementsStudentManager.publishButton) {
    elementsStudentManager.publishButton.disabled = !hasStudent;
  }
}

function formatStudentLabel(student) {
  if (!student) return "未命名学生";
  const profile = student.profile;
  if (profile?.full_name) {
    return `${profile.full_name} (${profile.email})`;
  }
  return profile?.email || "未命名学生";
}

function handleStudentsChange(students) {
  state.students = students;
  updateStudentCount(students.length);
  const select = elementsStudentManager.select;
  const publishBtn = elementsStudentManager.publishButton;

  if (select) {
    const currentValue = state.selectedStudentId;
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "请选择学生";
    select.appendChild(placeholder);

    students.forEach((student) => {
      const option = document.createElement("option");
      option.value = student.student_id;
      option.textContent = formatStudentLabel(student);
      select.appendChild(option);
    });

    if (currentValue && students.some((item) => item.student_id === currentValue)) {
      select.value = currentValue;
    }
  }

  if (publishBtn) {
    publishBtn.disabled = !state.selectedStudentId || !students.length;
  }

  if (!students.length) {
    setSelectedStudent("", { silent: true });
    setStudentSelectMessage("尚未绑定学生，请先添加。", "error");
    togglePlannerAvailability(false);
    return;
  }

  if (!students.some((item) => item.student_id === state.selectedStudentId)) {
    const firstId = students[0].student_id;
    setSelectedStudent(firstId);
  } else {
    const currentStudent = students.find((item) => item.student_id === state.selectedStudentId);
    setStudentSelectMessage(`当前学生：${formatStudentLabel(currentStudent)}`);
    togglePlannerAvailability(true);
  }
}

async function setSelectedStudent(studentId, { silent = false } = {}) {
  const normalizedId = studentId || "";
  state.selectedStudentId = normalizedId;
  togglePlannerAvailability(Boolean(normalizedId));

  if (elementsStudentManager.select && elementsStudentManager.select.value !== normalizedId) {
    elementsStudentManager.select.value = normalizedId;
  }

  if (elementsStudentManager.publishButton) {
    elementsStudentManager.publishButton.disabled = !normalizedId;
  }

  if (!normalizedId) {
    state.scheduleRecordId = null;
    state.schedule = getDefaultSchedule();
    ensureScheduleStructure(state.schedule);
    syncWeekValues(state.schedule);
    updateScheduleInputs();
    generalPlanner.render();
    if (weeklyPlanner) weeklyPlanner.render();
    if (!silent) {
      setStudentSelectMessage("请选择学生以开始制定计划。", "error");
    }
    return;
  }

  await loadScheduleForStudent(normalizedId);
}

function bindStudentControls() {
  if (elementsStudentManager.select) {
    elementsStudentManager.select.addEventListener("change", (event) => {
      const value = event.target.value;
      setSelectedStudent(value);
    });
  }

  if (elementsStudentManager.publishButton) {
    elementsStudentManager.publishButton.addEventListener("click", publishCurrentStudentWeek);
    elementsStudentManager.publishButton.disabled = true;
  }
}

function buildWeekPlanSnapshot(schedule, weekIndex) {
  if (!schedule || typeof schedule !== "object") return null;
  const safeWeek = Number.isFinite(weekIndex) ? weekIndex : 0;
  const days = (schedule.dayData || []).map((day) => {
    const entries = (day.entries || []).map((entry) => {
      const actions = (entry.actions || []).map((action) => {
        const weekValues = Array.isArray(action.weekValues)
          ? action.weekValues[safeWeek] || null
          : null;
        return {
          id: action.id,
          actionId: action.actionId,
          actionName: action.actionName,
          weekValue: weekValues,
        };
      });
      return {
        id: entry.id,
        typeName: entry.typeName,
        groupLabel: entry.groupLabel,
        actions,
      };
    });
    return {
      id: day.id,
      title: day.title,
      entries,
    };
  });

  return {
    weekIndex: safeWeek,
    generatedAt: new Date().toISOString(),
    days,
  };
}

async function publishCurrentStudentWeek() {
  if (!state.currentUser || !state.selectedStudentId) {
    setStudentSelectMessage("请选择学生后再发布周计划。", "error");
    return;
  }

  const weekIndex = weeklyPlanner?.getSelectedWeek?.() ?? 0;
  const snapshot = buildWeekPlanSnapshot(state.schedule, weekIndex);

  if (!snapshot || !snapshot.days.length) {
    setStudentSelectMessage("周计划为空，请先完善计划内容。", "error");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("weekly_plans")
      .upsert(
        {
          teacher_id: state.currentUser.id,
          student_id: state.selectedStudentId,
          week_number: weekIndex + 1,
          schedule_snapshot: snapshot,
          published_at: new Date().toISOString(),
        },
        { onConflict: "teacher_id,student_id,week_number" }
      )
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("发布周计划失败", error);
      if (error.code === "42P01") {
        setStudentSelectMessage(
          "未找到 weekly_plans 表或缺少 student_id 字段，请在 Supabase 中更新结构。",
          "error"
        );
      } else {
        setStudentSelectMessage(error.message || "发布失败", "error");
      }
      return;
    }

    const planId = data?.id;
    if (!planId) {
      setStudentSelectMessage("未能创建周计划记录", "error");
      return;
    }

    const { error: assignmentError } = await supabase
      .from("weekly_plan_assignments")
      .upsert(
        {
          plan_id: planId,
          student_id: state.selectedStudentId,
          teacher_id: state.currentUser.id,
          status: "assigned",
        },
        { onConflict: "plan_id,student_id" }
      );

    if (assignmentError) {
      console.error("创建周计划分发记录失败", assignmentError);
      setStudentSelectMessage(assignmentError.message || "发布失败", "error");
      return;
    }

    setStudentSelectMessage(`已发布第 ${weekIndex + 1} 周计划给该学生。`, "success");
  } catch (error) {
    console.error("发布周计划失败", error);
    setStudentSelectMessage(error?.message || "发布失败", "error");
  }
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
