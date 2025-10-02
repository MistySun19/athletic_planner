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
let currentPlanWeekNumber = 1;

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

  const progressMap = new Map();
  if (existingProgress && Array.isArray(existingProgress.content)) {
    existingProgress.content.forEach((dayItem) => {
      const dayIndex = dayItem.dayIndex;
      (dayItem.actions || []).forEach((action) => {
        const key = `${dayIndex}|${action.entryId}|${action.actionId}`;
        progressMap.set(key, action);
      });
    });
  }

  planSnapshot.days.forEach((day, dayIndex) => {
    const section = document.createElement("section");
    section.className = "progress-day";

    const dayTitle = document.createElement("h3");
    dayTitle.textContent = day.title || `第 ${dayIndex + 1} 天`;
    section.appendChild(dayTitle);

    if (!Array.isArray(day.entries) || !day.entries.length) {
      const tip = document.createElement("p");
      tip.className = "tip";
      tip.textContent = "该日无需完成，老师未安排训练。";
      section.appendChild(tip);
      progressFields.appendChild(section);
      return;
    }

    day.entries.forEach((entry) => {
      const entryBlock = document.createElement("div");
      entryBlock.className = "progress-entry";

      const entryHeader = document.createElement("header");
      entryHeader.className = "progress-entry-header";
      const entryName = document.createElement("strong");
      entryName.textContent = entry.typeName || "未指定类型";
      entryHeader.appendChild(entryName);
      if (entry.groupLabel) {
        const badge = document.createElement("span");
        badge.textContent = entry.groupLabel;
        badge.className = "progress-entry-group";
        entryHeader.appendChild(badge);
      }
      entryBlock.appendChild(entryHeader);

      (entry.actions || []).forEach((action) => {
        const actionBlock = document.createElement("div");
        actionBlock.className = "progress-action";

        const actionHeader = document.createElement("div");
        actionHeader.className = "progress-action-header";
        const actionName = document.createElement("h4");
        actionName.textContent = action.actionName || "动作";
        actionHeader.appendChild(actionName);

        const metrics = action.weekValue || {};
        const metricInfo = document.createElement("div");
        metricInfo.className = "progress-action-metrics";
        [
          { key: "sets", label: "组数" },
          { key: "reps", label: "次数" },
          { key: "weight", label: "重量" },
        ].forEach((metric) => {
          if (!metrics[metric.key]) return;
          const pill = document.createElement("span");
          pill.textContent = `${metric.label}：${metrics[metric.key]}`;
          metricInfo.appendChild(pill);
        });
        actionHeader.appendChild(metricInfo);
        actionBlock.appendChild(actionHeader);

        const progressKey = `${dayIndex}|${entry.id}|${action.id}`;
        const recorded = progressMap.get(progressKey) || {};

        const rpeWrap = document.createElement("label");
        rpeWrap.className = "progress-rpe";
        rpeWrap.textContent = "实际 RPE";
        const rpeInput = document.createElement("input");
        rpeInput.type = "number";
        rpeInput.min = "0";
        rpeInput.max = "10";
        rpeInput.step = "0.5";
        rpeInput.name = `rpe-${dayIndex}-${entry.id}-${action.id}`;
        rpeInput.value = recorded.rpe ?? metrics.rpe ?? "";
        rpeWrap.appendChild(rpeInput);
        actionBlock.appendChild(rpeWrap);

        const setCount = getSetCount(metrics);
        if (setCount > 0) {
          const setList = document.createElement("div");
          setList.className = "progress-set-list";
          for (let setIndex = 0; setIndex < setCount; setIndex += 1) {
            const setId = `set-${dayIndex}-${entry.id}-${action.id}-${setIndex}`;
            const setItem = document.createElement("label");
            setItem.className = "progress-set-item";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = setId;
            checkbox.checked = Boolean(recorded.sets?.[setIndex]?.done);
            const span = document.createElement("span");
            span.textContent = `第 ${setIndex + 1} 组完成`;
            setItem.appendChild(checkbox);
            setItem.appendChild(span);
            setList.appendChild(setItem);
          }
          actionBlock.appendChild(setList);
        }

        entryBlock.appendChild(actionBlock);
      });

      section.appendChild(entryBlock);
    });

    progressFields.appendChild(section);
  });
}

function getSetCount(metrics) {
  if (!metrics) return 0;
  if (Array.isArray(metrics.setLog) && metrics.setLog.length) {
    return metrics.setLog.length;
  }
  const totalSets = Number.parseInt(metrics.sets, 10);
  return Number.isNaN(totalSets) || totalSets < 0 ? 0 : totalSets;
}

async function fetchLatestPlan() {
  showPlanMessage("正在加载周计划…");

  const { data: plan, error: planError } = await supabase
    .from("weekly_plans")
    .select("id, teacher_id, student_id, week_number, published_at, schedule_snapshot")
    .eq("student_id", currentUser.id)
    .order("week_number", { ascending: false })
    .order("published_at", { ascending: false, nullsLast: true })
    .limit(1)
    .maybeSingle();

  if (planError) {
    console.error("加载周计划失败", planError);
    showPlanMessage("加载周计划失败：" + planError.message, true);
    return { assignment: null, plan: null, progress: null };
  }

  if (!plan) {
    showPlanMessage("老师尚未给你分配周计划。", false);
    return { assignment: null, plan: null, progress: null };
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("weekly_plan_assignments")
    .select("id, status")
    .eq("plan_id", plan.id)
    .eq("student_id", currentUser.id)
    .maybeSingle();

  if (assignmentError && assignmentError.code !== "PGRST116") {
    console.error("加载周计划分发记录失败", assignmentError);
    showPlanMessage("加载周计划失败：" + assignmentError.message, true);
    return { assignment: null, plan, progress: null };
  }

  let progress = null;
  if (assignment?.id) {
    const { data: progressData, error: progressError } = await supabase
      .from("weekly_progress")
      .select("id, content, updated_at")
      .eq("assignment_id", assignment.id)
      .maybeSingle();

    if (progressError && progressError.code !== "PGRST116") {
      console.error("加载完成情况失败", progressError);
      showPlanMessage("加载完成情况失败：" + progressError.message, true);
    } else {
      progress = progressData ?? null;
    }
  }

  return { assignment: assignment ?? null, plan, progress };
}

async function refreshPlan() {
  const { assignment, plan, progress } = await fetchLatestPlan();
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

  currentPlanWeekNumber = weekNumber;

  if (planSubtitle) {
    planSubtitle.textContent = `第 ${weekNumber} 周 · 发布于 ${publishedAt || "未记录时间"}`;
  }

  renderPlan(plan.schedule_snapshot);
  renderProgressFields(plan.schedule_snapshot, progress);
  showPlanMessage("周计划已加载。", false);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!currentPlan) {
    showProgressMessage("当前没有可提交的周计划。", true);
    return;
  }

  if (!currentAssignment?.id) {
    showProgressMessage("尚未收到老师发布的周计划，无法提交。", true);
    return;
  }

  const formData = new FormData(progressForm);
  const content = [];

  (currentPlan.schedule_snapshot?.days || []).forEach((day, dayIndex) => {
    const actions = [];
    (day.entries || []).forEach((entry) => {
      (entry.actions || []).forEach((action) => {
        const rpeName = `rpe-${dayIndex}-${entry.id}-${action.id}`;
        const rpeValue = formData.get(rpeName);
        const metrics = action.weekValue || {};
        const setCount = getSetCount(metrics);
        const sets = [];
        for (let setIndex = 0; setIndex < setCount; setIndex += 1) {
          const setName = `set-${dayIndex}-${entry.id}-${action.id}-${setIndex}`;
          sets.push({ index: setIndex, done: formData.has(setName) });
        }
        actions.push({
          entryId: entry.id,
          actionId: action.id,
          rpe: rpeValue == null ? "" : String(rpeValue).trim(),
          sets,
        });
      });
    });
    content.push({ dayIndex, actions });
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
