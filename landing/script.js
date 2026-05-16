/* ============================================================================
   FHINK AI · Landing Page · JavaScript
   - Form validation
   - Lead submission (to backend endpoint — currently mocked)
   - Personalized success state
   - Redirect to questionnaire after success
============================================================================ */

(function () {
  'use strict';

  // -----------------------------
  // Config
  // -----------------------------
  const CONFIG = {
    endpoint: '/api/lead',                 // ← to be wired by Claude Code / Gai
    redirectTo: '/questionnaire',          // ← path of the opening questionnaire
    redirectDelayMs: 2000,                 // time on success screen before redirect
    storageKey: 'fhink_lead_v1',           // localStorage key for prefill recovery
  };

  // -----------------------------
  // Validators
  // -----------------------------
  const v = {
    name: (val) => val.trim().length >= 2,
    phone: (val) => /^0[0-9]{8,9}$/.test(val.replace(/[-\s]/g, '')),
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
  };

  // -----------------------------
  // DOM refs
  // -----------------------------
  const form          = document.getElementById('leadForm');
  const formSection   = document.getElementById('formSection');
  const successState  = document.getElementById('successState');
  const successName   = document.getElementById('successName');

  const nameInput   = document.getElementById('leadName');
  const phoneInput  = document.getElementById('leadPhone');
  const emailInput  = document.getElementById('leadEmail');

  const errName  = document.getElementById('errName');
  const errPhone = document.getElementById('errPhone');
  const errEmail = document.getElementById('errEmail');

  // -----------------------------
  // Prefill (if user came back)
  // -----------------------------
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.storageKey) || 'null');
    if (saved) {
      if (saved.fullName) nameInput.value = saved.fullName;
      if (saved.phone)    phoneInput.value = saved.phone;
      if (saved.email)    emailInput.value = saved.email;
      if (saved.gender) {
        const r = document.querySelector(`input[name="gender"][value="${saved.gender}"]`);
        if (r) r.checked = true;
      }
    }
  } catch (_) {}

  // -----------------------------
  // Error helpers
  // -----------------------------
  function setError(input, errEl, hasError) {
    if (hasError) {
      input.classList.add('is-error');
      errEl.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.classList.remove('is-error');
      errEl.hidden = true;
      input.removeAttribute('aria-invalid');
    }
  }

  // -----------------------------
  // Realtime feedback on blur
  // -----------------------------
  nameInput.addEventListener('blur', () => {
    if (nameInput.value) setError(nameInput, errName, !v.name(nameInput.value));
  });
  phoneInput.addEventListener('blur', () => {
    if (phoneInput.value) setError(phoneInput, errPhone, !v.phone(phoneInput.value));
  });
  emailInput.addEventListener('blur', () => {
    if (emailInput.value) setError(emailInput, errEmail, !v.email(emailInput.value));
  });

  // Clear error on typing
  [
    [nameInput, errName],
    [phoneInput, errPhone],
    [emailInput, errEmail],
  ].forEach(([inp, err]) => {
    inp.addEventListener('input', () => setError(inp, err, false));
  });

  // -----------------------------
  // Submit
  // -----------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = nameInput.value.trim();
    const phone    = phoneInput.value.trim();
    const email    = emailInput.value.trim();
    const genderEl = document.querySelector('input[name="gender"]:checked');
    const gender   = genderEl ? genderEl.value : null;

    let ok = true;

    if (!v.name(fullName))   { setError(nameInput,  errName,  true); ok = false; }
    if (!v.phone(phone))     { setError(phoneInput, errPhone, true); ok = false; }
    if (!v.email(email))     { setError(emailInput, errEmail, true); ok = false; }

    if (!ok) {
      const firstError = form.querySelector('.is-error');
      if (firstError) firstError.focus();
      return;
    }

    const submitBtn = form.querySelector('.btn--primary');
    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'שולח...';

    const payload = { fullName, phone, email, gender, source: 'landing-pilot' };

    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(payload));
    } catch (_) {}

    // Send to backend
    try {
      await sendLead(payload);
    } catch (err) {
      console.warn('[FHINK] lead submit failed (continuing to success):', err);
    }

    // Show success
    showSuccess(fullName);

    // Redirect to questionnaire
    setTimeout(() => {
      const url = `${CONFIG.redirectTo}?lead=${encodeURIComponent(email)}`;
      window.location.href = url;
    }, CONFIG.redirectDelayMs);
  });

  // -----------------------------
  // Send lead to backend
  // -----------------------------
  async function sendLead(payload) {
    // In dev (file://) skip the network call.
    if (window.location.protocol === 'file:') {
      console.log('[FHINK] dev mode — would POST', payload);
      return { ok: true, mocked: true };
    }

    const res = await fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // -----------------------------
  // Success state
  // -----------------------------
  function showSuccess(fullName) {
    const firstName = fullName.split(' ')[0] || fullName;
    successName.textContent = firstName;

    formSection.style.transition = 'opacity 250ms ease, transform 250ms ease';
    formSection.style.opacity    = '0';
    formSection.style.transform  = 'translateY(-8px)';

    setTimeout(() => {
      formSection.hidden = true;
      successState.hidden = false;
      successState.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  }
})();
