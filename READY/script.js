/* ============================================================================
   FHINK AI · Opening Questionnaire — interaction layer
   - Multi-step flow with smooth transitions
   - Lightweight validation with friendly toasts
   - Persists answers to localStorage so users can resume
   - "Other" reveals contextual textarea
============================================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "fhink:opening-questionnaire";
  const SCREENS = ["intro", "step1", "step2", "step3", "step4", "done"];
  // Header "day" labels by screen — Day 0 during questionnaire, "מתחיל" on done.
  const DAY_LABELS = {
    intro: "יום 0",
    step1: "יום 0",
    step2: "יום 0",
    step3: "יום 0",
    step4: "יום 0",
    done:  "יום 1 קרב",
  };
  const SAVE_DEBOUNCE_MS = 200;

  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const toastText = toast?.querySelector(".toast__text");
  const brandPill = document.getElementById("brandPill");
  const dayLabel = document.getElementById("dayLabel");
  const doneGreeting = document.getElementById("doneGreeting");
  const recap = document.getElementById("recap");

  /* ---------------------------------------------------------------------- *
   * State
   * ---------------------------------------------------------------------- */

  let currentIdx = 0;
  let answers = loadAnswers();
  let toastTimer = null;
  let saveTimer = null;

  /* ---------------------------------------------------------------------- *
   * Storage
   * ---------------------------------------------------------------------- */

  function loadAnswers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function persistAnswers() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
      } catch (_) { /* ignore quota */ }
    }, SAVE_DEBOUNCE_MS);
  }

  function restoreFormValues() {
    // For every form across all steps, hydrate values from `answers`.
    document.querySelectorAll(".screen .form").forEach((form) => {
      Array.from(form.elements).forEach((el) => {
        if (!el.name) return;
        const stored = answers[el.name];
        if (stored === undefined) return;

        if (el.type === "radio") {
          el.checked = String(stored) === String(el.value);
        } else if (el.type === "checkbox") {
          // Multi-select stored as array
          const arr = Array.isArray(stored) ? stored : [stored];
          el.checked = arr.includes(el.value);
        } else {
          el.value = stored;
        }
      });
    });

    // After hydrating, sync any conditional "Other" fields
    document.querySelectorAll('[data-other]').forEach(syncOtherField);
  }

  /* ---------------------------------------------------------------------- *
   * Screen navigation
   * ---------------------------------------------------------------------- */

  function showScreen(idx, opts = {}) {
    const screens = document.querySelectorAll(".screen");
    const target = SCREENS[idx];
    if (!target) return;

    screens.forEach((s) => {
      const isTarget = s.dataset.screen === target;
      s.classList.toggle("is-active", isTarget);
    });

    currentIdx = idx;

    // Sync header pill + personalized subtitles to match this screen
    updateDayLabel(target);
    applyPersonalization();

    if (target === "done") buildRecap();

    // Scroll to top of card softly
    if (!opts.silent) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Move focus into the screen's first heading for a11y
      requestAnimationFrame(() => {
        const heading = document.querySelector(`.screen[data-screen="${target}"] .title-xl, .screen[data-screen="${target}"] .title-lg`);
        heading?.setAttribute("tabindex", "-1");
        heading?.focus({ preventScroll: true });
      });
    }
  }

  /* ---------------------------------------------------------------------- *
   * Dynamic header / personalization / recap
   * ---------------------------------------------------------------------- */

  function updateDayLabel(target) {
    if (!dayLabel) return;
    const label = DAY_LABELS[target] || "יום 0";
    if (dayLabel.textContent !== label) {
      dayLabel.textContent = label;
      brandPill?.classList.add("is-advancing");
      setTimeout(() => brandPill?.classList.remove("is-advancing"), 320);
    }
  }

  function firstName(full) {
    if (!full) return "";
    const trimmed = String(full).trim();
    if (!trimmed) return "";
    const first = trimmed.split(/\s+/)[0];
    return first.length > 18 ? first.slice(0, 18) : first;
  }

  function applyPersonalization() {
    const name = firstName(answers.fullName);
    document.querySelectorAll("[data-greet]").forEach((el) => {
      if (!el.dataset.originalText) el.dataset.originalText = el.textContent;
      const orig = genderizeText(el.dataset.originalText, currentGender);
      el.textContent = name ? `${name}, ${orig}` : orig;
    });
    if (doneGreeting) {
      doneGreeting.textContent = name ? `מעולה ${name}` : "מעולה";
    }
  }

  function buildRecap() {
    if (!recap) return;
    const pills = [];

    // Commitment level
    const commitment = answers.commitment;
    if (commitment) {
      pills.push({ label: "מחויבות", value: commitment });
    }

    // Top pain area
    const pp = Array.isArray(answers.painPoints) ? answers.painPoints : [];
    if (pp.length) {
      const summary = pp.length === 1 ? pp[0] : `${pp[0]} +${pp.length - 1}`;
      pills.push({ label: "במוקד", value: summary });
    }

    // Belief level
    if (answers.belief) {
      pills.push({ label: "אמונה ביכולת", value: answers.belief });
    }

    recap.innerHTML = pills.map((p, i) => `
      <span class="recap-pill" style="--i:${i}">
        <span class="recap-pill__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </span>
        <span class="recap-pill__label">${escapeHTML(p.label)}:</span>
        <span class="recap-pill__value">${escapeHTML(p.value)}</span>
      </span>
    `).join("");
  }

  function markAnswered() {
    // Add a tiny "answered" check next to question titles whose group has a selection.
    document.querySelectorAll(".q-block").forEach((block) => {
      const radios = block.querySelectorAll('input[type="radio"]');
      const checkboxes = block.querySelectorAll('input[type="checkbox"]');
      const textarea = block.querySelector("textarea");

      let answered = false;
      if (radios.length && Array.from(radios).some((r) => r.checked)) answered = true;
      if (checkboxes.length && Array.from(checkboxes).some((c) => c.checked)) answered = true;
      if (textarea && textarea.value.trim().length >= 5) answered = true;

      block.classList.toggle("is-answered", answered);
    });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function getLeadEmail() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('lead');
      if (fromUrl) return fromUrl;
      const saved = JSON.parse(localStorage.getItem('fhink_lead_v1') || 'null');
      return saved?.email || null;
    } catch (_) { return null; }
  }

  function goNext() {
    if (currentIdx >= SCREENS.length - 1) return;

    // For step screens (1..4), validate required fields before moving forward.
    const stepNum = currentIdx; // intro=0, step1=1, ...
    if (stepNum >= 1 && stepNum <= 4) {
      const formStep = document.querySelector(`.form[data-step="${stepNum}"]`);
      const valid = validateStep(formStep, stepNum);
      if (!valid) return;
      collectStep(formStep);
    }

    showScreen(currentIdx + 1);
  }

  function goBack() {
    if (currentIdx === 0) return;
    showScreen(currentIdx - 1);
  }

  function finish() {
    const formStep = document.querySelector('.form[data-step="4"]');
    if (formStep) {
      const valid = validateStep(formStep, 4);
      if (!valid) return;
      collectStep(formStep, { lenient: true });
    }
    persistAnswers();
    const email = getLeadEmail();
    if (email && window.location.protocol !== 'file:') {
      fetch('https://vuvavjmbvdqnwtleudqh.supabase.co/functions/v1/save-pretest-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, answers }),
      }).catch((e) => console.warn('[FHINK] pretest save failed:', e));
    }
    showScreen(SCREENS.indexOf("done"));
  }

  /* ---------------------------------------------------------------------- *
   * Validation
   * ---------------------------------------------------------------------- */

  function validateStep(form, stepNum) {
    if (!form) return true;

    // Step 1: required text + number + selects + employment
    if (stepNum === 1) {
      const name = form.elements.fullName?.value.trim();
      const age = form.elements.age?.value;
      const gender = form.elements.gender?.value;
      const marital = form.elements.maritalStatus?.value;
      const emp = form.querySelector('input[name="employment"]:checked');

      if (!name)   return failWith(form.elements.fullName, "נא למלא שם מלא");
      if (!age || +age < 14 || +age > 120) return failWith(form.elements.age, "נא להזין גיל תקין");
      if (!gender) return failWith(form.elements.gender, "נא לבחור מין");
      if (!marital) return failWith(form.elements.maritalStatus, "נא לבחור מצב משפחתי");
      if (!emp)    return failWith(null, "נא לבחור מצב תעסוקתי");
      return true;
    }

    // Step 2: each of q1..q4 must have a selection
    if (stepNum === 2) {
      for (const q of ["q1", "q2", "q3", "q4"]) {
        if (!form.querySelector(`input[name="${q}"]:checked`)) {
          return failWith(null, "נא לענות על כל השאלות לפני המשך");
        }
      }
      return true;
    }

    // Step 3: at least one pain-point checkbox
    if (stepNum === 3) {
      const any = form.querySelectorAll('input[name="painPoints"]:checked').length;
      if (!any) return failWith(null, "נא לבחור לפחות תחום אחד");
      // If "Other" is checked, require text
      const otherChecked = form.querySelector('input[value="אחר"]:checked');
      if (otherChecked) {
        const txt = form.elements.painOtherText?.value.trim();
        if (!txt) return failWith(form.elements.painOtherText, 'אחר נבחר — נא לפרט בקצרה');
      }
      return true;
    }

    if (stepNum === 4) {
      if (!form.querySelector('input[name="commitment"]:checked')) {
        return failWith(null, "נא לציין את רמת המחויבות שלך");
      }
      if (!form.querySelector('input[name="belief"]:checked')) {
        return failWith(null, "נא לציין את רמת האמונה שלך ביכולת");
      }
      if (!form.querySelector('input[name="currentMgmt"]:checked')) {
        return failWith(null, "נא לציין את ההתנהלות הפיננסית הנוכחית שלך");
      }
      return true;
    }

    return true;
  }

  function failWith(el, msg) {
    showToast(msg);
    if (el) {
      el.focus?.();
      el.classList?.add("is-invalid");
      el.addEventListener("input", () => el.classList.remove("is-invalid"), { once: true });
    }
    return false;
  }

  /* ---------------------------------------------------------------------- *
   * Toast
   * ---------------------------------------------------------------------- */

  function showToast(message) {
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => { toast.hidden = true; }, 300);
    }, 2600);
  }

  /* ---------------------------------------------------------------------- *
   * Step collection
   * ---------------------------------------------------------------------- */

  function collectStep(form, opts = {}) {
    if (!form) return;
    const data = answers;

    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (el.type === "radio") {
        if (el.checked) data[el.name] = el.value;
      } else if (el.type === "checkbox") {
        const prev = Array.isArray(data[el.name]) ? data[el.name] : [];
        const set = new Set(prev);
        if (el.checked) set.add(el.value);
        else set.delete(el.value);
        data[el.name] = Array.from(set);
      } else {
        if (opts.lenient || el.value.trim() !== "") {
          data[el.name] = el.value;
        }
      }
    });

    persistAnswers();
  }

  /* ---------------------------------------------------------------------- *
   * "Other" conditional field
   * ---------------------------------------------------------------------- */

  function syncOtherField(triggerEl) {
    const targetId = triggerEl.dataset.other;
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;

    if (triggerEl.checked) {
      target.hidden = false;
    } else {
      target.hidden = true;
      const textarea = target.querySelector("textarea");
      if (textarea) textarea.value = "";
    }
  }

  /* ---------------------------------------------------------------------- *
   * Event wiring
   * ---------------------------------------------------------------------- */

  function bindEvents() {
    // Next / Back / Finish / Day1
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "next") goNext();
      else if (action === "back") goBack();
      else if (action === "finish") finish();
      else if (action === "day1") {
        // Carry cohort + source attribution to day1 so participants keep their lead context.
        const p = new URLSearchParams(window.location.search);
        let cohort = p.get('cohort');
        let src = p.get('src');
        if (!cohort) {
          try { cohort = (JSON.parse(localStorage.getItem('fhink_lead_v1') || 'null') || {}).cohort || ''; } catch (_) {}
        }
        if (!src) {
          try { src = (JSON.parse(localStorage.getItem('fhink_lead_v1') || 'null') || {}).source || ''; } catch (_) {}
        }
        cohort = (cohort || 'pilot').toLowerCase();

        // Early-access gate: block before official cohort start (mirrors create-participant-v10 COHORT_START)
        const COHORT_START = {
          'pilot': '2026-06-07T06:00:00+03:00',
          'rehearsal': '2026-05-20T06:00:00+03:00',
          'lms': '2026-05-20T11:30:00+03:00',
        };
        const startIso = COHORT_START[cohort] || COHORT_START['pilot'];
        const startTs = new Date(startIso).getTime();
        if (Date.now() < startTs) {
          const d = new Date(startIso);
          const dateStr = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
          showToast('האתגר ייפתח ב-' + dateStr + ' בבוקר. שמרנו את ההרשמה שלך ונשלח תזכורת.');
          return;
        }

        showToast("מעבר ליום 1 של האתגר…");
        setTimeout(() => {
          const params = new URLSearchParams();
          if (cohort) params.set('cohort', cohort);
          if (src) params.set('src', src);
          const qs = params.toString();
          window.location.href = '/day1.html' + (qs ? '?' + qs : '');
        }, 1400);
      }
    });

    // Other-conditional triggers
    document.querySelectorAll('[data-other]').forEach((el) => {
      el.addEventListener("change", () => syncOtherField(el));
    });

    // Auto-save as the user fills fields
    document.addEventListener("input", (e) => {
      const f = e.target.closest(".form");
      if (f) collectStep(f, { lenient: true });
    });
    document.addEventListener("change", (e) => {
      const f = e.target.closest(".form");
      if (f) collectStep(f, { lenient: true });
      markAnswered();
    });

    // Keyboard shortcut: Enter on inputs moves forward when applicable
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const tag = (e.target.tagName || "").toLowerCase();
      // Allow newlines inside textareas
      if (tag === "textarea") return;
      // For form-bearing screens, Enter advances
      const activeScreen = document.querySelector(".screen.is-active");
      const idx = activeScreen ? SCREENS.indexOf(activeScreen.dataset.screen) : -1;
      if (idx >= 0 && idx < SCREENS.length - 1 && tag !== "button") {
        e.preventDefault();
        if (activeScreen.dataset.screen === "step4") finish();
        else goNext();
      }
    });

    // Improve focus ring only for keyboard users
    document.addEventListener("mousedown", () => document.body.classList.add("using-mouse"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") document.body.classList.remove("using-mouse");
    });
  }

  /* ---------------------------------------------------------------------- *
   * Gender-aware text (resolves slash patterns like "מחויב/ת" or "את/ה")
   * ---------------------------------------------------------------------- */

  const genderTextNodes = [];
  const originalTextByNode = new WeakMap();
  let currentGender = null;
  // Irregular slash patterns where base+suffix is not the female form.
  const IRREGULAR_GENDER = {
    'מוכן/ה':  { 'זכר': 'מוכן',   'נקבה': 'מוכנה'  },
    'מאמין/ה': { 'זכר': 'מאמין',  'נקבה': 'מאמינה' },
    'נשוי/אה': { 'זכר': 'נשוי',  'נקבה': 'נשואה' },
    'את/ה':    { 'זכר': 'אתה',   'נקבה': 'את'    },
    'שאת/ה':   { 'זכר': 'שאתה',  'נקבה': 'שאת'   },
  };
  const HEB = '֐-׿';
  const SLASH_TEST = new RegExp(`[${HEB}]+\\/[${HEB}]+`);
  const SLASH_REPLACE = new RegExp(`[${HEB}]+\\/[${HEB}]+`, 'g');

  function snapshotGenderedNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Skip [data-greet] subtrees; applyPersonalization owns those.
        if (node.parentElement?.closest('[data-greet]')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && SLASH_TEST.test(node.nodeValue)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      originalTextByNode.set(node, node.nodeValue);
      genderTextNodes.push(node);
    }
  }

  function genderizeText(text, gender) {
    if (gender !== 'זכר' && gender !== 'נקבה') return text;
    return text.replace(SLASH_REPLACE, (match) => {
      const irregular = IRREGULAR_GENDER[match];
      if (irregular) return irregular[gender];
      const [base, suffix] = match.split('/');
      return gender === 'נקבה' ? base + suffix : base;
    });
  }

  function applyGender(gender) {
    currentGender = gender || null;
    for (const node of genderTextNodes) {
      const original = originalTextByNode.get(node);
      if (original == null) continue;
      const resolved = genderizeText(original, currentGender);
      if (node.nodeValue !== resolved) node.nodeValue = resolved;
    }
    applyPersonalization();
  }

  /* ---------------------------------------------------------------------- *
   * Init
   * ---------------------------------------------------------------------- */

  function init() {
    snapshotGenderedNodes(document.body);
    bindEvents();
    restoreFormValues();
    markAnswered();
    if (answers.gender) applyGender(answers.gender);
    const genderSelect = document.getElementById('gender');
    if (genderSelect) {
      genderSelect.addEventListener('change', () => applyGender(genderSelect.value));
    }
    // Always start at intro on load (don't auto-skip; the brief positions
    // the intro as a moment of context-setting).
    showScreen(0, { silent: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
