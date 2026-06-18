/* ============================================================================
   FHINK AI · Day 1 · Main Script
   - Screen navigation
   - State management with localStorage
   - Income management (dynamic add/remove)
   - Expense categories accordion
   - "Other" required-detail enforcement
   - Live totals (income / expenses / balance)
   - AI insight selection
   - Skip-warning modal
============================================================================ */

(function () {
  'use strict';

  // ============================================================
  // Config & State
  // ============================================================
  const CONFIG = {
    storageKey: 'fhink_day1_v1',
    leadStorageKey: 'fhink_lead_v1',
    autosaveDelayMs: 600,
    apiEndpoint: '/api/day1',           // ← wire by Claude Code
  };

  const SUPA_URL = 'https://vuvavjmbvdqnwtleudqh.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dmF2am1idmRxbnd0bGV1ZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDY1MTMsImV4cCI6MjA2NzAyMjUxM30.QgtlrWs_qL7dMzxHkdUQaCBkGWsNNnExDv0phGz7NbI';
  const PILOT_UNLOCK_ISO = '2026-06-21T06:00:00+03:00';
  const VIDEO_MAP = {
    omri: '78550d3c-134c-4e1c-b07e-6edc9527fee5',
    guy: null,
  };
  let originalVideoPhHTML = '';

  const SCREEN_ORDER = ['opening', 'commitment', 'calendar', 'basics', 'expenses', 'summary', 'completed'];
  const ACTIVE_CONSENT = false; // ← flip to true if אילת requires active consent
  const TERMINAL_SCREENS = new Set(['completed', 'postponed']);

  const state = loadState();

  // ============================================================
  // Boot
  // ============================================================
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    if (!allowEarlyAccess()) return;
    captureVideoPlaceholder();
    applyUrlParams();
    state.meta.watched = state.meta.watched || {};
    applyUserContext();
    restoreWatchedVideos();
    buildIncomes();
    buildCategories();
    bindNavigation();
    bindCalendarLinks();
    enableActiveConsent();
    bindModal();
    refreshAllTotals();
    showScreen(state.currentScreen || 'opening');
    wireGoToDay2();
  }

  // ============================================================
  // State (localStorage)
  // ============================================================
  function defaultState() {
    return {
      currentScreen: 'opening',
      user: { fullName: '', firstName: '', gender: '' },
      basics: {
        salary: '',
        additionalIncomes: [], // { type, amount, otherDetail }
      },
      expenses: {
        // categoryId -> { itemId: { amount, otherDetail } }
      },
      meta: {
        commitmentChosen: null, // 'now' | 'later'
        calendarConfirmed: false,
        completedAt: null,
        watched: {},            // videoId -> true
        consentGiven: false,
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
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
  // User context — pull from lead storage
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

    // Inject first-name in greeting spots
    document.querySelectorAll('[data-username]').forEach(el => {
      el.textContent = state.user.firstName || 'חבר';
    });

    // Apply gendered text everywhere
    applyGender(state.user.gender);
  }

  function normalizeGender(raw) {
    if (!raw) return 'male'; // default per brief
    if (raw === 'זכר')   return 'male';
    if (raw === 'נקבה')  return 'female';
    return 'male'; // "אחר" / "מעדיף לא להשיב" → masculine with disclaimer (per test1)
  }

  function applyGender(g) {
    document.querySelectorAll('[data-male], [data-female]').forEach(el => {
      const target = g === 'female' ? el.dataset.female : el.dataset.male;
      if (target) el.textContent = target;
    });
  }

  // ============================================================
  // Screen Navigation
  // ============================================================
  function showScreen(screenId) {
    const modal = document.getElementById('skipModal');
    if (modal) {
      modal.hidden = true;
      document.body.style.overflow = '';
    }

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
    let target = document.querySelector(`.screen[data-screen="${screenId}"]`);
    if (!target) {
      target = document.querySelector('.screen[data-screen="opening"]');
      screenId = 'opening';
    }
    target.classList.add('is-active');
    state.currentScreen = screenId;
    autosave();

    // Scroll to top of the new screen
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Focus first heading for screen readers
    const heading = target.querySelector('h1, h2, h3');
    if (heading) setTimeout(() => heading.focus({ preventScroll: true }), 100);

    // Specific actions per screen
    if (screenId === 'summary') computeSummary();
    if (screenId === 'expenses') {
      // Open first category automatically so users see where to input
      setTimeout(() => {
        const firstCat = document.querySelector('.category');
        if (firstCat && !firstCat.classList.contains('is-open')) {
          const header = firstCat.querySelector('.category__header');
          if (header) header.click();
        }
      }, 200);
    }
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
          if (currentScreen === 'basics' && !validateBasics()) return;
          if (currentScreen === 'expenses') {
            if (!validateExpensesOther()) return;
            if (computeTotalExpenses() === 0) { openSkipModal(); return; }
          }
          nextFrom(currentScreen, target);
          break;

        case 'back':
          prevFrom(currentScreen, target);
          break;

        case 'postpone':
          handlePostpone();
          break;

        case 'complete':
          handleComplete();
          break;

        case 'modal-close':
          // Read data-skip BEFORE closing (in case closing tears down the button)
          const shouldSkip = btn.dataset.skip === 'true';
          closeSkipModal(shouldSkip);
          break;

        case 'video-open': {
          const titleEl = document.getElementById('videoModalTitle');
          if (titleEl) titleEl.textContent = btn.dataset.videoTitle || 'הסרטון';
          renderVideoPlayer(btn.dataset.videoId);
          openModalById('videoModal');
          if (btn.dataset.videoId) {
            state.meta.watched = state.meta.watched || {};
            state.meta.watched[btn.dataset.videoId] = true;
            btn.classList.add('is-watched');
            autosave();
          }
          break;
        }

        case 'video-close':
          closeModalById('videoModal');
          break;

        case 'legal-open':
          openModalById(btn.dataset.target);
          break;

        case 'legal-close': {
          const openModalEl = btn.closest('.modal');
          if (openModalEl) {
            openModalEl.hidden = true;
            document.body.style.overflow = '';
          }
          break;
        }
      }
    });
  }

  // ============================================================
  // Calendar links
  // ============================================================
  function bindCalendarLinks() {
    // Replace with real meeting details from backend later.
    // These are placeholder values — Claude Code will inject real URLs.
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
      'PRODID:-//FHINK AI//Day 1//EN',
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
  // Postpone ("אעשה את זה בהמשך היום")
  // ============================================================
  function handlePostpone() {
    state.meta.commitmentChosen = 'later';
    saveState();
    showScreen('postponed');
  }

  // ============================================================
  // Basics screen: salary + dynamic incomes
  // ============================================================
  function buildIncomes() {
    const list = document.getElementById('incomesList');
    const salaryInput = document.getElementById('salary');
    if (!list || !salaryInput) return;

    // Restore salary value
    salaryInput.value = state.basics.salary || '';
    salaryInput.addEventListener('input', () => {
      state.basics.salary = salaryInput.value;
      autosave();
      refreshAllTotals();
    });

    // Render existing additional incomes
    renderIncomes();

    document.getElementById('addIncomeBtn').addEventListener('click', () => {
      if (state.basics.additionalIncomes.length >= 5) return;
      state.basics.additionalIncomes.push({ type: '', amount: '', otherDetail: '' });
      renderIncomes();
      autosave();
    });
  }

  function renderIncomes() {
    const list = document.getElementById('incomesList');
    list.innerHTML = '';

    state.basics.additionalIncomes.forEach((inc, idx) => {
      const row = document.createElement('div');
      row.className = 'income-row';
      row.innerHTML = `
        <div class="income-row__main">
          <div class="select-wrap income-row__type">
            <select class="input select">
              <option value="" disabled ${!inc.type ? 'selected' : ''}>סוג ההכנסה</option>
              ${window.FHINK_DATA.incomeTypes.map(t =>
                `<option value="${t.value}" ${inc.type === t.value ? 'selected' : ''}>${t.label}</option>`
              ).join('')}
            </select>
            <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          <div class="money-input income-row__amount">
            <span class="money-input__currency" aria-hidden="true">₪</span>
            <input type="number" class="input input--money" placeholder="סכום" min="0" step="100" inputmode="numeric" value="${inc.amount || ''}" />
          </div>

          <button type="button" class="btn-icon" data-remove-income="${idx}" aria-label="הסר הכנסה">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18"></line>
              <line x1="6" y1="18" x2="18" y2="6"></line>
            </svg>
          </button>
        </div>
        <div class="income-row__other" ${inc.type === 'other' ? '' : 'hidden'}>
          <input type="text" class="input" placeholder="פרט את ההכנסה הנוספת" value="${inc.otherDetail || ''}" />
        </div>
      `;

      // Bind inputs
      const selectEl   = row.querySelector('select');
      const amountEl   = row.querySelector('input[type="number"]');
      const otherWrap  = row.querySelector('.income-row__other');
      const otherInput = otherWrap.querySelector('input');

      selectEl.addEventListener('change', () => {
        state.basics.additionalIncomes[idx].type = selectEl.value;
        otherWrap.hidden = selectEl.value !== 'other';
        if (selectEl.value !== 'other') state.basics.additionalIncomes[idx].otherDetail = '';
        autosave();
      });
      amountEl.addEventListener('input', () => {
        state.basics.additionalIncomes[idx].amount = amountEl.value;
        autosave();
        refreshAllTotals();
      });
      otherInput.addEventListener('input', () => {
        state.basics.additionalIncomes[idx].otherDetail = otherInput.value;
        autosave();
      });

      // Remove
      row.querySelector('[data-remove-income]').addEventListener('click', () => {
        state.basics.additionalIncomes.splice(idx, 1);
        renderIncomes();
        autosave();
        refreshAllTotals();
      });

      list.appendChild(row);
    });

    // Update add-button disabled state
    const addBtn = document.getElementById('addIncomeBtn');
    if (addBtn) addBtn.disabled = state.basics.additionalIncomes.length >= 5;
  }

  function validateBasics() {
    const salary = parseFloat(state.basics.salary);
    if (isNaN(salary) || salary < 0) {
      // Light validation — allow 0 explicitly for unemployed
      const input = document.getElementById('salary');
      input.classList.add('is-error');
      input.focus();
      setTimeout(() => input.classList.remove('is-error'), 1800);
      return false;
    }
    return true;
  }

  // ============================================================
  // Expenses screen: 11-category accordion
  // ============================================================
  function buildCategories() {
    const container = document.getElementById('categories');
    if (!container) return;

    container.innerHTML = '';

    window.FHINK_DATA.categories.forEach(cat => {
      const catTotal = computeCategoryTotal(cat.id);
      const filledCount = countFilled(cat.id);

      const block = document.createElement('div');
      block.className = 'category';
      block.dataset.catId = cat.id;
      if (filledCount > 0) block.classList.add('is-touched');

      block.innerHTML = `
        <button type="button" class="category__header" aria-expanded="false">
          <span class="category__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${window.FHINK_DATA.icons[cat.icon] || ''}
            </svg>
          </span>
          <span class="category__title">${cat.title}</span>
          <span class="category__meta">
            <span class="category__check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
            <span class="category__sum" ${catTotal > 0 ? '' : 'hidden'}>₪${catTotal.toLocaleString('he-IL')}</span>
            <span class="category__chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </span>
        </button>
        <div class="category__body" hidden>
          <div class="category__items">
            ${cat.items.map(item => buildItemHTML(cat.id, item)).join('')}
          </div>
        </div>
      `;

      // Toggle open/close
      const header = block.querySelector('.category__header');
      const body = block.querySelector('.category__body');
      header.addEventListener('click', () => {
        const isOpen = !body.hidden;
        body.hidden = isOpen;
        header.setAttribute('aria-expanded', String(!isOpen));
        block.classList.toggle('is-open', !isOpen);
      });

      // Bind item inputs
      block.querySelectorAll('.item').forEach(item => {
        const itemId = item.dataset.itemId;
        const isOther = item.dataset.isOther === 'true';
        const amountInput = item.querySelector('input[type="number"]');
        const otherWrap = item.querySelector('.item__other');
        const otherInput = otherWrap ? otherWrap.querySelector('input') : null;

        amountInput.addEventListener('input', () => {
          state.expenses[cat.id] = state.expenses[cat.id] || {};
          state.expenses[cat.id][itemId] = state.expenses[cat.id][itemId] || {};
          state.expenses[cat.id][itemId].amount = amountInput.value;

          if (isOther && otherWrap) {
            otherWrap.hidden = !(parseFloat(amountInput.value) > 0);
          }

          autosave();
          updateCategoryHeader(cat.id);
          refreshAllTotals();
        });

        if (otherInput) {
          otherInput.addEventListener('input', () => {
            state.expenses[cat.id] = state.expenses[cat.id] || {};
            state.expenses[cat.id][itemId] = state.expenses[cat.id][itemId] || {};
            state.expenses[cat.id][itemId].otherDetail = otherInput.value;
            autosave();
          });
        }
      });

      container.appendChild(block);
    });
  }

  function buildItemHTML(catId, item) {
    const saved = (state.expenses[catId] && state.expenses[catId][item.id]) || {};
    const showOther = item.isOther && parseFloat(saved.amount) > 0;

    return `
      <div class="item" data-item-id="${item.id}" data-is-other="${!!item.isOther}">
        <label class="item__label">${item.label}</label>
        <div class="money-input item__amount">
          <span class="money-input__currency" aria-hidden="true">₪</span>
          <input type="number" class="input input--money" placeholder="0" min="0" step="50" inputmode="numeric" value="${saved.amount || ''}" />
        </div>
        ${item.isOther ? `
          <div class="item__other" ${showOther ? '' : 'hidden'}>
            <input type="text" class="input" placeholder="פרט במה מדובר — משפט קצר" value="${saved.otherDetail || ''}" />
          </div>
        ` : ''}
      </div>
    `;
  }

  function computeCategoryTotal(catId) {
    const items = state.expenses[catId] || {};
    let total = 0;
    Object.values(items).forEach(item => {
      const v = parseFloat(item.amount);
      if (!isNaN(v)) total += v;
    });
    return total;
  }

  function countFilled(catId) {
    const items = state.expenses[catId] || {};
    return Object.values(items).filter(it => parseFloat(it.amount) > 0).length;
  }

  function updateCategoryHeader(catId) {
    const block = document.querySelector(`.category[data-cat-id="${catId}"]`);
    if (!block) return;
    const total = computeCategoryTotal(catId);
    const sumEl = block.querySelector('.category__sum');
    if (total > 0) {
      sumEl.hidden = false;
      sumEl.textContent = `₪${total.toLocaleString('he-IL')}`;
    } else {
      sumEl.hidden = true;
    }
    block.classList.toggle('is-touched', total > 0);
  }

  function validateExpensesOther() {
    let firstMissing = null;
    Object.keys(state.expenses).forEach(catId => {
      const items = state.expenses[catId] || {};
      Object.keys(items).forEach(itemId => {
        if (itemId === 'other') {
          const it = items[itemId];
          if (parseFloat(it.amount) > 0 && (!it.otherDetail || it.otherDetail.trim().length < 2)) {
            if (!firstMissing) firstMissing = catId;
          }
        }
      });
    });

    if (firstMissing) {
      const block = document.querySelector(`.category[data-cat-id="${firstMissing}"]`);
      if (block) {
        const body = block.querySelector('.category__body');
        if (body && body.hidden) {
          block.querySelector('.category__header').click();
        }
        const otherInput = block.querySelector('.item__other input');
        if (otherInput) {
          otherInput.classList.add('is-error');
          otherInput.focus();
          setTimeout(() => otherInput.classList.remove('is-error'), 2000);
        }
        showToast('יש קטגוריה עם "אחר" שדורשת פירוט קצר.');
      }
      return false;
    }
    return true;
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
  // Live totals
  // ============================================================
  function computeTotalIncome() {
    let total = parseFloat(state.basics.salary) || 0;
    state.basics.additionalIncomes.forEach(inc => {
      const v = parseFloat(inc.amount);
      if (!isNaN(v)) total += v;
    });
    return total;
  }

  function computeTotalExpenses() {
    let total = 0;
    Object.keys(state.expenses).forEach(catId => {
      total += computeCategoryTotal(catId);
    });
    return total;
  }

  function refreshAllTotals() {
    const income   = computeTotalIncome();
    const expenses = computeTotalExpenses();
    const balance  = income - expenses;

    document.querySelectorAll('[data-total="income"]').forEach(el => {
      el.textContent = income.toLocaleString('he-IL');
    });
    document.querySelectorAll('[data-total="expense"]').forEach(el => {
      el.textContent = expenses.toLocaleString('he-IL');
    });
    document.querySelectorAll('[data-total="balance"]').forEach(el => {
      el.textContent = Math.abs(balance).toLocaleString('he-IL');
    });
  }

  // ============================================================
  // Summary screen
  // ============================================================
  function computeSummary() {
    const income = computeTotalIncome();
    const expenses = computeTotalExpenses();
    const balance = income - expenses;

    refreshAllTotals();

    const block = document.getElementById('balanceBlock');
    const label = document.getElementById('balanceLabel');
    const hint = document.getElementById('balanceHint');

    block.classList.remove('is-positive', 'is-negative', 'is-zero');

    if (balance > 0) {
      block.classList.add('is-positive');
      label.textContent = 'נשאר בסוף החודש';
      hint.textContent = 'זו נקודת הפתיחה שלך — נראה איך מגדילים אותה.';
    } else if (balance < 0) {
      block.classList.add('is-negative');
      label.textContent = 'חסר בסוף החודש';
      hint.textContent = 'זה לא טוב או רע — זה ברור. מחר נתחיל לסגור את הפער.';
    } else {
      block.classList.add('is-zero');
      label.textContent = 'מאוזן';
      hint.textContent = 'בדיוק על הקו. נראה איך פותחים מרווח אמיתי.';
    }

    // Generate AI insight
    const insightText = document.getElementById('insightText');
    if (income === 0 && expenses === 0) {
      insightText.textContent = window.FHINK_DATA.insights.noData();
    } else if (balance < -200) {
      insightText.textContent = window.FHINK_DATA.insights.deficit(income, expenses);
    } else if (Math.abs(balance) <= 200) {
      insightText.textContent = window.FHINK_DATA.insights.tight();
    } else if (balance / income < 0.15) {
      insightText.textContent = window.FHINK_DATA.insights.healthy(income, expenses);
    } else {
      insightText.textContent = window.FHINK_DATA.insights.excellent(income, expenses);
    }
  }

  // ============================================================
  // Skip warning modal
  // ============================================================
  function bindModal() {
    const modal = document.getElementById('skipModal');
    if (!modal) return;

    // Only the backdrop closes via this listener.
    // The buttons inside the modal go through the main delegated handler above.
    const backdrop = modal.querySelector('.modal__backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => closeSkipModal(false));
    }

    // Escape key closes the modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeSkipModal(false);
    });

    // Escape also closes the legal / video popups
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      ['privacyModal', 'disclaimerModal', 'videoModal'].forEach(id => {
        const mm = document.getElementById(id);
        if (mm && !mm.hidden) closeModalById(id);
      });
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

  function openModalById(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModalById(id) {
    const m = document.getElementById(id);
    if (!m) return;
    if (id === 'videoModal') resetVideoPlaceholder();
    m.hidden = true;
    document.body.style.overflow = '';
  }

  function restoreWatchedVideos() {
    const watched = state.meta.watched || {};
    document.querySelectorAll('[data-video-id]').forEach(card => {
      if (watched[card.dataset.videoId]) card.classList.add('is-watched');
    });
  }

  // Dev / review helpers — ?name=דנה&gender=נקבה&screen=basics&popup=privacyModal&reset=1
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
    if (popup) setTimeout(() => openModalById(popup), 300);
  }

  function openSkipModal() {
    const m = document.getElementById('skipModal');
    if (!m) return;
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeSkipModal(forceSkip) {
    const m = document.getElementById('skipModal');
    if (!m) return;
    m.hidden = true;
    document.body.style.overflow = '';
    if (forceSkip) {
      state.meta.commitmentChosen = 'skipped';
      saveState();
      showScreen('summary');
    }
  }

  // ============================================================
  // Complete Day 1
  // ============================================================
  async function handleComplete() {
    state.meta.completedAt = new Date().toISOString();
    saveState();

    let synced = false;
    try {
      await postDay1();
      synced = true;
    } catch (err) {
      console.warn('[FHINK] Day1 sync failed:', err);
    }

    const pid = state.user.pid || localStorage.getItem('challenge_pid');
    // Only block when the sync actually FAILED and we have no pid. A 200 with no
    // pid (data saved) must not trap the user — advance instead of deadlocking.
    if (!synced && !pid && window.location.protocol !== 'file:') {
      // Sync failed and no pid — do NOT advance, the next days need it. Let the user retry.
      alert('הייתה תקלה בשמירת הנתונים. בדקו את החיבור לאינטרנט ולחצו שוב על "סיום".');
      return;
    }

    showScreen('completed');
    wireGoToDay2();
  }

  function wireGoToDay2() {
    const btn = document.getElementById('goToDay2Btn');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const pid = localStorage.getItem('challenge_pid');
      const params = new URLSearchParams(window.location.search);
      const bypass = params.get('bypass');
      const cohort = (params.get('cohort') || localStorage.getItem('challenge_cohort') || '').toLowerCase();
      const qs = [];
      if (pid) qs.push('pid=' + encodeURIComponent(pid));
      if (bypass === '1') qs.push('bypass=1');
      if (cohort === 'lms') qs.push('cohort=lms');
      const url = 'day2.html' + (qs.length ? '?' + qs.join('&') : '');
      window.location.href = url;
    });
  }

  function allowEarlyAccess() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('bypass') === '1') return true;
    const cohort = (params.get('cohort') || localStorage.getItem('challenge_cohort') || 'pilot').toLowerCase();
    if (cohort === 'lms') { try { localStorage.setItem('challenge_cohort', 'lms'); } catch (e) {} return true; } // LMS course: all days open immediately
    const unlockMap = {
      pilot: PILOT_UNLOCK_ISO,
    };
    const unlockIso = unlockMap[cohort] || PILOT_UNLOCK_ISO;
    if (Date.now() >= new Date(unlockIso).getTime()) return true;
    showLockedOverlay(unlockIso);
    return false;
  }

  function showLockedOverlay(unlockIso) {
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
          <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;color:#231d15;font-weight:800;">יום 1 עדיין נעול</h1>
          <p style="margin:0;color:#5d5143;font-size:16px;line-height:1.8;">הפתיחה לצוות הפיילוט נקבעה ל-${unlockLabel}. אם קיבלת bypass=1, הדף ייפתח מייד.</p>
        </div>
      </div>`;
  }

  async function postDay1() {
    if (window.location.protocol === 'file:') {
      console.log('[FHINK] dev mode — would POST', state);
      return { ok: true, mocked: true };
    }

    const payload = buildSupabasePayload();
    const res = await fetch(SUPA_URL + '/functions/v1/create-participant-v10', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('Edge function error:', errBody);
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const pid = data?.id || data?.pid;
    if (pid) {
      try { localStorage.setItem('challenge_pid', pid); } catch (_) {}
      state.user.pid = pid;
    }
    return data;
  }

  function buildSupabasePayload() {
    const lead = JSON.parse(localStorage.getItem(CONFIG.leadStorageKey) || '{}') || {};
    const ready = JSON.parse(localStorage.getItem('fhink:opening-questionnaire') || '{}') || {};

    return {
      name: lead.fullName || lead.name || ready.fullName || state.user.fullName || '',
      age: parseInt(ready.age, 10) || 0,
      job_type: ready.employment || '',
      income: parseFloat(state.basics.salary) || 0,
      income_extra: (state.basics.additionalIncomes || []).reduce((acc, inc) => acc + (parseFloat(inc.amount) || 0), 0),
      email: lead.email || ready.email || '',
      phone: lead.phone || ready.phone || '',
      rent: getExpenseAmount('household', 'rent_mortgage'),
      arnona: getExpenseAmount('household', 'other'),
      utilities: getExpenseAmount('household', 'electricity') + getExpenseAmount('household', 'water') + getExpenseAmount('household', 'gas') + getExpenseAmount('household', 'house_committee'),
      telecom: getExpenseAmount('comms', 'phone') + getExpenseAmount('comms', 'internet') + getExpenseAmount('comms', 'tv') + getExpenseAmount('comms', 'streaming'),
      car_insurance: getExpenseAmount('insurance', 'car_insurance'),
      loans: getExpenseAmount('loans', 'bank_loans') + getExpenseAmount('loans', 'credit_cards') + getExpenseAmount('loans', 'private_loans'),
      education: getExpenseAmount('education', 'kindergarten') + getExpenseAmount('education', 'afternoon') + getExpenseAmount('education', 'tuition'),
      leasing: getExpenseAmount('transport', 'leasing'),
      groceries: getExpenseAmount('food', 'supermarket'),
      dining: getExpenseAmount('food', 'restaurants'),
      coffee: getExpenseAmount('food', 'coffee') + getExpenseAmount('food', 'delivery'),
      transport: getExpenseAmount('transport', 'fuel') + getExpenseAmount('transport', 'public') + getExpenseAmount('transport', 'parking'),
      health: getExpenseAmount('health', 'health_fund') + getExpenseAmount('health', 'medicine') + getExpenseAmount('health', 'dental') + getExpenseAmount('health', 'optics'),
      shopping: getExpenseAmount('leisure', 'shopping'),
      leisure: getExpenseAmount('leisure', 'entertainment') + getExpenseAmount('leisure', 'vacations') + getExpenseAmount('leisure', 'hobbies'),
      kids: getExpenseAmount('classes', 'kids_classes') + getExpenseAmount('classes', 'fitness'),
      pension_extra: getExpenseAmount('investments', 'extra_pension'),
      keren_hishtalmut: getExpenseAmount('investments', 'training_fund'),
      gemel_invest: getExpenseAmount('investments', 'investments'),
      child_savings: getExpenseAmount('investments', 'kids_savings'),
      general_savings: getExpenseAmount('investments', 'general_savings'),
      expenses_detail: JSON.stringify(buildExpensesDetailJSON()),
      cohort: (new URLSearchParams(window.location.search).get('cohort') || lead.cohort || 'pilot').toLowerCase(),
      source: new URLSearchParams(window.location.search).get('src') || lead.source || '',
    };
  }

  function buildExpensesDetailJSON() {
    const detail = {};
    Object.keys(state.expenses || {}).forEach(catId => {
      Object.keys(state.expenses[catId] || {}).forEach(itemId => {
        const itemVal = state.expenses[catId][itemId] || {};
        const amt = parseFloat(itemVal.amount) || 0;
        if (amt > 0) {
          detail[itemId] = amt;
          if (itemVal.otherDetail && itemVal.otherDetail.trim()) {
            detail[itemId + '_desc'] = itemVal.otherDetail.trim();
          }
        }
      });
    });
    return detail;
  }

  function getExpenseAmount(catId, itemId) {
    return parseFloat(state.expenses?.[catId]?.[itemId]?.amount) || 0;
  }

  // ============================================================
  // Active consent (optional) — flip ACTIVE_CONSENT to true if
  // the lawyer requires an explicit checkbox before starting
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

})();
