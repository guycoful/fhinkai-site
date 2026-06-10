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
   - Wired to Supabase Edge Functions (create-participant-v10)
   - Early-access time gating
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
  };

  const SUPA_URL = 'https://vuvavjmbvdqnwtleudqh.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dmF2am1idmRxbnd0bGV1ZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDY1MTMsImV4cCI6MjA2NzAyMjUxM30.QgtlrWs_qL7dMzxHkdUQaCBkGWsNNnExDv0phGz7NbI';

  const SCREEN_ORDER = ['opening', 'commitment', 'calendar', 'basics', 'expenses', 'summary', 'completed'];
  const TERMINAL_SCREENS = new Set(['completed', 'postponed']);

  const state = loadState();

  // ============================================================
  // Boot
  // ============================================================
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    applyUserContext();
    buildIncomes();
    buildCategories();
    bindNavigation();
    bindCalendarLinks();
    bindModal();
    refreshAllTotals();
    
    // Check if already completed
    if (state.meta.completedAt && !window.location.search.includes('reset=1')) {
      showScreen('completed');
      wireGoToDay2();
      return;
    }

    // Check lock (early-access gate)
    const COHORT_START_DAY1 = {
      'pilot': '2026-06-14T06:00:00+03:00',
      'rehearsal': '2026-05-20T06:00:00+03:00',
      'lms': '2026-05-20T11:30:00+03:00',
    };
    const urlCohort = (new URLSearchParams(window.location.search).get('cohort') || 'pilot').toLowerCase();
    const cohortKey = COHORT_START_DAY1[urlCohort] ? urlCohort : 'pilot';
    const startIso = COHORT_START_DAY1[cohortKey];
    const startTs = new Date(startIso).getTime();
    if (Date.now() < startTs && !window.location.search.includes('bypass=1')) {
      const d = new Date(startIso);
      const dateStr = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
      const labelEl = document.getElementById('lockedOpenDate');
      if (labelEl) labelEl.textContent = dateStr;
      showScreen('locked');
      return;
    }

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
        state.user.fullName = lead.fullName || lead.name || '';
        state.user.firstName = (lead.fullName || lead.name || '').split(' ')[0] || '';
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
    if (raw === 'זכר' || raw === 'male')   return 'male';
    if (raw === 'נקבה' || raw === 'female')  return 'female';
    return 'male'; 
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

    if (screenId === 'summary') {
      computeSummary();
    }
  }

  function bindNavigation() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const target = btn.dataset.target;

      if (action === 'next') {
        const currentScreen = state.currentScreen;

        // Validation per screen
        if (currentScreen === 'basics') {
          const salaryInput = document.getElementById('salary');
          if (salaryInput && !salaryInput.checkValidity()) {
            salaryInput.classList.add('is-error');
            salaryInput.focus();
            return;
          }
        }

        if (currentScreen === 'expenses' && target === 'summary') {
          // If no expenses at all, prompt warning modal
          const totalExpenses = computeTotalExpenses();
          if (totalExpenses === 0) {
            openSkipModal();
            return;
          }
        }

        showScreen(target);
      } else if (action === 'back') {
        // Go back in SCREEN_ORDER
        const idx = SCREEN_ORDER.indexOf(state.currentScreen);
        if (idx > 0) {
          showScreen(SCREEN_ORDER[idx - 1]);
        }
      } else if (action === 'postpone') {
        localStorage.setItem('day1_deferred', 'true');
        showScreen('postponed');
      } else if (action === 'complete') {
        handleComplete();
      } else if (action === 'modal-close') {
        const forceSkip = btn.dataset.skip === 'true';
        closeSkipModal(forceSkip);
      }
    });

    // Handle yes/no commitment
    const commitYesBtn = document.getElementById('commitYes');
    if (commitYesBtn) {
      commitYesBtn.addEventListener('click', () => {
        state.meta.commitmentChosen = 'now';
        autosave();
        showScreen('calendar');
      });
    }

    const commitNoBtn = document.getElementById('commitNo');
    if (commitNoBtn) {
      commitNoBtn.addEventListener('click', () => {
        state.meta.commitmentChosen = 'later';
        localStorage.setItem('day1_deferred', 'true');
        showScreen('postponed');
      });
    }

    // Handle calendar confirmed
    const calConfirmBtn = document.getElementById('calConfirm');
    if (calConfirmBtn) {
      calConfirmBtn.addEventListener('click', () => {
        state.meta.calendarConfirmed = true;
        autosave();
        showScreen('basics');
      });
    }

    // Handle salary input change
    const salaryInput = document.getElementById('salary');
    if (salaryInput) {
      salaryInput.value = state.basics.salary || '';
      salaryInput.addEventListener('input', () => {
        salaryInput.classList.remove('is-error');
        state.basics.salary = salaryInput.value;
        refreshAllTotals();
        autosave();
      });
    }
  }

  // ============================================================
  // Additional Incomes
  // ============================================================
  function buildIncomes() {
    const list = document.getElementById('incomesList');
    if (!list) return;

    list.innerHTML = '';
    state.basics.additionalIncomes.forEach((inc, idx) => {
      list.appendChild(createIncomeRow(inc, idx));
    });

    const addBtn = document.getElementById('addIncomeBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (state.basics.additionalIncomes.length >= 5) return;
        const newInc = { type: 'freelance', amount: '', otherDetail: '' };
        state.basics.additionalIncomes.push(newInc);
        list.appendChild(createIncomeRow(newInc, state.basics.additionalIncomes.length - 1));
        autosave();
      });
    }
  }

  function createIncomeRow(inc, idx) {
    const div = document.createElement('div');
    div.className = 'income-row';
    div.dataset.index = idx;

    const selectOptions = window.FHINK_DATA.incomeTypes.map(t => 
      `<option value="${t.value}" ${inc.type === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    div.innerHTML = `
      <div class="income-row__fields">
        <div class="select-wrap">
          <select class="select" data-field="type">
            ${selectOptions}
          </select>
          <svg class="select-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="money-input">
          <span class="money-input__currency">₪</span>
          <input type="number" class="input input--money" data-field="amount" value="${inc.amount}" placeholder="0" min="0" inputmode="numeric" />
        </div>
      </div>
      <div class="field other-detail" ${inc.type === 'other' ? '' : 'hidden'}>
        <input type="text" class="input" data-field="otherDetail" value="${inc.otherDetail || ''}" placeholder="פרט במה מדובר" />
      </div>
      <button type="button" class="btn-delete" aria-label="מחק הכנסה">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>
    `;

    const select = div.querySelector('[data-field="type"]');
    const amount = div.querySelector('[data-field="amount"]');
    const otherDetail = div.querySelector('[data-field="otherDetail"]');
    const otherDiv = div.querySelector('.other-detail');
    const deleteBtn = div.querySelector('.btn-delete');

    select.addEventListener('change', () => {
      inc.type = select.value;
      otherDiv.hidden = select.value !== 'other';
      if (select.value !== 'other') {
        inc.otherDetail = '';
        if (otherDetail) otherDetail.value = '';
      }
      autosave();
    });

    amount.addEventListener('input', () => {
      inc.amount = amount.value;
      refreshAllTotals();
      autosave();
    });

    if (otherDetail) {
      otherDetail.addEventListener('input', () => {
        inc.otherDetail = otherDetail.value;
        autosave();
      });
    }

    deleteBtn.addEventListener('click', () => {
      state.basics.additionalIncomes.splice(idx, 1);
      buildIncomes();
      refreshAllTotals();
      autosave();
    });

    return div;
  }

  // ============================================================
  // Expense Categories (Accordion)
  // ============================================================
  function buildCategories() {
    const wrap = document.getElementById('categories');
    if (!wrap) return;

    wrap.innerHTML = '';
    window.FHINK_DATA.categories.forEach(cat => {
      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.id = cat.id;

      const hasData = hasCategoryData(cat.id);
      if (hasData) card.classList.add('has-data');

      const path = window.FHINK_DATA.icons[cat.icon] || '';
      const itemsHtml = cat.items.map(item => createExpenseField(cat.id, item)).join('');

      card.innerHTML = `
        <button type="button" class="category-card__header" aria-expanded="false" aria-controls="body-${cat.id}">
          <div class="category-card__title-wrap">
            <span class="category-card__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                ${path}
              </svg>
            </span>
            <h3 class="category-card__title">${cat.title}</h3>
          </div>
          <div class="category-card__actions">
            <span class="category-card__status-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </span>
            <span class="category-card__total" data-cat-total="${cat.id}">0</span>
            <span class="category-card__chevron">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        </button>
        <div class="category-card__body" id="body-${cat.id}" hidden>
          <div class="category-card__inner">
            ${itemsHtml}
          </div>
        </div>
      `;

      // Wire accordion toggle
      const header = card.querySelector('.category-card__header');
      const body = card.querySelector('.category-card__body');
      header.addEventListener('click', () => {
        const open = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', String(!open));
        body.hidden = open;
        card.classList.toggle('is-open', !open);
      });

      // Wire inputs inside card
      cat.items.forEach(item => {
        const input = card.querySelector(`input[data-item="${item.id}"]`);
        const otherDetail = card.querySelector(`input[data-item-detail="${item.id}"]`);
        const otherDiv = card.querySelector(`.other-detail-${item.id}`);

        if (input) {
          input.addEventListener('input', () => {
            const val = input.value;
            if (!state.expenses[cat.id]) state.expenses[cat.id] = {};
            if (!state.expenses[cat.id][item.id]) {
              state.expenses[cat.id][item.id] = { amount: '', otherDetail: '' };
            }
            state.expenses[cat.id][item.id].amount = val;
            
            if (item.isOther) {
              if (otherDiv) otherDiv.hidden = !val || parseFloat(val) === 0;
            }

            updateCategoryUI(cat.id);
            refreshAllTotals();
            autosave();
          });
        }

        if (otherDetail) {
          otherDetail.addEventListener('input', () => {
            if (!state.expenses[cat.id]) state.expenses[cat.id] = {};
            if (!state.expenses[cat.id][item.id]) {
              state.expenses[cat.id][item.id] = { amount: '', otherDetail: '' };
            }
            state.expenses[cat.id][item.id].otherDetail = otherDetail.value;
            autosave();
          });
        }
      });

      wrap.appendChild(card);
      updateCategoryUI(cat.id);
    });
  }

  function createExpenseField(catId, item) {
    const val = state.expenses[catId]?.[item.id]?.amount || '';
    const desc = state.expenses[catId]?.[item.id]?.otherDetail || '';

    return `
      <div class="field field--money">
        <label class="field-label" for="exp-${catId}-${item.id}">${item.label}</label>
        <div class="money-input">
          <span class="money-input__currency" aria-hidden="true">₪</span>
          <input type="number" id="exp-${catId}-${item.id}" data-item="${item.id}" class="input input--money" value="${val}" placeholder="0" min="0" inputmode="numeric" />
        </div>
        ${item.isOther ? `
          <div class="field other-detail-${item.id}" ${val && parseFloat(val) > 0 ? '' : 'hidden'} style="margin-top:8px;">
            <input type="text" class="input" data-item-detail="${item.id}" value="${desc}" placeholder="פרט במה מדובר" />
          </div>
        ` : ''}
      </div>
    `;
  }

  function hasCategoryData(catId) {
    const catData = state.expenses[catId];
    if (!catData) return false;
    return Object.values(catData).some(v => parseFloat(v.amount) > 0);
  }

  function computeCategoryTotal(catId) {
    const catData = state.expenses[catId];
    if (!catData) return 0;
    let total = 0;
    Object.values(catData).forEach(v => {
      const val = parseFloat(v.amount);
      if (!isNaN(val)) total += val;
    });
    return total;
  }

  function updateCategoryUI(catId) {
    const card = document.querySelector(`.category-card[data-id="${catId}"]`);
    if (!card) return;

    const total = computeCategoryTotal(catId);
    const hasData = total > 0;

    card.classList.toggle('has-data', hasData);
    const totalEl = card.querySelector(`[data-cat-total="${catId}"]`);
    if (totalEl) {
      totalEl.textContent = total > 0 ? '₪' + total.toLocaleString('he-IL') : '';
    }
  }

  // ============================================================
  // Totals calculations
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

    if (block) block.classList.remove('is-positive', 'is-negative', 'is-zero');

    if (balance > 0) {
      if (block) block.classList.add('is-positive');
      if (label) label.textContent = 'נשאר בסוף החודש';
      if (hint) hint.textContent = 'זו נקודת הפתיחה שלך — נראה איך מגדילים אותה.';
    } else if (balance < 0) {
      if (block) block.classList.add('is-negative');
      if (label) label.textContent = 'חסר בסוף החודש';
      if (hint) hint.textContent = 'זה לא טוב או רע — זה ברור. מחר נתחיל לסגור את הפער.';
    } else {
      if (block) block.classList.add('is-zero');
      if (label) label.textContent = 'מאוזן';
      if (hint) hint.textContent = 'בדיוק על הקו. נראה איך פותחים מרווח אמיתי.';
    }

    // Generate AI insight
    const insightText = document.getElementById('insightText');
    if (insightText) {
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
  }

  // ============================================================
  // Skip warning modal
  // ============================================================
  function bindModal() {
    const modal = document.getElementById('skipModal');
    if (!modal) return;

    const backdrop = modal.querySelector('.modal__backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => closeSkipModal(false));
    }

    // Escape key closes the modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeSkipModal(false);
    });
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

    try {
      await postDay1();
    } catch (err) {
      console.warn('[FHINK] Day1 sync failed:', err);
    }

    showScreen('completed');
    wireGoToDay2();
  }

  function wireGoToDay2() {
    const btn = document.getElementById('goToDay2Btn');
    if (btn) {
      btn.addEventListener('click', () => {
        const pid = localStorage.getItem('challenge_pid');
        const params = new URLSearchParams(window.location.search);
        const bypass = params.get('bypass');
        let url = 'day2.html' + (pid ? '?pid=' + pid : '');
        if (bypass === '1') {
          url += (pid ? '&' : '?') + 'bypass=1';
        }
        window.location.href = url;
      });
    }
  }

  function getExpenseAmount(catId, itemId) {
    return parseFloat(state.expenses[catId]?.[itemId]?.amount) || 0;
  }

  function buildExpensesDetailJSON() {
    const detail = {};
    Object.keys(state.expenses).forEach(catId => {
      Object.keys(state.expenses[catId]).forEach(itemId => {
        const itemVal = state.expenses[catId][itemId];
        const amt = parseFloat(itemVal?.amount) || 0;
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

  function buildSupabasePayload() {
    const lead  = JSON.parse(localStorage.getItem('fhink_lead_v1') || '{}');
    const ready = JSON.parse(localStorage.getItem('fhink:opening-questionnaire') || '{}');

    return {
      name: lead.fullName || lead.name || ready.fullName || state.user.fullName || '',
      age: parseInt(ready.age) || 0,
      job_type: ready.employment || '',
      income: parseFloat(state.basics.salary) || 0,
      income_extra: state.basics.additionalIncomes.reduce((acc, inc) => acc + (parseFloat(inc.amount) || 0), 0),
      email: lead.email || ready.email || '',
      phone: lead.phone || ready.phone || '',
      
      // Legacy expense columns
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
      
      // Savings
      pension_extra: getExpenseAmount('investments', 'extra_pension'),
      keren_hishtalmut: getExpenseAmount('investments', 'training_fund'),
      gemel_invest: getExpenseAmount('investments', 'investments'),
      child_savings: getExpenseAmount('investments', 'kids_savings'),
      general_savings: getExpenseAmount('investments', 'general_savings'),
      
      // Detailed expense JSON
      expenses_detail: JSON.stringify(buildExpensesDetailJSON()),
      
      // Cohort/source
      cohort: (new URLSearchParams(window.location.search).get('cohort') || lead.cohort || 'pilot').toLowerCase(),
      source: new URLSearchParams(window.location.search).get('src') || lead.source || ''
    };
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
    const pid = data?.id;
    if (pid) {
      localStorage.setItem('challenge_pid', pid);
    }
    
    return data;
  }

  // ============================================================
  // Calendar links dynamically built
  // ============================================================
  function bindCalendarLinks() {
    const googleBtn = document.querySelector('[data-action="cal-google"]');
    const icalBtn   = document.querySelector('[data-action="cal-ical"]');

    // Create dynamic links for Webinar: Wednesday 17 Dec 2026 20:00-21:30 IDT (UTC+2)
    // 20261217T180000Z / 20261217T193000Z
    const title = 'FHINK AI · וובינר חיתום האתגר';
    const details = 'וובינר סיום אתגר 4 הימים של FHINK AI. נתחבר ונשלב את כל התוצאות שעבדת עליהן.';
    const location = 'אונליין (קישור יישלח בוואטסאפ)';
    const startStr = '20261217T180000Z';
    const endStr   = '20261217T193000Z';

    if (googleBtn) {
      googleBtn.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
    }
    if (icalBtn) {
      // Direct .ics download data URI
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${details}`,
        `LOCATION:${location}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
      icalBtn.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(icsContent);
      icalBtn.setAttribute('download', 'fhink_webinar.ics');
    }
  }

})();
