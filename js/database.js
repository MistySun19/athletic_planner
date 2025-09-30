import { loadDatabase, saveDatabase, generateId } from "./storage.js";

const typeInput = document.getElementById("new-type");
const addTypeBtn = document.getElementById("add-type");
const typeList = document.getElementById("type-list");
const typeTemplate = document.getElementById("type-template");
const actionTemplate = document.getElementById("action-template");

let database = loadDatabase();

function persist() {
  saveDatabase(database);
}

function clearElement(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function createActionElement(type, action) {
  const fragment = actionTemplate.content.cloneNode(true);
  const item = fragment.querySelector(".action-item");
  const nameEl = fragment.querySelector('[data-field="action-name"]');
  const renameBtn = fragment.querySelector('[data-action="rename-action"]');
  const deleteBtn = fragment.querySelector('[data-action="delete-action"]');

  nameEl.textContent = action.name;

  renameBtn.addEventListener("click", () => {
    const nextName = window.prompt("重命名动作", action.name);
    if (!nextName) return;
    action.name = nextName.trim();
    if (!action.name) return;
    nameEl.textContent = action.name;
    persist();
  });

  deleteBtn.addEventListener("click", () => {
    if (!window.confirm(`确定删除动作“${action.name}”吗？`)) return;
    type.actions = type.actions.filter((item) => item.id !== action.id);
    item.remove();
    persist();
  });

  return fragment;
}

function createTypeElement(type) {
  const fragment = typeTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".type-card");
  const nameEl = fragment.querySelector('[data-field="type-name"]');
  const actionList = fragment.querySelector('[data-field="action-list"]');
  const addActionBtn = fragment.querySelector('[data-action="add-action"]');
  const renameBtn = fragment.querySelector('[data-action="rename-type"]');
  const deleteBtn = fragment.querySelector('[data-action="delete-type"]');

  nameEl.textContent = type.name;

  type.actions.forEach((action) => {
    actionList.appendChild(createActionElement(type, action));
  });

  addActionBtn.addEventListener("click", () => {
    const name = window.prompt(`为“${type.name}”添加动作`, "");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const action = { id: generateId("action"), name: trimmed };
    type.actions.push(action);
    actionList.appendChild(createActionElement(type, action));
    persist();
  });

  renameBtn.addEventListener("click", () => {
    const nextName = window.prompt("重命名训练类型", type.name);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    type.name = trimmed;
    nameEl.textContent = trimmed;
    persist();
  });

  deleteBtn.addEventListener("click", () => {
    if (!window.confirm(`确定删除训练类型“${type.name}”吗？`)) return;
    database.types = database.types.filter((item) => item.id !== type.id);
    render();
    persist();
  });

  return fragment;
}

function render() {
  clearElement(typeList);
  if (!database.types.length) {
    const emptyEl = document.createElement("p");
    emptyEl.className = "tip";
    emptyEl.textContent = "暂未添加训练类型";
    typeList.appendChild(emptyEl);
    return;
  }
  database.types.forEach((type) => {
    typeList.appendChild(createTypeElement(type));
  });
}

addTypeBtn.addEventListener("click", () => {
  const name = typeInput.value.trim();
  if (!name) {
    typeInput.focus();
    return;
  }
  const exists = database.types.some((type) => type.name === name);
  if (exists) {
    window.alert("该训练类型已存在");
    typeInput.focus();
    return;
  }
  const type = {
    id: generateId("type"),
    name,
    actions: [],
  };
  database.types.push(type);
  typeInput.value = "";
  render();
  persist();
});

typeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTypeBtn.click();
  }
});

render();
