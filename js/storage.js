const DATABASE_KEY = "trainingDatabase";
const SCHEDULE_KEY = "trainingSchedule";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJSON(key, fallback) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return clone(fallback);
  try {
    return JSON.parse(raw);
  } catch (_err) {
    console.warn(`Invalid JSON for ${key}, using fallback`);
    return clone(fallback);
  }
}

function writeJSON(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function generateId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 8);
  const now = Date.now().toString(36);
  return `${prefix}_${now}_${random}`;
}

const defaultDatabase = { types: [] };

export function loadDatabase() {
  return readJSON(DATABASE_KEY, defaultDatabase);
}

export function saveDatabase(db) {
  writeJSON(DATABASE_KEY, db);
}

const defaultSchedule = {
  weeks: 4,
  days: 5,
  dayData: [],
};

export function loadSchedule() {
  const data = readJSON(SCHEDULE_KEY, defaultSchedule);
  // ensure required fields exist
  if (typeof data.weeks !== "number" || data.weeks < 1) data.weeks = defaultSchedule.weeks;
  if (typeof data.days !== "number" || data.days < 1) data.days = defaultSchedule.days;
  if (!Array.isArray(data.dayData)) data.dayData = [];
  if (data.entries) {
    delete data.entries;
    data.dayData = [];
  }
  return data;
}

export function saveSchedule(schedule) {
  writeJSON(SCHEDULE_KEY, schedule);
}

export function resetAll() {
  window.localStorage.removeItem(DATABASE_KEY);
  window.localStorage.removeItem(SCHEDULE_KEY);
}
