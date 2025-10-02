import { supabase } from "./supabaseClient.js";
import { ROLE } from "./auth.js";

function createState() {
  return {
    students: [],
    loading: false,
  };
}

function showMessage(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", Boolean(isError));
}

function formatStudentDisplay(profile) {
  if (!profile) return "未知学生";
  if (profile.full_name) {
    return `${profile.full_name} (${profile.email})`;
  }
  return profile.email ?? "未知学生";
}

function buildWeekPlanSnapshot(schedule, weekIndex) {
  if (!schedule || typeof schedule !== "object") return null;
  const safeWeek = Number.isFinite(weekIndex) ? weekIndex : 0;
  const days = (schedule.dayData || []).map((day) => {
    const entries = (day.entries || []).map((entry) => {
      const actions = (entry.actions || []).map((action) => {
        const weekValues = Array.isArray(action.weekValues)
          ? action.weekValues[safeWeek] || null
          : null;
        return {
          id: action.id,
          actionId: action.actionId,
          actionName: action.actionName,
          weekValue: weekValues,
        };
      });
      return {
        id: entry.id,
        typeName: entry.typeName,
        groupLabel: entry.groupLabel,
        actions,
      };
    });
    return {
      id: day.id,
      title: day.title,
      entries,
    };
  });

  return {
    weekIndex: safeWeek,
    generatedAt: new Date().toISOString(),
    days,
  };
}

export function initTeacherStudents({
  state,
  elements,
  getSelectedWeek = () => 0,
  onStudentsChange = () => {},
}) {
  if (!elements?.form || !elements?.list) return;

  const local = createState();

  async function loadStudents() {
    if (!state.currentUser?.id) return;
    local.loading = true;
    showMessage(elements.message, "正在加载学生名单…");

    const { data, error } = await supabase
      .from("teacher_students")
      .select("id, student_id, created_at")
      .eq("teacher_id", state.currentUser.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("加载学生列表失败", error);
      showMessage(elements.message, "加载学生列表失败：" + error.message, true);
      local.loading = false;
      return;
    }

    const studentIds = data.map((item) => item.student_id).filter(Boolean);
    let profileMap = new Map();
    if (studentIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .in("id", studentIds);

      if (profileError) {
        console.error("加载学生档案失败", profileError);
        showMessage(elements.message, "加载学生档案失败：" + profileError.message, true);
        local.loading = false;
        return;
      }
      profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    }

    local.students = data.map((record) => ({
      id: record.id,
      student_id: record.student_id,
      created_at: record.created_at,
      profile: profileMap.get(record.student_id) || null,
    }));

    renderStudents();
    onStudentsChange([...local.students]);
    showMessage(elements.message, local.students.length ? "" : "尚未绑定学生，先通过邮箱添加。");
    local.loading = false;
  }

  function renderStudents() {
    const container = elements.list;
    if (!container) return;
    container.innerHTML = "";

    if (!local.students.length) {
      const empty = document.createElement("p");
      empty.className = "tip";
      empty.textContent = "暂无学生";
      container.appendChild(empty);
      return;
    }

    local.students.forEach((item) => {
      const row = document.createElement("div");
      row.className = "student-item";

      const info = document.createElement("div");
      info.className = "student-info";
      info.textContent = formatStudentDisplay(item.profile);

      const roleTag = document.createElement("span");
      roleTag.className = "student-role-tag";
    const role = item.profile?.role;
    const roleLabel = role === ROLE.teacher ? "教师" : role === ROLE.admin ? "管理员" : "学生";
      roleTag.textContent = roleLabel;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "danger";
      removeBtn.textContent = "移除";
      removeBtn.addEventListener("click", () => {
        if (!window.confirm("确定要移除该学生吗？")) return;
        removeStudent(item);
      });

      info.appendChild(roleTag);
      row.appendChild(info);
      row.appendChild(removeBtn);
      container.appendChild(row);
    });
  }

  async function removeStudent(studentItem) {
    if (!studentItem?.id) return;
    showMessage(elements.message, "正在移除学生…");

    const { error } = await supabase
      .from("teacher_students")
      .delete()
      .eq("id", studentItem.id)
      .eq("teacher_id", state.currentUser.id);

    if (error) {
      console.error("移除学生失败", error);
      showMessage(elements.message, "移除学生失败：" + error.message, true);
      return;
    }

    await supabase
      .from("weekly_plan_assignments")
      .delete()
      .eq("teacher_id", state.currentUser.id)
      .eq("student_id", studentItem.student_id);

    showMessage(elements.message, "已移除学生。");
    loadStudents();
  }

  elements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const emailRaw = elements.emailInput?.value.trim();
    if (!emailRaw) {
      elements.emailInput?.focus();
      return;
    }

    const email = emailRaw.toLowerCase();
    showMessage(elements.message, "正在绑定学生…");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("查找学生失败", profileError);
      showMessage(elements.message, "查找学生失败：" + profileError.message, true);
      return;
    }

    if (!profile) {
      showMessage(elements.message, "未找到该邮箱对应的学生，请让对方先注册。", true);
      return;
    }

    if (profile.role === ROLE.teacher || profile.role === ROLE.admin) {
      showMessage(elements.message, "该账户无法绑定为学生。", true);
      return;
    }

    const duplicate = local.students.some((item) => item.student_id === profile.id);
    if (duplicate) {
      showMessage(elements.message, "该学生已经绑定，无需重复添加。", true);
      return;
    }

    const { error: bindError } = await supabase
      .from("teacher_students")
      .insert({
        teacher_id: state.currentUser.id,
        student_id: profile.id,
      });

    if (bindError) {
      console.error("绑定学生失败", bindError);
      showMessage(elements.message, "绑定学生失败：" + bindError.message, true);
      return;
    }

    elements.emailInput.value = "";
    showMessage(elements.message, "已成功绑定学生。");
    loadStudents();
  });

  if (elements.syncButton) {
    elements.syncButton.addEventListener("click", async () => {
      if (!local.students.length) {
        showMessage(elements.message, "尚未绑定学生，无法分发周计划。", true);
        return;
      }
      const weekIndex = getSelectedWeek();
      const snapshot = buildWeekPlanSnapshot(state.schedule, weekIndex);
      if (!snapshot || !snapshot.days.length) {
        showMessage(elements.message, "周计划为空，请先在上方填写后再分发。", true);
        return;
      }

      showMessage(elements.message, "正在分发周计划…");

      const { data: planData, error: planError } = await supabase
        .from("weekly_plans")
        .upsert(
          {
            teacher_id: state.currentUser.id,
            week_number: weekIndex + 1,
            schedule_snapshot: snapshot,
            published_at: new Date().toISOString(),
          },
          { onConflict: "teacher_id,week_number" }
        )
        .select("id")
        .maybeSingle();

      if (planError) {
        console.error("发布周计划失败", planError);
        showMessage(elements.message, "发布周计划失败：" + planError.message, true);
        return;
      }

      if (!planData?.id) {
        showMessage(elements.message, "未能创建周计划记录", true);
        return;
      }

      const assignments = local.students.map((student) => ({
        plan_id: planData.id,
        student_id: student.student_id,
        teacher_id: state.currentUser.id,
        status: "assigned",
      }));

      const { error: assignmentError } = await supabase
        .from("weekly_plan_assignments")
        .upsert(assignments, { onConflict: "plan_id,student_id" });

      if (assignmentError) {
        console.error("分发周计划失败", assignmentError);
        showMessage(elements.message, "分发周计划失败：" + assignmentError.message, true);
        return;
      }

      showMessage(elements.message, "周计划已分发给绑定学生。");
      onStudentsChange([...local.students]);
    });
  }

  loadStudents();

  return {
    reload: loadStudents,
    getStudents: () => [...local.students],
  };
}
