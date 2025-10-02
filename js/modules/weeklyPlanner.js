import { clearElement } from "./helpers.js";

export function initWeeklyPlanner({
  state,
  elements,
  metrics,
  createWeekValues,
  persistSchedule,
  onScheduleChange = () => {},
  onWeekChange = () => {},
  actions = {},
}) {
  const {
    weekInput,
    prevBtn,
    nextBtn,
    container,
    bindCodeInput,
    bindNameInput,
    bindButton,
    studentListEl,
    syncButton,
  } = elements;

  const {
    bindStudentByEmail = async () => ({ success: false, message: "未实现" }),
    removeStudent = async () => ({ success: false, message: "未实现" }),
    syncWeek = async () => ({ success: false, message: "未实现" }),
  } = actions;

  if (!container) {
    return { render: () => {}, setWeek: () => {} };
  }

  let selectedWeek = 0;
  const selectedStudentIds = new Set();

  function renderStudents() {}

  function normalizeWeekValue(weekValue) {
    if (!weekValue || typeof weekValue !== "object") return;
    if (typeof weekValue.sets !== "string") weekValue.sets = weekValue.sets == null ? "" : String(weekValue.sets);
    if (typeof weekValue.reps !== "string") weekValue.reps = weekValue.reps == null ? "" : String(weekValue.reps);
    if (typeof weekValue.weight !== "string") weekValue.weight = weekValue.weight == null ? "" : String(weekValue.weight);
    if (typeof weekValue.rpe !== "string") weekValue.rpe = weekValue.rpe == null ? "" : String(weekValue.rpe);
    if (!Array.isArray(weekValue.setLog)) weekValue.setLog = [];
  }

  function ensureSetLogLength(weekValue) {
    normalizeWeekValue(weekValue);
    const totalSets = Number.parseInt(weekValue.sets, 10);
    if (Number.isNaN(totalSets) || totalSets <= 0) {
      weekValue.setLog = [];
      return;
    }
    const defaultWeight = weekValue.weight || "";
    while (weekValue.setLog.length < totalSets) {
      weekValue.setLog.push({ done: false, weight: defaultWeight });
    }
    if (weekValue.setLog.length > totalSets) {
      weekValue.setLog.length = totalSets;
    }
    weekValue.setLog.forEach((set) => {
      if (typeof set.done !== "boolean") set.done = Boolean(set.done);
      if (typeof set.weight !== "string") {
        set.weight = set.weight == null ? "" : String(set.weight);
      }
      if (!set.weight && defaultWeight) set.weight = defaultWeight;
    });
  }

  function resolveWeekContext(dayIndex, entryId, actionId, weekIndex) {
    const schedule = state.schedule;
    const day = schedule.dayData[dayIndex];
    if (!day) return {};
    const entry = day.entries.find((item) => item.id === entryId);
    if (!entry) return {};
    const action = entry.actions.find((item) => item.id === actionId);
    if (!action) return {};
    let weekValue = action.weekValues[weekIndex];
    if (!weekValue) {
      weekValue = action.weekValues[weekIndex] = createWeekValues(1)[0];
    }
    normalizeWeekValue(weekValue);
    return { day, entry, action, weekValue };
  }

  function clampWeek(index) {
    const schedule = state.schedule;
    const maxWeeks = Math.max(1, schedule.weeks || 1);
    if (index < 0) return 0;
    if (index >= maxWeeks) return maxWeeks - 1;
    return index;
  }

  function setWeek(index) {
    selectedWeek = clampWeek(index);
    if (weekInput) {
      weekInput.value = String(selectedWeek + 1);
      weekInput.min = "1";
      weekInput.max = String(Math.max(1, state.schedule.weeks || 1));
    }
    const maybePromise = onWeekChange(selectedWeek);
    if (maybePromise && typeof maybePromise.then === "function") {
      maybePromise.then(() => {
        render();
      });
    } else {
      render();
    }
  }

  function notifyChange(shouldRerender = false) {
    persistSchedule();
    onScheduleChange();
    if (shouldRerender) render();
  }

  function handleMetricInput(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.dataset) return;

    const dayIndex = Number.parseInt(input.dataset.dayIndex, 10);
    const weekIndex = Number.parseInt(input.dataset.weekIndex, 10);
    const entryId = input.dataset.entryId;
    const actionId = input.dataset.actionId;
    const metric = input.dataset.metric;

    if ([dayIndex, weekIndex].some(Number.isNaN) || !entryId || !actionId || !metric) return;

    const { weekValue } = resolveWeekContext(dayIndex, entryId, actionId, weekIndex);
    if (!weekValue) return;

    weekValue[metric] = input.value;
    if (metric === "sets" || metric === "weight") {
      ensureSetLogLength(weekValue);
      notifyChange(true);
    } else {
      notifyChange(false);
    }
  }

  function handleSetLogToggle(event) {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement)) return;
    if (checkbox.type !== "checkbox") return;

    const dayIndex = Number.parseInt(checkbox.dataset.dayIndex, 10);
    const weekIndex = Number.parseInt(checkbox.dataset.weekIndex, 10);
    const setIndex = Number.parseInt(checkbox.dataset.setIndex, 10);
    const entryId = checkbox.dataset.entryId;
    const actionId = checkbox.dataset.actionId;

    if ([dayIndex, weekIndex, setIndex].some(Number.isNaN) || !entryId || !actionId) return;

    const { weekValue } = resolveWeekContext(dayIndex, entryId, actionId, weekIndex);
    if (!weekValue || !Array.isArray(weekValue.setLog) || !weekValue.setLog[setIndex]) return;

    weekValue.setLog[setIndex].done = checkbox.checked;
    notifyChange(false);
  }

  function handleSetLogWeight(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const dayIndex = Number.parseInt(input.dataset.dayIndex, 10);
    const weekIndex = Number.parseInt(input.dataset.weekIndex, 10);
    const setIndex = Number.parseInt(input.dataset.setIndex, 10);
    const entryId = input.dataset.entryId;
    const actionId = input.dataset.actionId;

    if ([dayIndex, weekIndex, setIndex].some(Number.isNaN) || !entryId || !actionId) return;

    const { weekValue } = resolveWeekContext(dayIndex, entryId, actionId, weekIndex);
    if (!weekValue || !Array.isArray(weekValue.setLog) || !weekValue.setLog[setIndex]) return;
    weekValue.setLog[setIndex].weight = input.value;
    notifyChange(false);
  }

  function render() {
    const schedule = state.schedule;
    const maxWeeks = Math.max(1, schedule.weeks || 1);
    selectedWeek = clampWeek(selectedWeek);

    if (weekInput) {
      weekInput.min = "1";
      weekInput.max = String(maxWeeks);
      weekInput.value = String(selectedWeek + 1);
    }

    clearElement(container);

    if (!schedule.dayData || !schedule.dayData.length) {
      const empty = document.createElement("p");
      empty.className = "tip";
      empty.textContent = "尚未创建训练日";
      container.appendChild(empty);
      return;
    }

    schedule.dayData.forEach((day, dayIndex) => {
      const dayCard = document.createElement("article");
      dayCard.className = "weekly-day";

      const title = document.createElement("h3");
      title.textContent = day.title;
      dayCard.appendChild(title);

      if (!day.entries || !day.entries.length) {
        const emptyEntry = document.createElement("p");
        emptyEntry.className = "tip";
        emptyEntry.textContent = "该训练日暂无条目";
        dayCard.appendChild(emptyEntry);
        container.appendChild(dayCard);
        return;
      }

      const entryList = document.createElement("div");
      entryList.className = "weekly-actions";

      day.entries.forEach((entry) => {
        const entryCard = document.createElement("section");
        entryCard.className = "weekly-entry";

        const header = document.createElement("header");
        const titleWrap = document.createElement("div");
        titleWrap.className = "entry-title";
        const typeLine = document.createElement("strong");
        typeLine.textContent = entry.typeName || "类型已删除";
        titleWrap.appendChild(typeLine);
        if (entry.groupLabel) {
          const groupLine = document.createElement("span");
          groupLine.textContent = `组别：${entry.groupLabel}`;
          titleWrap.appendChild(groupLine);
        }
        header.appendChild(titleWrap);
        entryCard.appendChild(header);

        if (!entry.actions || !entry.actions.length) {
          const tip = document.createElement("p");
          tip.className = "tip";
          tip.textContent = "请在中周期页签中为该条目添加动作";
          entryCard.appendChild(tip);
          entryList.appendChild(entryCard);
          return;
        }

        entry.actions.forEach((action) => {
          const actionBlock = document.createElement("div");
          actionBlock.className = "weekly-action";
          const name = document.createElement("h4");
          name.textContent = action.actionName || "动作已删除";
          actionBlock.appendChild(name);

          const weekValue = (action.weekValues && action.weekValues[selectedWeek]) || createWeekValues(1)[0];
          if (!action.weekValues[selectedWeek]) {
            action.weekValues[selectedWeek] = weekValue;
          }
          normalizeWeekValue(weekValue);
          ensureSetLogLength(weekValue);

          const metricGrid = document.createElement("div");
          metricGrid.className = "weekly-metrics";
          metrics.forEach((metric) => {
            const label = document.createElement("label");
            label.textContent = metric.label;
            const input = document.createElement("input");
            input.type = "text";
            input.value = weekValue[metric.key] ?? "";
            input.dataset.dayIndex = String(dayIndex);
            input.dataset.entryId = entry.id;
            input.dataset.actionId = action.id;
            input.dataset.weekIndex = String(selectedWeek);
            input.dataset.metric = metric.key;
            input.addEventListener("input", handleMetricInput);
            label.appendChild(input);
            metricGrid.appendChild(label);
          });
          actionBlock.appendChild(metricGrid);

          const progressInfo = document.createElement("div");
          progressInfo.className = "weekly-student-progress";
          const studentProgress = weekValue.studentProgress;
          if (studentProgress && (studentProgress.rpe || (studentProgress.sets && studentProgress.sets.length))) {
            const headerLine = document.createElement("div");
            headerLine.className = "progress-summary-header";
            const title = document.createElement("strong");
            title.textContent = "学生反馈";
            headerLine.appendChild(title);
            if (studentProgress.rpe) {
              const rpeTag = document.createElement("span");
              rpeTag.className = "progress-summary-rpe";
              rpeTag.textContent = `RPE：${studentProgress.rpe}`;
              headerLine.appendChild(rpeTag);
            }
            progressInfo.appendChild(headerLine);

            if (Array.isArray(studentProgress.sets) && studentProgress.sets.length) {
              const setList = document.createElement("ul");
              setList.className = "progress-summary-sets";
              studentProgress.sets.forEach((done, idx) => {
                const item = document.createElement("li");
                item.textContent = `第 ${idx + 1} 组：${done ? "已完成" : "未完成"}`;
                item.classList.toggle("done", Boolean(done));
                setList.appendChild(item);
              });
              progressInfo.appendChild(setList);
            }
          } else {
            const empty = document.createElement("p");
            empty.className = "tip";
            empty.textContent = "学生尚未提交完成情况。";
            progressInfo.appendChild(empty);
          }
          actionBlock.appendChild(progressInfo);

          const setLogWrapper = document.createElement("div");
          setLogWrapper.className = "weekly-set-log";
          if (!weekValue.setLog.length) {
            const empty = document.createElement("p");
            empty.className = "tip";
            empty.textContent = "请先填写组数以生成完成记录";
            setLogWrapper.appendChild(empty);
          } else {
            weekValue.setLog.forEach((setEntry, setIndex) => {
              const row = document.createElement("div");
              row.className = "set-log-row";

              const checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.checked = Boolean(setEntry.done);
              checkbox.dataset.dayIndex = String(dayIndex);
              checkbox.dataset.entryId = entry.id;
              checkbox.dataset.actionId = action.id;
              checkbox.dataset.weekIndex = String(selectedWeek);
              checkbox.dataset.setIndex = String(setIndex);
              checkbox.addEventListener("change", handleSetLogToggle);

              const label = document.createElement("span");
              label.textContent = `第${setIndex + 1}组`;

              const weightInput = document.createElement("input");
              weightInput.type = "text";
              weightInput.value = setEntry.weight ?? "";
              weightInput.dataset.dayIndex = String(dayIndex);
              weightInput.dataset.entryId = entry.id;
              weightInput.dataset.actionId = action.id;
              weightInput.dataset.weekIndex = String(selectedWeek);
              weightInput.dataset.setIndex = String(setIndex);
              weightInput.addEventListener("input", handleSetLogWeight);

              row.appendChild(checkbox);
              row.appendChild(label);
              row.appendChild(weightInput);
              setLogWrapper.appendChild(row);
            });
          }
          actionBlock.appendChild(setLogWrapper);
          entryCard.appendChild(actionBlock);
        });

        entryList.appendChild(entryCard);
      });

      dayCard.appendChild(entryList);
      container.appendChild(dayCard);
    });
  }

  if (weekInput) {
    weekInput.addEventListener("change", () => {
      const value = Number.parseInt(weekInput.value, 10);
      if (Number.isNaN(value)) return;
      setWeek(value - 1);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      setWeek(selectedWeek - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      setWeek(selectedWeek + 1);
    });
  }

  return {
    render,
    setWeek,
    getSelectedWeek: () => selectedWeek,
  };
}
