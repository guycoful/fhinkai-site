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
    endpoint: 'https://vuvavjmbvdqnwtleudqh.supabase.co/functions/v1/create-lead',
    redirectTo: '/READY/',                 // opening questionnaire (Asaf's final version)
    redirectDelayMs: 2000,                 // time on success screen before redirect
    storageKey: 'fhink_lead_v1',           // localStorage key for prefill recovery
    cohort: 'pilot',
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

    const payload = {
      name: fullName,
      phone,
      email,
      gender,
      source: new URLSearchParams(window.location.search).get('src') || 'landing-pilot',
      cohort: new URLSearchParams(window.location.search).get('cohort') || CONFIG.cohort,
    };

    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(payload));
    } catch (_) {}

    // Send to backend — retry once before giving up so a flaky network doesn't
    // silently drop a lead (root cause we hit in 18.5 rehearsal).
    let leadSaved = false;
    try {
      await sendLead(payload);
      leadSaved = true;
    } catch (err) {
      console.warn('[FHINK] lead submit failed, retrying once:', err);
      try {
        await new Promise((r) => setTimeout(r, 600));
        await sendLead(payload);
        leadSaved = true;
      } catch (err2) {
        console.error('[FHINK] lead submit failed after retry:', err2);
      }
    }

    if (!leadSaved && window.location.protocol !== 'file:') {
      // Surface failure to user instead of redirecting silently into the funnel
      submitBtn.disabled = false;
      submitBtn.querySelector('span').textContent = 'נסה שוב';
      alert('שגיאה בשמירת ההרשמה. בדקי חיבור אינטרנט ונסי שוב.');
      return;
    }

    // Show success
    showSuccess(fullName);

    // Redirect to questionnaire, carrying cohort/src so they survive the funnel
    setTimeout(() => {
      const params = new URLSearchParams({ lead: email });
      if (payload.cohort) params.set('cohort', payload.cohort);
      if (payload.source) params.set('src', payload.source);
      window.location.href = `${CONFIG.redirectTo}?${params.toString()}`;
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
