import { supabase } from "./supabaseClient.js";
import { ROLE, requireRole } from "./auth.js";

const signOutBtn = document.getElementById("student-sign-out");
const refreshBtn = document.getElementById("refresh-plan");
const planContainer = document.getElementById("plan-container");
const planMessage = document.getElementById("plan-message");
const planSubtitle = document.getElementById("plan-subtitle");
const progressForm = document.getElementById("progress-form");
const progressFields = document.getElementById("progress-fields");
const progressMessage = document.getElementById("progress-message");

let currentAssignment = null;
let currentPlan = null;
let currentUser = null;

function showPlanMessage(message, isError = false) {
  if (!planMessage) return;
  planMessage.textContent = message;
  planMessage.classList.toggle("error", Boolean(isError));
}

function showProgressMessage(message, isError = false) {
  if (!progressMessage) return;
  progressMessage.textContent = message;
  progressMessage.classList.toggle("error", Boolean(isError));
}

function bindSignOut() {
  if (!signOutBtn) return;
  signOutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

function renderPlan(planSnapshot) {
  if (!planContainer) return;
  planContainer.innerHTML = "";

  if (!planSnapshot || !Array.isArray(planSnapshot.days) || !planSnapshot.days.length) {
    const empty = document.createElement("p");
    empty.className = "tip";
    empty.textContent = "暂未收到老师发布的周计划。";
    planContainer.appendChild(empty);
    return;
  }

  planSnapshot.days.forEach((day, index) => {
    const dayCard = document.createElement("article");
    dayCard.className = "plan-day";

    const title = document.createElement("h3");
    title.textContent = day.title || `第 ${index + 1} 天`;
    dayCard.appendChild(title);

    if (!Array.isArray(day.entries) || !day.entries.length) {
      const tip = document.createElement("p");
      tip.className = "tip";
      tip.textContent = "老师尚未安排该日训练内容";
      dayCard.appendChild(tip);
      planContainer.appendChild(dayCard);
      return;
    }

    day.entries.forEach((entry) => {
      const entrySection = document.createElement("section");
      entrySection.className = "plan-entry";

      const header = document.createElement("header");
      header.className = "plan-entry-header";
      const type = document.createElement("strong");
      type.textContent = entry.typeName || "未指定类型";
      header.appendChild(type);
      if (entry.groupLabel) {
        const label = document.createElement("span");
        label.className = "plan-entry-group";
        label.textContent = entry.groupLabel;
        header.appendChild(label);
      }
      entrySection.appendChild(header);

      const actionList = document.createElement("ul");
      actionList.className = "plan-action-list";

      (entry.actions || []).forEach((action) => {
        const item = document.createElement("li");
        item.className = "plan-action-item";

        const titleEl = document.createElement("h4");
        titleEl.textContent = action.actionName || "动作";
        item.appendChild(titleEl);

        const metrics = action.weekValue || {};
        const metricList = document.createElement("div");
        metricList.className = "plan-metrics";

        [
          { key: "sets", label: "组数" },
          { key: "reps", label: "次数" },
          { key: "weight", label: "重量" },
          { key: "rpe", label: "RPE" },
        ].forEach((metric) => {
          if (!metrics[metric.key]) return;
          const pill = document.createElement("span");
          pill.className = "plan-metric-pill";
          pill.textContent = `${metric.label}: ${metrics[metric.key]}`;
          metricList.appendChild(pill);
        });

        if (metricList.children.length) {
          item.appendChild(metricList);
        }

        item.appendChild(createSetLog(metrics));
        actionList.appendChild(item);
      });

      entrySection.appendChild(actionList);
      dayCard.appendChild(entrySection);
    });

    planContainer.appendChild(dayCard);
  });
}

function createSetLog(metrics) {
  if (!metrics || !Array.isArray(metrics.setLog) || !metrics.setLog.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "tip";
    placeholder.textContent = "未提供每组记录";
    return placeholder;
  }

  const list = document.createElement("ul");
  list.className = "plan-setlog";

  metrics.setLog.forEach((set, index) => {
    const item = document.createElement("li");
    item.textContent = `第 ${index + 1} 组：${set.weight ?? ""}${set.done ? " ✅" : ""}`;
    list.appendChild(item);
  });

  return list;
}

function renderProgressFields(planSnapshot, existingProgress) {
  if (!progressFields) return;
  progressFields.innerHTML = "";

  if (!planSnapshot || !Array.isArray(planSnapshot.days) || !planSnapshot.days.length) {
    const tip = document.createElement("p");
    tip.className = "tip";
    tip.textContent = "没有周计划，无需填写完成情况。";
    progressFields.appendChild(tip);
    return;
  }

  const contentMap = new Map();
  if (existingProgress && Array.isArray(existingProgress.content)) {
    existingProgress.content.forEach((item) => {
      if (Number.isInteger(item.dayIndex)) {
        contentMap.set(item.dayIndex, item.note ?? "");
      }
    });
  }

  planSnapshot.days.forEach((day, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "progress-day";

    const label = document.createElement("label");
    label.htmlFor = `progress-day-${index}`;
    label.textContent = day.title || `第 ${index + 1} 天`;

    const textarea = document.createElement("textarea");
    textarea.id = `progress-day-${index}`;
    textarea.name = `day-${index}`;
    textarea.placeholder = "请填写完成情况或反馈";
    textarea.value = contentMap.get(index) ?? "";

    wrapper.appendChild(label);
    wrapper.appendChild(textarea);
    progressFields.appendChild(wrapper);
  });
}

async function fetchLatestAssignment() {
  showPlanMessage("正在加载周计划…");

  const { data: assignment, error } = await supabase
    .from("weekly_plan_assignments")
    .select("id, plan_id, status, created_at, teacher_id")
    .eq("student_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("加载分配失败", error);
    showPlanMessage("加载周计划失败：" + error.message, true);
    return { assignment: null, plan: null, progress: null };
  }

  if (!assignment) {
    showPlanMessage("老师尚未给你分配周计划。", false);
    return { assignment: null, plan: null, progress: null };
  }

  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("id, week_number, published_at, schedule_snapshot")
    .eq("id", assignment.plan_id)
    .maybeSingle();

  if (planError) {
    console.error("加载周计划详情失败", planError);
    showPlanMessage("加载周计划详情失败：" + planError.message, true);
    return { assignment, plan: null, progress: null };
  }

  const { data: progress, error: progressError } = await supabase
    .from("weekly_progress")
    .select("id, content, updated_at")
    .eq("assignment_id", assignment.id)
    .maybeSingle();

  if (progressError && progressError.code !== "PGRST116") {
    console.error("加载完成情况失败", progressError);
    showPlanMessage("加载完成情况失败：" + progressError.message, true);
    return { assignment, plan, progress: null };
  }

  return { assignment, plan, progress: progress ?? null };
}

async function refreshPlan() {
  const { assignment, plan, progress } = await fetchLatestAssignment();
  currentAssignment = assignment;
  currentPlan = plan;

  if (!plan) {
    renderPlan(null);
    renderProgressFields(null, null);
    return;
  }

  const weekNumber = plan.week_number ?? (plan.schedule_snapshot?.weekIndex ?? 0) + 1;
  const publishedAt = plan.published_at
    ? new Date(plan.published_at).toLocaleString()
    : "";

  if (planSubtitle) {
    planSubtitle.textContent = `第 ${weekNumber} 周 · 发布于 ${publishedAt || "未记录时间"}`;
  }

  renderPlan(plan.schedule_snapshot);
  renderProgressFields(plan.schedule_snapshot, progress);
  showPlanMessage("周计划已加载。", false);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!currentAssignment || !currentPlan) {
    showProgressMessage("当前没有可提交的周计划。", true);
    return;
  }

  const formData = new FormData(progressForm);
  const content = [];

  (currentPlan.schedule_snapshot?.days || []).forEach((day, index) => {
    const note = formData.get(`day-${index}`) ?? "";
    content.push({ dayIndex: index, note: String(note).trim() });
  });

  const payload = {
    assignment_id: currentAssignment.id,
    student_id: currentUser.id,
    content,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("weekly_progress")
    .upsert(payload, { onConflict: "assignment_id" });

  if (error) {
    console.error("提交完成情况失败", error);
    showProgressMessage("提交失败：" + error.message, true);
    return;
  }

  showProgressMessage("完成情况已提交。");
  refreshPlan();
}

async function init() {
  const session = await requireRole(ROLE.student);
  if (!session) return;

  currentUser = session.user;
  bindSignOut();

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshPlan();
    });
  }

  if (progressForm) {
    progressForm.addEventListener("submit", handleSubmit);
  }

  await refreshPlan();
}

init().catch((error) => {
  console.error(error);
  showPlanMessage(error?.message || "初始化失败", true);
});
