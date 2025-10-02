import { clearElement } from "./helpers.js";
import { createDefaultMesocycle, createDefaultMacrocycle } from "./state.js";

export function initMacroPlanner({
  state,
  elements,
  constants,
  helpers,
  ensureMacroPlanStructure,
  persistSchedule,
}) {
  const {
    macroStartInput,
    macroNameInput,
    macroNotesInput,
    macrocycleListEl,
    addMacrocycleBtn,
    mesocycleListEl,
    addMesocycleBtn,
    macroTimelineEl,
    workloadPerformanceInput,
    workloadLoadPlusInput,
    workloadLoadInput,
    workloadBaseInput,
    workloadDeloadInput,
  } = elements;

  const { TOTAL_WEEKS, DAYS, MONTH_NAMES, PHASE_OPTIONS, FOCUS_CATEGORIES } = constants;
  const { parseISODate, getISOWeekNumber, moveArrayItem, removeArrayItem } = helpers;

  function render() {
    ensureMacroPlanStructure(state.schedule);
    const plan = state.schedule.macroPlan;

    if (macroStartInput) macroStartInput.value = plan.startingDate;
    if (macroNameInput) macroNameInput.value = plan.macrocycleName;
    if (macroNotesInput) macroNotesInput.value = plan.notes;

    renderMacrocycleList(plan);
    renderMesocycleList(plan);
    renderTimeline(plan);
    renderWorkload(plan);
  }

  function renderMacrocycleList(plan) {
    if (!macrocycleListEl) return;
    clearElement(macrocycleListEl);

    plan.macrocycles.forEach((macro, index) => {
      const item = document.createElement("div");
      item.className = "mesocycle-item";
      item.dataset.macroId = macro.id;

      const nameLabel = document.createElement("label");
      nameLabel.textContent = "名称";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = macro.name;
      nameInput.dataset.macroId = macro.id;
      nameInput.dataset.field = "name";
      nameLabel.appendChild(nameInput);

      const weekLabel = document.createElement("label");
      weekLabel.textContent = "长度 (周)";
      const weekInput = document.createElement("input");
      weekInput.type = "number";
      weekInput.min = "1";
      weekInput.value = macro.weeks;
      weekInput.dataset.macroId = macro.id;
      weekInput.dataset.field = "weeks";
      weekLabel.appendChild(weekInput);

      const orderLabel = document.createElement("label");
      orderLabel.textContent = "顺序";
      const orderInput = document.createElement("input");
      orderInput.type = "number";
      orderInput.min = "1";
      orderInput.value = index + 1;
      orderInput.dataset.macroId = macro.id;
      orderInput.dataset.field = "order";
      orderLabel.appendChild(orderInput);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "删除";
      removeBtn.dataset.action = "remove-macro";
      removeBtn.dataset.macroId = macro.id;
      removeBtn.disabled = plan.macrocycles.length <= 1;

      item.appendChild(nameLabel);
      item.appendChild(weekLabel);
      item.appendChild(orderLabel);
      item.appendChild(removeBtn);
      macrocycleListEl.appendChild(item);
    });
  }

  function renderMesocycleList(plan) {
    if (!mesocycleListEl) return;
    clearElement(mesocycleListEl);

    plan.mesocycles.forEach((meso, index) => {
      const item = document.createElement("div");
      item.className = "mesocycle-item";
      item.dataset.mesoId = meso.id;

      const nameLabel = document.createElement("label");
      nameLabel.textContent = "名称";
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = meso.name;
      nameInput.dataset.mesoId = meso.id;
      nameInput.dataset.field = "name";
      nameLabel.appendChild(nameInput);

      const weekLabel = document.createElement("label");
      weekLabel.textContent = "长度 (周)";
      const weekInput = document.createElement("input");
      weekInput.type = "number";
      weekInput.min = "1";
      weekInput.value = meso.weeks;
      weekInput.dataset.mesoId = meso.id;
      weekInput.dataset.field = "weeks";
      weekLabel.appendChild(weekInput);

      const orderLabel = document.createElement("label");
      orderLabel.textContent = "顺序";
      const orderInput = document.createElement("input");
      orderInput.type = "number";
      orderInput.min = "1";
      orderInput.value = index + 1;
      orderInput.dataset.mesoId = meso.id;
      orderInput.dataset.field = "order";
      orderLabel.appendChild(orderInput);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "删除";
      removeBtn.dataset.action = "remove-meso";
      removeBtn.dataset.mesoId = meso.id;
      removeBtn.disabled = plan.mesocycles.length <= 1;

      item.appendChild(nameLabel);
      item.appendChild(weekLabel);
      item.appendChild(orderLabel);
      item.appendChild(removeBtn);
      mesocycleListEl.appendChild(item);
    });
  }

  function renderTimeline(plan) {
    if (!macroTimelineEl) return;
    clearElement(macroTimelineEl);

    const weeks = computeWeeks(plan);
    const table = document.createElement("table");
    const tbody = document.createElement("tbody");

    tbody.appendChild(buildHeaderRow("Periodization", weeks.length, () => `${parseISODate(plan.startingDate).getFullYear()} 年计划`));
    tbody.appendChild(buildValueRow("Months", weeks, (week) => week.month, "month-cell"));

    DAYS.forEach((dayName, index) => {
      tbody.appendChild(buildValueRow(dayName, weeks, (week) => String(week.days[index].getDate()).padStart(2, "0")));
    });

    tbody.appendChild(buildValueRow("Macrocycle", weeks, (week) => week.macroName, (week) => `macrocell ${week.macroIndex % 2 === 0 ? "macro-even" : "macro-odd"}`));
    tbody.appendChild(buildValueRow("Mesocycle", weeks, (week) => week.mesoName, (week) => `mesocell ${week.mesoIndex % 2 === 0 ? "meso-even" : "meso-odd"}`));
    tbody.appendChild(buildValueRow("Week", weeks, (week) => week.weekOfYear, "weekcell"));
    tbody.appendChild(buildValueRow("Microcycle", weeks, (week) => week.microcycle, "microcell"));

    tbody.appendChild(buildTextareaRow("Strength Primary", plan.strengthFocus.primaryRow, "strength-primary"));
    tbody.appendChild(buildTextareaRow("Strength Secondary", plan.strengthFocus.secondaryRow, "strength-secondary"));
    FOCUS_CATEGORIES.forEach(({ key, label }) => {
      tbody.appendChild(buildTextareaRow(label, plan.strengthFocus.matrix[key], `strength-${key}`, `focus-${key}`));
    });

    tbody.appendChild(buildTextareaRow("Movement Primary", plan.movementFocus.primaryRow, "movement-primary"));
    tbody.appendChild(buildTextareaRow("Movement Secondary", plan.movementFocus.secondaryRow, "movement-secondary"));
    tbody.appendChild(buildTextareaRow("Movement Notes", plan.movementFocus.notesRow, "movement-notes"));

    tbody.appendChild(buildTextareaRow("ESD Primary", plan.esdFocus.primaryRow, "esd-primary"));
    tbody.appendChild(buildTextareaRow("ESD Secondary", plan.esdFocus.secondaryRow, "esd-secondary"));
    tbody.appendChild(buildTextareaRow("ESD Notes", plan.esdFocus.notesRow, "esd-notes"));

    tbody.appendChild(buildSelectRow("Phase", plan.phaseSelection, "phase"));
    tbody.appendChild(buildInputRow("Intensity", plan.intensityScale, "intensity", "intensity-cell"));
    tbody.appendChild(buildInputRow("Volume", plan.volumeScale, "volume", "volume-cell"));

    table.appendChild(tbody);
    macroTimelineEl.appendChild(table);
  }

  function buildHeaderRow(label, span, valueFn) {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.textContent = label;
    labelCell.className = "row-label";
    tr.appendChild(labelCell);
    const valueCell = document.createElement("td");
    valueCell.colSpan = span;
    valueCell.className = "header-cell";
    valueCell.textContent = valueFn();
    tr.appendChild(valueCell);
    return tr;
  }

  function buildValueRow(label, weeks, getter, classNameOrFn) {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.textContent = label;
    labelCell.className = "row-label";
    tr.appendChild(labelCell);

    weeks.forEach((week, index) => {
      const td = document.createElement("td");
      if (typeof classNameOrFn === "function") {
        const className = classNameOrFn(week, index);
        if (className) td.className = className;
      } else if (classNameOrFn) {
        td.className = classNameOrFn;
      }
      td.textContent = getter(week, index);
      tr.appendChild(td);
    });

    return tr;
  }

  function buildTextareaRow(label, values, field, cellClass) {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.textContent = label;
    labelCell.className = "row-label";
    tr.appendChild(labelCell);

    values.forEach((value, index) => {
      const td = document.createElement("td");
      if (cellClass) td.classList.add(cellClass);
      const textarea = document.createElement("textarea");
      textarea.rows = 2;
      textarea.value = value;
      textarea.dataset.week = String(index);
      textarea.dataset.field = field;
      td.appendChild(textarea);
      tr.appendChild(td);
    });

    return tr;
  }

  function buildInputRow(label, values, field, cellClass) {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.textContent = label;
    labelCell.className = "row-label";
    tr.appendChild(labelCell);

    values.forEach((value, index) => {
      const td = document.createElement("td");
      if (cellClass) td.classList.add(cellClass);
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.dataset.week = String(index);
      input.dataset.field = field;
      td.appendChild(input);
      tr.appendChild(td);
    });

    return tr;
  }

  function buildSelectRow(label, values, field) {
    const tr = document.createElement("tr");
    const labelCell = document.createElement("th");
    labelCell.textContent = label;
    labelCell.className = "row-label";
    tr.appendChild(labelCell);

    values.forEach((value, index) => {
      const td = document.createElement("td");
      const select = document.createElement("select");
      select.dataset.week = String(index);
      select.dataset.field = field;
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "--";
      select.appendChild(empty);
      PHASE_OPTIONS.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (value === option.value) opt.selected = true;
        select.appendChild(opt);
      });
      td.appendChild(select);
      tr.appendChild(td);
    });

    return tr;
  }

  function computeWeeks(plan) {
    const start = parseISODate(plan.startingDate);
    const macroQueue = plan.macrocycles.slice();
    let macroIndex = 0;
    let macroRemaining = macroQueue[0] ? macroQueue[0].weeks : TOTAL_WEEKS;

    const mesoQueue = plan.mesocycles.slice();
    let mesoIndex = 0;
    let mesoRemaining = mesoQueue[0] ? mesoQueue[0].weeks : TOTAL_WEEKS;

    const weeks = [];

    for (let week = 0; week < TOTAL_WEEKS; week += 1) {
      const weekStart = new Date(start.getTime());
      weekStart.setDate(weekStart.getDate() + week * 7);

      const days = DAYS.map((_, offset) => {
        const d = new Date(weekStart.getTime());
        d.setDate(d.getDate() + offset);
        return d;
      });

      const currentMacro = macroQueue[macroIndex];
      const currentMeso = mesoQueue[mesoIndex];

      weeks.push({
        index: week,
        month: MONTH_NAMES[weekStart.getMonth()],
        days,
        weekOfYear: getISOWeekNumber(weekStart),
        microcycle: week + 1,
        macroName: currentMacro ? currentMacro.name : "",
        macroIndex,
        mesoName: currentMeso ? currentMeso.name : "",
        mesoIndex,
      });

      macroRemaining -= 1;
      if (macroRemaining <= 0) {
        if (macroIndex < macroQueue.length - 1) {
          macroIndex += 1;
          macroRemaining = macroQueue[macroIndex].weeks;
        } else if (currentMacro) {
          macroRemaining = currentMacro.weeks;
        }
      }

      mesoRemaining -= 1;
      if (mesoRemaining <= 0) {
        if (mesoIndex < mesoQueue.length - 1) {
          mesoIndex += 1;
          mesoRemaining = mesoQueue[mesoIndex].weeks;
        } else if (currentMeso) {
          mesoRemaining = currentMeso.weeks;
        }
      }
    }

    return weeks;
  }

  function renderWorkload(plan) {
    if (workloadPerformanceInput) workloadPerformanceInput.value = plan.workload.performance;
    if (workloadLoadPlusInput) workloadLoadPlusInput.value = plan.workload.loadPlus;
    if (workloadLoadInput) workloadLoadInput.value = plan.workload.load;
    if (workloadBaseInput) workloadBaseInput.value = plan.workload.base;
    if (workloadDeloadInput) workloadDeloadInput.value = plan.workload.deload;
  }

  if (macroStartInput) {
    macroStartInput.addEventListener("change", () => {
      state.schedule.macroPlan.startingDate = macroStartInput.value || new Date().toISOString().slice(0, 10);
      persistSchedule();
      render();
    });
  }

  if (macroNameInput) {
    macroNameInput.addEventListener("input", () => {
      state.schedule.macroPlan.macrocycleName = macroNameInput.value;
      persistSchedule();
    });
  }

  if (macroNotesInput) {
    macroNotesInput.addEventListener("input", () => {
      state.schedule.macroPlan.notes = macroNotesInput.value;
      persistSchedule();
    });
  }

  if (addMacrocycleBtn) {
    addMacrocycleBtn.addEventListener("click", () => {
      const plan = state.schedule.macroPlan;
      plan.macrocycles.push(createDefaultMacrocycle(plan.macrocycles.length));
      ensureMacroPlanStructure(state.schedule);
      persistSchedule();
      render();
    });
  }

  if (macrocycleListEl) {
    macrocycleListEl.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const macroId = target.dataset.macroId;
      const field = target.dataset.field;
      if (!macroId || !field) return;

      const plan = state.schedule.macroPlan;
      const index = plan.macrocycles.findIndex((macro) => macro.id === macroId);
      if (index === -1) return;
      const macro = plan.macrocycles[index];

      if (field === "name") {
        macro.name = target.value;
      } else if (field === "weeks") {
        const weeks = Number.parseInt(target.value, 10);
        if (!Number.isNaN(weeks) && weeks > 0) macro.weeks = weeks;
      } else if (field === "order") {
        const order = Number.parseInt(target.value, 10);
        if (!Number.isNaN(order) && order >= 1 && order <= plan.macrocycles.length && order - 1 !== index) {
          moveArrayItem(plan.macrocycles, index, order - 1);
        }
      }

      ensureMacroPlanStructure(state.schedule);
      persistSchedule();
      render();
    });

    macrocycleListEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.dataset.action !== "remove-macro") return;
      const macroId = target.dataset.macroId;
      const plan = state.schedule.macroPlan;
      if (plan.macrocycles.length <= 1) return;
      const index = plan.macrocycles.findIndex((macro) => macro.id === macroId);
      if (index === -1) return;
      removeArrayItem(plan.macrocycles, index);
      ensureMacroPlanStructure(state.schedule);
      persistSchedule();
      render();
    });
  }

  if (addMesocycleBtn) {
    addMesocycleBtn.addEventListener("click", () => {
      const plan = state.schedule.macroPlan;
      plan.mesocycles.push(createDefaultMesocycle(plan.mesocycles.length));
      ensureMacroPlanStructure(state.schedule);
      persistSchedule();
      render();
    });
  }

  if (mesocycleListEl) {
    mesocycleListEl.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const mesoId = target.dataset.mesoId;
      const field = target.dataset.field;
      if (!mesoId || !field) return;

      const plan = state.schedule.macroPlan;
      const index = plan.mesocycles.findIndex((meso) => meso.id === mesoId);
      if (index === -1) return;
      const meso = plan.mesocycles[index];

      if (field === "name") {
        meso.name = target.value;
      } else if (field === "weeks") {
        const weeks = Number.parseInt(target.value, 10);
        if (!Number.isNaN(weeks) && weeks > 0) meso.weeks = weeks;
      } else if (field === "order") {
        const order = Number.parseInt(target.value, 10);
        if (!Number.isNaN(order) && order >= 1 && order <= plan.mesocycles.length && order - 1 !== index) {
          moveArrayItem(plan.mesocycles, index, order - 1);
        }
      }

      ensureMacroPlanStructure(state.schedule);
      persistSchedule();
      render();
    });

    mesocycleListEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;
      if (target.dataset.action !== "remove-meso") return;
      const mesoId = target.dataset.mesoId;
      const plan = state.schedule.macroPlan;
      if (plan.mesocycles.length <= 1) return;
      const index = plan.mesocycles.findIndex((meso) => meso.id === mesoId);
      if (index === -1) return;
      removeArrayItem(plan.mesocycles, index);
      ensureMacroPlanStructure(state.schedule);
      persistSchedule();
      render();
    });
  }

  if (macroTimelineEl) {
    macroTimelineEl.addEventListener("input", handleTimelineInput);
    macroTimelineEl.addEventListener("change", handleTimelineChange);
  }

  if (workloadPerformanceInput) workloadPerformanceInput.addEventListener("input", handleWorkloadInput);
  if (workloadLoadPlusInput) workloadLoadPlusInput.addEventListener("input", handleWorkloadInput);
  if (workloadLoadInput) workloadLoadInput.addEventListener("input", handleWorkloadInput);
  if (workloadBaseInput) workloadBaseInput.addEventListener("input", handleWorkloadInput);
  if (workloadDeloadInput) workloadDeloadInput.addEventListener("input", handleWorkloadInput);

  function handleTimelineInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) return;
    const weekIndex = Number.parseInt(target.dataset.week, 10);
    if (Number.isNaN(weekIndex)) return;
    const field = target.dataset.field;
    const plan = state.schedule.macroPlan;

    switch (field) {
      case "strength-primary":
        plan.strengthFocus.primaryRow[weekIndex] = target.value;
        break;
      case "strength-secondary":
        plan.strengthFocus.secondaryRow[weekIndex] = target.value;
        break;
      case "movement-primary":
        plan.movementFocus.primaryRow[weekIndex] = target.value;
        break;
      case "movement-secondary":
        plan.movementFocus.secondaryRow[weekIndex] = target.value;
        break;
      case "movement-notes":
        plan.movementFocus.notesRow[weekIndex] = target.value;
        break;
      case "esd-primary":
        plan.esdFocus.primaryRow[weekIndex] = target.value;
        break;
      case "esd-secondary":
        plan.esdFocus.secondaryRow[weekIndex] = target.value;
        break;
      case "esd-notes":
        plan.esdFocus.notesRow[weekIndex] = target.value;
        break;
      case "intensity":
        plan.intensityScale[weekIndex] = target.value;
        break;
      case "volume":
        plan.volumeScale[weekIndex] = target.value;
        break;
      default:
        if (field && field.startsWith("strength-")) {
          const key = field.replace("strength-", "");
          if (plan.strengthFocus.matrix[key]) {
            plan.strengthFocus.matrix[key][weekIndex] = target.value;
          }
        }
        break;
    }

    persistSchedule();
  }

  function handleTimelineChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const weekIndex = Number.parseInt(target.dataset.week, 10);
    if (Number.isNaN(weekIndex)) return;
    const field = target.dataset.field;
    if (field === "phase") {
      state.schedule.macroPlan.phaseSelection[weekIndex] = target.value;
      persistSchedule();
    }
  }

  function handleWorkloadInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement)) return;
    const workload = state.schedule.macroPlan.workload;
    if (target === workloadPerformanceInput) workload.performance = target.value;
    if (target === workloadLoadPlusInput) workload.loadPlus = target.value;
    if (target === workloadLoadInput) workload.load = target.value;
    if (target === workloadBaseInput) workload.base = target.value;
    if (target === workloadDeloadInput) workload.deload = target.value;
    persistSchedule();
  }

  return { render };
}
