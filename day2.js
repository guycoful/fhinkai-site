/* ============================================================================
   FHINK AI · Day 2 · Main Script
   - Screen navigation (same engine as Day 1)
   - Pulls user (fhink_lead_v1) and finances (fhink_day1_v1) — never re-asks
   - Buckets the Day-1 expenses into need / want / save
   - Trim mechanics: quick percent chips or custom amount per item
   - Live target tracker (3% of need-expenses = the daily win)
   - Video slots (Guy + Omri) with minimal players
   - Day-2 summary with rule-based AI insight
   - State in localStorage, autosaved
============================================================================ */

(function () {
  'use strict';

  // ============================================================
  // Config & State
  // ============================================================
  const CONFIG = {
    storageKey: 'fhink_day2_v1',
    day1StorageKey: 'fhink_day1_v1',
    leadStorageKey: 'fhink_lead_v1',
    autosaveDelayMs: 600,
    apiEndpoint: '/api/day2',           // ← wire by Claude Code
    targetRate: 0.03,                   // 3% of need-expenses
  };

  const DATA = window.FHINK_DAY2_DATA;
  const SCREEN_ORDER = ['opening', 'commitment', 'webinar', 'basics', 'trim', 'summary', 'completed'];
  const ACTIVE_CONSENT = false; // ← flip to true if אילת requires active consent

  const state = loadState();

  // Derived at boot
  let day1 = null;        // Day-1 state (real or demo)
  let rows = [];          // flat expense rows with bucket info
  let totals = { need: 0, want: 0, save: 0, expense: 0, income: 0 };
  let target = 0;
  let targetHitAnnounced = false;

  // ============================================================
  // Boot
  // ============================================================
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    applyUrlParams();
    applyUserContext();
    loadDay1();
    buildRows();
    computeTotals();
    renderPulled();
    restoreWatchedVideos();
    buildBuckets();
    bindNavigation();
    bindCalendarLinks();
    bindModals();
    enableActiveConsent();
    updateTracker();
    showScreen(state.currentScreen || 'opening');

    if (state.meta.demo) {
      const chip = document.getElementById('pulledChip');
      if (chip) {
        chip.classList.add('pulled__chip--demo');
        chip.querySelector('span').textContent = 'נתוני דוגמה להמחשה — בגרסה החיה נשאב אוטומטית מיום 1';
      }
    }
  }

  // ============================================================
  // Dev / review helpers — ?name=דנה&gender=נקבה&screen=trim&reset=1
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
    if (pid) state.user.pid = pid;

    // Pre-applied example trims, for review of the tracker/summary states
    if (params.get('demotrims') === '1') {
      state.trims = {
        'household.rent_mortgage': { mode: 'pct', pct: 5 },
        'food.supermarket':        { mode: 'pct', pct: 5 },
        'transport.fuel':          { mode: 'pct', pct: 10 },
        'food.restaurants':        { mode: 'pct', pct: 10 },
      };
    }
  }

  // ============================================================
  // State (localStorage)
  // ============================================================
  function defaultState() {
    return {
      currentScreen: 'opening',
      user: { fullName: '', firstName: '', gender: '' },
      trims: {
        // "catId.itemId" -> { mode: 'none'|'pct'|'custom', pct, custom }
      },
      meta: {
        commitmentChosen: null, // 'now' | 'later'
        watched: {},            // videoId -> true
        webinarConfirmed: false,
        consentGiven: false,
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
          trims: parsed.trims || {},
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
    if (!raw) return 'male'; // default per brief
    if (raw === 'זכר' || raw === 'male')   return 'male';
    if (raw === 'נקבה' || raw === 'female') return 'female';
    return 'male';
  }

  function applyGender(g) {
    document.querySelectorAll('[data-male], [data-female]').forEach(el => {
      const target2 = g === 'female' ? el.dataset.female : el.dataset.male;
      if (target2) el.textContent = target2;
    });
  }

  // ============================================================
  // Day-1 data — pulled automatically, demo fallback
  // ============================================================
  function loadDay1() {
    try {
      const raw = localStorage.getItem(CONFIG.day1StorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.expenses && hasAnyExpense(parsed.expenses)) {
          day1 = parsed;
          state.meta.demo = false;
          return;
        }
      }
    } catch (_) {}
    day1 = DATA.demoDay1;
    state.meta.demo = true;
  }

  function hasAnyExpense(expenses) {
    return Object.values(expenses).some(items =>
      Object.values(items || {}).some(it => parseFloat(it.amount) > 0)
    );
  }

  // ============================================================
  // Rows: flatten Day-1 expenses with bucket mapping
  // ============================================================
  function buildRows() {
    rows = [];
    DATA.categories.forEach(cat => {
      const saved = (day1.expenses && day1.expenses[cat.id]) || {};
      cat.items.forEach(item => {
        const rec = saved[item.id];
        const amount = rec ? parseFloat(rec.amount) : NaN;
        if (isNaN(amount) || amount <= 0) return;
        rows.push({
          key: cat.id + '.' + item.id,
          catId: cat.id,
          catTitle: cat.title,
          itemId: item.id,
          label: (item.isOther && rec.otherDetail) ? rec.otherDetail : item.label,
          bucket: item.bucket,
          day4: !!item.day4,
          amount: amount,
        });
      });
    });
  }

  function computeTotals() {
    totals = { need: 0, want: 0, save: 0, expense: 0, income: 0 };
    rows.forEach(r => {
      totals[r.bucket] += r.amount;
      totals.expense += r.amount;
    });

    let income = parseFloat(day1.basics && day1.basics.salary) || 0;
    ((day1.basics && day1.basics.additionalIncomes) || []).forEach(inc => {
      const v = parseFloat(inc.amount);
      if (!isNaN(v)) income += v;
    });
    totals.income = income;

    target = Math.round((totals.need + totals.want) * CONFIG.targetRate);
  }

  // ============================================================
  // Trim math
  // ============================================================
  function trimFor(row) {
    const t = state.trims[row.key];
    if (!t || t.mode === 'none') return 0;
    if (t.mode === 'pct') return Math.round(row.amount * (t.pct / 100));
    if (t.mode === 'custom') {
      const v = parseFloat(t.custom);
      if (isNaN(v) || v <= 0) return 0;
      return Math.min(Math.round(v), row.amount);
    }
    return 0;
  }

  function savedByBucket() {
    const out = { need: 0, want: 0, save: 0 };
    rows.forEach(r => { out[r.bucket] += trimFor(r); });
    return out;
  }

  // ============================================================
  // Screen Navigation
  // ============================================================
  function showScreen(screenId) {
    document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
    document.body.style.overflow = '';

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
    let target2 = document.querySelector(`.screen[data-screen="${screenId}"]`);
    if (!target2) {
      target2 = document.querySelector('.screen[data-screen="opening"]');
      screenId = 'opening';
    }
    target2.classList.add('is-active');
    state.currentScreen = screenId;
    autosave();

    window.scrollTo({ top: 0, behavior: 'smooth' });

    const heading = target2.querySelector('h1, h2, h3');
    if (heading) setTimeout(() => heading.focus({ preventScroll: true }), 100);

    if (screenId === 'webinar' && state.meta.webinarConfirmed) {
      const confirmedChip = document.getElementById('webinarConfirmedChip');
      if (confirmedChip) confirmedChip.hidden = false;
    }
    if (screenId === 'summary') computeSummary();
    if (screenId === 'trim') {
      // Open the need-bucket automatically so users see where to act
      setTimeout(() => {
        const firstBucket = document.querySelector('.bucket');
        if (firstBucket && !firstBucket.classList.contains('is-open')) {
          const header = firstBucket.querySelector('.category__header');
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
      const target2 = btn.dataset.target;
      const currentScreen = state.currentScreen;

      switch (action) {
        case 'next':
          if (currentScreen === 'trim' && target2 === 'summary') {
            const saved = savedByBucket();
            if (saved.need + saved.want === 0) { openModal('skipModal'); return; }
          }
          nextFrom(currentScreen, target2);
          break;

        case 'back':
          prevFrom(currentScreen, target2);
          break;

        case 'postpone':
          handlePostpone();
          break;

        case 'complete':
          handleComplete();
          break;

        case 'modal-close': {
          const shouldSkip = btn.dataset.skip === 'true';
          closeModal('skipModal');
          if (shouldSkip) showScreen('summary');
          break;
        }

        case 'video-open': {
          const titleEl = document.getElementById('videoModalTitle');
          if (titleEl) titleEl.textContent = btn.dataset.videoTitle || 'הסרטון';
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
          saveState();
          const confirmedChip = document.getElementById('webinarConfirmedChip');
          if (confirmedChip) confirmedChip.hidden = false;
          showToast('מעולה — המקום שלך שמור. נתראה בוובינר.');
          nextFrom(state.currentScreen, btn.dataset.target);
          break;
        }
      }
    });
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
  // Basics screen — pulled numbers
  // ============================================================
  function renderPulled() {
    setAll('[data-pulled="income"]', fmt(totals.income));
    setAll('[data-pulled="expense"]', fmt(totals.expense));

    ['need', 'want', 'save'].forEach(b => {
      setAll(`[data-bucket-sum="${b}"]`, fmt(totals[b]));
      const count = rows.filter(r => r.bucket === b).length;
      setAll(`[data-bucket-count="${b}"]`, count + ' סעיפים');
    });

    setAll('[data-trim="target"]', fmt(target));
    setAll('[data-trim="baseTotal"]', fmt(totals.need + totals.want));
  }

  // ============================================================
  // Trim screen — bucket accordions (need / want / save)
  // ============================================================
  function buildBuckets() {
    const container = document.getElementById('buckets');
    if (!container) return;
    container.innerHTML = '';

    DATA.buckets.filter(b => b.trimmable).forEach(bucket => {
      const bucketRows = rows.filter(r => r.bucket === bucket.id).sort((a, b) => b.amount - a.amount);
      const sum = bucketRows.reduce((a, r) => a + r.amount, 0);

      const block = document.createElement('div');
      block.className = `category bucket bucket--${bucket.id}`;
      block.dataset.bucketId = bucket.id;

      block.innerHTML = `
        <button type="button" class="category__header" aria-expanded="false">
          <span class="category__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              ${DATA.icons[bucket.icon] || ''}
            </svg>
          </span>
          <span class="bucket__heading">
            <span class="category__title">${bucket.title}</span>
            <span class="bucket__subtitle">${bucket.subtitle}</span>
          </span>
          <span class="category__meta">
            <span class="bucket__saved" hidden>−₪0</span>
            <span class="category__sum" ${sum > 0 ? '' : 'hidden'}>₪${fmt(sum)}</span>
            <span class="category__chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </span>
        </button>
        <div class="category__body" hidden>
          <div class="category__items">
            ${bucketRows.length
              ? bucketRows.map(r => bucket.trimmable ? buildTrimRowHTML(r) : buildSaveRowHTML(r)).join('')
              : `<div class="bucket__empty">לא הוזנו הוצאות כאלה ביום 1.</div>`}
          </div>
          ${bucket.note ? `
            <div class="note-line note-line--inset">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DATA.icons.lock}</svg>
              <span>${bucket.note}</span>
            </div>` : ''}
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

      // Bind trim rows
      if (bucket.trimmable) {
        block.querySelectorAll('.trim-row').forEach(rowEl => bindTrimRow(rowEl));
      }

      container.appendChild(block);
    });

    refreshBucketHeaders();
  }

  function buildTrimRowHTML(row) {
    const t = state.trims[row.key] || { mode: 'none' };
    const trimmed = trimFor(row);

    const chips = DATA.trimOptions.map(opt => {
      let selected = false;
      if (opt.key === 'none')   selected = !t.mode || t.mode === 'none';
      if (opt.pct && t.mode === 'pct') selected = t.pct === opt.pct;
      if (opt.key === 'custom') selected = t.mode === 'custom';
      return `<button type="button" class="chip${selected ? ' is-selected' : ''}" data-chip="${opt.key}" data-pct="${opt.pct || 0}">${opt.label}</button>`;
    }).join('');

    return `
      <div class="trim-row${trimmed > 0 ? ' is-trimmed' : ''}" data-row-key="${row.key}">
        <div class="trim-row__top">
          <div class="trim-row__info">
            <span class="trim-row__label">${row.label}</span>
            <span class="trim-row__origin">${row.catTitle}</span>
          </div>
          <div class="trim-row__amounts">
            <span class="trim-row__now">₪${fmt(row.amount)}</span>
            <span class="trim-row__delta" ${trimmed > 0 ? '' : 'hidden'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="17" y1="12" x2="7" y2="12"></line><polyline points="11 16 7 12 11 8"></polyline></svg>
              <span>₪${fmt(row.amount - trimmed)}</span>
            </span>
          </div>
        </div>
        <div class="trim-row__chips" role="group" aria-label="כמה לצמצם ב${row.label}">
          ${chips}
        </div>
        <div class="trim-row__custom" ${t.mode === 'custom' ? '' : 'hidden'}>
          <div class="money-input">
            <span class="money-input__currency" aria-hidden="true">₪</span>
            <input type="number" class="input input--money" placeholder="כמה לצמצם בחודש?"
                   min="0" max="${row.amount}" step="10" inputmode="numeric"
                   value="${t.mode === 'custom' && t.custom ? t.custom : ''}" />
          </div>
        </div>
        <div class="trim-row__win" ${trimmed > 0 ? '' : 'hidden'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>חיסכון של ₪<span class="trim-row__win-amount">${fmt(trimmed)}</span> בחודש</span>
        </div>
      </div>
    `;
  }

  function buildSaveRowHTML(row) {
    return `
      <div class="trim-row trim-row--locked" data-row-key="${row.key}">
        <div class="trim-row__top">
          <div class="trim-row__info">
            <span class="trim-row__label">${row.label}</span>
            <span class="trim-row__origin">${row.catTitle}</span>
          </div>
          <div class="trim-row__amounts">
            <span class="trim-row__now">₪${fmt(row.amount)}</span>
            <span class="trim-row__lock" title="${row.day4 ? 'נטפל בזה ביום 4' : 'בחיסכון לא נוגעים'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DATA.icons.lock}</svg>
              <span>${row.day4 ? 'יום 4' : 'שמור'}</span>
            </span>
          </div>
        </div>
      </div>
    `;
  }

  function bindTrimRow(rowEl) {
    const key = rowEl.dataset.rowKey;
    const row = rows.find(r => r.key === key);
    if (!row) return;

    const customWrap = rowEl.querySelector('.trim-row__custom');
    const customInput = customWrap ? customWrap.querySelector('input') : null;

    rowEl.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const kind = chip.dataset.chip;
        const pct = parseFloat(chip.dataset.pct) || 0;

        if (kind === 'none') {
          state.trims[key] = { mode: 'none' };
          if (customWrap) customWrap.hidden = true;
        } else if (kind === 'custom') {
          state.trims[key] = { mode: 'custom', custom: (state.trims[key] && state.trims[key].custom) || '' };
          if (customWrap) {
            customWrap.hidden = false;
            if (customInput) customInput.focus();
          }
        } else {
          state.trims[key] = { mode: 'pct', pct: pct };
          if (customWrap) customWrap.hidden = true;
        }

        rowEl.querySelectorAll('.chip').forEach(c => c.classList.remove('is-selected'));
        chip.classList.add('is-selected');

        refreshTrimRow(rowEl, row);
        autosave();
      });
    });

    if (customInput) {
      customInput.addEventListener('input', () => {
        state.trims[key] = { mode: 'custom', custom: customInput.value };
        refreshTrimRow(rowEl, row);
        autosave();
      });
    }
  }

  function refreshTrimRow(rowEl, row) {
    const trimmed = trimFor(row);

    rowEl.classList.toggle('is-trimmed', trimmed > 0);

    const delta = rowEl.querySelector('.trim-row__delta');
    if (delta) {
      delta.hidden = trimmed <= 0;
      const span = delta.querySelector('span');
      if (span) span.textContent = '₪' + fmt(row.amount - trimmed);
    }

    const win = rowEl.querySelector('.trim-row__win');
    if (win) {
      win.hidden = trimmed <= 0;
      const amountEl = win.querySelector('.trim-row__win-amount');
      if (amountEl) amountEl.textContent = fmt(trimmed);
    }

    refreshBucketHeaders();
    updateTracker();
  }

  function refreshBucketHeaders() {
    const saved = savedByBucket();
    document.querySelectorAll('.bucket').forEach(block => {
      const b = block.dataset.bucketId;
      const savedEl = block.querySelector('.bucket__saved');
      if (!savedEl) return;
      if (saved[b] > 0) {
        savedEl.hidden = false;
        savedEl.textContent = '−₪' + fmt(saved[b]);
        block.classList.add('is-touched');
      } else {
        savedEl.hidden = true;
        block.classList.remove('is-touched');
      }
    });
  }

  // ============================================================
  // Sticky tracker
  // ============================================================
  function updateTracker() {
    const saved = savedByBucket();
    const total = saved.need + saved.want;

    setAll('[data-trim="saved"]', fmt(total));

    const tracker = document.getElementById('trimTracker');
    const fill = document.getElementById('trackerFill');
    const label = document.getElementById('trackerLabel');
    const caption = document.getElementById('trackerCaption');
    if (!tracker || !fill) return;

    const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
    fill.style.width = pct + '%';

    const bar = tracker.querySelector('.trim-tracker__bar');
    if (bar) bar.setAttribute('aria-valuenow', pct);

    const hit = target > 0 && total >= target;
    tracker.classList.toggle('is-hit', hit);

    if (hit) {
      label.textContent = 'ניצחת את היום — קיזזת 3%';
      caption.textContent = `קיזזת ₪${fmt(total)} מתוך יעד של ₪${fmt(target)} · כל קיזוז נוסף מגדיל את הניצחון`;
      if (!targetHitAnnounced) {
        targetHitAnnounced = true;
        fireConfetti(tracker);
        showToast('זהו. קיזזת 3% — ניצחת את היום 🏆');
      }
    } else {
      label.textContent = 'הקיזוז החודשי שלך עד כה';
      caption.textContent = target > 0
        ? `היעד: קיזוז ₪${fmt(target)} · עוד ₪${fmt(Math.max(0, target - total))} ליעד`
        : 'היעד: קיזוז של 3% מההוצאות שלך';
      targetHitAnnounced = false;
    }
  }

  // ============================================================
  // Fireworks — calm brand-colored burst when the 3% target is hit
  // ============================================================
  function fireConfetti(anchorEl) {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const colors = ['#26A59A', '#5EE8DC', '#1F8D84', '#DDF4F1', '#151924'];
      const rect = anchorEl ? anchorEl.getBoundingClientRect()
                            : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + Math.min(rect.height / 2, 40);

      const layer = document.createElement('div');
      layer.className = 'confetti-layer';
      document.body.appendChild(layer);

      for (let i = 0; i < 90; i++) {
        const piece = document.createElement('span');
        piece.className = 'confetti';
        const size = 6 + Math.random() * 7;
        piece.style.width = size + 'px';
        piece.style.height = (Math.random() > 0.5 ? size : size * 0.45) + 'px';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.borderRadius = Math.random() > 0.6 ? '50%' : '2px';
        piece.style.left = originX + 'px';
        piece.style.top = originY + 'px';
        layer.appendChild(piece);

        const angle = -Math.random() * Math.PI;            // upward fan
        const velocity = 180 + Math.random() * 340;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity - 80;
        const rot = (Math.random() - 0.5) * 760;
        piece.animate([
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy + 420}px) rotate(${rot}deg)`, opacity: 0 }
        ], {
          duration: 1000 + Math.random() * 900,
          easing: 'cubic-bezier(0.16, 0.6, 0.4, 1)',
          fill: 'forwards',
        });
      }

      setTimeout(() => layer.remove(), 2200);
    } catch (_) {}
  }

  function restoreWatchedVideos() {
    const watched = state.meta.watched || {};
    document.querySelectorAll('[data-video-id]').forEach(card => {
      if (watched[card.dataset.videoId]) card.classList.add('is-watched');
    });
  }

  // ============================================================
  // Summary screen
  // ============================================================
  function computeSummary() {
    const saved = savedByBucket();
    const total = saved.need + saved.want;
    const yearly = total * 12;
    const hit = target > 0 && total >= target;

    setAll('[data-trim="savedTotal"]', fmt(total));
    setAll('[data-trim="savedYear"]', fmt(yearly));
    setAll('[data-trim="savedNeed"]', fmt(total));

    // Headline
    const headline = document.getElementById('summaryHeadline');
    if (headline) {
      headline.textContent = hit ? 'זה ניצחון.' : (total > 0 ? 'התחלה מצוינת.' : 'אפשר לחזור ולבחור.');
    }

    // Target result block
    const block = document.getElementById('targetResult');
    const label = document.getElementById('targetResultLabel');
    const hint = document.getElementById('targetResultHint');
    if (block) {
      block.classList.remove('is-positive', 'is-negative', 'is-zero');
      if (hit) {
        block.classList.add('is-positive');
        label.textContent = 'היעד הושג';
        hint.textContent = `קיזוז מתוך יעד של ₪${fmt(target)} (3% מסך ההוצאות שלך)`;
      } else if (total > 0) {
        block.classList.add('is-zero');
        label.textContent = 'בדרך ליעד';
        hint.textContent = `היעד: ₪${fmt(target)} · אפשר לחזור ולהשלים בכל רגע`;
      } else {
        block.classList.add('is-zero');
        label.textContent = 'היעד ממתין';
        hint.textContent = `היעד: ₪${fmt(target)} (3% מהוצאות הצורך)`;
      }
    }

    // New monthly flow (before → after)
    const before = totals.income - totals.expense;
    const after = before + total;
    setAll('[data-flow="before"]', fmtSigned(before));
    setAll('[data-flow="after"]', fmtSigned(after));
    const flowEl = document.getElementById('newFlow');
    if (flowEl) {
      flowEl.classList.toggle('is-positive', after > 0);
      flowEl.classList.toggle('is-negative', after < 0);
    }

    // AI insight
    const insightText = document.getElementById('insightText');
    if (insightText) {
      let text;
      if (total === 0) {
        text = DATA.insights.none();
      } else if (hit && total > target * 1.5) {
        text = DATA.insights.exceeded(total, target, yearly);
      } else if (hit) {
        text = DATA.insights.hit(total, target, yearly);
      } else {
        text = DATA.insights.partial(total, target);
      }
      if (before < 0 && total > 0) {
        text += DATA.insights.closesGap(total, Math.abs(before));
      }
      insightText.textContent = text;
    }
  }

  // ============================================================
  // Modals & Toast
  // ============================================================
  function bindModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      const backdrop = modal.querySelector('.modal__backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', () => { modal.hidden = true; document.body.style.overflow = ''; });
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.modal:not([hidden])').forEach(m => { m.hidden = true; });
      document.body.style.overflow = '';
    });
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
  // Complete Day 2
  // ============================================================
  async function handleComplete() {
    state.meta.completedAt = new Date().toISOString();
    saveState();

    try {
      await postDay2();
    } catch (err) {
      console.warn('[FHINK] Day2 sync failed:', err);
    }

    showScreen('completed');
  }

  async function postDay2() {
    const saved = savedByBucket();
    const payload = {
      ...state,
      results: {
        target: target,
        needTotal: totals.need,
        savedNeed: saved.need,
        savedWant: saved.want,
        savedTotal: saved.need + saved.want,
        yearly: (saved.need + saved.want) * 12,
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
  // Calendar links (webinar)
  // ============================================================
  function bindCalendarLinks() {
    // Placeholder values — wire real meeting details from backend later.
    const webinar = {
      title: 'וובינר חיתום אתגר FHINK AI',
      start: '20261217T170000Z',  // ISO UTC — placeholder
      end:   '20261217T183000Z',
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

  // ============================================================
  // Helpers
  // ============================================================
  function fmt(n) {
    return (Math.round(n) || 0).toLocaleString('he-IL');
  }

  function fmtSigned(n) {
    const v = Math.round(n) || 0;
    return (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('he-IL');
  }

  function setAll(selector, text) {
    document.querySelectorAll(selector).forEach(el => { el.textContent = text; });
  }
})();
