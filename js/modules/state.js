import { generateId } from "../storage.js";
import { FOCUS_CATEGORIES, TOTAL_WEEKS } from "./constants.js";

export function createWeekValues(count) {
  const values = [];
  for (let i = 0; i < count; i += 1) {
    values.push({ sets: "", reps: "", weight: "" });
  }
  return values;
}

export function createDay(index) {
  return {
    id: generateId("day"),
    title: `DAY${index + 1}`,
    entries: [],
  };
}

export function createDefaultMesocycle(index) {
  return {
    id: generateId("meso"),
    name: String(index + 1),
    weeks: 4,
  };
}

export function createDefaultMacrocycle(index) {
  return {
    id: generateId("macro"),
    name: index === 0 ? "Preparation" : String(index + 1),
    weeks: 13,
  };
}

export function getDefaultMacroPlan() {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  return {
    startingDate: isoDate,
    macrocycleName: "",
    notes: "",
    macrocycles: [
      createDefaultMacrocycle(0),
      createDefaultMacrocycle(1),
      createDefaultMacrocycle(2),
      createDefaultMacrocycle(3),
    ],
    mesocycles: [
      createDefaultMesocycle(0),
      createDefaultMesocycle(1),
      createDefaultMesocycle(2),
      createDefaultMesocycle(3),
    ],
    strengthFocus: {
      primaryRow: new Array(TOTAL_WEEKS).fill(""),
      secondaryRow: new Array(TOTAL_WEEKS).fill(""),
      matrix: {
        hypertrophy: new Array(TOTAL_WEEKS).fill(""),
        strength: new Array(TOTAL_WEEKS).fill(""),
        strengthPower: new Array(TOTAL_WEEKS).fill(""),
        power: new Array(TOTAL_WEEKS).fill(""),
        peaking: new Array(TOTAL_WEEKS).fill(""),
      },
    },
    movementFocus: {
      primaryRow: new Array(TOTAL_WEEKS).fill(""),
      secondaryRow: new Array(TOTAL_WEEKS).fill(""),
      notesRow: new Array(TOTAL_WEEKS).fill(""),
    },
    esdFocus: {
      primaryRow: new Array(TOTAL_WEEKS).fill(""),
      secondaryRow: new Array(TOTAL_WEEKS).fill(""),
      notesRow: new Array(TOTAL_WEEKS).fill(""),
    },
    phaseSelection: new Array(TOTAL_WEEKS).fill(""),
    intensityScale: new Array(TOTAL_WEEKS).fill(""),
    volumeScale: new Array(TOTAL_WEEKS).fill(""),
    workload: {
      performance: "",
      loadPlus: "",
      load: "",
      base: "",
      deload: "",
    },
  };
}

export function getDefaultSchedule() {
  return {
    weeks: 4,
    days: 5,
    dayData: [],
    macroPlan: getDefaultMacroPlan(),
  };
}

export function ensureScheduleStructure(schedule) {
  if (!schedule || typeof schedule !== "object") return false;
  let changed = false;

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

  schedule.dayData.forEach((day, index) => {
    if (!day || typeof day !== "object") {
      schedule.dayData[index] = createDay(index);
      changed = true;
      day = schedule.dayData[index];
    }

    if (typeof day.id !== "string" || !day.id) {
      day.id = generateId("day");
      changed = true;
    }

    if (typeof day.title !== "string" || !day.title.trim()) {
      day.title = `DAY${index + 1}`;
      changed = true;
    }

    if (!Array.isArray(day.entries)) {
      day.entries = [];
      changed = true;
    }

    day.entries.forEach((entry, entryIndex) => {
      if (!entry || typeof entry !== "object") {
        day.entries.splice(entryIndex, 1);
        changed = true;
        return;
      }

      if (typeof entry.id !== "string" || !entry.id) {
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

      entry.actions.forEach((action, actionIndex) => {
        if (!action || typeof action !== "object") {
          entry.actions.splice(actionIndex, 1);
          changed = true;
          return;
        }

        if (typeof action.id !== "string" || !action.id) {
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
      });
    });
  });

  return changed;
}

export function syncWeekValues(schedule) {
  if (!schedule || !Array.isArray(schedule.dayData)) return false;
  let changed = false;

  schedule.dayData.forEach((day) => {
    if (!day || !Array.isArray(day.entries)) return;
    day.entries.forEach((entry) => {
      if (!entry || !Array.isArray(entry.actions)) return;
      entry.actions.forEach((action) => {
        if (!action) return;
        if (!Array.isArray(action.weekValues)) {
          action.weekValues = createWeekValues(schedule.weeks);
          changed = true;
          return;
        }
        if (action.weekValues.length < schedule.weeks) {
          const missing = schedule.weeks - action.weekValues.length;
          for (let i = 0; i < missing; i += 1) {
            action.weekValues.push({ sets: "", reps: "", weight: "" });
          }
          changed = true;
        } else if (action.weekValues.length > schedule.weeks) {
          action.weekValues.length = schedule.weeks;
          changed = true;
        }

        action.weekValues.forEach((values, index) => {
          if (!values || typeof values !== "object") {
            action.weekValues[index] = { sets: "", reps: "", weight: "" };
            changed = true;
            return;
          }
          if (typeof values.sets !== "string") values.sets = "";
          if (typeof values.reps !== "string") values.reps = "";
          if (typeof values.weight !== "string") values.weight = "";
        });
      });
    });
  });

  return changed;
}

function syncArrayLength(array, length) {
  const result = Array.isArray(array) ? array.slice(0, length) : [];
  while (result.length < length) {
    result.push("");
  }
  return result;
}

function syncMicroArray(array) {
  return syncArrayLength(array, TOTAL_WEEKS);
}

export function ensureMacroPlanStructure(schedule) {
  if (!schedule || typeof schedule !== "object") return false;
  let changed = false;

  if (!schedule.macroPlan || typeof schedule.macroPlan !== "object") {
    schedule.macroPlan = getDefaultMacroPlan();
    return true;
  }

  const plan = schedule.macroPlan;

  if (typeof plan.startingDate !== "string" || !plan.startingDate) {
    plan.startingDate = new Date().toISOString().slice(0, 10);
    changed = true;
  }

  if (typeof plan.macrocycleName !== "string") {
    plan.macrocycleName = "";
    changed = true;
  }

  if (typeof plan.notes !== "string") {
    plan.notes = "";
    changed = true;
  }

  if (!Array.isArray(plan.macrocycles) || plan.macrocycles.length === 0) {
    plan.macrocycles = [
      createDefaultMacrocycle(0),
      createDefaultMacrocycle(1),
      createDefaultMacrocycle(2),
      createDefaultMacrocycle(3),
    ];
    changed = true;
  }

  plan.macrocycles = plan.macrocycles.map((macro, index) => {
    if (!macro || typeof macro !== "object") {
      changed = true;
      return createDefaultMacrocycle(index);
    }
    if (typeof macro.id !== "string" || !macro.id) {
      macro.id = generateId("macro");
      changed = true;
    }
    if (typeof macro.name !== "string") {
      macro.name = `Macro ${index + 1}`;
      changed = true;
    }
    const weeks = Number.parseInt(macro.weeks, 10);
    if (Number.isNaN(weeks) || weeks <= 0) {
      macro.weeks = 13;
      changed = true;
    } else {
      macro.weeks = weeks;
    }
    return macro;
  });

  if (!Array.isArray(plan.mesocycles) || plan.mesocycles.length === 0) {
    plan.mesocycles = [
      createDefaultMesocycle(0),
      createDefaultMesocycle(1),
      createDefaultMesocycle(2),
      createDefaultMesocycle(3),
    ];
    changed = true;
  }

  plan.mesocycles = plan.mesocycles.map((meso, index) => {
    if (!meso || typeof meso !== "object") {
      changed = true;
      return createDefaultMesocycle(index);
    }
    if (typeof meso.id !== "string" || !meso.id) {
      meso.id = generateId("meso");
      changed = true;
    }
    if (typeof meso.name !== "string") {
      meso.name = String(index + 1);
      changed = true;
    }
    const weeks = Number.parseInt(meso.weeks, 10);
    if (Number.isNaN(weeks) || weeks <= 0) {
      meso.weeks = 4;
      changed = true;
    } else {
      meso.weeks = weeks;
    }
    return meso;
  });

  const lengthNeeded = plan.mesocycles.length;

  if (!plan.strengthFocus || typeof plan.strengthFocus !== "object") {
    const defaults = getDefaultMacroPlan().strengthFocus;
    plan.strengthFocus = JSON.parse(JSON.stringify(defaults));
    changed = true;
  }

  plan.strengthFocus.primaryRow = syncMicroArray(plan.strengthFocus.primaryRow);
  if (typeof plan.strengthFocus.primary === "string" && plan.strengthFocus.primary) {
    plan.strengthFocus.primaryRow[0] = plan.strengthFocus.primaryRow[0] || plan.strengthFocus.primary;
    delete plan.strengthFocus.primary;
  }
  plan.strengthFocus.secondaryRow = syncMicroArray(plan.strengthFocus.secondaryRow);
  if (typeof plan.strengthFocus.secondary === "string" && plan.strengthFocus.secondary) {
    plan.strengthFocus.secondaryRow[0] = plan.strengthFocus.secondaryRow[0] || plan.strengthFocus.secondary;
    delete plan.strengthFocus.secondary;
  }
  if (!plan.strengthFocus.matrix || typeof plan.strengthFocus.matrix !== "object") {
    plan.strengthFocus.matrix = getDefaultMacroPlan().strengthFocus.matrix;
    changed = true;
  }
  FOCUS_CATEGORIES.forEach(({ key }) => {
    plan.strengthFocus.matrix[key] = syncMicroArray(plan.strengthFocus.matrix[key]);
  });

  if (!plan.movementFocus || typeof plan.movementFocus !== "object") {
    plan.movementFocus = JSON.parse(JSON.stringify(getDefaultMacroPlan().movementFocus));
    changed = true;
  }
  plan.movementFocus.primaryRow = syncMicroArray(plan.movementFocus.primaryRow);
  if (typeof plan.movementFocus.primary === "string" && plan.movementFocus.primary) {
    plan.movementFocus.primaryRow[0] = plan.movementFocus.primaryRow[0] || plan.movementFocus.primary;
    delete plan.movementFocus.primary;
  }
  plan.movementFocus.secondaryRow = syncMicroArray(plan.movementFocus.secondaryRow);
  if (typeof plan.movementFocus.secondary === "string" && plan.movementFocus.secondary) {
    plan.movementFocus.secondaryRow[0] = plan.movementFocus.secondaryRow[0] || plan.movementFocus.secondary;
    delete plan.movementFocus.secondary;
  }
  plan.movementFocus.notesRow = syncMicroArray(plan.movementFocus.notesRow);
  if (typeof plan.movementFocus.notes === "string" && plan.movementFocus.notes) {
    plan.movementFocus.notesRow[0] = plan.movementFocus.notesRow[0] || plan.movementFocus.notes;
    delete plan.movementFocus.notes;
  }

  if (!plan.esdFocus || typeof plan.esdFocus !== "object") {
    plan.esdFocus = JSON.parse(JSON.stringify(getDefaultMacroPlan().esdFocus));
    changed = true;
  }
  plan.esdFocus.primaryRow = syncMicroArray(plan.esdFocus.primaryRow);
  if (typeof plan.esdFocus.primary === "string" && plan.esdFocus.primary) {
    plan.esdFocus.primaryRow[0] = plan.esdFocus.primaryRow[0] || plan.esdFocus.primary;
    delete plan.esdFocus.primary;
  }
  plan.esdFocus.secondaryRow = syncMicroArray(plan.esdFocus.secondaryRow);
  if (typeof plan.esdFocus.secondary === "string" && plan.esdFocus.secondary) {
    plan.esdFocus.secondaryRow[0] = plan.esdFocus.secondaryRow[0] || plan.esdFocus.secondary;
    delete plan.esdFocus.secondary;
  }
  plan.esdFocus.notesRow = syncMicroArray(plan.esdFocus.notesRow);
  if (typeof plan.esdFocus.notes === "string" && plan.esdFocus.notes) {
    plan.esdFocus.notesRow[0] = plan.esdFocus.notesRow[0] || plan.esdFocus.notes;
    delete plan.esdFocus.notes;
  }

  plan.phaseSelection = syncMicroArray(plan.phaseSelection);

  if (!Array.isArray(plan.intensityScale)) {
    plan.intensityScale = new Array(TOTAL_WEEKS).fill("");
    changed = true;
  } else {
    plan.intensityScale = syncMicroArray(plan.intensityScale);
  }

  if (!Array.isArray(plan.volumeScale)) {
    plan.volumeScale = new Array(TOTAL_WEEKS).fill("");
    changed = true;
  } else {
    plan.volumeScale = syncMicroArray(plan.volumeScale);
  }

  if (!plan.workload || typeof plan.workload !== "object") {
    plan.workload = { performance: "", loadPlus: "", load: "", base: "", deload: "" };
    changed = true;
  } else {
    if (typeof plan.workload.performance !== "string") plan.workload.performance = "";
    if (typeof plan.workload.loadPlus !== "string") plan.workload.loadPlus = "";
    if (typeof plan.workload.load !== "string") plan.workload.load = "";
    if (typeof plan.workload.base !== "string") plan.workload.base = "";
    if (typeof plan.workload.deload !== "string") plan.workload.deload = "";
  }

  return changed;
}
