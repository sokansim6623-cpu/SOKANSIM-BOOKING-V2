const state = {
  settings: null,
  new: {
    month: startOfMonth(new Date()),
    data: null,
    date: "",
    time: ""
  },
  change: {
    month: startOfMonth(new Date()),
    data: null,
    date: "",
    time: "",
    originalDate: "",
    originalTime: "",
    patientName: "",
    phoneLast4: ""
  },
  lookup: {
    patientName: "",
    phoneLast4: ""
  }
};

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  digitsOnly($("new-phone"));
  digitsOnly($("lookup-phone"));

  $("new-start").addEventListener("click", startNewBooking);
  $("new-prev").addEventListener("click", () => moveMonth("new", -1));
  $("new-next").addEventListener("click", () => moveMonth("new", 1));
  $("new-submit").addEventListener("click", submitNewBooking);

  $("lookup-btn").addEventListener("click", lookupReservations);
  $("change-prev").addEventListener("click", () => moveMonth("change", -1));
  $("change-next").addEventListener("click", () => moveMonth("change", 1));
  $("change-submit").addEventListener("click", submitChange);
  $("change-close").addEventListener("click", closeChangePicker);
});

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((x) => x.classList.remove("active"));

      tab.classList.add("active");
      $(`panel-${tab.dataset.tab}`).classList.add("active");
      hideNotice();
    });
  });
}

function digitsOnly(input) {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 4);
  });
}

async function apiGet(params) {
  const query = new URLSearchParams(params);
  const res = await fetch(`/api/booking?${query.toString()}`, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

async function apiPost(body) {
  const res = await fetch("/api/booking", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

async function ensureSettings() {
  if (state.settings) return state.settings;

  const data = await apiGet({ action: "settings" });
  if (!data.ok) throw new Error("설정 정보를 불러오지 못했습니다.");

  state.settings = data.settings;
  return state.settings;
}

async function startNewBooking() {
  const patientName = $("new-name").value.trim();
  const phoneLast4 = $("new-phone").value.trim();

  if (!patientName) return showNotice("환자명을 입력해 주세요.", true);
  if (!/^\d{4}$/.test(phoneLast4)) return showNotice("휴대폰 번호 뒤 4자리를 입력해 주세요.", true);

  showLoading(true);

  try {
    await ensureSettings();

    state.new.month = startOfMonth(new Date());
    state.new.date = "";
    state.new.time = "";

    $("new-picker").classList.remove("hidden");
    $("new-times-wrap").classList.add("hidden");
    $("new-submit").classList.add("hidden");

    await loadMonth("new");
    hideNotice();
  } catch (err) {
    showNotice(friendlyError(err), true);
  } finally {
    showLoading(false);
  }
}

async function moveMonth(mode, diff) {
  const target = addMonths(state[mode].month, diff);

  if (!monthAllowed(target)) return;

  state[mode].month = target;
  state[mode].date = "";
  state[mode].time = "";

  $(`${mode}-times-wrap`).classList.add("hidden");
  $(`${mode}-submit`).classList.add("hidden");

  showLoading(true);
  try {
    await loadMonth(mode);
  } catch (err) {
    showNotice(friendlyError(err), true);
  } finally {
    showLoading(false);
  }
}

async function loadMonth(mode) {
  const monthKey = toMonthKey(state[mode].month);
  const data = await apiGet({ action: "availability", month: monthKey });

  if (!data.ok) throw new Error(data.error || "예약 가능 시간을 불러오지 못했습니다.");

  state[mode].data = data;
  renderCalendar(mode);
  updateMonthNav(mode);
}

function renderCalendar(mode) {
  const monthDate = state[mode].month;
  const monthKey = toMonthKey(monthDate);
  const data = state[mode].data?.days || {};

  $(`${mode}-month-label`).textContent =
    `${monthDate.getFullYear()}년 ${monthDate.getMonth() + 1}월`;

  const calendar = $(`${mode}-calendar`);
  calendar.innerHTML = "";

  const firstWeekday = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();

  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement("button");
    blank.type = "button";
    blank.className = "day blank";
    blank.disabled = true;
    calendar.appendChild(blank);
  }

  for (let day = 1; day <= lastDay; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
    const slots = data[dateKey] || [];

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(day);
    btn.className = "day";

    if (!slots.length) {
      btn.classList.add("disabled");
      btn.disabled = true;
    } else {
      btn.classList.add("available");
      btn.addEventListener("click", () => selectDate(mode, dateKey, slots, btn));
    }

    if (state[mode].date === dateKey) btn.classList.add("selected");
    calendar.appendChild(btn);
  }
}

function selectDate(mode, dateKey, slots) {
  state[mode].date = dateKey;
  state[mode].time = "";

  renderCalendar(mode);

  $(`${mode}-selected-date`).textContent = formatDateKorean(dateKey);
  $(`${mode}-times-wrap`).classList.remove("hidden");
  $(`${mode}-submit`).classList.add("hidden");

  const wrap = $(`${mode}-times`);
  wrap.innerHTML = "";

  slots.forEach((time) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "time-btn";
    btn.textContent = time;

    btn.addEventListener("click", () => {
      state[mode].time = time;
      wrap.querySelectorAll(".time-btn").forEach((x) => x.classList.remove("selected"));
      btn.classList.add("selected");
      $(`${mode}-submit`).classList.remove("hidden");
    });

    wrap.appendChild(btn);
  });

  $(`${mode}-times-wrap`).scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function submitNewBooking() {
  const patientName = $("new-name").value.trim();
  const phoneLast4 = $("new-phone").value.trim();
  const appointmentDate = state.new.date;
  const appointmentTime = state.new.time;

  if (!appointmentDate || !appointmentTime) return;

  if (!confirm(`${formatDateKorean(appointmentDate)} ${appointmentTime}\n이 시간으로 예약하시겠습니까?`)) return;

  showLoading(true);

  try {
    const result = await apiPost({
      action: "create",
      patientName,
      phoneLast4,
      appointmentDate,
      appointmentTime
    });

    if (!result.ok) throw new Error(result.error || "예약에 실패했습니다.");

    showNotice(`${formatDateKorean(appointmentDate)} ${appointmentTime} 예약이 완료되었습니다.`);
    $("new-picker").classList.add("hidden");
    state.new.date = "";
    state.new.time = "";
  } catch (err) {
    showNotice(friendlyError(err), true);

    if (String(err.message).includes("slot_unavailable")) {
      try { await loadMonth("new"); } catch (_) {}
    }
  } finally {
    showLoading(false);
  }
}

async function lookupReservations() {
  const patientName = $("lookup-name").value.trim();
  const phoneLast4 = $("lookup-phone").value.trim();

  if (!patientName) return showNotice("환자명을 입력해 주세요.", true);
  if (!/^\d{4}$/.test(phoneLast4)) return showNotice("휴대폰 번호 뒤 4자리를 입력해 주세요.", true);

  showLoading(true);

  try {
    const result = await apiPost({
      action: "lookup",
      patientName,
      phoneLast4
    });

    state.lookup.patientName = patientName;
    state.lookup.phoneLast4 = phoneLast4;

    if (!result.ok) {
      if (result.error === "not_found") {
        $("lookup-results").innerHTML = "";
        $("lookup-results").classList.add("hidden");
        return showNotice("확인되는 예약이 없습니다.", true);
      }
      throw new Error(result.error || "예약을 확인하지 못했습니다.");
    }

    renderReservations(result.reservations || []);
    hideNotice();
  } catch (err) {
    showNotice(friendlyError(err), true);
  } finally {
    showLoading(false);
  }
}

function renderReservations(reservations) {
  const wrap = $("lookup-results");
  wrap.innerHTML = "";

  reservations.forEach((reservation) => {
    const card = document.createElement("article");
    card.className = "reservation";

    const date = document.createElement("div");
    date.className = "reservation-date";
    date.textContent = `${formatDateKorean(reservation.appointmentDate)} ${reservation.appointmentTime}`;

    const sub = document.createElement("div");
    sub.className = "reservation-sub";
    sub.textContent = "오지혜 원장님 외래진료";

    const actions = document.createElement("div");
    actions.className = "actions";

    const change = document.createElement("button");
    change.type = "button";
    change.className = "secondary";
    change.textContent = "예약 변경";
    change.addEventListener("click", () => openChangePicker(reservation));

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "danger";
    cancel.textContent = "예약 취소";
    cancel.addEventListener("click", () => cancelReservation(reservation));

    actions.append(change, cancel);
    card.append(date, sub, actions);
    wrap.appendChild(card);
  });

  wrap.classList.remove("hidden");
  closeChangePicker();
}

async function openChangePicker(reservation) {
  state.change.patientName = state.lookup.patientName;
  state.change.phoneLast4 = state.lookup.phoneLast4;
  state.change.originalDate = reservation.appointmentDate;
  state.change.originalTime = reservation.appointmentTime;
  state.change.month = monthFromKey(reservation.appointmentDate.slice(0, 7));
  state.change.date = "";
  state.change.time = "";

  $("change-original").textContent =
    `현재 예약: ${formatDateKorean(reservation.appointmentDate)} ${reservation.appointmentTime}`;

  $("change-picker").classList.remove("hidden");
  $("change-times-wrap").classList.add("hidden");
  $("change-submit").classList.add("hidden");

  showLoading(true);
  try {
    await ensureSettings();
    await loadMonth("change");
    $("change-picker").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showNotice(friendlyError(err), true);
  } finally {
    showLoading(false);
  }
}

function closeChangePicker() {
  $("change-picker").classList.add("hidden");
  state.change.date = "";
  state.change.time = "";
}

async function submitChange() {
  const s = state.change;

  if (!s.date || !s.time) return;

  if (!confirm(`${formatDateKorean(s.date)} ${s.time}\n이 시간으로 변경하시겠습니까?`)) return;

  showLoading(true);

  try {
    const result = await apiPost({
      action: "change",
      patientName: s.patientName,
      phoneLast4: s.phoneLast4,
      originalDate: s.originalDate,
      originalTime: s.originalTime,
      appointmentDate: s.date,
      appointmentTime: s.time
    });

    if (!result.ok) throw new Error(result.error || "예약 변경에 실패했습니다.");

    showNotice(`${formatDateKorean(s.date)} ${s.time}으로 예약이 변경되었습니다.`);
    closeChangePicker();
    await lookupReservations();
  } catch (err) {
    showNotice(friendlyError(err), true);
    if (String(err.message).includes("slot_unavailable")) {
      try { await loadMonth("change"); } catch (_) {}
    }
  } finally {
    showLoading(false);
  }
}

async function cancelReservation(reservation) {
  const text =
    `${formatDateKorean(reservation.appointmentDate)} ${reservation.appointmentTime}\n예약을 취소하시겠습니까?`;

  if (!confirm(text)) return;

  showLoading(true);

  try {
    const result = await apiPost({
      action: "cancel",
      patientName: state.lookup.patientName,
      phoneLast4: state.lookup.phoneLast4,
      originalDate: reservation.appointmentDate,
      originalTime: reservation.appointmentTime
    });

    if (!result.ok) throw new Error(result.error || "예약 취소에 실패했습니다.");

    showNotice("예약이 취소되었습니다.");
    await lookupReservations();
  } catch (err) {
    showNotice(friendlyError(err), true);
  } finally {
    showLoading(false);
  }
}

function updateMonthNav(mode) {
  const current = startOfMonth(new Date());
  const max = maxMonth();

  const month = state[mode].month;

  $(`${mode}-prev`).disabled = month <= current;
  $(`${mode}-next`).disabled = month >= max;
}

function monthAllowed(month) {
  const current = startOfMonth(new Date());
  const max = maxMonth();
  return month >= current && month <= max;
}

function maxMonth() {
  const days = Number(state.settings?.bookingDays || 180);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + days);
  return startOfMonth(maxDate);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthFromKey(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateKorean(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const day = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${y}년 ${m}월 ${d}일 (${day})`;
}

function showNotice(message, isError = false) {
  const box = $("notice");
  box.textContent = message;
  box.classList.toggle("error", isError);
  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideNotice() {
  $("notice").classList.add("hidden");
}

function showLoading(show) {
  $("loading").classList.toggle("hidden", !show);
}

function friendlyError(err) {
  const msg = String(err?.message || err || "");

  if (msg.includes("slot_unavailable")) return "방금 다른 예약이 등록된 시간입니다. 다른 시간을 선택해 주세요.";
  if (msg.includes("not_found")) return "확인되는 예약이 없습니다.";
  if (msg.includes("invalid_input")) return "입력 내용을 다시 확인해 주세요.";
  if (msg.includes("unauthorized")) return "예약 시스템 연결 정보를 확인해 주세요.";
  if (msg.includes("환경변수")) return "예약 시스템 연결 설정이 필요합니다.";

  return "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}
