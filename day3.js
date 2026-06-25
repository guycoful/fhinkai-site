/* ============================================================================
   FHINK AI · Day 3 · Main Script
   - Screen navigation (same engine as Days 1–2)
   - Pulls user (fhink_lead_v1) + salary (fhink_day1_v1) — never re-asks
   - About-you form: occupation / experience / target salary
   - Live salary-gap calculation + Day-3 summary with rule-based AI insight
   - Optional bridge to Day-2 results (the trims keep working for you)
   - State in localStorage, autosaved
============================================================================ */

(function () {
  'use strict';

  // ============================================================
  // Config & State
  // ============================================================
  const CONFIG = {
    storageKey: 'fhink_day3_v1',
    day1StorageKey: 'fhink_day1_v1',
    day2StorageKey: 'fhink_day2_v1',
    leadStorageKey: 'fhink_lead_v1',
    autosaveDelayMs: 600,
    apiEndpoint: '/api/day3',           // ← wire by Claude Code
  };

  const SUPA_URL = 'https://vuvavjmbvdqnwtleudqh.supabase.co';
  const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1dmF2am1idmRxbnd0bGV1ZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDY1MTMsImV4cCI6MjA2NzAyMjUxM30.QgtlrWs_qL7dMzxHkdUQaCBkGWsNNnExDv0phGz7NbI';
  const CHAT_ENDPOINT = `${SUPA_URL}/functions/v1/chat-agent-v10`;
  const MAX_TURNS = 15;
  const PILOT_UNLOCK_ISO = '2026-06-23T06:00:00+03:00';
  const VIDEO_MAP = {
    omri: '3c47fe05-7282-4ae9-91c0-5e0133263642',
    guy: '36d23c37-4272-423c-9854-afc5415e806f',
  };
  let originalVideoPhHTML = '';

  const DATA = window.FHINK_DAY3_DATA;
  const SCREEN_ORDER = ['opening', 'commitment', 'webinar', 'about', 'summary', 'chat', 'plan', 'completed'];
  const CHAT = window.FHINK_DAY3_CHAT;
  const ACTIVE_CONSENT = false; // ← flip to true if אילת requires active consent

  const state = loadState();

  // Derived at boot
  let salary = 0;          // monthly net salary from Day 1 (or demo)
  let day2Saved = 0;       // monthly trim total from Day 2 (0 if absent)
  let turnsCount = 0;

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
    loadSalary();
    loadDay2Savings();
    buildSelects();
    bindAboutForm();
    renderPulled();
    bindNavigation();
    bindCalendarLinks();
    bindModals();
    enableActiveConsent();
    bindChatInput();
    turnsCount = state.chat.round || 0;
    showScreen(state.currentScreen || 'opening');

    if (state.meta.demo) {
      const chip = document.getElementById('pulledChip');
      if (chip) {
        chip.classList.add('pulled__chip--demo');
        chip.querySelector('span').textContent = 'נתון דוגמה להמחשה — בגרסה החיה נשאב אוטומטית מיום 1';
      }
    }
  }

  // ============================================================
  // Dev / review helpers — ?name=דנה&gender=נקבה&screen=about&popup=privacyModal&reset=1
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

    // Example answers, for review of the summary state
    if (params.get('demoabout') === '1') {
      state.about = { occupation: 'design', occupationOther: '', experience: '6-10', targetSalary: '22000' };
    }

    const popup = params.get('popup');
    if (popup) setTimeout(() => {
      const m = document.getElementById(popup);
      if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
    }, 300);
  }

  function allowEarlyAccess() {
    const params = new URLSearchParams(window.location.search);
    const isAdmin = params.get('admin') === 'true';
    const isBypass = params.get('bypass') === '1';
    const cohort = (params.get('cohort') || localStorage.getItem('challenge_cohort') || 'pilot').toLowerCase();
    const isAllowedCohort = ['lms', 'rehearsal'].includes(cohort);

    const ALLOWED_PIDS = [
      '91d38a0b-0503-4ec9-8d6a-b9f59f04e510', // Barak
      'ba4ebce3-65a3-4b2c-862c-b3436f274a61', // Noam
      'e92b3619-5d8a-4223-ac8c-f33b9da709ac'  // Yahav
    ];
    const pid = params.get('pid') || localStorage.getItem('challenge_pid');

    if (!isAdmin && !isBypass && !isAllowedCohort && !ALLOWED_PIDS.includes(pid)) {
      showEndedOverlay();
      return false;
    }

    if (isBypass) return true;
    if (cohort === 'lms') { try { localStorage.setItem('challenge_cohort', 'lms'); } catch (e) {} return true; }
    if (Date.now() >= new Date(PILOT_UNLOCK_ISO).getTime()) return true;
    showLockedOverlay(PILOT_UNLOCK_ISO, 'יום 3');
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

  // ============================================================
  // State (localStorage)
  // ============================================================
  function defaultState() {
    return {
      currentScreen: 'opening',
      user: { fullName: '', firstName: '', gender: '' },
      about: {
        occupation: '',
        occupationOther: '',
        experience: '',
        targetSalary: '',
      },
      chat: {
        messages: [],   // {role: 'mentor'|'user', text}
        answers: [],    // {q, a}
        stage: 0,       // 0 = path selection, then steps, then closing
        round: 0,
        pathId: '',
        done: false,
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
          about: { ...base.about, ...(parsed.about || {}) },
          chat: { ...base.chat, ...(parsed.chat || {}) },
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
      const target = g === 'female' ? el.dataset.female : el.dataset.male;
      if (target) el.textContent = target;
    });
  }

  // ============================================================
  // Pulled data — salary from Day 1, savings from Day 2
  // ============================================================
  function loadSalary() {
    try {
      const raw = localStorage.getItem(CONFIG.day1StorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const s = parseFloat(parsed && parsed.basics && parsed.basics.salary);
        if (!isNaN(s) && s > 0) {
          salary = s;
          state.meta.demo = false;
          return;
        }
      }
    } catch (_) {}
    salary = DATA.demoSalary;
    state.meta.demo = true;
  }

  function loadDay2Savings() {
    // Best-effort: read the synced Day-2 results if they exist
    try {
      const raw = localStorage.getItem(CONFIG.day2StorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.trims) return;

      // Rebuild amounts from Day-1 data to value the percent-trims
      const d1raw = localStorage.getItem(CONFIG.day1StorageKey);
      const d1 = d1raw ? JSON.parse(d1raw) : null;
      if (!d1 || !d1.expenses) return;

      let total = 0;
      Object.keys(parsed.trims).forEach(key => {
        const t = parsed.trims[key];
        if (!t || t.mode === 'none') return;
        const dot = key.indexOf('.');
        if (dot < 0) return;
        const catId = key.slice(0, dot);
        const itemId = key.slice(dot + 1);
        const rec = d1.expenses[catId] && d1.expenses[catId][itemId];
        const amount = rec ? parseFloat(rec.amount) : NaN;
        if (isNaN(amount) || amount <= 0) return;
        if (t.mode === 'pct') total += Math.round(amount * (t.pct / 100));
        if (t.mode === 'custom') {
          const v = parseFloat(t.custom);
          if (!isNaN(v) && v > 0) total += Math.min(Math.round(v), amount);
        }
      });
      day2Saved = total;
    } catch (_) {}
  }

  function renderPulled() {
    setAll('[data-pulled="salary"]', fmt(salary));
  }

  // ============================================================
  // About form — occupation / experience / target salary
  // ============================================================
  function buildSelects() {
    const occ = document.getElementById('occupation');
    if (occ) {
      DATA.occupations.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        occ.appendChild(opt);
      });
      if (state.about.occupation) occ.value = state.about.occupation;
    }

    const exp = document.getElementById('experience');
    if (exp) {
      DATA.experiences.forEach(e => {
        const opt = document.createElement('option');
        opt.value = e.value;
        opt.textContent = e.label;
        exp.appendChild(opt);
      });
      if (state.about.experience) exp.value = state.about.experience;
    }
  }

  function bindAboutForm() {
    const occ = document.getElementById('occupation');
    const otherWrap = document.getElementById('occupationOtherWrap');
    const otherInput = document.getElementById('occupationOther');
    const exp = document.getElementById('experience');
    const targetInput = document.getElementById('targetSalary');

    if (otherWrap) otherWrap.hidden = state.about.occupation !== 'other';
    if (otherInput) otherInput.value = state.about.occupationOther || '';
    if (targetInput) targetInput.value = state.about.targetSalary || '';

    if (occ) {
      occ.addEventListener('change', () => {
        state.about.occupation = occ.value;
        if (otherWrap) otherWrap.hidden = occ.value !== 'other';
        if (occ.value !== 'other') state.about.occupationOther = '';
        autosave();
      });
    }

    if (otherInput) {
      otherInput.addEventListener('input', () => {
        state.about.occupationOther = otherInput.value;
        autosave();
      });
    }

    if (exp) {
      exp.addEventListener('change', () => {
        state.about.experience = exp.value;
        autosave();
      });
    }

    if (targetInput) {
      targetInput.addEventListener('input', () => {
        state.about.targetSalary = targetInput.value;
        autosave();
        updateGapStrip();
      });
    }

    updateGapStrip();
  }

  function gapNumbers() {
    const target = parseFloat(state.about.targetSalary) || 0;
    const gap = target - salary;
    const pct = salary > 0 ? Math.round((gap / salary) * 100) : 0;
    return { target, gap, pct };
  }

  function updateGapStrip() {
    const strip = document.getElementById('gapStrip');
    if (!strip) return;
    const { target, gap, pct } = gapNumbers();

    if (target > 0 && gap > 0) {
      strip.hidden = false;
      setAll('[data-gap="amount"]', fmt(gap));
      const pctEl = strip.querySelector('[data-gap="pct"]');
      if (pctEl) pctEl.textContent = `‎+${pct}%‎ מהשכר הנוכחי`;
    } else {
      strip.hidden = true;
    }
  }

  function validateAbout() {
    const occ = document.getElementById('occupation');
    const targetInput = document.getElementById('targetSalary');

    if (!state.about.occupation) {
      if (occ) {
        occ.classList.add('is-error');
        occ.focus();
        setTimeout(() => occ.classList.remove('is-error'), 1800);
      }
      showToast('עוד רגע — בחר תחום עיסוק כדי שנדייק את התמונה.');
      return false;
    }

    const target = parseFloat(state.about.targetSalary);
    if (isNaN(target) || target <= 0) {
      if (targetInput) {
        targetInput.classList.add('is-error');
        targetInput.focus();
        setTimeout(() => targetInput.classList.remove('is-error'), 1800);
      }
      showToast('הצב יעד שכר — גם מספר ראשוני הוא התחלה מצוינת.');
      return false;
    }
    return true;
  }

  // ============================================================
  // Screen Navigation
  // ============================================================
  function showScreen(screenId) {
    document.querySelectorAll('.modal').forEach(m => { m.hidden = true; });
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
    if (screenId === 'summary') computeSummary();
    if (screenId === 'chat') initChat();
    if (screenId === 'plan') buildPlan();
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
          if (currentScreen === 'about' && target === 'summary' && !validateAbout()) return;
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

        case 'chat-skip': {
          if (!state.chat.done) {
            state.chat.pathId = state.chat.pathId || 'raise';
            state.chat.done = true;
            if (!state.chat.answers.length) {
              state.chat.answers = [
                { q: 'ניסיון', a: 'התחלתי לגשש' },
                { q: 'זמן שבועי', a: '3–6 שעות' },
                { q: 'חסם', a: 'ביטחון' },
              ];
            }
            saveState();
          }
          showScreen('plan');
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

  function restoreWatchedVideos() {
    const watched = state.meta.watched || {};
    document.querySelectorAll('[data-video-id]').forEach(card => {
      if (watched[card.dataset.videoId]) card.classList.add('is-watched');
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
  // Summary — the gap picture
  // ============================================================
  function computeSummary() {
    const { target, gap, pct } = gapNumbers();

    setAll('[data-sum="salary"]', fmt(salary));
    setAll('[data-sum="target"]', fmt(target));
    setAll('[data-sum="gap"]', fmt(Math.abs(gap)));

    const headline = document.getElementById('summaryHeadline');
    if (headline) {
      headline.textContent = target <= 0 ? 'נשאר רק להציב יעד.'
        : gap <= 0 ? 'אתה כבר מעבר ליעד.'
        : 'הכיוון ברור.';
    }

    const gapBlock = document.getElementById('gapBlock');
    const gapHint = document.getElementById('gapHint');
    if (gapBlock) {
      gapBlock.classList.remove('is-positive', 'is-negative', 'is-zero');
      if (target > 0 && gap > 0) {
        gapBlock.classList.add('is-zero');
        gapHint.textContent = `‎+${pct}%‎ מהשכר הנוכחי — זה לא חלום, זו תכנית`;
      } else if (target > 0) {
        gapBlock.classList.add('is-positive');
        gapHint.textContent = 'היעד שהצבת כבר מאחוריך — אפשר לכוון גבוה יותר';
      } else {
        gapBlock.classList.add('is-zero');
        gapHint.textContent = 'הצב יעד במסך הקודם כדי לראות את הפער';
      }
    }

    // AI insight
    const insightText = document.getElementById('insightText');
    if (insightText) {
      let text;
      if (target <= 0) {
        text = DATA.insights.noTarget();
      } else if (gap <= 0) {
        text = DATA.insights.belowCurrent();
      } else if (pct <= 15) {
        text = DATA.insights.close(gap, pct);
      } else if (pct <= 50) {
        text = DATA.insights.buildable(gap, pct);
      } else {
        text = DATA.insights.ambitious(gap, pct);
      }

      if (gap > 0 && state.about.experience && state.about.occupation && state.about.occupation !== 'other') {
        const expLabel = (DATA.experiences.find(e => e.value === state.about.experience) || {}).label;
        const occLabel = (DATA.occupations.find(o => o.value === state.about.occupation) || {}).label;
        if (expLabel && occLabel) text += DATA.insights.expBoost(expLabel, occLabel);
      }

      if (gap > 0 && day2Saved > 0) {
        text += DATA.insights.day2Bridge(day2Saved);
      }

      insightText.textContent = text;
    }
  }


  // ============================================================
  // Mentor chat — demo engine (the live version: up to 15 AI rounds)
  // ============================================================
  let typingEl = null;
  let chatBusy = false;

  function chatCtx() {
    const { target, gap, pct } = gapNumbers();
    const path = CHAT.paths.find(p => p.id === state.chat.pathId);
    return {
      firstName: state.user.firstName || 'חבר',
      pathLabel: path ? path.label : 'הנתיב שבחרת',
      target, gap: Math.max(0, gap), pct,
    };
  }

  function initChat() {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;
    messagesEl.innerHTML = '';
    hideReplies();
    hideInputBar();

    // Replay an existing conversation instantly
    if (state.chat.messages.length) {
      state.chat.messages.forEach(m => addBubble(m.role, m.text, true));
      updateRound();
      if (state.chat.done) {
        showReplies([{ label: 'הצג את התוכנית', value: '__plan__' }]);
      } else {
        showInputBar();
      }
      scrollChat();
      return;
    }

    // Fresh conversation — mentor greeting + path selection
    updateRound();
    const greeting = `שלום ${chatCtx().firstName}, אני המנטור הפיננסי שלך. ראיתי את היעד שהצבת — פער של ₪${fmt(chatCtx().gap)} בחודש. באיזה נתיב נתמקד כדי לסגור אותו?`;
    addBubble('mentor', greeting, true);
    state.chat.messages.push({ role: 'mentor', text: greeting });
    saveState();
    showReplies(CHAT.paths.map(p => ({ label: p.label, value: 'path:' + p.id })));
  }

  function presentStage(instant) {
    const stage = state.chat.stage;
    if (stage < 1 || stage > CHAT.steps.length) return;
    const step = CHAT.steps[stage - 1];
    const opts = step.optionsByPath ? (step.optionsByPath[state.chat.pathId] || []) : (step.options || []);
    const show = () => {
      if (step.type === 'text') showInputBar();
      else showReplies(opts.map(o => ({ label: o, value: o })));
    };
    if (instant) show(); else show();
  }

  function handleAnswer(value, label) {
    if (chatBusy) return;
    if (value === '__plan__') { showScreen('plan'); return; }

    hideReplies();
    hideInputBar();
    addBubble('user', label, true);
    state.chat.messages.push({ role: 'user', text: label });
    state.chat.round = (state.chat.round || 0) + 1;
    turnsCount = state.chat.round;
    updateRound();

    if (String(value).indexOf('path:') === 0) {
      state.chat.pathId = String(value).slice(5);
      state.chat.answers.push({ q: 'נתיב', a: label });
    }

    autosave();
    sendLiveMessage(label);
  }

  async function sendLiveMessage(message) {
    if (chatBusy) return;
    chatBusy = true;
    setChatSending(true);
    const thinking = showTyping();
    const histToSend = state.chat.messages.slice(0, -1);

    try {
      const data = await callChat(message, histToSend);
      hideTyping(thinking);

      const responseText = data.response || data.message || '';
      if (responseText) {
        state.chat.messages.push({ role: 'mentor', text: responseText });
        addBubble('mentor', responseText, true);
      }

      if (data.agent_name) {
        const nameEl = document.querySelector('.chat__name');
        if (nameEl) nameEl.textContent = data.agent_name;
      }

      if (data.selected_path || data.path_id) {
        state.chat.pathId = data.selected_path || data.path_id;
      }

      if (typeof data.turns_count === 'number') {
        state.chat.round = data.turns_count;
      }
      turnsCount = state.chat.round || turnsCount;
      updateRound();

      if (data.session_ended || turnsCount >= MAX_TURNS) {
        state.chat.done = true;
        state.chat.messages = state.chat.messages || [];
        saveState();
        buildPlan();
        setChatSending(true);
        showScreen('plan');
        chatBusy = false;
        return;
      }

      saveState();
      showInputBar();
      setChatSending(false);
      chatBusy = false;
      document.getElementById('chatInput')?.focus();
    } catch (err) {
      hideTyping(thinking);
      showInputBar();
      setChatSending(false);
      chatBusy = false;
      state.chat.messages.pop();
      state.chat.round = Math.max(0, (state.chat.round || 1) - 1);
      turnsCount = state.chat.round;
      updateRound();
      saveState();
      appendErrorBubble(formatChatError(err), () => handleAnswer(message, message));
    }
  }

  async function callChat(message, sendHistory) {
    const pid = state.user.pid || localStorage.getItem('challenge_pid') || new URLSearchParams(window.location.search).get('pid');
    const normalizedHistory = Array.isArray(sendHistory)
      ? sendHistory
          .slice(-14)
          .map(m => ({
            role: m && m.role === 'mentor' ? 'model' : 'user',
            text: m && typeof m.text === 'string' ? m.text : '',
          }))
          .filter(m => m.text)
      : [];
    const body = {
      pid,
      message,
      history: normalizedHistory,
    };
    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errText = 'שגיאת שרת';
      try {
        const errJson = await res.json();
        errText = errJson.error || errText;
      } catch (_) {}
      throw new Error(errText);
    }
    return res.json();
  }

  function appendErrorBubble(text, onRetry) {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;
    const b = document.createElement('div');
    b.className = 'bubble bubble--agent';
    b.textContent = (text || 'בעיית רשת') + (typeof onRetry === 'function' ? ' (לחצו כאן לניסיון חוזר)' : '');
    if (typeof onRetry === 'function') {
      b.style.cursor = 'pointer';
      b.addEventListener('click', () => { b.remove(); onRetry(); }, { once: true });
    }
    messagesEl.appendChild(b);
    if (typeof scrollChat === 'function') scrollChat();
  }

  function formatChatError(err) {
    const raw = String(err && err.message ? err.message : err || '').trim();
    if (!raw) return 'אירעה תקלה בשליחת ההודעה';
    if (raw.includes('Gemini API failed: 503')) return 'שירות ה-AI עמוס כרגע';
    if (raw.includes('Gemini API failed: 429')) return 'שירות ה-AI הגיע למגבלת קצב זמנית';
    if (raw.includes('participant not found')) return 'לא מצאתי את פרטי המשתתף. פתחו את היום מאותו קישור ואותו דפדפן';
    if (raw.includes('pid required')) return 'חסר מזהה משתתף. פתחו את היום מהקישור המקורי';
    if (raw.includes('403')) return 'הגישה לשלב הזה חסומה כרגע';
    return raw;
  }

  function addBubble(role, text, instant) {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;
    const b = document.createElement('div');
    b.className = 'bubble bubble--' + role + (instant ? ' bubble--instant' : '');
    b.textContent = text;
    messagesEl.appendChild(b);
    scrollChat();
  }

  function showTyping() {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'bubble bubble--mentor bubble--typing';
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typingEl);
    scrollChat();
    return typingEl;
  }

  function hideTyping(node) {
    const el = node || typingEl;
    if (el) { el.remove(); }
    typingEl = null;
  }

  function setChatSending(val) {
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    if (input) input.disabled = !!val;
    if (send) send.disabled = !!val;
  }

  function showReplies(options) {
    const wrap = document.getElementById('chatReplies');
    if (!wrap) return;
    wrap.innerHTML = '';
    options.forEach(o => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip chip--reply';
      chip.textContent = o.label;
      chip.addEventListener('click', () => handleAnswer(o.value, o.label));
      wrap.appendChild(chip);
    });
    wrap.hidden = false;
  }

  function hideReplies() {
    const wrap = document.getElementById('chatReplies');
    if (wrap) { wrap.hidden = true; wrap.innerHTML = ''; }
  }

  function showInputBar() {
    const bar = document.getElementById('chatInputBar');
    const input = document.getElementById('chatInput');
    if (!bar) return;
    bar.hidden = false;
    if (input) { input.value = ''; input.focus(); }
  }

  function hideInputBar() {
    const bar = document.getElementById('chatInputBar');
    if (bar) bar.hidden = true;
  }

  function bindChatInput() {
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    if (!input || !send) return;
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      handleAnswer(v, v);
    };
    send.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  }

  function updateRound() {
    const el = document.getElementById('chatRound');
    if (!el) return;
    const shown = Math.min(turnsCount || 0, MAX_TURNS);
    el.textContent = `${shown}/${MAX_TURNS}`;
  }

  function scrollChat() {
    const messagesEl = document.getElementById('chatMessages');
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ============================================================
  // The plan — built from the chat + the gap data
  // ============================================================
  function buildPlan() {
    const body = document.getElementById('planBody');
    const titleEl = document.getElementById('plan-title');
    if (!body) return;

    const ctx = chatCtx();
    const { target, gap, pct } = gapNumbers();
    const steps = CHAT.planSteps[state.chat.pathId] || CHAT.planSteps.raise;

    if (titleEl) titleEl.textContent = `${ctx.firstName}, התוכנית שלך: ${ctx.pathLabel}`;

    const prefs = state.chat.answers.slice(0, 3).map(a => a.a).filter(Boolean);

    body.innerHTML = `
      <div class="plan__goal">
        <span class="plan__goal-label">המטרה</span>
        <span class="plan__goal-amounts">
          <span>₪${fmt(salary)}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <strong>₪${fmt(target)}</strong>
        </span>
        <span class="plan__goal-hint">סגירת פער של ₪${fmt(gap)} בחודש (‎+${pct}%‎)</span>
      </div>

      <div class="plan__section">
        <h3 class="plan__h">3 הצעדים הראשונים · 30 הימים הקרובים</h3>
        <ol class="plan__steps">
          ${steps.map(st => `<li>${st}</li>`).join('')}
        </ol>
      </div>

      <div class="plan__section">
        <h3 class="plan__h">קצב העבודה</h3>
        <div class="plan__weeks">
          <span class="plan__week"><strong>שבוע 1</strong>צעד 1</span>
          <span class="plan__week"><strong>שבוע 2</strong>צעד 2</span>
          <span class="plan__week"><strong>שבוע 3</strong>צעד 3</span>
          <span class="plan__week"><strong>שבוע 4</strong>מדידה והמשך</span>
        </div>
      </div>

      ${prefs.length ? `
      <div class="plan__section">
        <h3 class="plan__h">מה שסיפרת לי בשיחה</h3>
        <div class="plan__prefs">${prefs.map(v => `<span class="plan__pref">${v}</span>`).join('')}</div>
      </div>` : ''}

      <div class="note-line">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="15.5" r="0.5" fill="currentColor"/></svg>
        <span>התוכנית היא תוכן חינוכי ואינה ייעוץ. מחר ביום 4 נחבר אותה לציר החמצן הפיננסי.</span>
      </div>
    `;
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
      document.querySelectorAll('.modal:not([hidden])').forEach(m => closeModal(m.id));
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
  // Complete Day 3
  // ============================================================
  async function handleComplete() {
    state.meta.completedAt = new Date().toISOString();
    saveState();

    try {
      await postDay3();
    } catch (err) {
      console.warn('[FHINK] Day3 sync failed:', err);
    }

    showScreen('completed');
  }

  async function postDay3() {
    const { target, gap, pct } = gapNumbers();
    const payload = {
      ...state,
      results: {
        salary: salary,
        targetSalary: target,
        gap: gap,
        gapPct: pct,
        day2MonthlySavings: day2Saved,
        demo: state.meta.demo,
      },
    };

    if (window.location.protocol === 'file:') {
      console.log('[FHINK] dev mode — would PATCH', payload);
      return { ok: true, mocked: true };
    }
    const pid = state.user.pid || localStorage.getItem('challenge_pid') || new URLSearchParams(window.location.search).get('pid');
    if (!pid) throw new Error('Missing pid');
    const res = await fetch(`${SUPA_URL}/rest/v1/challenge_participants?id=eq.${encodeURIComponent(pid)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ unlock_level: 4 }),
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
      title: 'וובינר סיכום אתגר FHINK AI',
      start: '20260624T170000Z',  // ISO UTC — placeholder
      end:   '20260624T183000Z',
      details: 'וובינר סיכום של אתגר 4 הימים, בו נחבר את כל מה שלמדת ונפתח את הצעד הבא. קישור לזום: https://us06web.zoom.us/j/89631087594?pwd=K3JfaI9Ebg2RsYRqdgliP1XPoQQDLm.1',
      location: 'זום אונליין: https://us06web.zoom.us/j/89631087594?pwd=K3JfaI9Ebg2RsYRqdgliP1XPoQQDLm.1',
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

  function setAll(selector, text) {
    document.querySelectorAll(selector).forEach(el => { el.textContent = text; });
  }

  function showEndedOverlay() {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;padding:24px;direction:rtl;font-family:Heebo,sans-serif;color:#f8fafc;text-align:center;">
        <div style="max-width:520px;width:100%;background:#1e293b;border-radius:28px;padding:40px 28px;box-shadow:0 16px 60px rgba(0,0,0,.3);text-align:center;border:1px solid #334155;">
          <div style="font-size:56px;line-height:1;margin-bottom:20px;">🏁</div>
          <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px;color:#38bdf8;font-weight:800;">האתגר הפיננסי הסתיים</h1>
          <p style="margin:0;color:#94a3b8;font-size:16px;line-height:1.8;">תודה רבה לכל המשתתפים ! האתגר הגיע לסיומו וגישת הקהל הרחב נסגרה.</p>
        </div>
      </div>`;
  }

  })();
