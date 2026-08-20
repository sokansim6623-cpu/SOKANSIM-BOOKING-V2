const $ = (id) => document.getElementById(id);

const lookupForm = $("lookupForm");
const nameInput = $("patientName");
const phoneInput = $("phoneLast4");
const lookupButton = $("lookupButton");
const lookupError = $("lookupError");

const reservationCard = $("reservationCard");
const reservationList = $("reservationList");

const changeCard = $("changeCard");
const cancelCard = $("cancelCard");
const successCard = $("successCard");

const changeCloseButton = $("changeCloseButton");
const cancelCloseButton = $("cancelCloseButton");
const changeSubmitButton = $("changeSubmitButton");
const cancelSubmitButton = $("cancelSubmitButton");

const changeError = $("changeError");
const cancelError = $("cancelError");

const dateInput = $("appointmentDate");
const dateGuide = $("dateGuide");
const timeArea = $("timeArea");

const calendarTitle = $("calendarTitle");
const calendarDays = $("calendarDays");
const previousMonthButton = $("previousMonth");
const nextMonthButton = $("nextMonth");

const changeCurrentSummary = $("changeCurrentSummary");
const cancelSummary = $("cancelSummary");

const successTitle = $("successTitle");
const successSummary = $("successSummary");
const restartButton = $("restartButton");

const loading = $("loading");

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

let settings = null;
let reservations = [];
let currentReservation = null;
let selectedTime = "";
let calendarMonth = startOfMonth(new Date());
let monthAvailability = {};

const pad = (n) => String(n).padStart(2, "0");

function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function parseDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(key) {
  const date = parseDate(key);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function addDays(date, count) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function showError(element, message) {
  element.textContent = message;
  element.classList.add("show");
}

function clearError(element) {
  element.textContent = "";
  element.classList.remove("show");
}

function showLoading(show) {
  loading.classList.toggle("hidden", !show);
}

function friendlyError(error) {
  const message = String(error?.message || error || "");

  if (message.includes("slot_unavailable")) {
    return "방금 다른 예약이 등록된 시간입니다. 다른 시간을 선택해 주세요.";
  }
  if (message.includes("not_found")) {
    return "확인되는 예약이 없습니다.";
  }
  if (message.includes("invalid_input")) {
    return "입력 내용을 다시 확인해 주세요.";
  }
  if (message.includes("unauthorized")) {
    return "예약 시스템 연결 정보를 확인해 주세요.";
  }

  return message || "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

async function apiGet(params) {
  const query = new URLSearchParams(params);

  const response = await fetch(`/api/booking?${query.toString()}`, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "요청을 처리하지 못했습니다.");
  }

  return result;
}

async function apiPost(body) {
  const response = await fetch("/api/booking", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(body)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || "요청을 처리하지 못했습니다.");
  }

  return result;
}

async function ensureSettings() {
  if (settings) return settings;

  const result = await apiGet({ action: "settings" });

  if (!result.ok) {
    throw new Error(result.error || "설정 정보를 불러오지 못했습니다.");
  }

  settings = result.settings;
  return settings;
}

function getMaxDate() {
  const days = Number(settings?.bookingDays || 180);
  return addDays(new Date(), days);
}

function monthAllowed(monthDate) {
  const minMonth = startOfMonth(new Date());
  const maxMonth = startOfMonth(getMaxDate());

  return monthDate >= minMonth && monthDate <= maxMonth;
}

phoneInput.oninput = () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, "").slice(0, 4);
};

lookupForm.onsubmit = async (event) => {
  event.preventDefault();
  clearError(lookupError);

  const patientName = nameInput.value.trim();
  const phoneLast4 = phoneInput.value.trim();

  if (!patientName) {
    return showError(lookupError, "성함을 입력해 주세요.");
  }

  if (!/^\d{4}$/.test(phoneLast4)) {
    return showError(lookupError, "휴대전화번호 뒤 4자리를 확인해 주세요.");
  }

  lookupButton.disabled = true;
  lookupButton.textContent = "확인 중입니다…";
  showLoading(true);

  try {
    const result = await apiPost({
      action: "lookup",
      patientName,
      phoneLast4
    });

    if (!result.ok) {
      throw new Error(result.error || "예약을 확인하지 못했습니다.");
    }

    reservations = Array.isArray(result.reservations)
      ? result.reservations
      : [];

    if (!reservations.length) {
      throw new Error("not_found");
    }

    renderReservations();
  } catch (error) {
    reservationCard.classList.add("hidden");
    changeCard.classList.add("hidden");
    cancelCard.classList.add("hidden");
    showError(lookupError, friendlyError(error));
  } finally {
    lookupButton.disabled = false;
    lookupButton.innerHTML = '예약 확인하기 <span>→</span>';
    showLoading(false);
  }
};

function renderReservations() {
  reservationList.innerHTML = "";

  reservations.forEach((reservation, index) => {
    const item = document.createElement("article");
    item.className = "reservation-item";

    const box = document.createElement("div");
    box.className = "reservation-box";

    const nameBlock = document.createElement("div");
    nameBlock.innerHTML = `<span>환자명</span><strong></strong>`;
    nameBlock.querySelector("strong").textContent = reservation.patientName;

    const doctorBlock = document.createElement("div");
    doctorBlock.innerHTML = `<span>담당 의료진</span><strong>오지혜 원장님</strong>`;

    const dateBlock = document.createElement("div");
    dateBlock.className = "wide";
    dateBlock.innerHTML = `<span>예약 일시</span><strong></strong>`;
    dateBlock.querySelector("strong").textContent =
      `${formatDate(reservation.appointmentDate)} ${reservation.appointmentTime}`;

    box.append(nameBlock, doctorBlock, dateBlock);

    const actions = document.createElement("div");
    actions.className = "action-row";

    const changeButton = document.createElement("button");
    changeButton.type = "button";
    changeButton.className = "secondary";
    changeButton.textContent = "예약 변경";
    changeButton.onclick = () => openChange(index);

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "danger-ghost";
    cancelButton.textContent = "예약 취소";
    cancelButton.onclick = () => openCancel(index);

    actions.append(changeButton, cancelButton);
    item.append(box, actions);
    reservationList.appendChild(item);
  });

  reservationCard.classList.remove("hidden");
  changeCard.classList.add("hidden");
  cancelCard.classList.add("hidden");
  successCard.classList.add("hidden");

  reservationCard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function openChange(index) {
  currentReservation = reservations[index];

  clearError(changeError);

  changeCard.classList.remove("hidden");
  cancelCard.classList.add("hidden");
  successCard.classList.add("hidden");

  changeCurrentSummary.textContent =
    `현재 예약: ${formatDate(currentReservation.appointmentDate)} ${currentReservation.appointmentTime}`;

  dateInput.value = "";
  selectedTime = "";
  timeArea.className = "empty";
  timeArea.textContent = "먼저 날짜를 선택해 주세요.";
  dateGuide.textContent = "회색 날짜는 휴진일 또는 예약 불가일입니다.";

  calendarMonth = startOfMonth(new Date());

  showLoading(true);

  try {
    await ensureSettings();
    await loadAvailability(calendarMonth);
    renderCalendar();

    changeCard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) {
    showError(changeError, friendlyError(error));
  } finally {
    showLoading(false);
  }
}

function openCancel(index) {
  currentReservation = reservations[index];

  clearError(cancelError);

  cancelCard.classList.remove("hidden");
  changeCard.classList.add("hidden");
  successCard.classList.add("hidden");

  cancelSummary.textContent =
    `${formatDate(currentReservation.appointmentDate)} ${currentReservation.appointmentTime} · 오지혜 원장님`;

  cancelCard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

changeCloseButton.onclick = () => {
  changeCard.classList.add("hidden");
};

cancelCloseButton.onclick = () => {
  cancelCard.classList.add("hidden");
};

async function loadAvailability(monthDate) {
  const monthKey = toMonthKey(monthDate);

  const result = await apiGet({
    action: "availability",
    month: monthKey
  });

  if (!result.ok) {
    throw new Error(result.error || "예약 가능 시간을 불러오지 못했습니다.");
  }

  monthAvailability = result.days || {};
}

function availableSlotsForDate(dateKey) {
  let slots = Array.isArray(monthAvailability[dateKey])
    ? [...monthAvailability[dateKey]]
    : [];

  if (
    currentReservation &&
    dateKey === currentReservation.appointmentDate &&
    !slots.includes(currentReservation.appointmentTime)
  ) {
    slots.push(currentReservation.appointmentTime);
    slots.sort();
  }

  return slots;
}

function renderCalendar() {
  calendarDays.innerHTML = "";

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();

  calendarTitle.textContent = `${year}년 ${month + 1}월`;

  for (let i = 0; i < first.getDay(); i++) {
    const empty = document.createElement("span");
    empty.className = "day empty";
    calendarDays.appendChild(empty);
  }

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    const dateKey = toKey(date);
    const slots = availableSlotsForDate(dateKey);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(day);
    button.className = "day";

    if (dateKey === dateInput.value) {
      button.classList.add("selected");
    }

    if (!slots.length) {
      button.disabled = true;
      button.classList.add("disabled");
    } else {
      button.onclick = () => {
        dateInput.value = dateKey;
        selectedTime = "";

        calendarDays
          .querySelectorAll(".day")
          .forEach((item) => item.classList.remove("selected"));

        button.classList.add("selected");

        dateGuide.textContent =
          `${formatDate(dateKey)} 변경 시간을 선택해 주세요.`;

        renderTimes(dateKey);
        clearError(changeError);
      };
    }

    calendarDays.appendChild(button);
  }

  const currentMonth = startOfMonth(new Date());
  const maxMonth = startOfMonth(getMaxDate());

  previousMonthButton.disabled = calendarMonth <= currentMonth;
  nextMonthButton.disabled = calendarMonth >= maxMonth;
}

function renderTimes(dateKey) {
  const slots = availableSlotsForDate(dateKey);

  if (!slots.length) {
    timeArea.className = "empty";
    timeArea.textContent = "선택 가능한 시간이 없습니다.";
    return;
  }

  timeArea.className = "time-grid";
  timeArea.innerHTML = "";

  slots.forEach((time) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "time-button";
    button.textContent = time;

    if (time === selectedTime) {
      button.classList.add("selected");
    }

    button.onclick = () => {
      selectedTime = time;

      timeArea
        .querySelectorAll(".time-button")
        .forEach((item) => item.classList.remove("selected"));

      button.classList.add("selected");
    };

    timeArea.appendChild(button);
  });
}

previousMonthButton.onclick = async () => {
  const target = addMonths(calendarMonth, -1);

  if (!monthAllowed(target)) return;

  calendarMonth = target;
  dateInput.value = "";
  selectedTime = "";
  timeArea.className = "empty";
  timeArea.textContent = "먼저 날짜를 선택해 주세요.";

  showLoading(true);

  try {
    await loadAvailability(calendarMonth);
    renderCalendar();
  } catch (error) {
    showError(changeError, friendlyError(error));
  } finally {
    showLoading(false);
  }
};

nextMonthButton.onclick = async () => {
  const target = addMonths(calendarMonth, 1);

  if (!monthAllowed(target)) return;

  calendarMonth = target;
  dateInput.value = "";
  selectedTime = "";
  timeArea.className = "empty";
  timeArea.textContent = "먼저 날짜를 선택해 주세요.";

  showLoading(true);

  try {
    await loadAvailability(calendarMonth);
    renderCalendar();
  } catch (error) {
    showError(changeError, friendlyError(error));
  } finally {
    showLoading(false);
  }
};

changeSubmitButton.onclick = async () => {
  clearError(changeError);

  if (!currentReservation) {
    return showError(changeError, "변경할 예약을 다시 선택해 주세요.");
  }

  const appointmentDate = dateInput.value;

  if (!appointmentDate) {
    return showError(changeError, "변경할 날짜를 선택해 주세요.");
  }

  if (!selectedTime) {
    return showError(changeError, "변경할 시간을 선택해 주세요.");
  }

  const ok = confirm(
    `${formatDate(appointmentDate)} ${selectedTime}\n이 시간으로 변경하시겠습니까?`
  );

  if (!ok) return;

  changeSubmitButton.disabled = true;
  showLoading(true);

  try {
    const result = await apiPost({
      action: "change",
      patientName: currentReservation.patientName,
      phoneLast4: phoneInput.value.trim(),
      originalDate: currentReservation.appointmentDate,
      originalTime: currentReservation.appointmentTime,
      appointmentDate,
      appointmentTime: selectedTime
    });

    if (!result.ok) {
      throw new Error(result.error || "예약 변경에 실패했습니다.");
    }

    showSuccess(
      "예약 변경이 완료되었습니다.",
      `${formatDate(appointmentDate)} ${selectedTime}<br>오지혜 원장님 외래진료`
    );
  } catch (error) {
    showError(changeError, friendlyError(error));

    if (String(error?.message || "").includes("slot_unavailable")) {
      try {
        await loadAvailability(calendarMonth);
        renderCalendar();
        if (dateInput.value) renderTimes(dateInput.value);
      } catch (_) {}
    }
  } finally {
    changeSubmitButton.disabled = false;
    showLoading(false);
  }
};

cancelSubmitButton.onclick = async () => {
  clearError(cancelError);

  if (!currentReservation) {
    return showError(cancelError, "취소할 예약을 다시 선택해 주세요.");
  }

  const ok = confirm(
    `${formatDate(currentReservation.appointmentDate)} ${currentReservation.appointmentTime}\n예약을 취소하시겠습니까?`
  );

  if (!ok) return;

  cancelSubmitButton.disabled = true;
  showLoading(true);

  try {
    const result = await apiPost({
      action: "cancel",
      patientName: currentReservation.patientName,
      phoneLast4: phoneInput.value.trim(),
      originalDate: currentReservation.appointmentDate,
      originalTime: currentReservation.appointmentTime
    });

    if (!result.ok) {
      throw new Error(result.error || "예약 취소에 실패했습니다.");
    }

    showSuccess(
      "예약이 취소되었습니다.",
      `${formatDate(currentReservation.appointmentDate)} ${currentReservation.appointmentTime}<br>오지혜 원장님 외래진료`
    );
  } catch (error) {
    showError(cancelError, friendlyError(error));
  } finally {
    cancelSubmitButton.disabled = false;
    showLoading(false);
  }
};

function showSuccess(title, summary) {
  successTitle.textContent = title;
  successSummary.innerHTML = summary;

  reservationCard.classList.add("hidden");
  changeCard.classList.add("hidden");
  cancelCard.classList.add("hidden");
  successCard.classList.remove("hidden");

  successCard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

restartButton.onclick = async () => {
  successCard.classList.add("hidden");
  lookupError.classList.remove("show");

  if (nameInput.value.trim() && /^\d{4}$/.test(phoneInput.value.trim())) {
    lookupForm.requestSubmit();
  } else {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};
