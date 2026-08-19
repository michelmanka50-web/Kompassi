const MONTHS = [
  "Januari",
  "Februari",
  "Mars",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "Augusti",
  "September",
  "Oktober",
  "November",
  "December",
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
const STORAGE_KEY = "budgetti-data-v1";
const THEME_KEY = "kompassi-theme";
const currentCalendarMonth = new Date().getMonth();

let state = loadState();
let activeSection = "today";
let activeView = "dashboard";
let toastTimer;
let showAllMonths = false;

const app = document.querySelector("#app");
const sectionNav = document.querySelector("#sectionNav");
const budgetNav = document.querySelector("#budgetNav");
const financeActions = document.querySelector(".topbar-actions");
const yearSelect = document.querySelector("#yearSelect");
const monthTabs = document.querySelector("#monthTabs");
const yearDialog = document.querySelector("#yearDialog");
const newYearInput = document.querySelector("#newYearInput");
const copyBudgetInput = document.querySelector("#copyBudgetInput");
const dataDialog = document.querySelector("#dataDialog");
const importDataInput = document.querySelector("#importDataInput");

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function line(name, budget, actual) {
  return { id: uid(), name, budget, actual };
}

function createMonth(index, filledThrough = -1, multiplier = 1) {
  const hasActual = index <= filledThrough;
  const variation = [0.98, 1.03, 1, 1.05, 0.99, 1.06, 1.02, 1.04, 1, 1.02, 1.01, 1.08][index];
  const incomeActual = hasActual ? Math.round(34500 * multiplier * variation / 100) * 100 : 0;
  const housingActual = hasActual ? 10150 : 0;
  const foodActual = hasActual ? Math.round((4400 + ((index % 3) - 1) * 310) / 10) * 10 : 0;
  const transportActual = hasActual ? 1320 + (index % 2) * 240 : 0;
  const leisureActual = hasActual ? 1800 + (index % 4) * 190 : 0;
  const otherActual = hasActual ? 960 + (index % 3) * 230 : 0;
  const plannedSaving = 6000;
  const savingVariation = [5600, 6100, 5800, 6400, 5900, 6200, 5700, 6300, 6000, 6100, 5900, 6200][index];
  const actualSaving = hasActual ? savingVariation : 0;

  return {
    incomes: [line("Lön", 34500 * multiplier, incomeActual), line("Övrigt", 0, 0)],
    expenses: [
      line("Boende", 10200, housingActual),
      line("Mat", 4500, foodActual),
      line("Transport", 1600, transportActual),
      line("Nöjen", 2200, leisureActual),
      line("Övrigt", 1500, otherActual),
    ],
    subscriptions: [],
    savings: [line("Långsiktigt sparande", plannedSaving, actualSaving)],
  };
}

function createYear(year, withExample = false) {
  const filledThrough = withExample ? Math.min(currentCalendarMonth, 7) : -1;
  return {
    savingsGoal: 72000,
    savingsGoalDate: `${year}-12-31`,
    goals: [
      { id: uid(), name: "Buffert", target: 50000, saved: withExample ? 31500 : 0 },
      { id: uid(), name: "Semester", target: 25000, saved: withExample ? 12800 : 0 },
    ],
    months: MONTHS.map((_, index) => createMonth(index, filledThrough, year === 2027 ? 1.04 : 1)),
  };
}

function createPersonalState() {
  return {
    training: {
      weeklyTarget: 3,
      sessions: [
        {
          id: uid(),
          name: "Ryggpass",
          weeklyTarget: 1,
          exercises: [
            { id: uid(), name: "Latsdrag", sets: 3, reps: "8–12", weight: "" },
            { id: uid(), name: "Sittande rodd", sets: 3, reps: "8–12", weight: "" },
          ],
        },
        {
          id: uid(),
          name: "Bröstpass",
          weeklyTarget: 1,
          exercises: [
            { id: uid(), name: "Bänkpress", sets: 3, reps: "6–10", weight: "" },
            { id: uid(), name: "Bröstpress", sets: 3, reps: "8–12", weight: "" },
          ],
        },
      ],
      sessionLogs: [],
      routines: [
        { id: uid(), name: "Kvällsstretch", type: "Stretching", duration: 10, weeklyTarget: 3 },
        { id: uid(), name: "Rörlighet för höfter", type: "Rörlighet", duration: 8, weeklyTarget: 3 },
      ],
      routineLogs: [],
    },
  };
}

function createInitialState() {
  return {
    activeYear: "2026",
    personal: createPersonalState(),
    years: {
      2026: createYear(2026, true),
      2027: createYear(2027, false),
    },
  };
}

function normalizeBudgetYears(years) {
  Object.entries(years).forEach(([key, year]) => {
    if (!Array.isArray(year.goals)) year.goals = [];
    if (!year.savingsGoalDate) year.savingsGoalDate = `${key}-12-31`;
    if (!Array.isArray(year.months)) throw new Error("Budgetår saknar månader");
    year.months.forEach((month) => {
      if (!Array.isArray(month.incomes)) month.incomes = [];
      if (!Array.isArray(month.expenses)) month.expenses = [];
      if (!Array.isArray(month.subscriptions)) month.subscriptions = [];
      if (!Array.isArray(month.savings)) month.savings = [];
    });
  });
  return years;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createInitialState();
    const parsed = JSON.parse(saved);
    if (!parsed.years || !parsed.activeYear) throw new Error("Ogiltig data");
    parsed.years = normalizeBudgetYears(parsed.years);
    parsed.personal = normalizePersonalState(parsed.personal);
    return parsed;
  } catch {
    return createInitialState();
  }
}

function normalizePersonalState(personal) {
  const defaults = createPersonalState();
  if (!personal) return defaults;
  const savedTraining = personal.training && typeof personal.training === "object" ? personal.training : defaults.training;
  const normalized = {
    ...defaults,
    ...personal,
    training: {
      weeklyTarget: Math.max(1, Number(savedTraining.weeklyTarget) || defaults.training.weeklyTarget),
      sessions: Array.isArray(savedTraining.sessions)
        ? savedTraining.sessions.map((session) => ({
            ...session,
            weeklyTarget: Math.max(1, Number(session.weeklyTarget) || 1),
            exercises: Array.isArray(session.exercises) ? session.exercises : [],
          }))
        : defaults.training.sessions,
      sessionLogs: Array.isArray(savedTraining.sessionLogs) ? savedTraining.sessionLogs : [],
      routines: Array.isArray(savedTraining.routines) ? savedTraining.routines : defaults.training.routines,
      routineLogs: Array.isArray(savedTraining.routineLogs) ? savedTraining.routineLogs : [],
    },
  };

  return normalized;
}

function saveState(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (message) showToast(message);
}

function exportStateFile(prefix = "kompassi-backup") {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${prefix}-${dateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function normalizeImportedState(imported) {
  if (!imported || typeof imported !== "object" || !imported.years || typeof imported.years !== "object") {
    throw new Error("Filen innehåller ingen Kompassi-data");
  }
  const years = normalizeBudgetYears(imported.years);
  const yearKeys = Object.keys(years);
  if (!yearKeys.length) throw new Error("Filen innehåller inga budgetår");
  const activeYear = years[String(imported.activeYear)] ? String(imported.activeYear) : yearKeys.sort()[0];
  return {
    ...imported,
    activeYear,
    years,
    personal: normalizePersonalState(imported.personal),
  };
}

function showToast(message, actionLabel = "", action = null) {
  const toast = document.querySelector("#toast");
  toast.replaceChildren();
  const messageNode = document.createElement("span");
  messageNode.textContent = message;
  toast.appendChild(messageNode);

  if (actionLabel && action) {
    const actionButton = document.createElement("button");
    actionButton.className = "toast-action";
    actionButton.type = "button";
    actionButton.textContent = actionLabel;
    actionButton.addEventListener("click", () => {
      action();
      toast.classList.remove("show");
    });
    toast.appendChild(actionButton);
  }

  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), action ? 5200 : 2200);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatCompact(value) {
  return new Intl.NumberFormat("sv-SE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function formatInputAmount(value) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function parseAmount(value) {
  const normalized = String(value).replace(/\s/g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function sumLines(lines, key) {
  return lines.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}

function monthTotals(month) {
  const budgetIncome = sumLines(month.incomes, "budget");
  const actualIncome = sumLines(month.incomes, "actual");
  const budgetSubscriptions = sumLines(month.subscriptions || [], "budget");
  const actualSubscriptions = sumLines(month.subscriptions || [], "actual");
  const budgetExpenses = sumLines(month.expenses, "budget") + budgetSubscriptions;
  const actualExpenses = sumLines(month.expenses, "actual") + actualSubscriptions;
  const budgetSavings = sumLines(month.savings, "budget");
  const actualSavings = sumLines(month.savings, "actual");

  return {
    budgetIncome,
    actualIncome,
    budgetExpenses,
    actualExpenses,
    budgetSubscriptions,
    actualSubscriptions,
    budgetSavings,
    actualSavings,
    budgetResult: budgetIncome - budgetExpenses - budgetSavings,
    actualResult: actualIncome - actualExpenses - actualSavings,
  };
}

function yearTotals(year) {
  return totalMonths(year.months);
}

function totalMonths(months) {
  return months.reduce(
    (result, month) => {
      const totals = monthTotals(month);
      Object.keys(result).forEach((key) => {
        result[key] += totals[key];
      });
      return result;
    },
    {
      budgetIncome: 0,
      actualIncome: 0,
      budgetExpenses: 0,
      actualExpenses: 0,
      budgetSubscriptions: 0,
      actualSubscriptions: 0,
      budgetSavings: 0,
      actualSavings: 0,
      budgetResult: 0,
      actualResult: 0,
    },
  );
}

function percentage(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function signedClass(value) {
  return value >= 0 ? "positive" : "negative";
}

function currentYearData() {
  return state.years[state.activeYear];
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function formatShortDate(dateString) {
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${dateString}T00:00:00`),
  );
}

function monthsUntil(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  const diffDays = (target - new Date()) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.ceil(diffDays / 30.44));
}

function renderSectionNavigation() {
  sectionNav.querySelectorAll("[data-section]").forEach((button) => {
    const isActive = button.dataset.section === activeSection;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  const isFinance = activeSection === "finance";
  budgetNav.hidden = !isFinance;
  financeActions.hidden = !isFinance;
  document.body.dataset.section = activeSection;
}

function renderNavigation() {
  const years = Object.keys(state.years).sort((a, b) => Number(a) - Number(b));
  yearSelect.innerHTML = years
    .map((year) => `<option value="${year}" ${year === state.activeYear ? "selected" : ""}>${year}</option>`)
    .join("");

  monthTabs.innerHTML = MONTH_SHORT.map(
    (month, index) => {
      const isActive = activeView === String(index);
      const isCurrent = state.activeYear === String(new Date().getFullYear()) && index === currentCalendarMonth;
      return `<button class="period-tab ${isActive ? "active" : ""} ${isCurrent ? "current-month" : ""}" type="button" data-view="${index}" ${isActive ? 'aria-current="page"' : ""}>${month}</button>`;
    },
  ).join("");

  const dashboardButton = document.querySelector('[data-view="dashboard"]');
  dashboardButton.classList.toggle("active", activeView === "dashboard");
  if (activeView === "dashboard") dashboardButton.setAttribute("aria-current", "page");
  else dashboardButton.removeAttribute("aria-current");

  const activeMonth = monthTabs.querySelector(".active");
  if (activeMonth) {
    const tabsRect = monthTabs.getBoundingClientRect();
    const activeRect = activeMonth.getBoundingClientRect();
    const activeCenter = activeRect.left - tabsRect.left + monthTabs.scrollLeft + activeRect.width / 2;
    monthTabs.scrollLeft = activeCenter - monthTabs.clientWidth / 2;
  }
}

function render() {
  renderSectionNavigation();

  if (activeSection === "finance") {
    renderNavigation();
    if (activeView === "dashboard") renderDashboard();
    else renderMonth(Number(activeView));
    refreshIcons();
    return;
  }

  if (activeSection === "today") renderToday();
  if (activeSection === "training") renderTraining();
  refreshIcons();
}

function passiAsset(stateName) {
  return `assets/passi/passi-${stateName}.webp`;
}

function refreshIcons() {
  if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
}

function effectiveTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") document.documentElement.dataset.theme = stored;
  else delete document.documentElement.dataset.theme;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.content = effectiveTheme() === "dark" ? "#0b0b0d" : "#0088ff";
  updateThemeToggleButton();
}

function updateThemeToggleButton() {
  const button = document.querySelector("#themeToggleButton");
  if (!button) return;
  const isDark = effectiveTheme() === "dark";
  button.querySelector("span").innerHTML = `<i data-lucide="${isDark ? "sun" : "moon"}"></i>`;
  button.querySelector("strong").textContent = isDark ? "Ljust läge" : "Mörkt läge";
  refreshIcons();
}

function getFinanceSnapshot() {
  const year = currentYearData();
  const summaries = year.months.map(monthTotals);
  const latestActualMonth = Math.max(
    -1,
    ...summaries.map((total, index) =>
      total.actualIncome || total.actualExpenses || total.actualSavings ? index : -1,
    ),
  );
  const recordedMonths = latestActualMonth >= 0 ? year.months.slice(0, latestActualMonth + 1) : [];
  const totals = totalMonths(recordedMonths);
  return {
    latestActualMonth,
    totals,
    expenseDifference: totals.budgetExpenses - totals.actualExpenses,
    savingsPercent: percentage(totals.actualSavings, year.savingsGoal),
  };
}

function renderToday() {
  const finance = getFinanceSnapshot();
  const training = state.personal.training;
  const weeklyLogs = training.sessionLogs.filter((log) => isInCurrentWeek(log.date));
  const weeklyProgress = percentage(weeklyLogs.length, training.weeklyTarget);
  const greeting = new Date().getHours() < 11 ? "God morgon" : new Date().getHours() < 17 ? "God eftermiddag" : "God kväll";

  app.innerHTML = `
    <section class="page-heading">
      <div>
        <p class="eyebrow">${formatDate()}</p>
        <h2>${greeting}!</h2>
        <p>Snabb koll på ekonomi och träning.</p>
      </div>
    </section>

    <section class="today-summary-grid">
      <article class="panel">
        <div class="section-heading">
          <div><h3>Ekonomi</h3><p>${finance.latestActualMonth >= 0 ? `${state.activeYear} hittills` : "Inget utfall registrerat"}</p></div>
          <button class="icon-button" type="button" data-go-section="finance" aria-label="Öppna Ekonomi"><i data-lucide="arrow-up-right"></i></button>
        </div>
        <div class="summary-list">
          <div class="summary-row"><span>Utgifter</span><strong>${formatCurrency(finance.totals.actualExpenses)}</strong></div>
          <div class="summary-row"><span>${finance.expenseDifference >= 0 ? "Under budget" : "Över budget"}</span><strong class="${finance.expenseDifference >= 0 ? "positive" : "negative"}">${formatCurrency(Math.abs(finance.expenseDifference))}</strong></div>
          <div class="summary-row total"><span>Sparat hittills</span><strong>${formatCurrency(finance.totals.actualSavings)}</strong></div>
        </div>
        <div class="mini-progress"><span style="width:${finance.savingsPercent}%"></span></div>
        <small class="today-summary-note">${Math.round(finance.savingsPercent)}% av årets sparmål</small>
      </article>

      <article class="panel">
        <div class="section-heading">
          <div><h3>Träning</h3><p>Denna vecka</p></div>
          <button class="icon-button" type="button" data-go-section="training" aria-label="Öppna Träning"><i data-lucide="arrow-up-right"></i></button>
        </div>
        <div class="training-count"><strong>${weeklyLogs.length}</strong><span>av ${training.weeklyTarget} pass</span></div>
        <div class="training-progress"><span style="width:${weeklyProgress}%"></span></div>
        <small class="today-summary-note">${weeklyProgress >= 100 ? "Veckans mål är klart." : `${Math.max(0, training.weeklyTarget - weeklyLogs.length)} pass kvar till veckans mål.`}</small>
      </article>
    </section>
  `;

  bindSectionLinks();
  refreshIcons();
}

function startOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isInCurrentWeek(day) {
  const date = new Date(`${day}T12:00:00`);
  const start = startOfCurrentWeek();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return date >= start && date < end;
}

function renderTraining() {
  const training = state.personal.training;
  const today = dateKey();
  const weeklyLogs = training.sessionLogs.filter((log) => isInCurrentWeek(log.date));
  const weeklyProgress = percentage(weeklyLogs.length, training.weeklyTarget);
  const routineLogsThisWeek = training.routineLogs.filter((log) => isInCurrentWeek(log.date));
  const passiState = weeklyProgress >= 100 ? "celebrating" : weeklyProgress > 0 ? "encouraging" : "welcome";

  app.innerHTML = `
    <section class="page-heading open-heading">
      <div>
        <p class="eyebrow">Styrka, rörlighet och återhämtning</p>
        <h2>Träning</h2>
        <p>Bygg dina pass, följ veckans rytm och samla stretching och välmående på samma plats.</p>
      </div>
      <span class="day-status ${weeklyProgress >= 100 ? "successful" : ""}"><i data-lucide="dumbbell"></i>${weeklyLogs.length} av ${training.weeklyTarget} pass denna vecka</span>
    </section>

    <section class="training-hero">
      <div class="training-hero-copy">
        <p class="eyebrow">Veckans träningsmål</p>
        <div class="training-count"><strong>${weeklyLogs.length}</strong><span>av</span><label><input id="weeklyTrainingTarget" type="number" min="1" max="14" value="${training.weeklyTarget}" aria-label="Antal träningspass per vecka" /><small>pass</small></label></div>
        <div class="training-progress" role="progressbar" aria-label="Veckans träningsframsteg" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(weeklyProgress)}"><span style="width:${weeklyProgress}%"></span></div>
        <p>${weeklyProgress >= 100 ? "Veckans mål är klart. Bra jobbat." : `${Math.max(0, training.weeklyTarget - weeklyLogs.length)} pass kvar till veckans mål.`}</p>
      </div>
      <div class="training-week-days" aria-label="Denna veckas träningsdagar">
        ${recentWeekDays().map((day) => {
          const count = training.sessionLogs.filter((log) => log.date === day).length;
          const label = new Intl.DateTimeFormat("sv-SE", { weekday: "short" }).format(new Date(`${day}T12:00:00`)).replace(".", "");
          return `<span class="${count ? "done" : ""}" title="${count ? `${count} genomförda pass` : "Inget pass registrerat"}"><small>${label}</small><i>${count || ""}</i></span>`;
        }).join("")}
      </div>
      <img src="${passiAsset(passiState)}" alt="Passi ${weeklyProgress >= 100 ? "firar veckans träningsmål" : "uppmuntrar dig i träningen"}" />
    </section>

    <section class="training-layout">
      <div class="workout-column">
        <div class="section-heading training-section-heading">
          <div><p class="eyebrow">Dina passmallar</p><h3>Träningspass</h3><p>Lägg in övningar och markera passet när du har tränat.</p></div>
        </div>

        <div class="workout-list">
          ${training.sessions.map((session) => {
            const doneToday = training.sessionLogs.some((log) => log.sessionId === session.id && log.date === today);
            const completedThisWeek = weeklyLogs.filter((log) => log.sessionId === session.id).length;
            return `
              <article class="workout-card ${doneToday ? "completed" : ""}" data-workout-id="${session.id}">
                <div class="workout-heading">
                  <span class="workout-icon" aria-hidden="true"><i data-lucide="dumbbell"></i></span>
                  <label><span>Passnamn</span><input class="workout-name" value="${escapeHtml(session.name)}" aria-label="Träningspassets namn" /></label>
                  <label class="workout-frequency"><span><strong>${completedThisWeek}</strong> av <input class="workout-weekly-target" type="number" min="1" max="7" value="${session.weeklyTarget}" aria-label="Veckomål för ${escapeHtml(session.name)}" /></span><small>gånger per vecka</small></label>
                  <button class="button ${doneToday ? "button-completed" : "button-primary"} complete-workout" type="button"><i data-lucide="${doneToday ? "circle-check" : "check"}"></i>${doneToday ? "Genomfört idag" : "Markera genomfört"}</button>
                  <button class="icon-button delete-workout" type="button" aria-label="Ta bort ${escapeHtml(session.name)}"><i data-lucide="trash-2"></i></button>
                </div>
                <div class="exercise-list">
                  <div class="exercise-head"><span>Övning</span><span>Set</span><span>Repetitioner</span><span>Vikt</span><span></span></div>
                  ${session.exercises.map((exercise) => `
                    <div class="exercise-row" data-exercise-id="${exercise.id}">
                      <input class="exercise-name" value="${escapeHtml(exercise.name)}" aria-label="Övning" />
                      <input class="exercise-sets" type="number" min="1" max="20" value="${Number(exercise.sets) || 1}" aria-label="Antal set för ${escapeHtml(exercise.name)}" />
                      <input class="exercise-reps" value="${escapeHtml(exercise.reps)}" placeholder="8–12" aria-label="Repetitioner för ${escapeHtml(exercise.name)}" />
                      <input class="exercise-weight" value="${escapeHtml(exercise.weight || "")}" placeholder="kg" aria-label="Vikt för ${escapeHtml(exercise.name)}" />
                      <button class="icon-button delete-exercise" type="button" aria-label="Ta bort ${escapeHtml(exercise.name)}"><i data-lucide="trash-2"></i></button>
                    </div>
                  `).join("") || '<div class="empty-exercises">Inga övningar ännu. Lägg till den första nedan.</div>'}
                </div>
                <button class="text-button add-exercise" type="button"><i data-lucide="plus"></i>Lägg till övning</button>
              </article>
            `;
          }).join("") || '<div class="empty-state illustrated-empty"><i data-lucide="dumbbell"></i><p>Skapa ditt första träningspass nedan.</p></div>'}
        </div>

        <form class="add-workout-form" id="addWorkoutForm">
          <label class="field"><span>Nytt träningspass</span><input id="newWorkoutName" placeholder="Till exempel: Benpass" required /></label>
          <button class="button button-primary" type="submit"><i data-lucide="plus"></i>Skapa pass</button>
        </form>
      </div>

      <aside class="wellbeing-column">
        <section class="wellbeing-surface">
          <div class="section-heading"><div><span class="support-icon"><i data-lucide="person-standing"></i></span><h3>Rörlighet & välmående</h3><p>Stretching, rörlighet och lugnare rutiner.</p></div></div>
          <div class="routine-list">
            ${training.routines.map((routine) => {
              const doneToday = training.routineLogs.some((log) => log.routineId === routine.id && log.date === today);
              const weekCount = routineLogsThisWeek.filter((log) => log.routineId === routine.id).length;
              return `
                <div class="routine-row ${doneToday ? "completed" : ""}" data-routine-id="${routine.id}">
                  <button class="routine-check" type="button" aria-label="${doneToday ? "Ta bort dagens markering för" : "Markera som klar idag:"} ${escapeHtml(routine.name)}"><i data-lucide="check"></i></button>
                  <div class="routine-fields">
                    <input class="routine-name" value="${escapeHtml(routine.name)}" aria-label="Rutinens namn" />
                    <div><select class="routine-type" aria-label="Typ av rutin"><option ${routine.type === "Stretching" ? "selected" : ""}>Stretching</option><option ${routine.type === "Rörlighet" ? "selected" : ""}>Rörlighet</option><option ${routine.type === "Välmående" ? "selected" : ""}>Välmående</option><option ${routine.type === "Återhämtning" ? "selected" : ""}>Återhämtning</option></select><label><input class="routine-duration" type="number" min="1" max="180" value="${routine.duration}" /> min</label></div>
                    <small>${weekCount} av ${routine.weeklyTarget} gånger denna vecka</small>
                  </div>
                  <label class="routine-target"><input type="number" class="routine-weekly-target" min="1" max="14" value="${routine.weeklyTarget}" /><span>/ vecka</span></label>
                  <button class="icon-button delete-routine" type="button" aria-label="Ta bort ${escapeHtml(routine.name)}"><i data-lucide="trash-2"></i></button>
                </div>
              `;
            }).join("") || '<p class="empty-state">Lägg till en rutin för stretching eller rörlighet.</p>'}
          </div>
          <form class="add-routine-form" id="addRoutineForm">
            <label class="field"><span>Ny rutin</span><input id="newRoutineName" placeholder="Till exempel: Morgonrörlighet" required /></label>
            <div class="form-grid-two"><label class="field"><span>Typ</span><select id="newRoutineType"><option>Stretching</option><option>Rörlighet</option><option>Välmående</option><option>Återhämtning</option></select></label><label class="field"><span>Minuter</span><input id="newRoutineDuration" type="number" min="1" max="180" value="10" required /></label></div>
            <label class="field"><span>Gånger per vecka</span><input id="newRoutineTarget" type="number" min="1" max="14" value="3" required /></label>
            <button class="button button-secondary" type="submit"><i data-lucide="plus"></i>Lägg till rutin</button>
          </form>
        </section>
      </aside>
    </section>
  `;

  bindTrainingEvents();
  refreshIcons();
}

function recentWeekDays() {
  const start = startOfCurrentWeek();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return dateKey(date);
  });
}

function bindTrainingEvents() {
  const training = state.personal.training;
  const today = dateKey();

  document.querySelector("#weeklyTrainingTarget").addEventListener("change", (event) => {
    training.weeklyTarget = Math.max(1, Math.min(14, Number(event.target.value) || 1));
    saveState("Veckomålet är uppdaterat");
    renderTraining();
  });

  document.querySelectorAll("[data-workout-id]").forEach((element) => {
    const session = training.sessions.find((item) => item.id === element.dataset.workoutId);
    element.querySelector(".workout-name").addEventListener("change", (event) => {
      session.name = event.target.value.trim() || "Namnlöst pass";
      saveState("Passet är uppdaterat");
    });
    element.querySelector(".workout-weekly-target").addEventListener("change", (event) => {
      session.weeklyTarget = Math.max(1, Math.min(7, Number(event.target.value) || 1));
      saveState("Passets veckomål är uppdaterat");
      renderTraining();
    });
    element.querySelector(".complete-workout").addEventListener("click", () => {
      const logIndex = training.sessionLogs.findIndex((log) => log.sessionId === session.id && log.date === today);
      if (logIndex >= 0) training.sessionLogs.splice(logIndex, 1);
      else training.sessionLogs.push({ id: uid(), sessionId: session.id, sessionName: session.name, date: today });
      saveState(logIndex >= 0 ? "Dagens passmarkering är borttagen" : `${session.name} är registrerat`);
      renderTraining();
    });
    element.querySelector(".delete-workout").addEventListener("click", () => {
      const index = training.sessions.findIndex((item) => item.id === session.id);
      const [removed] = training.sessions.splice(index, 1);
      saveState();
      renderTraining();
      showToast("Passet har tagits bort", "Ångra", () => {
        training.sessions.splice(index, 0, removed);
        saveState();
        renderTraining();
      });
    });
    element.querySelectorAll("[data-exercise-id]").forEach((row) => {
      const exercise = session.exercises.find((item) => item.id === row.dataset.exerciseId);
      const saveExercise = () => {
        exercise.name = row.querySelector(".exercise-name").value.trim() || "Namnlös övning";
        exercise.sets = Math.max(1, Number(row.querySelector(".exercise-sets").value) || 1);
        exercise.reps = row.querySelector(".exercise-reps").value.trim();
        exercise.weight = row.querySelector(".exercise-weight").value.trim();
        saveState("Övningen är uppdaterad");
      };
      row.querySelectorAll("input").forEach((input) => input.addEventListener("change", saveExercise));
      row.querySelector(".delete-exercise").addEventListener("click", () => {
        session.exercises = session.exercises.filter((item) => item.id !== exercise.id);
        saveState("Övningen har tagits bort");
        renderTraining();
      });
    });
    element.querySelector(".add-exercise").addEventListener("click", () => {
      session.exercises.push({ id: uid(), name: "Ny övning", sets: 3, reps: "8–12", weight: "" });
      saveState();
      renderTraining();
      document.querySelector(`[data-workout-id="${session.id}"] .exercise-row:last-child .exercise-name`)?.select();
    });
  });

  document.querySelector("#addWorkoutForm").addEventListener("submit", (event) => {
    event.preventDefault();
    training.sessions.push({ id: uid(), name: document.querySelector("#newWorkoutName").value.trim(), weeklyTarget: 1, exercises: [] });
    saveState("Träningspasset är skapat");
    renderTraining();
  });

  document.querySelectorAll("[data-routine-id]").forEach((element) => {
    const routine = training.routines.find((item) => item.id === element.dataset.routineId);
    element.querySelector(".routine-check").addEventListener("click", () => {
      const logIndex = training.routineLogs.findIndex((log) => log.routineId === routine.id && log.date === today);
      if (logIndex >= 0) training.routineLogs.splice(logIndex, 1);
      else training.routineLogs.push({ id: uid(), routineId: routine.id, routineName: routine.name, date: today });
      saveState(logIndex >= 0 ? "Dagens markering är borttagen" : `${routine.name} är registrerad`);
      renderTraining();
    });
    const saveRoutine = () => {
      routine.name = element.querySelector(".routine-name").value.trim() || "Namnlös rutin";
      routine.type = element.querySelector(".routine-type").value;
      routine.duration = Math.max(1, Number(element.querySelector(".routine-duration").value) || 1);
      routine.weeklyTarget = Math.max(1, Number(element.querySelector(".routine-weekly-target").value) || 1);
      saveState("Rutinen är uppdaterad");
    };
    element.querySelectorAll("input, select").forEach((input) => input.addEventListener("change", saveRoutine));
    element.querySelector(".delete-routine").addEventListener("click", () => {
      training.routines = training.routines.filter((item) => item.id !== routine.id);
      saveState("Rutinen har tagits bort");
      renderTraining();
    });
  });

  document.querySelector("#addRoutineForm").addEventListener("submit", (event) => {
    event.preventDefault();
    training.routines.push({
      id: uid(),
      name: document.querySelector("#newRoutineName").value.trim(),
      type: document.querySelector("#newRoutineType").value,
      duration: Math.max(1, Number(document.querySelector("#newRoutineDuration").value) || 10),
      weeklyTarget: Math.max(1, Number(document.querySelector("#newRoutineTarget").value) || 1),
    });
    saveState("Rutinen är tillagd");
    renderTraining();
  });
}

function bindSectionLinks() {
  document.querySelectorAll("[data-go-section]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSection = button.dataset.goSection;
      render();
      app.focus();
    });
  });
}

function renderDashboard() {
  const year = currentYearData();
  const monthSummaries = year.months.map(monthTotals);
  const latestActualMonth = Math.max(
    -1,
    ...monthSummaries.map((total, index) =>
      total.actualIncome || total.actualExpenses || total.actualSavings ? index : -1,
    ),
  );
  const recordedMonths = latestActualMonth >= 0 ? year.months.slice(0, latestActualMonth + 1) : [];
  const futureMonths = latestActualMonth >= 0 ? year.months.slice(latestActualMonth + 1) : year.months;
  const ytdTotals = totalMonths(recordedMonths);
  const futureTotals = totalMonths(futureMonths);
  const savingsPercent = percentage(ytdTotals.actualSavings, year.savingsGoal);
  const monthsLeft = monthsUntil(year.savingsGoalDate);
  const remainingSavings = Math.max(0, year.savingsGoal - ytdTotals.actualSavings);
  const monthlyNeeded = remainingSavings / monthsLeft;
  const expensePercent = percentage(ytdTotals.actualExpenses, ytdTotals.budgetExpenses);
  const expenseDifference = ytdTotals.budgetExpenses - ytdTotals.actualExpenses;
  const periodLabel = latestActualMonth >= 0 ? `Januari–${MONTHS[latestActualMonth]}` : "Ingen period registrerad";
  const expenseDetail = latestActualMonth < 0
    ? "Inget utfall registrerat"
    : expenseDifference >= 0
      ? `${formatCurrency(expenseDifference)} under budget`
      : `${formatCurrency(Math.abs(expenseDifference))} över budget`;
  const forecastResult = ytdTotals.actualResult + futureTotals.budgetResult;
  const allocatedSavings = year.goals.reduce((sum, goal) => sum + (Number(goal.saved) || 0), 0);
  const unallocatedSavings = ytdTotals.actualSavings - allocatedSavings;

  app.innerHTML = `
    <section class="page-heading">
      <div>
        <p class="eyebrow">Årsöversikt ${state.activeYear}</p>
        <h2>Din ekonomi i ett ögonblick</h2>
        <p>Följ budget, utfall och sparande. Alla belopp kan korrigeras direkt under respektive månad.</p>
      </div>
      <span class="status-pill"><span class="status-dot"></span> Sparas automatiskt</span>
    </section>

    <section class="metric-grid" aria-label="Årets nyckeltal">
      ${metricCard("Budget hittills", formatCurrency(ytdTotals.budgetExpenses), periodLabel)}
      ${metricCard("Utfall hittills", formatCurrency(ytdTotals.actualExpenses), expenseDetail, expenseDifference < 0 ? "negative" : "")}
      ${metricCard("Sparat hittills", formatCurrency(ytdTotals.actualSavings), `${Math.round(savingsPercent)} % av sparmålet`, "positive")}
      ${metricCard("Kvar efter allt", formatCurrency(ytdTotals.actualResult), "Pengar kvar efter utgifter och sparande", signedClass(ytdTotals.actualResult))}
    </section>

    <section class="dashboard-grid">
      <div class="dashboard-stack">
        <article class="panel">
          <div class="section-heading">
            <div>
              <h3>Budget mot utfall</h3>
              <p>${showAllMonths ? "Utgifter per månad, hela året" : "Nuvarande månad"}</p>
            </div>
            <button class="button button-secondary months-toggle" id="toggleMonths" type="button">${showAllMonths ? "Visa bara denna månad" : "Visa alla månader"}</button>
          </div>
          ${renderBarChart(year, latestActualMonth)}
        </article>

        <article class="panel">
          <div class="section-heading">
            <div>
              <h3>Kvar varje månad</h3>
              <p>${showAllMonths ? "Hela året" : "Nuvarande månad"}</p>
            </div>
          </div>
          ${renderMonthTable(year, latestActualMonth)}
        </article>
      </div>

      <aside class="dashboard-stack">
        <article class="panel">
          <div class="section-heading">
            <div>
              <h3>Årets sparmål</h3>
              <p>Totalt faktiskt sparande</p>
            </div>
          </div>
          <div class="savings-summary">
            <div class="progress-ring" style="--progress: ${savingsPercent * 3.6}deg">
              <strong>${Math.round(savingsPercent)}%</strong>
              <span>uppnått</span>
            </div>
            <div class="savings-copy">
              <strong>${formatCurrency(ytdTotals.actualSavings)}</strong>
              <p>av ${formatCurrency(year.savingsGoal)} till ${formatShortDate(year.savingsGoalDate)}</p>
            </div>
          </div>
          <div class="summary-list">
            <div class="summary-row"><span>Kvar till målet</span><strong>${formatCurrency(remainingSavings)}</strong></div>
            <div class="summary-row"><span>Behövs per återstående månad</span><strong>${formatCurrency(monthlyNeeded)}</strong></div>
            <div class="summary-row total"><span>Beräknat kvar vid årets slut</span><strong class="${signedClass(forecastResult)}">${formatCurrency(forecastResult)}</strong></div>
          </div>
          <div class="inline-field">
            <label for="annualSavingsGoal">Sparmål</label>
            <span class="money-field"><input class="money-input" id="annualSavingsGoal" type="text" inputmode="numeric" value="${formatInputAmount(year.savingsGoal)}" /><span>kr</span></span>
          </div>
          <div class="inline-field">
            <label for="savingsGoalDate">Måldatum</label>
            <input class="date-input" id="savingsGoalDate" type="date" value="${year.savingsGoalDate}" />
          </div>
        </article>

        <article class="panel">
          <div class="section-heading">
            <div>
              <h3>Dina mål</h3>
              <p>Så fördelas årets registrerade sparande</p>
            </div>
            <button class="text-button" type="button" id="addGoalButton">+ Lägg till</button>
          </div>
          <div class="goal-list">
            ${year.goals.length ? year.goals.map(renderGoal).join("") : '<p class="empty-state">Inga mål ännu.</p>'}
          </div>
          <div class="allocation-summary">
            <span>${unallocatedSavings >= 0 ? "Ofördelat sparande" : "Överfördelat på mål"}</span>
            <strong class="${signedClass(unallocatedSavings)}">${formatCurrency(Math.abs(unallocatedSavings))}</strong>
          </div>
        </article>
      </aside>
    </section>
  `;

  bindDashboardEvents();
  refreshIcons();
}

function metricCard(label, value, detail, valueClass = "") {
  return `
    <article class="metric-card">
      <p class="metric-label">${label}</p>
      <p class="metric-value ${valueClass}">${value}</p>
      <p class="metric-detail">${detail}</p>
    </article>
  `;
}

function renderBarChart(year, latestActualMonth) {
  const values = year.months.flatMap((month) => {
    const totals = monthTotals(month);
    return [totals.budgetExpenses, totals.actualExpenses];
  });
  const maxValue = Math.max(...values, 1);
  const compactMonth = latestActualMonth >= 0 ? latestActualMonth : 0;
  const visibleIndexes = showAllMonths ? year.months.map((_, index) => index) : [compactMonth];

  return `
    <div class="bar-chart ${showAllMonths ? "" : "compact"}" aria-label="Budgeterade och faktiska utgifter per månad">
      ${visibleIndexes
        .map((index) => {
          const month = year.months[index];
          const totals = monthTotals(month);
          const budgetWidth = Math.max(2, (totals.budgetExpenses / maxValue) * 100);
          const actualWidth = totals.actualExpenses ? Math.max(2, (totals.actualExpenses / maxValue) * 100) : 0;
          const isFuture = index > latestActualMonth;
          const isCurrent = state.activeYear === String(new Date().getFullYear()) && index === currentCalendarMonth;
          return `
            <div class="bar-group ${isFuture ? "future" : ""}">
              <div class="bar-group-heading">
                <strong>${MONTHS[index]}</strong>
                ${isCurrent ? '<span class="chart-status current">Nu</span>' : isFuture ? '<span class="chart-status">Kommande</span>' : ""}
              </div>
              <div class="comparison-row">
                <span class="series-label">Budget</span>
                <span class="comparison-track"><span class="comparison-fill budget ${isFuture ? "planned" : ""}" style="width: ${budgetWidth}%"></span></span>
                <strong>${formatInputAmount(totals.budgetExpenses)} kr</strong>
              </div>
              <div class="comparison-row">
                <span class="series-label">Utfall</span>
                <span class="comparison-track"><span class="comparison-fill actual${totals.actualExpenses ? "" : " missing"}" style="width: ${actualWidth}%"></span></span>
                <strong class="${totals.actualExpenses ? "" : "no-data"}">${totals.actualExpenses ? `${formatInputAmount(totals.actualExpenses)} kr` : "Ej reg."}</strong>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
    <p class="chart-footnote">Kommande månader visar planerad budget tills ett utfall har registrerats.</p>
  `;
}

function renderMonthTable(year, latestActualMonth) {
  const compactMonth = latestActualMonth >= 0 ? latestActualMonth : 0;
  const compactStart = compactMonth;
  const compactEnd = compactMonth;
  return `
    <div class="table-wrap month-result-wrap">
      <table class="month-result-table">
        <thead>
          <tr><th>Månad</th><th class="optional-mobile">Inkomst</th><th>Utgifter</th><th class="optional-mobile">Sparande</th><th>Kvar</th></tr>
        </thead>
        <tbody>
          ${year.months
            .map((month, index) => {
              const totals = monthTotals(month);
              const hasActual = Boolean(totals.actualIncome || totals.actualExpenses || totals.actualSavings);
              const hideOnCompact = !showAllMonths && (index < compactStart || index > compactEnd);
              const currentBadge = state.activeYear === String(new Date().getFullYear()) && index === currentCalendarMonth
                ? '<span class="month-now">Nu</span>'
                : "";
              const noData = '<span class="no-data">Ej registrerat</span>';
              return `
                <tr class="${hideOnCompact ? "compact-hidden" : ""} ${hasActual ? "" : "future-row"}">
                  <td data-label="Månad"><button class="text-button month-link" type="button" data-open-month="${index}">${MONTHS[index]}</button>${currentBadge}</td>
                  <td class="optional-mobile" data-label="Inkomst">${hasActual ? formatCurrency(totals.actualIncome) : noData}</td>
                  <td data-label="Utgifter">${hasActual ? formatCurrency(totals.actualExpenses) : noData}</td>
                  <td class="optional-mobile" data-label="Sparande">${hasActual ? formatCurrency(totals.actualSavings) : noData}</td>
                  <td class="${hasActual ? signedClass(totals.actualResult) : ""}" data-label="Kvar">${hasActual ? formatCurrency(totals.actualResult) : noData}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderGoal(goal) {
  const progress = percentage(goal.saved, goal.target);
  return `
    <div class="goal-item" data-goal-id="${goal.id}">
      <div class="goal-heading">
        <strong>${escapeHtml(goal.name)}</strong>
        <button class="icon-button delete-goal" type="button" aria-label="Ta bort ${escapeHtml(goal.name)}">×</button>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width: ${progress}%"></div></div>
      <div class="goal-footer"><span>${formatCurrency(goal.saved)} av ${formatCurrency(goal.target)}</span><strong>${Math.round(progress)}%</strong></div>
      <div class="goal-input-grid">
        <label><span>Sparat</span><span class="money-field"><input class="money-input goal-saved-input" type="text" inputmode="numeric" aria-label="Sparat till ${escapeHtml(goal.name)}" value="${formatInputAmount(goal.saved)}" /><span>kr</span></span></label>
        <label><span>Mål</span><span class="money-field"><input class="money-input goal-target-input" type="text" inputmode="numeric" aria-label="Målbelopp för ${escapeHtml(goal.name)}" value="${formatInputAmount(goal.target)}" /><span>kr</span></span></label>
      </div>
    </div>
  `;
}

function bindDashboardEvents() {
  document.querySelector("#annualSavingsGoal").addEventListener("change", (event) => {
    currentYearData().savingsGoal = Math.max(0, parseAmount(event.target.value));
    saveState("Sparmålet är uppdaterat");
    renderDashboard();
  });

  document.querySelector("#savingsGoalDate").addEventListener("change", (event) => {
    if (!event.target.value) return;
    currentYearData().savingsGoalDate = event.target.value;
    saveState("Måldatumet är uppdaterat");
    renderDashboard();
  });

  document.querySelector("#toggleMonths").addEventListener("click", () => {
    showAllMonths = !showAllMonths;
    renderDashboard();
  });

  document.querySelector("#addGoalButton").addEventListener("click", () => {
    const name = window.prompt("Vad heter målet?", "Nytt mål");
    if (!name?.trim()) return;
    const target = Number(window.prompt("Hur mycket vill du spara?", "10000"));
    if (!Number.isFinite(target) || target <= 0) return;
    currentYearData().goals.push({ id: uid(), name: name.trim(), target, saved: 0 });
    saveState("Målet har lagts till");
    renderDashboard();
  });

  document.querySelectorAll("[data-open-month]").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.openMonth;
      render();
      app.focus();
    });
  });

  document.querySelectorAll(".goal-item").forEach((element) => {
    const goal = currentYearData().goals.find((item) => item.id === element.dataset.goalId);
    element.querySelector(".goal-saved-input").addEventListener("change", (event) => {
      goal.saved = Math.max(0, parseAmount(event.target.value));
      saveState("Målet är uppdaterat");
      renderDashboard();
    });
    element.querySelector(".goal-target-input").addEventListener("change", (event) => {
      goal.target = Math.max(1, parseAmount(event.target.value) || 1);
      saveState("Målet är uppdaterat");
      renderDashboard();
    });
    element.querySelector(".delete-goal").addEventListener("click", () => {
      const yearKey = state.activeYear;
      const goals = state.years[yearKey].goals;
      const removedIndex = goals.findIndex((item) => item.id === goal.id);
      const [removedGoal] = goals.splice(removedIndex, 1);
      saveState();
      renderDashboard();
      showToast("Målet har tagits bort", "Ångra", () => {
        state.years[yearKey].goals.splice(removedIndex, 0, removedGoal);
        saveState();
        render();
      });
    });
  });
}

function renderMonth(monthIndex) {
  const month = currentYearData().months[monthIndex];
  const totals = monthTotals(month);
  const expenseUsage = percentage(totals.actualExpenses, totals.budgetExpenses);
  const savingUsage = percentage(totals.actualSavings, totals.budgetSavings);
  const expenseStatus = expenseUsage > 100 ? "danger" : expenseUsage > 85 ? "warning" : "";

  app.innerHTML = `
    <section class="page-heading">
      <div>
        <p class="eyebrow">${state.activeYear}</p>
        <h2>${MONTHS[monthIndex]}</h2>
        <p>Ändra budget och utfall direkt i tabellerna. Din årsöversikt räknas om automatiskt.</p>
      </div>
      <button class="button button-secondary" type="button" id="backToDashboard">Till årsöversikten</button>
    </section>

    <section class="metric-grid" aria-label="Månadens nyckeltal">
      ${metricCard("Faktisk inkomst", formatCurrency(totals.actualIncome), `Budget ${formatCurrency(totals.budgetIncome)}`)}
      ${metricCard("Faktiska utgifter", formatCurrency(totals.actualExpenses), `Budget ${formatCurrency(totals.budgetExpenses)}`, expenseUsage > 100 ? "negative" : "")}
      ${metricCard("Faktiskt sparande", formatCurrency(totals.actualSavings), `Mål ${formatCurrency(totals.budgetSavings)}`, "positive")}
      ${metricCard("Kvar efter allt", formatCurrency(totals.actualResult), "Inkomst minus utgifter och sparande", signedClass(totals.actualResult))}
    </section>

    <section class="month-layout">
      <div class="month-sections">
        ${renderBudgetSection("Inkomster", "incomes", month.incomes, monthIndex)}
        ${renderBudgetSection("Utgifter", "expenses", month.expenses, monthIndex)}
        ${renderBudgetSection("Prenumerationer", "subscriptions", month.subscriptions, monthIndex)}
        ${renderBudgetSection("Sparande", "savings", month.savings, monthIndex)}
      </div>

      <aside class="month-sidebar">
        <article class="panel">
          <div class="section-heading"><div><h3>Månadssummering</h3><p>Planerat och faktiskt</p></div></div>
          <div class="summary-list">
            <div class="summary-row"><span>Budgeterad inkomst</span><strong>${formatCurrency(totals.budgetIncome)}</strong></div>
            <div class="summary-row"><span>Budgeterade utgifter</span><strong>${formatCurrency(totals.budgetExpenses)}</strong></div>
            <div class="summary-row subscription-summary-row"><span>Varav prenumerationer</span><strong>${formatCurrency(totals.budgetSubscriptions)}</strong></div>
            <div class="summary-row"><span>Planerat sparande</span><strong>${formatCurrency(totals.budgetSavings)}</strong></div>
            <div class="summary-row total"><span>Budgetmarginal</span><strong class="${signedClass(totals.budgetResult)}">${formatCurrency(totals.budgetResult)}</strong></div>
          </div>
        </article>

        <article class="panel">
          <div class="section-heading"><div><h3>Så går månaden</h3><p>Framsteg mot planen</p></div></div>
          <div class="month-health">
            ${healthBlock("Använd utgiftsbudget", expenseUsage, expenseStatus)}
            ${healthBlock("Nått sparmålet", savingUsage, "")}
          </div>
        </article>
      </aside>
    </section>
  `;

  bindMonthEvents(monthIndex);
  refreshIcons();
}

function healthBlock(label, value, status) {
  return `
    <div class="health-block">
      <div class="progress-label"><span>${label}</span><strong>${Math.round(value)}%</strong></div>
      <div class="progress-track"><div class="progress-fill ${status}" style="width: ${Math.min(100, value)}%"></div></div>
    </div>
  `;
}

function nextBudgetMonth(monthIndex) {
  if (monthIndex < 11) {
    return {
      yearKey: state.activeYear,
      monthIndex: monthIndex + 1,
      label: MONTHS[monthIndex + 1],
    };
  }

  const nextYearKey = String(Number(state.activeYear) + 1);
  if (!state.years[nextYearKey]) return null;
  return { yearKey: nextYearKey, monthIndex: 0, label: `Januari ${nextYearKey}` };
}

function renderBudgetSection(title, type, rows, monthIndex) {
  const sectionMeta = {
    incomes: { icon: "trending-up", detail: "Beloppen anges i kronor" },
    expenses: { icon: "shopping-bag", detail: "Beloppen anges i kronor" },
    subscriptions: { icon: "repeat-2", detail: "Räknas automatiskt in i Utgifter" },
    savings: { icon: "piggy-bank", detail: "Beloppen anges i kronor" },
  }[type];
  const nextMonth = nextBudgetMonth(monthIndex);
  return `
    <article class="panel budget-section" data-section="${type}">
      <div class="section-title-row">
        <div class="budget-section-heading"><span class="budget-section-icon" aria-hidden="true"><i data-lucide="${sectionMeta.icon}"></i></span><div><h3>${title}</h3><p class="metric-detail">${sectionMeta.detail}</p></div></div>
        <button class="button button-secondary add-row" type="button" data-type="${type}"><i data-lucide="plus"></i>Ny rad</button>
      </div>
      <div class="table-wrap">
        <table class="budget-table">
          <thead><tr><th>Kategori</th><th>Budget</th><th>Utfall</th><th aria-label="Åtgärd"></th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr data-row-id="${row.id}">
                    <td data-label="Kategori"><input class="name-input" type="text" aria-label="Kategorinamn för ${escapeHtml(row.name)}" value="${escapeHtml(row.name)}" /></td>
                    <td data-label="Budget"><span class="amount-field"><input class="amount-input budget-input" type="text" inputmode="numeric" aria-label="${escapeHtml(row.name)}, budgeterat belopp" value="${formatInputAmount(row.budget)}" /><span>kr</span></span></td>
                    <td data-label="Utfall"><span class="amount-field"><input class="amount-input actual-input" type="text" inputmode="numeric" aria-label="${escapeHtml(row.name)}, faktiskt belopp" value="${formatInputAmount(row.actual)}" /><span>kr</span></span></td>
                    <td class="row-action">
                      ${nextMonth ? `<button class="copy-next-row" type="button" aria-label="Kopiera ${escapeHtml(row.name)} till ${nextMonth.label}" title="Kopiera till ${nextMonth.label}"><i data-lucide="copy"></i></button>` : ""}
                      <button class="delete-row" type="button" aria-label="Ta bort ${escapeHtml(row.name)}" title="Ta bort rad"><i data-lucide="trash-2"></i></button>
                    </td>
                  </tr>
                `,
              )
              .join("")}
            ${rows.length || type !== "subscriptions" ? "" : '<tr class="subscription-empty"><td colspan="4">Inga prenumerationer registrerade ännu. Lägg till exempelvis Spotify, Netflix eller en molntjänst.</td></tr>'}
            <tr class="table-total"><td>Totalt</td><td data-label="Budget">${formatCurrency(sumLines(rows, "budget"))}</td><td data-label="Utfall">${formatCurrency(sumLines(rows, "actual"))}</td><td></td></tr>
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function bindMonthEvents(monthIndex) {
  document.querySelector("#backToDashboard").addEventListener("click", () => {
    activeView = "dashboard";
    render();
    app.focus();
  });

  document.querySelectorAll(".budget-section").forEach((section) => {
    const type = section.dataset.section;
    const rows = currentYearData().months[monthIndex][type];

    section.querySelectorAll("tr[data-row-id]").forEach((rowElement) => {
      const row = rows.find((item) => item.id === rowElement.dataset.rowId);
      rowElement.querySelector(".name-input").addEventListener("change", (event) => {
        row.name = event.target.value.trim() || "Namnlös";
        saveState("Ändringen är sparad");
        renderMonth(monthIndex);
      });
      rowElement.querySelector(".budget-input").addEventListener("change", (event) => {
        row.budget = Math.max(0, parseAmount(event.target.value));
        saveState("Budgeten är uppdaterad");
        renderMonth(monthIndex);
      });
      rowElement.querySelector(".actual-input").addEventListener("change", (event) => {
        row.actual = Math.max(0, parseAmount(event.target.value));
        saveState("Utfallet är uppdaterat");
        renderMonth(monthIndex);
      });
      const copyButton = rowElement.querySelector(".copy-next-row");
      copyButton?.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        row.name = rowElement.querySelector(".name-input").value.trim() || "Namnlös";
        row.budget = Math.max(0, parseAmount(rowElement.querySelector(".budget-input").value));
        row.actual = Math.max(0, parseAmount(rowElement.querySelector(".actual-input").value));
      });
      copyButton?.addEventListener("click", () => {
        const target = nextBudgetMonth(monthIndex);
        if (!target) return;
        const targetRows = state.years[target.yearKey].months[target.monthIndex][type];
        const plannedAmount = row.budget || row.actual;
        const existing = targetRows.find((item) => item.name.trim().toLocaleLowerCase("sv-SE") === row.name.trim().toLocaleLowerCase("sv-SE"));

        if (existing) {
          const previous = { name: existing.name, budget: existing.budget };
          existing.name = row.name;
          existing.budget = plannedAmount;
          saveState();
          showToast(`${row.name} är uppdaterad i ${target.label}`, "Ångra", () => {
            existing.name = previous.name;
            existing.budget = previous.budget;
            saveState();
          });
          return;
        }

        const copiedRow = line(row.name, plannedAmount, 0);
        targetRows.push(copiedRow);
        saveState();
        showToast(`${row.name} är kopierad till ${target.label}`, "Ångra", () => {
          const copiedIndex = targetRows.findIndex((item) => item.id === copiedRow.id);
          if (copiedIndex >= 0) targetRows.splice(copiedIndex, 1);
          saveState();
        });
      });
      rowElement.querySelector(".delete-row").addEventListener("click", () => {
        const yearKey = state.activeYear;
        const removedIndex = rows.findIndex((item) => item.id === row.id);
        const [removedRow] = rows.splice(removedIndex, 1);
        saveState();
        renderMonth(monthIndex);
        showToast("Raden har tagits bort", "Ångra", () => {
          state.years[yearKey].months[monthIndex][type].splice(removedIndex, 0, removedRow);
          saveState();
          render();
        });
      });
    });
  });

  document.querySelectorAll(".add-row").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.type;
      currentYearData().months[monthIndex][type].push(line("Ny kategori", 0, 0));
      saveState();
      renderMonth(monthIndex);
      const matchingSection = document.querySelector(`[data-section="${type}"]`);
      matchingSection.querySelectorAll(".name-input")[matchingSection.querySelectorAll(".name-input").length - 1]?.focus();
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

sectionNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section]");
  if (!button) return;
  activeSection = button.dataset.section;
  render();
  app.focus();
});

document.querySelector(".period-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");
  if (!button) return;
  activeView = button.dataset.view;
  render();
  app.focus();
});

document.querySelector("#monthScrollLeft").addEventListener("click", () => {
  monthTabs.scrollBy({ left: -240, behavior: "smooth" });
});

document.querySelector("#monthScrollRight").addEventListener("click", () => {
  monthTabs.scrollBy({ left: 240, behavior: "smooth" });
});

yearSelect.addEventListener("change", () => {
  state.activeYear = yearSelect.value;
  activeView = "dashboard";
  showAllMonths = false;
  saveState();
  render();
});

document.querySelector("#addYearButton").addEventListener("click", () => {
  const latestYear = Math.max(...Object.keys(state.years).map(Number));
  newYearInput.value = latestYear + 1;
  yearDialog.showModal();
  newYearInput.focus();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => yearDialog.close());
});

document.querySelectorAll("[data-open-data]").forEach((button) => {
  button.addEventListener("click", () => dataDialog.showModal());
});

document.querySelectorAll("[data-close-data]").forEach((button) => {
  button.addEventListener("click", () => dataDialog.close());
});

document.querySelector("#exportDataButton").addEventListener("click", () => {
  exportStateFile();
  showToast("Säkerhetskopian har laddats ner");
});

document.querySelector("#importDataButton").addEventListener("click", () => {
  exportStateFile("kompassi-fore-import");
  importDataInput.click();
});

importDataInput.addEventListener("change", async () => {
  const [file] = importDataInput.files;
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    state = normalizeImportedState(imported);
    activeSection = "today";
    activeView = "dashboard";
    showAllMonths = false;
    saveState();
    dataDialog.close();
    render();
    showToast("Din säkerhetskopia är importerad");
  } catch (error) {
    showToast(error instanceof SyntaxError ? "Filen kunde inte läsas" : error.message);
  } finally {
    importDataInput.value = "";
  }
});

document.querySelector("#yearForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const newYear = String(Number(newYearInput.value));
  if (state.years[newYear]) {
    showToast("Det året finns redan");
    return;
  }

  if (copyBudgetInput.checked) {
    const source = currentYearData();
    state.years[newYear] = {
      savingsGoal: source.savingsGoal,
      savingsGoalDate: `${newYear}-12-31`,
      goals: source.goals.map((goal) => ({ ...goal, id: uid(), saved: 0 })),
      months: source.months.map((month) => ({
        incomes: month.incomes.map((item) => ({ ...item, id: uid(), actual: 0 })),
        expenses: month.expenses.map((item) => ({ ...item, id: uid(), actual: 0 })),
        subscriptions: (month.subscriptions || []).map((item) => ({ ...item, id: uid(), actual: 0 })),
        savings: month.savings.map((item) => ({ ...item, id: uid(), actual: 0 })),
      })),
    };
  } else {
    state.years[newYear] = createYear(Number(newYear), false);
  }

  state.activeYear = newYear;
  activeView = "dashboard";
  saveState(`Budgetåret ${newYear} har skapats`);
  yearDialog.close();
  render();
});

document.querySelector("#exportButton").addEventListener("click", () => {
  exportStateFile();
  showToast("En säkerhetskopia har laddats ner");
});

document.querySelector("#themeToggleButton").addEventListener("click", () => {
  localStorage.setItem(THEME_KEY, effectiveTheme() === "dark" ? "light" : "dark");
  applyTheme();
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!localStorage.getItem(THEME_KEY)) applyTheme();
});

applyTheme();
render();
