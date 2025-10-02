import { clearElement } from "./helpers.js";

export function initGeneralPlanner({
  state,
  elements,
  metrics,
  createWeekValues,
  ensureScheduleStructure,
  syncWeekValues,
  persistSchedule,
  generateId,
  onScheduleChange = () => {},
}) {
  const {
    weekInput,
    dayInput,
    setWeeksBtn,
    addWeekBtn,
    setDaysBtn,
    addDayBtn,
    daysContainer,
  } = elements;

  if (!daysContainer) {
    throw new Error("未找到 daysContainer 元素");
  }

  let activeForm = null;
  const extraColumnsPerWeek = 1;

  function closeActiveForm() {
    if (activeForm && activeForm.parentElement) {
      activeForm.parentElement.removeChild(activeForm);
    }
    activeForm = null;
  }

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

  function notifyChange({ rerender = false } = {}) {
    persistSchedule();
    onScheduleChange();
    if (rerender) render();
  }

  function findType(typeId) {
    if (!typeId) return null;
    return state.database.types.find((type) => type.id === typeId) || null;
  }

  function findAction(type, actionId) {
    if (!type || !actionId) return null;
    return type.actions.find((action) => action.id === actionId) || null;
  }

  function handleMetricInput(event) {
    const input = event.target;
    if (!input || !input.dataset) return;

    const dayIndex = Number.parseInt(input.dataset.dayIndex, 10);
    const entryId = input.dataset.entryId;
    const actionId = input.dataset.actionId;
    const weekIndex = Number.parseInt(input.dataset.weekIndex, 10);
    const metric = input.dataset.metric;

    if (Number.isNaN(dayIndex) || Number.isNaN(weekIndex) || !metric) return;
    if (!entryId || !actionId) return;

    const { action, weekValue } = resolveWeekContext(dayIndex, entryId, actionId, weekIndex);
    if (!action || !weekValue) return;

    weekValue[metric] = input.value;
    const requiresRerender = metric === "sets" || metric === "weight";
    if (requiresRerender) {
      ensureSetLogLength(weekValue);
    }
    notifyChange({ rerender: requiresRerender });
  }

  function handleSetLogToggle(event) {
    const checkbox = event.target;
    if (!(checkbox instanceof HTMLInputElement)) return;
    const dayIndex = Number.parseInt(checkbox.dataset.dayIndex, 10);
    const weekIndex = Number.parseInt(checkbox.dataset.weekIndex, 10);
    const setIndex = Number.parseInt(checkbox.dataset.setIndex, 10);
    const entryId = checkbox.dataset.entryId;
    const actionId = checkbox.dataset.actionId;
    if ([dayIndex, weekIndex, setIndex].some(Number.isNaN) || !entryId || !actionId) return;

    const { weekValue } = resolveWeekContext(dayIndex, entryId, actionId, weekIndex);
    if (!weekValue || !Array.isArray(weekValue.setLog) || !weekValue.setLog[setIndex]) return;
    weekValue.setLog[setIndex].done = checkbox.checked;
    notifyChange();
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
    notifyChange();
  }

  function openEntryForm(dayIndex, entry) {
    if (!state.database.types.length) {
      window.alert("请先在数据库页新增训练类型");
      return;
    }

    closeActiveForm();

    const schedule = state.schedule;
    const daySection = daysContainer.querySelector(`[data-day-index="${dayIndex}"]`);
    if (!daySection) return;

    const slot = daySection.querySelector(".day-form-slot");
    if (!slot) return;

    const form = document.createElement("div");
    form.className = "entry-form-panel";

    const title = document.createElement("h3");
    title.textContent = entry ? "编辑训练条目" : "新增训练条目";
    form.appendChild(title);

    const typeField = document.createElement("div");
    typeField.className = "field";
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "训练类型";
    typeField.appendChild(typeLabel);

    const typeSelect = document.createElement("select");
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "请选择训练类型";
    typeSelect.appendChild(defaultOption);

    state.database.types.forEach((type) => {
      const option = document.createElement("option");
      option.value = type.id;
      option.textContent = type.name;
      typeSelect.appendChild(option);
    });

    const initialTypeId = entry ? entry.typeId : "";
    const selectedType = findType(initialTypeId);
    if (selectedType) {
      typeSelect.value = selectedType.id;
    }

    typeField.appendChild(typeSelect);
    form.appendChild(typeField);

    const groupField = document.createElement("div");
    groupField.className = "field";
    const groupLabel = document.createElement("label");
    groupLabel.textContent = "组别（可选）";
    groupField.appendChild(groupLabel);

    const groupInput = document.createElement("input");
    groupInput.type = "text";
    groupInput.placeholder = "例如：A";
    groupInput.value = entry ? entry.groupLabel : "";
    groupField.appendChild(groupInput);
    form.appendChild(groupField);

    const actionsField = document.createElement("div");
    actionsField.className = "field";
    const actionsLabel = document.createElement("label");
    actionsLabel.textContent = "训练动作";
    actionsField.appendChild(actionsLabel);

    const actionPicker = document.createElement("div");
    actionPicker.className = "action-picker";
    actionsField.appendChild(actionPicker);
    form.appendChild(actionsField);

    let selectedTypeRef = selectedType || null;
    let selectedIds = [];
    const storedNames = {};

    if (entry && Array.isArray(entry.actions)) {
      entry.actions.forEach((action) => {
        if (!action || !action.actionId) return;
        if (!selectedIds.includes(action.actionId)) {
          selectedIds.push(action.actionId);
        }
        storedNames[action.actionId] = action.actionName;
      });
    }

    renderActionPicker();

    typeSelect.addEventListener("change", () => {
      selectedTypeRef = findType(typeSelect.value);
      if (!selectedTypeRef) {
        selectedIds = [];
        renderActionPicker();
        return;
      }
      const available = new Set(selectedTypeRef.actions.map((action) => action.id));
      selectedIds = selectedIds.filter((id) => available.has(id));
      renderActionPicker();
    });

    const buttonRow = document.createElement("div");
    buttonRow.className = "button-row";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = entry ? "保存" : "添加";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => {
      closeActiveForm();
    });

    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(cancelBtn);
    form.appendChild(buttonRow);

    saveBtn.addEventListener("click", () => {
      const typeId = typeSelect.value;
      if (!typeId) {
        window.alert("请先选择训练类型");
        return;
      }
      if (!selectedIds.length) {
        window.alert("请至少选择一个动作");
        return;
      }

      const day = schedule.dayData[dayIndex];
      if (!day) return;

      const type = findType(typeId);
      const existingMap = new Map();
      if (entry && Array.isArray(entry.actions)) {
        entry.actions.forEach((action) => {
          if (action && action.actionId) {
            existingMap.set(action.actionId, action);
          }
        });
      }

      const nextActions = selectedIds.map((actionId) => {
        const definition = findAction(type, actionId);
        const existing = existingMap.get(actionId);
        if (existing) {
          existing.actionName = definition ? definition.name : existing.actionName;
          if (!Array.isArray(existing.weekValues)) {
            existing.weekValues = createWeekValues(state.schedule.weeks);
          }
          return existing;
        }
        return {
          id: generateId("entryAction"),
          actionId,
          actionName: definition ? definition.name : storedNames[actionId] || "",
          weekValues: createWeekValues(state.schedule.weeks),
        };
      });

      if (entry) {
        entry.typeId = typeId;
        entry.typeName = type ? type.name : entry.typeName;
        entry.groupLabel = groupInput.value.trim();
        entry.actions = nextActions;
      } else {
        day.entries.push({
          id: generateId("entry"),
          typeId,
          typeName: type ? type.name : "",
          groupLabel: groupInput.value.trim(),
          actions: nextActions,
        });
      }

      notifyChange({ rerender: false });
      closeActiveForm();
      render();
    });

    slot.appendChild(form);
    activeForm = form;
    typeSelect.focus();

    function renderActionPicker() {
      clearElement(actionPicker);

      if (!selectedTypeRef) {
        const tip = document.createElement("p");
        tip.className = "tip";
        tip.textContent = "请选择训练类型以加载动作";
        actionPicker.appendChild(tip);
        return;
      }

      if (!selectedTypeRef.actions.length) {
        const tip = document.createElement("p");
        tip.className = "tip";
        tip.textContent = "该类型暂无动作，请先在数据库页添加";
        actionPicker.appendChild(tip);
        return;
      }

      selectedTypeRef.actions.forEach((action) => {
        const label = document.createElement("label");
        label.className = "action-chip";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = action.id;
        checkbox.checked = selectedIds.includes(action.id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            if (!selectedIds.includes(action.id)) {
              selectedIds.push(action.id);
            }
          } else {
            selectedIds = selectedIds.filter((id) => id !== action.id);
          }
        });

        const span = document.createElement("span");
        span.textContent = action.name;

        label.appendChild(checkbox);
        label.appendChild(span);
        actionPicker.appendChild(label);
      });
    }
  }

  function render() {
    closeActiveForm();

    const schedule = state.schedule;
    let changed = false;
    if (ensureScheduleStructure(schedule)) changed = true;
    if (syncWeekValues(schedule)) changed = true;

    const fragment = document.createDocumentFragment();

    schedule.dayData.forEach((day, dayIndex) => {
      const section = document.createElement("section");
      section.className = "day-block";
      section.dataset.dayIndex = String(dayIndex);

      const toolbar = document.createElement("div");
      toolbar.className = "day-toolbar";

      const title = document.createElement("h2");
      title.textContent = day.title;
      toolbar.appendChild(title);

      const actions = document.createElement("div");
      actions.className = "day-toolbar-actions";

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "添加条目";
      addBtn.addEventListener("click", () => {
        openEntryForm(dayIndex, null);
      });

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.textContent = "重命名训练日";
      renameBtn.addEventListener("click", () => {
        const current = schedule.dayData[dayIndex];
        if (!current) return;
        const next = window.prompt("请输入新的训练日名称", current.title);
        if (next && next.trim().length > 0) {
          current.title = next.trim();
          notifyChange({ rerender: true });
        }
      });

      actions.appendChild(addBtn);
      actions.appendChild(renameBtn);
      toolbar.appendChild(actions);
      section.appendChild(toolbar);

      const formSlot = document.createElement("div");
      formSlot.className = "day-form-slot";
      section.appendChild(formSlot);

      const tableWrapper = document.createElement("div");
      tableWrapper.className = "sheet-table-wrapper";

      const table = document.createElement("table");
      table.className = "sheet-table";

      const thead = document.createElement("thead");
      const dayRow = document.createElement("tr");
      const dayCell = document.createElement("th");
      dayCell.className = "day-heading-cell";
      dayCell.colSpan = 3 + (metrics.length + extraColumnsPerWeek) * schedule.weeks;
      dayCell.textContent = day.title;
      dayRow.appendChild(dayCell);
      thead.appendChild(dayRow);

      const headerRow = document.createElement("tr");
      const typeHeader = document.createElement("th");
      typeHeader.textContent = "训练类型";
      headerRow.appendChild(typeHeader);
      const groupHeader = document.createElement("th");
      groupHeader.textContent = "组别";
      headerRow.appendChild(groupHeader);
      const actionHeader = document.createElement("th");
      actionHeader.textContent = "训练动作";
      headerRow.appendChild(actionHeader);

      const columnsPerWeek = metrics.length + extraColumnsPerWeek;
      for (let weekIndex = 0; weekIndex < schedule.weeks; weekIndex += 1) {
        const weekHeader = document.createElement("th");
        weekHeader.className = "week-heading";
        weekHeader.colSpan = columnsPerWeek;
        weekHeader.textContent = `第${weekIndex + 1}周`;
        headerRow.appendChild(weekHeader);
      }

      thead.appendChild(headerRow);

      if (schedule.weeks > 0) {
        const subRow = document.createElement("tr");
        subRow.className = "metrics-row";
        subRow.appendChild(document.createElement("th"));
        subRow.appendChild(document.createElement("th"));
        subRow.appendChild(document.createElement("th"));
        for (let s = 0; s < schedule.weeks; s += 1) {
          metrics.forEach((metric) => {
            const metricTh = document.createElement("th");
            metricTh.textContent = metric.label;
            subRow.appendChild(metricTh);
          });
          const logTh = document.createElement("th");
          logTh.textContent = "完成情况";
          subRow.appendChild(logTh);
        }
        thead.appendChild(subRow);
      }

      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      if (!Array.isArray(day.entries) || day.entries.length === 0) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 3 + (metrics.length + extraColumnsPerWeek) * schedule.weeks;
        emptyCell.className = "empty-cell";
        emptyCell.textContent = "暂未添加训练条目";
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
      } else {
        day.entries.forEach((entry) => {
          const type = findType(entry.typeId);
          if (type && entry.typeName !== type.name) {
            entry.typeName = type.name;
            changed = true;
          }

          const actionsList = Array.isArray(entry.actions) && entry.actions.length ? entry.actions : [];
          const displayActions = actionsList.length ? actionsList : [{ placeholder: true, weekValues: createWeekValues(schedule.weeks) }];

          displayActions.forEach((action, actionIndex) => {
            const row = document.createElement("tr");

            if (actionIndex === 0) {
              const typeCell = document.createElement("td");
              typeCell.className = "type-cell";
              typeCell.rowSpan = displayActions.length;
              typeCell.textContent = entry.typeName || "类型已删除";
              if (!type) {
                typeCell.classList.add("missing");
              }

              const controlRow = document.createElement("div");
              controlRow.className = "entry-controls";

              const editBtn = document.createElement("button");
              editBtn.type = "button";
              editBtn.textContent = "编辑";
              editBtn.addEventListener("click", () => {
                openEntryForm(dayIndex, entry);
              });

              const deleteBtn = document.createElement("button");
              deleteBtn.type = "button";
              deleteBtn.textContent = "删除";
              deleteBtn.className = "danger";
              deleteBtn.addEventListener("click", () => {
                if (!window.confirm("确定删除该训练条目吗？")) return;
                const currentDay = schedule.dayData[dayIndex];
                if (!currentDay) return;
                currentDay.entries = currentDay.entries.filter((item) => item.id !== entry.id);
                notifyChange({ rerender: true });
              });

              controlRow.appendChild(editBtn);
              controlRow.appendChild(deleteBtn);
              typeCell.appendChild(controlRow);
              row.appendChild(typeCell);

              const groupCell = document.createElement("td");
              groupCell.className = "group-cell";
              groupCell.rowSpan = displayActions.length;
              groupCell.textContent = entry.groupLabel || "-";
              row.appendChild(groupCell);
            }

            const actionCell = document.createElement("td");
            actionCell.className = "action-cell";
            const actionType = type || findType(entry.typeId);
            const actionDef = action.placeholder ? null : findAction(actionType, action.actionId);
            if (actionDef && action.actionName !== actionDef.name) {
              action.actionName = actionDef.name;
              changed = true;
            }

            if (action.placeholder) {
              actionCell.textContent = "请编辑条目以选择动作";
              actionCell.classList.add("muted");
            } else {
              actionCell.textContent = action.actionName || (actionDef ? actionDef.name : "动作已删除");
              if (!actionDef && action.actionName) {
                actionCell.classList.add("missing");
              }
            }

            row.appendChild(actionCell);

            for (let weekIndex = 0; weekIndex < schedule.weeks; weekIndex += 1) {
              const existing = action.weekValues ? action.weekValues[weekIndex] : null;
              let weekValue = existing;
              if (!weekValue) {
                weekValue = action.placeholder
                  ? createWeekValues(1)[0]
                  : (action.weekValues[weekIndex] = createWeekValues(1)[0]);
              }
              normalizeWeekValue(weekValue);
              ensureSetLogLength(weekValue);

              metrics.forEach((metric) => {
                const cell = document.createElement("td");
                cell.className = "value-cell";

                if (action.placeholder) {
                  cell.textContent = "—";
                  cell.classList.add("muted");
                } else {
                  const value = weekValue[metric.key] ?? "";
                  const input = document.createElement("input");
                  input.type = "text";
                  input.value = value;
                  input.className = "value-input";
                  input.dataset.dayIndex = String(dayIndex);
                  input.dataset.entryId = entry.id;
                  input.dataset.actionId = action.id;
                  input.dataset.weekIndex = String(weekIndex);
                  input.dataset.metric = metric.key;
                  input.addEventListener("input", handleMetricInput);
                  cell.appendChild(input);

                  if (metric.key === "rpe" && weekValue.studentProgress?.rpe) {
                    const badge = document.createElement("span");
                    badge.className = "student-rpe-badge";
                    badge.textContent = `学生 RPE：${weekValue.studentProgress.rpe}`;
                    cell.appendChild(badge);
                  }
                }

                row.appendChild(cell);
              });

              const logCell = document.createElement("td");
              logCell.className = "set-log-cell";

              if (action.placeholder) {
                logCell.textContent = "—";
                logCell.classList.add("muted");
              } else {
                if (!weekValue.setLog.length) {
                  logCell.textContent = "—";
                  logCell.classList.add("muted");
                } else {
                  const list = document.createElement("div");
                  list.className = "set-log-list";
                  weekValue.setLog.forEach((setEntry, setIndex) => {
                    const setRow = document.createElement("div");
                    setRow.className = "set-log-row";

                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = Boolean(setEntry.done);
                    checkbox.dataset.dayIndex = String(dayIndex);
                    checkbox.dataset.entryId = entry.id;
                    checkbox.dataset.actionId = action.id;
                    checkbox.dataset.weekIndex = String(weekIndex);
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
                    weightInput.dataset.weekIndex = String(weekIndex);
                    weightInput.dataset.setIndex = String(setIndex);
                    weightInput.addEventListener("input", handleSetLogWeight);

                    setRow.appendChild(checkbox);
                    setRow.appendChild(label);
                    setRow.appendChild(weightInput);
                    list.appendChild(setRow);
                  });
                  logCell.appendChild(list);
                }

                const progress = weekValue.studentProgress;
                if (progress) {
                  const summary = document.createElement("div");
                  summary.className = "set-log-summary";
                  if (progress.rpe) {
                    const badge = document.createElement("span");
                    badge.className = "set-log-summary-rpe";
                    badge.textContent = `学生 RPE：${progress.rpe}`;
                    summary.appendChild(badge);
                  }
                  if (Array.isArray(progress.sets) && progress.sets.length) {
                    const summaryList = document.createElement("ul");
                    summaryList.className = "set-log-summary-sets";
                    progress.sets.forEach((done, idx) => {
                      const item = document.createElement("li");
                      item.textContent = `第${idx + 1}组：${done ? "已完成" : "未完成"}`;
                      item.classList.toggle("done", Boolean(done));
                      summaryList.appendChild(item);
                    });
                    summary.appendChild(summaryList);
                  }
                  logCell.appendChild(summary);
                }
              }
              row.appendChild(logCell);
            }

            tbody.appendChild(row);
          });
        });
      }

      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);
      fragment.appendChild(section);
    });

    clearElement(daysContainer);
    daysContainer.appendChild(fragment);

    if (changed) {
      notifyChange();
    }
  }

  function applyWeekCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      window.alert("周数至少为 1");
      return;
    }
    state.schedule.weeks = parsed;
    if (weekInput) weekInput.value = String(parsed);
    notifyChange({ rerender: true });
  }

  function applyDayCount(value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      window.alert("天数至少为 1");
      return;
    }
    state.schedule.days = parsed;
    if (dayInput) dayInput.value = String(parsed);
    notifyChange({ rerender: true });
  }

  if (setWeeksBtn) setWeeksBtn.addEventListener("click", () => applyWeekCount(weekInput.value));
  if (setDaysBtn) setDaysBtn.addEventListener("click", () => applyDayCount(dayInput.value));
  if (addWeekBtn) addWeekBtn.addEventListener("click", () => applyWeekCount(state.schedule.weeks + 1));
  if (addDayBtn) addDayBtn.addEventListener("click", () => applyDayCount(state.schedule.days + 1));

  if (weekInput) {
    weekInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyWeekCount(weekInput.value);
      }
    });
  }

  if (dayInput) {
    dayInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyDayCount(dayInput.value);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeActiveForm();
    }
  });

  return {
    render,
    closeActiveForm,
    applyWeekCount,
    applyDayCount,
  };
}
