import { supabase } from "./supabaseClient.js";
import { ROLE, requireRole } from "./auth.js";

const typeInput = document.getElementById("new-type");
const addTypeBtn = document.getElementById("add-type");
const typeList = document.getElementById("type-list");
const typeTemplate = document.getElementById("type-template");
const actionTemplate = document.getElementById("action-template");
const signOutBtn = document.getElementById("sign-out");
const adminLink = document.getElementById("admin-link");

let currentUser = null;
let currentProfile = null;
let types = [];

function clearElement(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

async function fetchTypes() {
  const { data, error } = await supabase
    .from("training_types")
    .select("id, name, training_actions(id, name)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    window.alert("加载训练类型失败：" + error.message);
    types = [];
  } else {
    types = (data || []).map((type) => ({
      id: type.id,
      name: type.name,
      actions: Array.isArray(type.training_actions)
        ? type.training_actions.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        : [],
    }));
  }

  render();
}

function createActionElement(type, action) {
  const fragment = actionTemplate.content.cloneNode(true);
  const item = fragment.querySelector(".action-item");
  const nameEl = fragment.querySelector('[data-field="action-name"]');
  const renameBtn = fragment.querySelector('[data-action="rename-action"]');
  const deleteBtn = fragment.querySelector('[data-action="delete-action"]');

  nameEl.textContent = action.name;

  renameBtn.addEventListener("click", async () => {
    const nextName = window.prompt("重命名动作", action.name);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("training_actions")
      .update({ name: trimmed })
      .eq("id", action.id);
    if (error) {
      window.alert("重命名失败：" + error.message);
      return;
    }
    fetchTypes();
  });

  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm(`确定删除动作“${action.name}”吗？`)) return;
    const { error } = await supabase
      .from("training_actions")
      .delete()
      .eq("id", action.id);
    if (error) {
      window.alert("删除失败：" + error.message);
      return;
    }
    fetchTypes();
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

  addActionBtn.addEventListener("click", async () => {
    const name = window.prompt(`为“${type.name}”添加动作`, "");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("training_actions")
      .insert({
        name: trimmed,
        type_id: type.id,
        user_id: currentUser.id,
      });
    if (error) {
      window.alert("添加动作失败：" + error.message);
      return;
    }
    fetchTypes();
  });

  renameBtn.addEventListener("click", async () => {
    const nextName = window.prompt("重命名训练类型", type.name);
    if (!nextName) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("training_types")
      .update({ name: trimmed })
      .eq("id", type.id);
    if (error) {
      window.alert("重命名失败：" + error.message);
      return;
    }
    fetchTypes();
  });

  deleteBtn.addEventListener("click", async () => {
    if (!window.confirm(`确定删除训练类型“${type.name}”吗？`)) return;
    const { error } = await supabase
      .from("training_types")
      .delete()
      .eq("id", type.id);
    if (error) {
      window.alert("删除失败：" + error.message);
      return;
    }
    fetchTypes();
  });

  return fragment;
}

function render() {
  clearElement(typeList);
  if (!types.length) {
    const emptyEl = document.createElement("p");
    emptyEl.className = "tip";
    emptyEl.textContent = "暂未添加训练类型";
    typeList.appendChild(emptyEl);
    return;
  }
  types.forEach((type) => {
    typeList.appendChild(createTypeElement(type));
  });
}

addTypeBtn.addEventListener("click", async () => {
  const name = typeInput.value.trim();
  if (!name) {
    typeInput.focus();
    return;
  }
  const { error } = await supabase
    .from("training_types")
    .insert({
      name,
      user_id: currentUser.id,
    });
  if (error) {
    window.alert("添加类型失败：" + error.message);
    return;
  }
  typeInput.value = "";
  fetchTypes();
});

typeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTypeBtn.click();
  }
});

if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });
}

async function init() {
  const session = await requireRole([ROLE.teacher, ROLE.admin]);
  if (!session) return;
  currentUser = session.user;
  currentProfile = session.profile;
  if (adminLink) {
    adminLink.classList.toggle("hidden", currentProfile?.role !== ROLE.admin);
  }
  fetchTypes();
}

init().catch((error) => {
  console.error(error);
  window.alert("初始化失败：" + (error?.message || "未知错误"));
});
