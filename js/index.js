import { supabase } from "./supabaseClient.js";
import { generateId } from "./storage.js";

var metrics = [
  { key: "sets", label: "组数" },
  { key: "reps", label: "次数" },
  { key: "weight", label: "重量" },
];

var weekInput = document.getElementById("week-count");
var dayInput = document.getElementById("day-count");
var setWeeksBtn = document.getElementById("set-weeks");
var addWeekBtn = document.getElementById("add-week");
var setDaysBtn = document.getElementById("set-days");
var addDayBtn = document.getElementById("add-day");
var daysContainer = document.getElementById("days-container");
var signOutBtn = document.getElementById("sign-out");

if (!daysContainer) {
  throw new Error("days-container 未找到");
}

var currentUser = null;
var scheduleRecordId = null;
var activeForm = null;
var database = { types: [] };
var schedule = getDefaultSchedule();

function clearElement(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function getDefaultSchedule() {
  return {
    weeks: 4,
    days: 5,
    dayData: [],
  };
}

function createWeekValues(count) {
  var values = [];
  for (var i = 0; i < count; i += 1) {
    values.push({ sets: "", reps: "", weight: "" });
  }
  return values;
}

function createDay(index) {
  return {
    id: generateId("day"),
    title: "DAY" + (index + 1),
    entries: [],
  };
}

async function requireUser() {
  var result = await supabase.auth.getUser();
  if (result.error || !result.data?.user) {
    window.location.href = "login.html";
    throw result.error || new Error("未登录");
  }
  return result.data.user;
}

async function loadTypes() {
  var { data, error } = await supabase
    .from("training_types")
    .select("id, name, training_actions(id, name)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    window.alert("加载训练类型失败：" + error.message);
    database.types = [];
    return;
  }

  database.types = (data || []).map(function (type) {
    var actions = Array.isArray(type.training_actions)
      ? type.training_actions.slice().sort(function (a, b) {
          return (a.name || "").localeCompare(b.name || "");
        })
      : [];
    return {
      id: type.id,
      name: type.name,
      actions: actions.map(function (action) {
        return { id: action.id, name: action.name };
      }),
    };
  });
}

async function loadSchedule() {
  var { data, error } = await supabase
    .from("training_schedules")
    .select("id, data")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error(error);
    window.alert("加载训练计划失败：" + error.message);
    schedule = getDefaultSchedule();
    scheduleRecordId = null;
    return;
  }

  if (data) {
    scheduleRecordId = data.id;
    schedule = data.data || getDefaultSchedule();
  } else {
    scheduleRecordId = null;
    schedule = getDefaultSchedule();
  }
}

function persistSchedule() {
  if (!currentUser) return;
  var payload = {
    user_id: currentUser.id,
    data: schedule,
  };
  if (scheduleRecordId) {
    payload.id = scheduleRecordId;
  }

  supabase
    .from("training_schedules")
    .upsert(payload, { onConflict: "id" })
    .select("id")
    .single()
    .then(function (result) {
      if (result.error) {
        console.error(result.error);
        window.alert("保存训练计划失败：" + result.error.message);
        return;
      }
      if (result.data?.id) {
        scheduleRecordId = result.data.id;
      }
    })
    .catch(function (error) {
      console.error(error);
    });
}

function ensureScheduleStructure() {
  var changed = false;

  if (!schedule || typeof schedule !== "object") {
    schedule = getDefaultSchedule();
    changed = true;
  }

  if (typeof schedule.weeks !== "number" || schedule.weeks < 1) {
    schedule.weeks = 4;
    changed = true;
  }

  if (typeof schedule.days !== "number" || schedule.days < 1) {
    schedule.days = 5;
    changed = true;
  }

  if (!Array.isArray(schedule.dayData)) {
    schedule.dayData = [];
    changed = true;
  }

  while (schedule.dayData.length < schedule.days) {
    schedule.dayData.push(createDay(schedule.dayData.length));
    changed = true;
  }

  if (schedule.dayData.length > schedule.days) {
    schedule.dayData.length = schedule.days;
    changed = true;
  }

  for (var i = 0; i < schedule.dayData.length; i += 1) {
    var day = schedule.dayData[i];
    if (!day || typeof day !== "object") {
      schedule.dayData[i] = createDay(i);
      changed = true;
      day = schedule.dayData[i];
    }

    if (typeof day.id !== "string" || day.id.length === 0) {
      day.id = generateId("day");
      changed = true;
    }

    if (typeof day.title !== "string" || day.title.trim().length === 0) {
      day.title = "DAY" + (i + 1);
      changed = true;
    }

    if (!Array.isArray(day.entries)) {
      day.entries = [];
      changed = true;
    }

    for (var j = 0; j < day.entries.length; j += 1) {
      var entry = day.entries[j];
      if (!entry || typeof entry !== "object") {
        day.entries.splice(j, 1);
        j -= 1;
        changed = true;
        continue;
      }

      if (typeof entry.id !== "string" || entry.id.length === 0) {
        entry.id = generateId("entry");
        changed = true;
      }

      if (typeof entry.typeId !== "string") {
        entry.typeId = "";
        changed = true;
      }

      if (typeof entry.typeName !== "string") {
        entry.typeName = "";
        changed = true;
      }

      if (typeof entry.groupLabel !== "string") {
        entry.groupLabel = "";
        changed = true;
      }

      if (!Array.isArray(entry.actions)) {
        entry.actions = [];
        changed = true;
      }

      for (var k = 0; k < entry.actions.length; k += 1) {
        var action = entry.actions[k];
        if (!action || typeof action !== "object") {
          entry.actions.splice(k, 1);
          k -= 1;
          changed = true;
          continue;
        }

        if (typeof action.id !== "string" || action.id.length === 0) {
          action.id = generateId("entryAction");
          changed = true;
        }

        if (typeof action.actionId !== "string") {
          action.actionId = "";
          changed = true;
        }

        if (typeof action.actionName !== "string") {
          action.actionName = "";
          changed = true;
        }

        if (!Array.isArray(action.weekValues)) {
          action.weekValues = createWeekValues(schedule.weeks);
          changed = true;
        }
      }
    }
  }

  return changed;
}

function syncWeekValues() {
  var changed = false;

  for (var i = 0; i < schedule.dayData.length; i += 1) {
    var day = schedule.dayData[i];
    if (!day || !Array.isArray(day.entries)) continue;

    for (var j = 0; j < day.entries.length; j += 1) {
      var entry = day.entries[j];
      if (!entry || !Array.isArray(entry.actions)) continue;

      for (var k = 0; k < entry.actions.length; k += 1) {
        var action = entry.actions[k];
        if (!action) continue;

        if (!Array.isArray(action.weekValues)) {
          action.weekValues = createWeekValues(schedule.weeks);
          changed = true;
          continue;
        }

        if (action.weekValues.length < schedule.weeks) {
          var toAdd = schedule.weeks - action.weekValues.length;
          for (var m = 0; m < toAdd; m += 1) {
            action.weekValues.push({ sets: "", reps: "", weight: "" });
          }
          changed = true;
        } else if (action.weekValues.length > schedule.weeks) {
          action.weekValues.length = schedule.weeks;
          changed = true;
        }

        for (var n = 0; n < action.weekValues.length; n += 1) {
          var values = action.weekValues[n];
          if (!values || typeof values !== "object") {
            action.weekValues[n] = { sets: "", reps: "", weight: "" };
            changed = true;
            continue;
          }

          if (typeof values.sets !== "string") values.sets = "";
          if (typeof values.reps !== "string") values.reps = "";
          if (typeof values.weight !== "string") values.weight = "";
        }
      }
    }
  }

  return changed;
}

function closeActiveForm() {
  if (activeForm && activeForm.parentElement) {
    activeForm.parentElement.removeChild(activeForm);
  }
  activeForm = null;
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeActiveForm();
  }
});

function findType(typeId) {
  for (var i = 0; i < database.types.length; i += 1) {
    if (database.types[i].id === typeId) return database.types[i];
  }
  return null;
}

function findAction(type, actionId) {
  if (!type) return null;
  for (var i = 0; i < type.actions.length; i += 1) {
    if (type.actions[i].id === actionId) return type.actions[i];
  }
  return null;
}

function handleMetricInput(event) {
  var input = event.target;
  if (!input || !input.dataset) return;

  var dayIndex = parseInt(input.dataset.dayIndex, 10);
  var entryId = input.dataset.entryId;
  var actionId = input.dataset.actionId;
  var weekIndex = parseInt(input.dataset.weekIndex, 10);
  var metric = input.dataset.metric;

  if (isNaN(dayIndex) || isNaN(weekIndex) || !metric) return;
  if (!entryId || !actionId) return;

  var day = schedule.dayData[dayIndex];
  if (!day) return;

  var entry = null;
  for (var i = 0; i < day.entries.length; i += 1) {
    if (day.entries[i].id === entryId) {
      entry = day.entries[i];
      break;
    }
  }
  if (!entry) return;

  var action = null;
  for (var j = 0; j < entry.actions.length; j += 1) {
    if (entry.actions[j].id === actionId) {
      action = entry.actions[j];
      break;
    }
  }
  if (!action || !Array.isArray(action.weekValues)) return;

  var values = action.weekValues[weekIndex];
  if (!values) return;

  values[metric] = input.value;
  persistSchedule();
}

function buildActionPicker(container, type, selectedIds) {
  clearElement(container);

  if (!type) {
    var tip = document.createElement("p");
    tip.className = "tip";
    tip.textContent = "请选择训练类型以加载动作";
    container.appendChild(tip);
    return;
  }

  if (!Array.isArray(type.actions) || type.actions.length === 0) {
    var empty = document.createElement("p");
    empty.className = "tip";
    empty.textContent = "该类型暂无动作，请先在数据库页添加";
    container.appendChild(empty);
    return;
  }

  for (var i = 0; i < type.actions.length; i += 1) {
    var action = type.actions[i];
    if (!action) continue;

    var label = document.createElement("label");
    label.className = "action-chip";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = action.id;
    checkbox.checked = selectedIds.indexOf(action.id) !== -1;

    checkbox.addEventListener("change", function (evt) {
      var target = evt.target;
      var val = target.value;
      var idx = selectedIds.indexOf(val);
      if (target.checked) {
        if (idx === -1) selectedIds.push(val);
      } else if (idx !== -1) {
        selectedIds.splice(idx, 1);
      }
    });

    var span = document.createElement("span");
    span.textContent = action.name;

    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
  }
}

function openEntryForm(dayIndex, entry) {
  if (!database.types.length) {
    window.alert("请先在数据库页新增训练类型");
    return;
  }

  closeActiveForm();

  var daySection = daysContainer.querySelector('[data-day-index="' + dayIndex + '"]');
  if (!daySection) return;

  var slot = daySection.querySelector(".day-form-slot");
  if (!slot) return;

  var form = document.createElement("div");
  form.className = "entry-form-panel";

  var title = document.createElement("h3");
  title.textContent = entry ? "编辑训练条目" : "新增训练条目";
  form.appendChild(title);

  var typeField = document.createElement("div");
  typeField.className = "field";
  var typeLabel = document.createElement("label");
  typeLabel.textContent = "训练类型";
  typeField.appendChild(typeLabel);

  var typeSelect = document.createElement("select");
  var defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "请选择训练类型";
  typeSelect.appendChild(defaultOption);

  for (var i = 0; i < database.types.length; i += 1) {
    var t = database.types[i];
    var option = document.createElement("option");
    option.value = t.id;
    option.textContent = t.name;
    typeSelect.appendChild(option);
  }

  var initialTypeId = entry ? entry.typeId : "";
  var selectedType = findType(initialTypeId);
  if (selectedType) {
    typeSelect.value = selectedType.id;
  }

  typeField.appendChild(typeSelect);
  form.appendChild(typeField);

  var groupField = document.createElement("div");
  groupField.className = "field";
  var groupLabel = document.createElement("label");
  groupLabel.textContent = "组别（可选）";
  groupField.appendChild(groupLabel);
  var groupInput = document.createElement("input");
  groupInput.type = "text";
  groupInput.placeholder = "例如：A";
  groupInput.value = entry ? entry.groupLabel : "";
  groupField.appendChild(groupInput);
  form.appendChild(groupField);

  var actionsField = document.createElement("div");
  actionsField.className = "field";
  var actionsLabel = document.createElement("label");
  actionsLabel.textContent = "训练动作";
  actionsField.appendChild(actionsLabel);
  var actionPicker = document.createElement("div");
  actionPicker.className = "action-picker";
  actionsField.appendChild(actionPicker);
  form.appendChild(actionsField);

  var selectedIds = [];
  var storedNames = {};

  if (entry && Array.isArray(entry.actions)) {
    for (var j = 0; j < entry.actions.length; j += 1) {
      var action = entry.actions[j];
      if (!action) continue;
      if (action.actionId && selectedIds.indexOf(action.actionId) === -1) {
        selectedIds.push(action.actionId);
        storedNames[action.actionId] = action.actionName;
      }
    }
  }

  buildActionPicker(actionPicker, selectedType, selectedIds);

  typeSelect.addEventListener("change", function () {
    selectedType = findType(typeSelect.value);
    if (!selectedType) {
      selectedIds = [];
      buildActionPicker(actionPicker, null, selectedIds);
      return;
    }
    var available = {};
    for (var idx = 0; idx < selectedType.actions.length; idx += 1) {
      available[selectedType.actions[idx].id] = true;
    }
    selectedIds = selectedIds.filter(function (id) {
      return available[id];
    });
    buildActionPicker(actionPicker, selectedType, selectedIds);
  });

  var buttonRow = document.createElement("div");
  buttonRow.className = "button-row";
  var saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = entry ? "保存" : "添加";
  var cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", function () {
    closeActiveForm();
  });
  buttonRow.appendChild(saveBtn);
  buttonRow.appendChild(cancelBtn);
  form.appendChild(buttonRow);

  saveBtn.addEventListener("click", function () {
    var typeId = typeSelect.value;
    if (!typeId) {
      window.alert("请先选择训练类型");
      return;
    }
    if (selectedIds.length === 0) {
      window.alert("请至少选择一个动作");
      return;
    }

    var type = findType(typeId);
    var day = schedule.dayData[dayIndex];
    if (!day) return;

    var nextActions = [];
    var existingMap = {};
    if (entry && Array.isArray(entry.actions)) {
      for (var a = 0; a < entry.actions.length; a += 1) {
        var existing = entry.actions[a];
        if (existing && existing.actionId) {
          existingMap[existing.actionId] = existing;
        }
      }
    }

    for (var b = 0; b < selectedIds.length; b += 1) {
      var actionId = selectedIds[b];
      var actionDef = findAction(type, actionId);
      var reuse = existingMap[actionId];
      if (reuse) {
        reuse.actionName = actionDef ? actionDef.name : reuse.actionName;
        if (!Array.isArray(reuse.weekValues)) {
          reuse.weekValues = createWeekValues(schedule.weeks);
        }
        nextActions.push(reuse);
      } else {
        nextActions.push({
          id: generateId("entryAction"),
          actionId: actionId,
          actionName: actionDef ? actionDef.name : storedNames[actionId] || "",
          weekValues: createWeekValues(schedule.weeks),
        });
      }
    }

    if (entry) {
      entry.typeId = typeId;
      entry.typeName = type ? type.name : entry.typeName;
      entry.groupLabel = groupInput.value.trim();
      entry.actions = nextActions;
    } else {
      day.entries.push({
        id: generateId("entry"),
        typeId: typeId,
        typeName: type ? type.name : "",
        groupLabel: groupInput.value.trim(),
        actions: nextActions,
      });
    }

    persistSchedule();
    closeActiveForm();
    renderDays();
  });

  slot.appendChild(form);
  activeForm = form;
  typeSelect.focus();
}

function renderDays() {
  closeActiveForm();

  var changed = false;
  if (ensureScheduleStructure()) changed = true;
  if (syncWeekValues()) changed = true;

  var fragment = document.createDocumentFragment();

  for (var i = 0; i < schedule.dayData.length; i += 1) {
    var day = schedule.dayData[i];

    var section = document.createElement("section");
    section.className = "day-block";
    section.setAttribute("data-day-index", String(i));

    var toolbar = document.createElement("div");
    toolbar.className = "day-toolbar";

    var title = document.createElement("h2");
    title.textContent = day.title;
    toolbar.appendChild(title);

    var actions = document.createElement("div");
    actions.className = "day-toolbar-actions";

    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "添加条目";
    addBtn.addEventListener("click", function (index) {
      return function () {
        openEntryForm(index, null);
      };
    }(i));

    var renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "重命名训练日";
    renameBtn.addEventListener("click", function (index) {
      return function () {
        var current = schedule.dayData[index];
        if (!current) return;
        var next = window.prompt("请输入新的训练日名称", current.title);
        if (next && next.trim().length > 0) {
          current.title = next.trim();
          persistSchedule();
          renderDays();
        }
      };
    }(i));

    actions.appendChild(addBtn);
    actions.appendChild(renameBtn);
    toolbar.appendChild(actions);
    section.appendChild(toolbar);

    var formSlot = document.createElement("div");
    formSlot.className = "day-form-slot";
    section.appendChild(formSlot);

    var tableWrapper = document.createElement("div");
    tableWrapper.className = "sheet-table-wrapper";

    var table = document.createElement("table");
    table.className = "sheet-table";

    var thead = document.createElement("thead");
    var dayRow = document.createElement("tr");
    var dayCell = document.createElement("th");
    dayCell.className = "day-heading-cell";
    dayCell.colSpan = 3 + metrics.length * schedule.weeks;
    dayCell.textContent = day.title;
    dayRow.appendChild(dayCell);
    thead.appendChild(dayRow);

    var headerRow = document.createElement("tr");
    var typeHeader = document.createElement("th");
    typeHeader.textContent = "训练类型";
    headerRow.appendChild(typeHeader);
    var groupHeader = document.createElement("th");
    groupHeader.textContent = "组别";
    headerRow.appendChild(groupHeader);
    var actionHeader = document.createElement("th");
    actionHeader.textContent = "训练动作";
    headerRow.appendChild(actionHeader);

    for (var w = 0; w < schedule.weeks; w += 1) {
      var weekHeader = document.createElement("th");
      weekHeader.className = "week-heading";
      weekHeader.colSpan = metrics.length;
      weekHeader.textContent = "第" + (w + 1) + "周";
      headerRow.appendChild(weekHeader);
    }

    thead.appendChild(headerRow);

    if (schedule.weeks > 0) {
      var subRow = document.createElement("tr");
      subRow.className = "metrics-row";
      subRow.appendChild(document.createElement("th"));
      subRow.appendChild(document.createElement("th"));
      subRow.appendChild(document.createElement("th"));
      for (var s = 0; s < schedule.weeks; s += 1) {
        for (var m = 0; m < metrics.length; m += 1) {
          var metricTh = document.createElement("th");
          metricTh.textContent = metrics[m].label;
          subRow.appendChild(metricTh);
        }
      }
      thead.appendChild(subRow);
    }

    table.appendChild(thead);

    var tbody = document.createElement("tbody");

    if (!Array.isArray(day.entries) || day.entries.length === 0) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 3 + metrics.length * schedule.weeks;
      emptyCell.className = "empty-cell";
      emptyCell.textContent = "暂未添加训练条目";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    } else {
      for (var j = 0; j < day.entries.length; j += 1) {
        var entry = day.entries[j];
        var type = findType(entry.typeId);
        if (type && entry.typeName !== type.name) {
          entry.typeName = type.name;
          changed = true;
        }

        var actionsList = Array.isArray(entry.actions) && entry.actions.length > 0
          ? entry.actions
          : [];
        if (actionsList.length === 0) {
          actionsList.push({
            id: generateId("entryAction"),
            actionId: "",
            actionName: "",
            weekValues: createWeekValues(schedule.weeks),
            placeholder: true,
          });
        }

        for (var k = 0; k < actionsList.length; k += 1) {
          var action = actionsList[k];
          var row = document.createElement("tr");

          if (k === 0) {
            var typeCell = document.createElement("td");
            typeCell.className = "type-cell";
            typeCell.rowSpan = actionsList.length;
            typeCell.textContent = entry.typeName || "类型已删除";
            if (!type) {
              typeCell.classList.add("missing");
            }

            var controlRow = document.createElement("div");
            controlRow.className = "entry-controls";

            var editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.textContent = "编辑";
            editBtn.addEventListener("click", function (index, current) {
              return function () {
                openEntryForm(index, current);
              };
            }(i, entry));

            var deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "删除";
            deleteBtn.className = "danger";
            deleteBtn.addEventListener("click", function (dayIndex, entryId) {
              return function () {
                if (!window.confirm("确定删除该训练条目吗？")) return;
                var dayData = schedule.dayData[dayIndex];
                if (!dayData) return;
                dayData.entries = dayData.entries.filter(function (item) {
                  return item.id !== entryId;
                });
                persistSchedule();
                renderDays();
              };
            }(i, entry.id));

            controlRow.appendChild(editBtn);
            controlRow.appendChild(deleteBtn);
            typeCell.appendChild(controlRow);
            row.appendChild(typeCell);

            var groupCell = document.createElement("td");
            groupCell.className = "group-cell";
            groupCell.rowSpan = actionsList.length;
            groupCell.textContent = entry.groupLabel ? entry.groupLabel : "-";
            row.appendChild(groupCell);
          }

          var actionCell = document.createElement("td");
          actionCell.className = "action-cell";
          var actionType = type || findType(entry.typeId);
          var actionDef = findAction(actionType, action.actionId);
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

          for (var p = 0; p < schedule.weeks; p += 1) {
            for (var q = 0; q < metrics.length; q += 1) {
              var cell = document.createElement("td");
              cell.className = "value-cell";

              if (action.placeholder) {
                cell.textContent = "—";
                cell.classList.add("muted");
              } else {
                var metricKey = metrics[q].key;
                var value = "";
                if (Array.isArray(action.weekValues) && action.weekValues[p]) {
                  value = action.weekValues[p][metricKey] || "";
                }
                var input = document.createElement("input");
                input.type = "text";
                input.value = value;
                input.className = "value-input";
                input.dataset.dayIndex = String(i);
                input.dataset.entryId = entry.id;
                input.dataset.actionId = action.id;
                input.dataset.weekIndex = String(p);
                input.dataset.metric = metricKey;
                input.addEventListener("input", handleMetricInput);
                cell.appendChild(input);
              }

              row.appendChild(cell);
            }
          }

          tbody.appendChild(row);
        }
      }
    }

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    section.appendChild(tableWrapper);

    fragment.appendChild(section);
  }

  clearElement(daysContainer);
  daysContainer.appendChild(fragment);

  if (changed) {
    persistSchedule();
  }
}

function applyWeekCount(value) {
  var parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    window.alert("周数至少为 1");
    return;
  }
  schedule.weeks = parsed;
  weekInput.value = String(parsed);
  persistSchedule();
  renderDays();
}

function applyDayCount(value) {
  var parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    window.alert("天数至少为 1");
    return;
  }
  schedule.days = parsed;
  dayInput.value = String(parsed);
  persistSchedule();
  renderDays();
}

setWeeksBtn.addEventListener("click", function () {
  applyWeekCount(weekInput.value);
});

setDaysBtn.addEventListener("click", function () {
  applyDayCount(dayInput.value);
});

addWeekBtn.addEventListener("click", function () {
  applyWeekCount(schedule.weeks + 1);
});

addDayBtn.addEventListener("click", function () {
  applyDayCount(schedule.days + 1);
});

weekInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    applyWeekCount(weekInput.value);
  }
});

dayInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    applyDayCount(dayInput.value);
  }
});

window.addEventListener("focus", function () {
  if (!currentUser) return;
  loadTypes()
    .then(renderDays)
    .catch(function (error) {
      console.error(error);
    });
});

if (signOutBtn) {
  signOutBtn.addEventListener("click", async function () {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

async function init() {
  currentUser = await requireUser();
  await Promise.all([loadTypes(), loadSchedule()]);
  ensureScheduleStructure();
  syncWeekValues();
  weekInput.value = String(schedule.weeks);
  dayInput.value = String(schedule.days);
  renderDays();
}

init().catch(function (error) {
  console.error(error);
  window.alert("初始化失败：" + (error?.message || "未知错误"));
});
