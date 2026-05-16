/* ============================================================================
   FHINK AI · Opening Questionnaire — Version A
============================================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "fhink:opening-questionnaire-a";
  const SCREENS = ["intro", "step1", "step2", "step3", "step4", "done"];
  const SAVE_DEBOUNCE_MS = 200;

  const toast = document.getElementById("toast");
  const toastText = toast?.querySelector(".toast__text");
  const doneGreeting = document.getElementById("doneGreeting");
  const recap = document.getElementById("recap");

  let currentIdx = 0;
  let answers = loadAnswers();
  let toastTimer = null;
  let saveTimer = null;

  /* -------------------- Storage -------------------- */

  function loadAnswers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function persistAnswers() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); }
      catch (_) {}
    }, SAVE_DEBOUNCE_MS);
  }

  function restoreFormValues() {
    document.querySelectorAll(".screen .form").forEach((form) => {
      Array.from(form.elements).forEach((el) => {
        if (!el.name) return;
        const stored = answers[el.name];
        if (stored === undefined) return;
        if (el.type === "radio") {
          el.checked = String(stored) === String(el.value);
        } else if (el.type === "checkbox") {
          const arr = Array.isArray(stored) ? stored : [stored];
          el.checked = arr.includes(el.value);
        } else {
          el.value = stored;
        }
      });
    });
    document.querySelectorAll('[data-other]').forEach(syncOtherField);
  }

  /* -------------------- Screen nav -------------------- */

  function showScreen(idx, opts = {}) {
    const screens = document.querySelectorAll(".screen");
    const target = SCREENS[idx];
    if (!target) return;

    screens.forEach((s) => {
      s.classList.toggle("is-active", s.dataset.screen === target);
    });

    currentIdx = idx;
    applyGenderPersonalization();
    applyPersonalization();
    if (target === "done") buildRecap();

    if (!opts.silent) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      requestAnimationFrame(() => {
        const heading = document.querySelector(`.screen[data-screen="${target}"] .title-xl, .screen[data-screen="${target}"] .title-lg`);
        heading?.setAttribute("tabindex", "-1");
        heading?.focus({ preventScroll: true });
      });
    }
  }

  /* -------------------- Personalization -------------------- */

  function firstName(full) {
    if (!full) return "";
    const trimmed = String(full).trim();
    if (!trimmed) return "";
    const first = trimmed.split(/\s+/)[0];
    return first.length > 18 ? first.slice(0, 18) : first;
  }

  function applyPersonalization() {
    const name = firstName(answers.fullName);
    if (doneGreeting) {
      doneGreeting.textContent = name ? `מעולה ${name}` : "מעולה";
    }
  }

  function applyGenderPersonalization() {
    const gender = answers.gender;
    const useFemale = gender === "נקבה";
    const useOther = gender === "אחר";

    document.body.classList.toggle("gender-female", useFemale);
    document.body.classList.toggle("gender-other", useOther);

    document.querySelectorAll("[data-male][data-female]").forEach((el) => {
      const male = el.dataset.male;
      const female = el.dataset.female;
      const target = useFemale ? female : male;
      if (el.textContent.trim() !== target.trim()) {
        const name = firstName(answers.fullName);
        if (el.matches("[data-greet]") && name) {
          el.textContent = `${name}, ${target}`;
        } else {
          el.textContent = target;
        }
      } else if (el.matches("[data-greet]")) {
        const name = firstName(answers.fullName);
        el.textContent = name ? `${name}, ${target}` : target;
      }
    });
  }

  /* -------------------- Recap -------------------- */

  function buildRecap() {
    if (!recap) return;
    const pills = [];

    if (answers.commitment) pills.push({ label: "מחויבות", value: answers.commitment });

    const pp = Array.isArray(answers.painPoints) ? answers.painPoints : [];
    if (pp.length) {
      const summary = pp.length === 1 ? pp[0] : `${pp[0]} +${pp.length - 1}`;
      pills.push({ label: "במוקד", value: summary });
    }

    if (answers.belief) pills.push({ label: "אמונה ביכולת", value: answers.belief });

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

  function goNext() {
    if (currentIdx >= SCREENS.length - 1) return;
    const stepNum = currentIdx;
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
    if (formStep) collectStep(formStep, { lenient: true });
    persistAnswers();
    showScreen(SCREENS.indexOf("done"));
  }

  /* -------------------- Validation -------------------- */

  function validateStep(form, stepNum) {
    if (!form) return true;

    if (stepNum === 1) {
      const name = form.elements.fullName?.value.trim();
      const age = form.elements.age?.value;
      const gender = form.elements.gender?.value;
      const marital = form.elements.maritalStatus?.value;
      const emp = form.querySelector('input[name="employment"]:checked');

      if (!name)    return failWith(form.elements.fullName, "נא למלא שם מלא");
      if (!age || +age < 14 || +age > 120) return failWith(form.elements.age, "נא להזין גיל תקין");
      if (!gender)  return failWith(form.elements.gender, "נא לבחור מין");
      if (!marital) return failWith(form.elements.maritalStatus, "נא לבחור מצב משפחתי");
      if (!emp)     return failWith(null, "נא לבחור מצב תעסוקתי");
      return true;
    }

    if (stepNum === 2) {
      for (const q of ["q1", "q2", "q3", "q4"]) {
        if (!form.querySelector(`input[name="${q}"]:checked`)) {
          return failWith(null, "נא לענות על כל השאלות לפני המשך");
        }
      }
      return true;
    }

    if (stepNum === 3) {
      const any = form.querySelectorAll('input[name="painPoints"]:checked').length;
      if (!any) return failWith(null, "נא לבחור לפחות תחום אחד");
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

  /* -------------------- Toast -------------------- */

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

  /* -------------------- Collection -------------------- */

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

  /* -------------------- Other field -------------------- */

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

  /* -------------------- Events -------------------- */

  function bindEvents() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "next") goNext();
      else if (action === "back") goBack();
      else if (action === "finish") finish();
      else if (action === "day1") {
        showToast("מעבר ליום 1 של האתגר…");
        setTimeout(() => {
          showScreen(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 1400);
      }
    });

    document.querySelectorAll('[data-other]').forEach((el) => {
      el.addEventListener("change", () => syncOtherField(el));
    });

    document.addEventListener("input", (e) => {
      const f = e.target.closest(".form");
      if (f) collectStep(f, { lenient: true });
      if (e.target.name === "fullName") applyGenderPersonalization();
    });

    document.addEventListener("change", (e) => {
      const f = e.target.closest(".form");
      if (f) collectStep(f, { lenient: true });
      if (e.target.name === "gender") applyGenderPersonalization();
      markAnswered();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "textarea") return;
      const activeScreen = document.querySelector(".screen.is-active");
      const idx = activeScreen ? SCREENS.indexOf(activeScreen.dataset.screen) : -1;
      if (idx >= 0 && idx < SCREENS.length - 1 && tag !== "button") {
        e.preventDefault();
        if (activeScreen.dataset.screen === "step4") finish();
        else goNext();
      }
    });

    document.addEventListener("mousedown", () => document.body.classList.add("using-mouse"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab") document.body.classList.remove("using-mouse");
    });
  }

  /* -------------------- Init -------------------- */

  function init() {
    bindEvents();
    restoreFormValues();
    applyGenderPersonalization();
    markAnswered();
    showScreen(0, { silent: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
