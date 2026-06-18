/* ============================================================================
   FHINK AI · Day 4 · Main Script
   - Screen navigation (same engine as Days 1–3)
   - Pulls user (fhink_lead_v1), salary/expenses (fhink_day1_v1),
     the Day-2 trim (fhink_day2_v1) — never re-asks
   - Pension form (clearing-house data) → age-67 projection + fee cost
   - Assets vs liabilities (dynamic rows) → net worth
   - FI-distance chart: 4 scenarios, 50/30/20 locked until the webinar
   - State in localStorage, autosaved · supports ?pid= like all days
============================================================================ */

(function () {
  'use strict';

  // ============================================================
  // Config & State
  // ============================================================
  const CONFIG = {
    storageKey: 'fhink_day4_v1',
    day1StorageKey: 'fhink_day1_v1',
    day2StorageKey: 'fhink_day2_v1',
    day3StorageKey: 'fhink_day3_v1',
    leadStorageKey: 'fhink_lead_v1',
    autosaveDelayMs: 600,
    apiEndpoint: '/api/day4',           // ← wire by Claude Code
  };

  const SUPA_URL = 'https://vuvavjmbvdqnwtleudqh.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dmF2am1idmRxbnd0bGV1ZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDY1MTMsImV4cCI6MjA2NzAyMjUxM30.QgtlrWs_qL7dMzxHkdUQaCBkGWsNNnExDv0phGz7NbI';
  const PILOT_UNLOCK_ISO = '2026-06-21T06:00:00+03:00';
  const VIDEO_MAP = {
    omri: 'dec52845-faa8-4433-a939-ce2ba480bf62',
    guy: null,
  };
  let originalVideoPhHTML = '';

  const DATA = window.FHINK_DAY4_DATA;
  const A = DATA.assumptions;
  const SCREEN_ORDER = ['opening', 'commitment', 'webinar', 'pension', 'pensionSummary', 'networth', 'summary', 'completed'];
  const ACTIVE_CONSENT = false; // ← flip to true if אילת requires active consent

  const state = loadState();

  // Derived at boot
  let salary = 0;
  let age = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let day2Saved = 0;

  // ============================================================
  // Boot
  // ============================================================
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (!allowEarlyAccess()) return;
    captureVideoPlaceholder();
    applyUrlParams();
    state.meta.watched = state.meta.watched || {};
    applyUserContext();
    restoreWatchedVideos();
    await loadPriorDays();
    seedDemoIfEmpty();
    buildFundSelect();
    bindPensionForm();
    buildNetworthRows();
    renderPulled();
    bindNavigation();
    bindCalendarLinks();
    bindModals();
    enableActiveConsent();
    showScreen(state.currentScreen || 'opening');

    if (state.meta.demo) {
      const chip = document.getElementById('pulledChip');
      if (chip) {
        chip.classList.add('pulled__chip--demo');
        chip.querySelector('span').textContent = 'נתוני דוגמה להמחשה — בגרסה החיה נשאבים מהימים הקודמים ומהמסלקה';
      }
    }
  }

  // ============================================================
  // Dev / review helpers — ?name=דנה&gender=נקבה&screen=summary&reset=1
  // ============================================================
  function applyUrlParams() {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch (_) { return; }

    if (params.get('reset') === '1') {
      try { localStorage.removeItem(CONFIG.storageKey); } catch (_) {}
      Object.assign(state, defaultState());
    }
    const name = params.get('name');
    const gender = params.get('gender');
    if (name || gender) {
      try {
        const lead = JSON.parse(localStorage.getItem(CONFIG.leadStorageKey) || '{}') || {};
        if (name) lead.fullName = name;
        if (gender) lead.gender = gender;
        localStorage.setItem(CONFIG.leadStorageKey, JSON.stringify(lead));
      } catch (_) {}
    }
    const screen = params.get('screen');
    if (screen) state.currentScreen = screen;

    // Supabase user id — arrives in links between pages, never typed by the user
    const pid = params.get('pid');
    if (pid) {
      state.user.pid = pid;
      try { localStorage.setItem('challenge_pid', pid); } catch (_) {}
    }

    const popup = params.get('popup');
    if (popup) setTimeout(() => {
      const m = document.getElementById(popup);
      if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
    }, 300);

  }

  // ============================================================
  // State (localStorage)
  // ============================================================
  function defaultState() {
    return {
      currentScreen: 'opening',
      user: { fullName: '', firstName: '', gender: '' },
      pension: {
        empRate: '',
        employerRate: '',
        fundType: '',
        feeRate: '',
        balance: '',
      },
      assets: [],        // {type, amount}
      liabilities: [],   // {type, amount}
      meta: {
        commitmentChosen: null,
        watched: {},
        webinarConfirmed: false,
        consentGiven: false,
        modelUnlocked: false,
        demo: false,
        completedAt: null,
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const base = defaultState();
        return {
          ...base, ...parsed,
          user: { ...base.user, ...(parsed.user || {}) },
          pension: { ...base.pension, ...(parsed.pension || {}) },
          assets: Array.isArray(parsed.assets) ? parsed.assets : [],
          liabilities: Array.isArray(parsed.liabilities) ? parsed.liabilities : [],
          meta: { ...base.meta, ...(parsed.meta || {}) },
        };
      }
    } catch (_) {}
    return defaultState();
  }

  function saveState() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    } catch (_) {}
  }

  let saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, CONFIG.autosaveDelayMs);
  }

  // ============================================================
  // User context — pull from lead storage (never re-asked)
  // ============================================================
  function applyUserContext() {
    try {
      const lead = JSON.parse(localStorage.getItem(CONFIG.leadStorageKey) || 'null');
      if (lead) {
        state.user.fullName = lead.fullName || '';
        state.user.firstName = (lead.fullName || '').split(' ')[0] || '';
        state.user.gender = normalizeGender(lead.gender);
      }
    } catch (_) {}

    document.querySelectorAll('[data-username]').forEach(el => {
      el.textContent = state.user.firstName || 'חבר';
    });

    applyGender(state.user.gender);
  }

  function normalizeGender(raw) {
    if (!raw) return 'male';
    if (raw === 'זכר' || raw === 'male')   return 'male';
    if (raw === 'נקבה' || raw === 'female') return 'female';
    return 'male';
  }

  function applyGender(g) {
    document.querySelectorAll('[data-male], [data-female]').forEach(el => {
      const t = g === 'female' ? el.dataset.female : el.dataset.male;
      if (t) el.textContent = t;
    });
  }

  // ============================================================
  // Prior-day data
  // ============================================================
  async function loadPriorDays() {
    let d1 = null;
    let ready = null;
    try { d1 = JSON.parse(localStorage.getItem(CONFIG.day1StorageKey) || 'null'); } catch (_) {}
    try { ready = JSON.parse(localStorage.getItem('fhink:opening-questionnaire') || 'null'); } catch (_) {}

    if (d1 && d1.basics && parseFloat(d1.basics.salary) > 0) {
      state.meta.demo = false;
      salary = parseFloat(d1.basics.salary);

      let income = salary;
      (d1.basics.additionalIncomes || []).forEach(inc => {
        const v = parseFloat(inc.amount);
        if (!isNaN(v)) income += v;
      });
      monthlyIncome = income;

      let expenses = 0;
      Object.values(d1.expenses || {}).forEach(items => {
        Object.values(items || {}).forEach(it => {
          const v = parseFloat(it.amount);
          if (!isNaN(v) && v > 0) expenses += v;
        });
      });
      monthlyExpenses = expenses;
    } else {
      const pid = state.user.pid || localStorage.getItem('challenge_pid');
      if (pid) {
        const remote = await fetchParticipantRow(pid);
        if (remote) {
          state.meta.demo = false;
          salary = parseFloat(remote.income || remote.salary || 0) || DATA.demo.salary;
          monthlyIncome = salary + (parseFloat(remote.income_extra || 0) || 0);
          monthlyExpenses = parseFloat(remote.monthly_expenses || remote.expenses_total || 0) || DATA.demo.monthlyExpenses;
          age = parseInt(remote.age || 0, 10) || DATA.demo.age;
          day2Saved = parseFloat(remote.savings_commitment || 0) || 0;
          if (!day2Saved) day2Saved = DATA.demo.day2Saved;
          return;
        }
      }

      state.meta.demo = true;
      salary = DATA.demo.salary;
      monthlyIncome = DATA.demo.monthlyIncome;
      monthlyExpenses = DATA.demo.monthlyExpenses;
    }

    // Age comes from the opening questionnaire in production; demo fallback otherwise
    if (!age) age = parseInt(ready && ready.age, 10) || DATA.demo.age;

    // Day-2 trim total (the savings goal)
    day2Saved = 0;
    try {
      const raw = localStorage.getItem(CONFIG.day2StorageKey);
      if (raw && d1 && d1.expenses) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.trims) {
          Object.keys(parsed.trims).forEach(key => {
            const t = parsed.trims[key];
            if (!t || t.mode === 'none') return;
            const dot = key.indexOf('.');
            if (dot < 0) return;
            const rec = d1.expenses[key.slice(0, dot)] && d1.expenses[key.slice(0, dot)][key.slice(dot + 1)];
            const amount = rec ? parseFloat(rec.amount) : NaN;
            if (isNaN(amount) || amount <= 0) return;
            if (t.mode === 'pct') day2Saved += Math.round(amount * (t.pct / 100));
            if (t.mode === 'custom') {
              const v = parseFloat(t.custom);
              if (!isNaN(v) && v > 0) day2Saved += Math.min(Math.round(v), amount);
            }
          });
        }
      }
    } catch (_) {}
    if (!day2Saved) day2Saved = DATA.demo.day2Saved;
  }

  async function fetchParticipantRow(pid) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/challenge_participants?id=eq.${encodeURIComponent(pid)}&select=*`, {
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
        },
      });
      if (!res.ok) return null;
      const rows = await res.json();
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    } catch (err) {
      console.warn('[FHINK] day4 REST load failed:', err);
      return null;
    }
  }

  function allowEarlyAccess() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bypass') === '1') return true;
    const cohort = (params.get('cohort') || localStorage.getItem('challenge_cohort') || 'pilot').toLowerCase();
    if (cohort === 'lms') { try { localStorage.setItem('challenge_cohort', 'lms'); } catch (e) {} return true; } // LMS course: all days open immediately
    if (Date.now() >= new Date(PILOT_UNLOCK_ISO).getTime()) return true;
    showLockedOverlay(PILOT_UNLOCK_ISO, 'יום 4');
    return false;
  }

  function showLockedOverlay(unlockIso, label) {
    const unlockAt = new Date(unlockIso);
    const unlockLabel = unlockAt.toLocaleString('he-IL', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Asia/Jerusalem',
    });
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8f2e8;padding:24px;direction:rtl;font-family:Heebo,sans-serif;">
        <div style="max-width:520px;width:100%;background:#fff;border-radius:28px;padding:40px 28px;box-shadow:0 16px 60px rgba(0,0,0,.12);text-align:center;">
          <div style="font-size:56px;line-height:1;margin-bottom:12px;">🔒</div>
          <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;color:#231d15;font-weight:800;">${label} עדיין נעול</h1>
          <p style="margin:0;color:#5d5143;font-size:16px;line-height:1.8;">הפתיחה לצוות הפיילוט נקבעה ל-${unlockLabel}. אם קיבלת bypass=1, הדף ייפתח מייד.</p>
        </div>
      </div>`;
  }

  function seedDemoIfEmpty() {
    if (!state.meta.demo) return;
    const p = state.pension;
    if (p.empRate === '' && p.balance === '') {
      Object.assign(state.pension, DATA.demo.pension);
    }
    if (!state.assets.length) state.assets = DATA.demo.assets.map(a => ({ ...a }));
    if (!state.liabilities.length) state.liabilities = DATA.demo.liabilities.map(l => ({ ...l }));
  }

  function renderPulled() {
    setAll('[data-pen="salary"]', fmt(salary));
    setAll('[data-pen="age"]', String(age));
  }

  // ============================================================
  // Pension form
  // ============================================================
  function buildFundSelect() {
    const sel = document.getElementById('fundType');
    if (!sel) return;
    DATA.fundTypes.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.value;
      opt.textContent = f.label;
      sel.appendChild(opt);
    });
    if (state.pension.fundType) sel.value = state.pension.fundType;
  }

  function bindPensionForm() {
    const map = {
      empRate: 'empRate',
      employerRate: 'employerRate',
      feeRate: 'feeRate',
      balance: 'balance',
    };
    Object.keys(map).forEach(key => {
      const el = document.getElementById(map[key]);
      if (!el) return;
      if (state.pension[key] !== '' && state.pension[key] != null) el.value = state.pension[key];
      el.addEventListener('input', () => {
        state.pension[key] = el.value;
        autosave();
      });
    });

    const sel = document.getElementById('fundType');
    if (sel) {
      sel.addEventListener('change', () => {
        state.pension.fundType = sel.value;
        autosave();
      });
    }
  }

  // ============================================================
  // Pension math (illustration only — assumptions in data.js)
  // ============================================================
  function pensionNumbers() {
    const empRate = parseFloat(state.pension.empRate) || 0;
    const employerRate = parseFloat(state.pension.employerRate) || 0;
    const feeRate = parseFloat(state.pension.feeRate) || 0;
    const balance = parseFloat(state.pension.balance) || 0;

    const yearsLeft = Math.max(0, A.retirementAge - age);
    const monthlyContrib = Math.round(salary * ((empRate + employerRate) / 100));

    const grossProjected = simulate(balance, monthlyContrib, yearsLeft, A.pensionAnnualReturn);
    const netProjected = simulate(balance, monthlyContrib, yearsLeft, A.pensionAnnualReturn - (feeRate / 100));

    return {
      yearsLeft,
      monthlyContrib,
      balance,
      feeRate,
      projected: netProjected,
      monthlyPension: Math.round(netProjected / A.annuityFactor),
      feesTotal: Math.max(0, grossProjected - netProjected),
      feesYear: Math.round(balance * (feeRate / 100)),
    };
  }

  function simulate(start, monthly, years, annualReturn) {
    const r = annualReturn / 12;
    let capital = start;
    for (let i = 0; i < years * 12; i++) {
      capital = capital * (1 + r) + monthly;
    }
    return Math.round(capital);
  }

  function renderPensionSummary() {
    const p = pensionNumbers();
    setAll('[data-pen="projected"]', fmt(p.projected));
    setAll('[data-pen="monthlyPension"]', fmt(p.monthlyPension));
    setAll('[data-pen="monthlyContrib"]', fmt(p.monthlyContrib));
    setAll('[data-pen="balanceNow"]', fmt(p.balance));
    setAll('[data-pen="yearsLeft"]', String(p.yearsLeft));
    setAll('[data-pen="feesTotal"]', fmt(p.feesTotal));
    setAll('[data-pen="feesYear"]', fmt(p.feesYear));

    const insightEl = document.getElementById('pensionInsight');
    if (insightEl) {
      let text = p.feeRate > 0.8
        ? DATA.insights.pensionHighFee(p.feeRate, p.feesTotal)
        : DATA.insights.pensionOkFee(p.feesTotal);
      if (salary > 0 && p.monthlyPension < salary * 0.6) {
        text += DATA.insights.pensionGap(p.monthlyPension, salary);
      }
      insightEl.textContent = text;
    }
  }

  // ============================================================
  // Assets vs liabilities — dynamic rows
  // ============================================================
  function buildNetworthRows() {
    renderRows('assetsList', state.assets, DATA.assetTypes, 'asset');
    renderRows('liabilitiesList', state.liabilities, DATA.liabilityTypes, 'liability');

    const addAsset = document.getElementById('addAssetBtn');
    if (addAsset) addAsset.addEventListener('click', () => {
      state.assets.push({ type: '', amount: '' });
      renderRows('assetsList', state.assets, DATA.assetTypes, 'asset');
      autosave();
    });

    const addLiab = document.getElementById('addLiabilityBtn');
    if (addLiab) addLiab.addEventListener('click', () => {
      state.liabilities.push({ type: '', amount: '' });
      renderRows('liabilitiesList', state.liabilities, DATA.liabilityTypes, 'liability');
      autosave();
    });

    updateNetworth();
  }

  function renderRows(listId, rows, types, kind) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';

    if (!rows.length) rows.push({ type: '', amount: '' });

    rows.forEach((row, idx) => {
      const el = document.createElement('div');
      el.className = 'income-row';
      el.innerHTML = `
        <div class="income-row__main">
          <div class="income-row__type select-wrap">
            <select class="input select" aria-label="סוג">
              <option value="" disabled ${row.type ? '' : 'selected'}>בחר סוג</option>
              ${types.map(t => `<option value="${t.value}" ${row.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
            </select>
            <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="income-row__amount">
            <div class="money-input">
              <span class="money-input__currency" aria-hidden="true">₪</span>
              <input type="number" class="input input--money" placeholder="${kind === 'asset' ? 'שווי הנכס' : 'גובה ההתחייבות'}"
                     min="0" step="1000" inputmode="numeric" value="${row.amount !== '' ? row.amount : ''}" />
            </div>
          </div>
          <button type="button" class="btn-icon" aria-label="הסרת שורה">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18"></line>
              <line x1="6" y1="18" x2="18" y2="6"></line>
            </svg>
          </button>
        </div>
      `;

      el.querySelector('select').addEventListener('change', (e) => {
        row.type = e.target.value;
        autosave();
      });
      el.querySelector('input').addEventListener('input', (e) => {
        row.amount = e.target.value;
        updateNetworth();
        autosave();
      });
      el.querySelector('.btn-icon').addEventListener('click', () => {
        rows.splice(idx, 1);
        renderRows(listId, rows, types, kind);
        updateNetworth();
        autosave();
      });

      list.appendChild(el);
    });
  }

  function sumRows(rows) {
    return rows.reduce((acc, r) => {
      const v = parseFloat(r.amount);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
  }

  function updateNetworth() {
    const net = sumRows(state.assets) - sumRows(state.liabilities);
    const el = document.querySelector('[data-nw="net"]');
    if (el) el.textContent = (net < 0 ? '−' : '') + Math.abs(Math.round(net)).toLocaleString('he-IL');
    const box = document.getElementById('networthTotal');
    if (box) box.classList.toggle('live-total--negative', net < 0);
  }

  // ============================================================
  // FI distance — 4 scenarios (screen 6)
  // ============================================================
  function fiScenarios() {
    const p = pensionNumbers();
    const netWorth = sumRows(state.assets) - sumRows(state.liabilities);
    const startCapital = Math.max(0, netWorth) + p.balance;
    const freeCash = Math.max(0, monthlyIncome - monthlyExpenses);
    const target = monthlyExpenses * 12 * A.fiMultiple;

    const monthlyFor = {
      before_withdraw: freeCash + p.monthlyContrib * A.severanceKeepRatio,
      before_keep:     freeCash + p.monthlyContrib,
      challenge:       freeCash + p.monthlyContrib + day2Saved,
      model503020:     monthlyIncome * 0.2 + p.monthlyContrib,
    };

    return DATA.scenarios.map(sc => {
      const years = yearsToTarget(startCapital, monthlyFor[sc.id], target);
      return { ...sc, years, ageAt: years == null ? null : age + years };
    });
  }

  function yearsToTarget(start, monthly, target) {
    if (target <= 0) return null;
    let capital = start;
    for (let y = 1; y <= A.maxYears; y++) {
      capital = capital * (1 + A.investAnnualReturn) + monthly * 12;
      if (capital >= target) return y;
    }
    return null;
  }

  function renderFiChart() {
    const wrap = document.getElementById('fiChart');
    if (!wrap) return;

    const scenarios = fiScenarios();
    const known = scenarios.filter(s => s.years != null && s.kind !== 'locked');
    const maxYears = Math.max(10, ...known.map(s => s.years));

    wrap.innerHTML = scenarios.map(sc => {
      const locked = sc.kind === 'locked' && !state.meta.modelUnlocked;
      const width = sc.years == null ? 100 : Math.max(12, Math.round((sc.years / maxYears) * 100));
      const badge = sc.years == null
        ? `מעבר ל-${A.maxYears} שנים`
        : `בעוד ${sc.years} שנים · גיל ${sc.ageAt}`;

      return `
        <div class="fi__row${sc.kind === 'best' ? ' fi__row--best' : ''}${locked ? ' fi__row--locked' : ''}">
          <div class="fi__head">
            <span class="fi__label">${sc.label}</span>
            <span class="fi__badge">${locked ? '' : badge}</span>
          </div>
          <div class="fi__track">
            <div class="fi__bar" style="width:${locked ? 100 : width}%"></div>
          </div>
          <span class="fi__sub">${sc.sub}</span>
          ${locked ? `
            <div class="fi__lock">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>
              </svg>
              <span>נפתח לאחר צפייה בוובינר — הערב 20:00</span>
            </div>` : ''}
        </div>
      `;
    }).join('');

    // Insight
    const insightEl = document.getElementById('insightText');
    if (insightEl) {
      const before = scenarios.find(s => s.id === 'before_keep');
      const challenge = scenarios.find(s => s.id === 'challenge');
      if (before && challenge && before.years != null && challenge.years != null) {
        insightEl.textContent = DATA.insights.fi(before.years, challenge.years, before.years - challenge.years);
      } else {
        insightEl.textContent = DATA.insights.fiFar();
      }
    }
  }

  // ============================================================
  // Screen Navigation
  // ============================================================
  function showScreen(screenId) {
    document.querySelectorAll('.modal').forEach(mm => { mm.hidden = true; });
    document.body.style.overflow = '';

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
    let target = document.querySelector(`.screen[data-screen="${screenId}"]`);
    if (!target) {
      target = document.querySelector('.screen[data-screen="opening"]');
      screenId = 'opening';
    }
    target.classList.add('is-active');
    state.currentScreen = screenId;
    autosave();

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const heading = target.querySelector('h1, h2, h3');
    if (heading) setTimeout(() => heading.focus({ preventScroll: true }), 100);

    if (screenId === 'webinar' && state.meta.webinarConfirmed) {
      const confirmedChip = document.getElementById('webinarConfirmedChip');
      if (confirmedChip) confirmedChip.hidden = false;
    }
    if (screenId === 'pensionSummary') renderPensionSummary();
    if (screenId === 'networth') updateNetworth();
    if (screenId === 'summary') renderFiChart();
  }

  function nextFrom(currentScreen, targetOverride) {
    if (targetOverride) return showScreen(targetOverride);
    const idx = SCREEN_ORDER.indexOf(currentScreen);
    if (idx >= 0 && idx < SCREEN_ORDER.length - 1) {
      showScreen(SCREEN_ORDER[idx + 1]);
    }
  }

  function prevFrom(currentScreen, targetOverride) {
    if (targetOverride) return showScreen(targetOverride);
    const idx = SCREEN_ORDER.indexOf(currentScreen);
    if (idx > 0) showScreen(SCREEN_ORDER[idx - 1]);
  }

  function bindNavigation() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const target = btn.dataset.target;
      const currentScreen = state.currentScreen;

      switch (action) {
        case 'next':
          if (currentScreen === 'pension' && target === 'pensionSummary' && !validatePension()) return;
          nextFrom(currentScreen, target);
          break;

        case 'back':
          prevFrom(currentScreen, target);
          break;

        case 'postpone':
          state.meta.commitmentChosen = 'later';
          saveState();
          showScreen('postponed');
          break;

        case 'complete':
          handleComplete();
          break;

        case 'video-open': {
          const titleEl = document.getElementById('videoModalTitle');
          if (titleEl) titleEl.textContent = btn.dataset.videoTitle || 'הסרטון';
          renderVideoPlayer(btn.dataset.videoId);
          openModal('videoModal');
          if (btn.dataset.videoId) {
            state.meta.watched = state.meta.watched || {};
            state.meta.watched[btn.dataset.videoId] = true;
            btn.classList.add('is-watched');
            autosave();
          }
          break;
        }

        case 'video-close':
          closeModal('videoModal');
          break;

        case 'legal-open':
          openModal(btn.dataset.target);
          break;

        case 'legal-close': {
          const openModalEl = btn.closest('.modal');
          if (openModalEl) {
            openModalEl.hidden = true;
            document.body.style.overflow = '';
          }
          break;
        }

        case 'webinar-registered': {
          state.meta.webinarConfirmed = true;
          state.meta.modelUnlocked = true;
          saveState();
          const confirmedChip = document.getElementById('webinarConfirmedChip');
          if (confirmedChip) confirmedChip.hidden = false;
          showToast('מעולה — המקום שלך שמור. נתראה הערב בוובינר.');
          nextFrom(state.currentScreen, btn.dataset.target);
          break;
        }
      }
    });
  }

  function validatePension() {
    const balanceEl = document.getElementById('balance');
    const v = parseFloat(state.pension.balance);
    if (isNaN(v) || v < 0 || state.pension.balance === '') {
      if (balanceEl) {
        balanceEl.classList.add('is-error');
        balanceEl.focus();
        setTimeout(() => balanceEl.classList.remove('is-error'), 1800);
      }
      showToast('חסרה הצבירה הנוכחית — אפשר למצוא אותה במסלקה או בדוח השנתי. אין? הזן 0.');
      return false;
    }
    return true;
  }

  function restoreWatchedVideos() {
    const watched = state.meta.watched || {};
    document.querySelectorAll('[data-video-id]').forEach(card => {
      if (watched[card.dataset.videoId]) card.classList.add('is-watched');
    });
  }

  // ============================================================
  // Calendar links (webinar)
  // ============================================================
  function bindCalendarLinks() {
    const webinar = {
      title: 'וובינר סיכום אתגר FHINK AI',
      start: '20260624T170000Z',  // ISO UTC — placeholder
      end:   '20260624T183000Z',
      details: 'וובינר סיכום של אתגר 4 הימים, בו נחבר את כל מה שלמדת ונפתח את הצעד הבא.',
      location: 'אונליין',
    };

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE`
      + `&text=${encodeURIComponent(webinar.title)}`
      + `&dates=${webinar.start}/${webinar.end}`
      + `&details=${encodeURIComponent(webinar.details)}`
      + `&location=${encodeURIComponent(webinar.location)}`;

    const gBtn = document.querySelector('[data-action="cal-google"]');
    if (gBtn) gBtn.href = gcalUrl;

    const icsBtn = document.querySelector('[data-action="cal-ical"]');
    if (icsBtn) {
      icsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadICS(webinar);
      });
    }
  }

  function downloadICS({ title, start, end, details, location }) {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FHINK AI//Challenge//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@fhinkai.com`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${details}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fhink-webinar.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // Active consent (optional)
  // ============================================================
  function enableActiveConsent() {
    if (!ACTIVE_CONSENT) return;
    const line = document.querySelector('.consent');
    if (!line) return;
    const cta = document.querySelector('.screen[data-screen="opening"] .actions .btn--primary');
    line.classList.add('consent--active');

    const label = document.createElement('label');
    label.className = 'consent__check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = 'consentBox';
    box.checked = !!state.meta.consentGiven;
    label.appendChild(box);
    line.prepend(label);

    const lead = line.querySelector('[data-male]');
    if (lead) {
      lead.textContent = state.user.gender === 'female' ? 'אני מאשרת את' : 'אני מאשר את';
    }

    const sync = () => {
      state.meta.consentGiven = box.checked;
      if (cta) cta.disabled = !box.checked;
      document.querySelectorAll('button.roadmap__item.is-clickable').forEach(b => { b.disabled = !box.checked; });
      autosave();
    };
    box.addEventListener('change', sync);
    sync();
  }

  // ============================================================
  // Modals & Toast
  // ============================================================
  function bindModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      const backdrop = modal.querySelector('.modal__backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => closeModal(modal.id));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal:not([hidden])').forEach(mm => closeModal(mm.id));
    });
  }

  function captureVideoPlaceholder() {
    const videoPhEl = document.querySelector('#videoModal .video-ph');
    if (videoPhEl) originalVideoPhHTML = videoPhEl.innerHTML;
  }

  function renderVideoPlayer(videoId) {
    const videoPhEl = document.querySelector('#videoModal .video-ph');
    if (!videoPhEl) return;

    const videoGuid = VIDEO_MAP[videoId];
    videoPhEl.style.padding = '0';
    videoPhEl.style.position = 'relative';
    videoPhEl.style.overflow = 'hidden';
    videoPhEl.innerHTML = videoGuid
      ? `<iframe src="https://player.mediadelivery.net/embed/550242/${videoGuid}?autoplay=true"
          title="Bunny video player"
          loading="lazy"
          style="border: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowfullscreen="true"></iframe>`
      : `<div style="padding: 24px; text-align: center; color: rgba(255,255,255,0.75);">
          <p>סרטון ההדרכה הטכני של גיא יעלה בקרוב לקראת פתיחת האתגר !</p>
        </div>`;
  }

  function resetVideoPlaceholder() {
    const videoPhEl = document.querySelector('#videoModal .video-ph');
    if (!videoPhEl) return;
    videoPhEl.innerHTML = originalVideoPhHTML;
    videoPhEl.style.padding = '';
    videoPhEl.style.position = '';
    videoPhEl.style.overflow = '';
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    if (id === 'videoModal') resetVideoPlaceholder();
    m.hidden = true;
    document.body.style.overflow = '';
  }

  function showToast(message) {
    let toast = document.getElementById('fhinkToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'fhinkToast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  // ============================================================
  // Complete Day 4 — the challenge ends
  // ============================================================
  async function handleComplete() {
    state.meta.completedAt = new Date().toISOString();
    saveState();

    try {
      await postDay4();
    } catch (err) {
      console.warn('[FHINK] Day4 sync failed:', err);
    }

    showScreen('completed');
  }

  async function postDay4() {
    const p = pensionNumbers();
    const payload = {
      ...state,
      results: {
        pension: p,
        netWorth: sumRows(state.assets) - sumRows(state.liabilities),
        day2MonthlySavings: day2Saved,
        scenarios: fiScenarios().map(s => ({ id: s.id, years: s.years, ageAt: s.ageAt })),
        demo: state.meta.demo,
      },
    };

    if (window.location.protocol === 'file:') {
      console.log('[FHINK] dev mode — would POST', payload);
      return { ok: true, mocked: true };
    }
    const res = await fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ============================================================
  // Helpers
  // ============================================================
  function fmt(n) {
    return (Math.round(n) || 0).toLocaleString('he-IL');
  }

  function setAll(selector, text) {
    document.querySelectorAll(selector).forEach(el => { el.textContent = text; });
  }
})();
