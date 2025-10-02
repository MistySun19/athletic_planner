export function clearElement(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

export function moveArrayItem(array, fromIndex, toIndex) {
  if (!Array.isArray(array) || fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= array.length) return;
  if (toIndex < 0) {
    toIndex = 0;
  } else if (toIndex >= array.length) {
    toIndex = array.length - 1;
  }
  const item = array.splice(fromIndex, 1)[0];
  array.splice(toIndex, 0, item);
}

export function removeArrayItem(array, index) {
  if (!Array.isArray(array)) return;
  if (index < 0 || index >= array.length) return;
  array.splice(index, 1);
}

export function parseISODate(value) {
  if (typeof value !== "string" || !value) {
    return new Date();
  }
  const parts = value.split("-");
  if (parts.length === 3) {
    const year = Number.parseInt(parts[0], 10);
    const month = Number.parseInt(parts[1], 10) - 1;
    const day = Number.parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return new Date();
}

export function getISOWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNr = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3);
  const diff = target - firstThursday;
  return 1 + Math.round(diff / 604800000);
}
