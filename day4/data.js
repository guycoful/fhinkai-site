/* ============================================================================
   FHINK AI · Day 4 · Data
   - Fund / asset / liability types
   - Calculation assumptions (documented, illustration only)
   - FI-distance scenarios (screen 6) — incl. the locked 50/30/20 model
   - Rule-based AI insights
   - Demo fallbacks (used only when prior-day data is absent)
============================================================================ */

window.FHINK_DAY4_DATA = {

  // ----------------------------------------------------------------
  // ASSUMPTIONS (for illustration; Guy can tune in one place)
  // ----------------------------------------------------------------
  assumptions: {
    retirementAge: 67,
    pensionAnnualReturn: 0.05,   // average gross, before fees
    investAnnualReturn: 0.07,    // long-term average for the FI simulation
    annuityFactor: 200,          // צבירה ÷ 200 = פנסיה חודשית
    fiMultiple: 25,              // עצמאות כלכלית ≈ 25 × הוצאות שנתיות (כלל 4%)
    severanceKeepRatio: 0.5,     // משיכת פיצויים ≈ מחצית מזרם הפנסיה אובדת
    maxYears: 60,
  },

  // ----------------------------------------------------------------
  // SELECT OPTIONS
  // ----------------------------------------------------------------
  fundTypes: [
    { value: 'comprehensive', label: 'קרן פנסיה מקיפה' },
    { value: 'general',       label: 'קרן פנסיה כללית' },
    { value: 'gemel',         label: 'קופת גמל' },
    { value: 'managers',      label: 'ביטוח מנהלים' },
    { value: 'other',         label: 'אחר' },
  ],

  assetTypes: [
    { value: 'home',        label: 'דירה / נדל״ן' },
    { value: 'checking',    label: 'עו״ש' },
    { value: 'investments', label: 'חשבון השקעות' },
    { value: 'hishtalmut',  label: 'קרן השתלמות' },
    { value: 'car',         label: 'רכב' },
    { value: 'other',       label: 'אחר' },
  ],

  liabilityTypes: [
    { value: 'mortgage', label: 'משכנתא' },
    { value: 'loan',     label: 'הלוואה' },
    { value: 'credit',   label: 'יתרת אשראי' },
    { value: 'other',    label: 'אחר' },
  ],

  // ----------------------------------------------------------------
  // FI-DISTANCE SCENARIOS (screen 6, fixed order from the brief)
  // ----------------------------------------------------------------
  scenarios: [
    {
      id: 'before_withdraw',
      label: 'לפני האתגר · עם משיכת פיצויים',
      sub: 'ההתנהלות הישנה, כולל שבירת הפנסיה במעברי עבודה',
      kind: 'before',
    },
    {
      id: 'before_keep',
      label: 'לפני האתגר · בלי משיכת פיצויים',
      sub: 'אותה התנהלות, רק בלי לגעת בפיצויים',
      kind: 'before',
    },
    {
      id: 'challenge',
      label: 'אחרי האתגר · עם קיזוז ה-3%',
      sub: 'הקיזוז מיום 2 מצטרף לחיסכון — אתה כאן',
      kind: 'best',
    },
    {
      id: 'model503020',
      label: 'מודל 50/30/20',
      sub: 'נפתח לאחר צפייה בוובינר',
      kind: 'locked',
    },
  ],

  // ----------------------------------------------------------------
  // AI INSIGHTS — rule-based for the pilot (LLM can replace later)
  // ----------------------------------------------------------------
  insights: {
    pensionHighFee: (fee, feesTotal) =>
      `דמי ניהול של ${fee}% מהצבירה הם מעל הממוצע (~0.6%). על פני השנים זה מצטבר ל-₪${feesTotal.toLocaleString('he-IL')} — שיחה אחת עם הקרן יכולה להוזיל אותם. זה הסעיף הכי משתלם לטפל בו השבוע.`,
    pensionOkFee: (feesTotal) =>
      `דמי הניהול שלך סבירים — אבל שווה לדעת שגם הם מצטברים ל-₪${feesTotal.toLocaleString('he-IL')} עד הפרישה. בוובינר הערב עמרי יראה מה עוד אפשר לעשות עם זה.`,
    pensionGap: (monthlyPension, salary) =>
      ` שים לב: הפנסיה הצפויה (₪${monthlyPension.toLocaleString('he-IL')}) היא כ-${Math.round((monthlyPension / salary) * 100)}% מהשכר של היום — עדיף לגלות את זה עכשיו, בגיל שאפשר לשנות.`,
    fi: (beforeYears, challengeYears, gained) =>
      `לפני האתגר היית במרחק של כ-${beforeYears} שנים מעצמאות כלכלית. עם הקיזוז של יום 2 — ${challengeYears} שנים${gained > 0 ? `, כלומר הרווחת ${gained} שנ${gained === 1 ? 'ה' : 'ים'} של חיים` : ''}. וזה לפני המודל המלא שנפתח הערב בוובינר.`,
    fiFar: () =>
      `לפי הקצב הנוכחי, עצמאות כלכלית מלאה עוד רחוקה — וזו בדיוק הסיבה שהאתגר הזה חשוב. כל אחד מהימים קיצר את הדרך, והמודל שייפתח הערב בוובינר הוא הצעד הבא.`,
  },

  // ----------------------------------------------------------------
  // DEMO FALLBACKS
  // ----------------------------------------------------------------
  demo: {
    age: 34,
    salary: 14800,
    monthlyIncome: 18000,
    monthlyExpenses: 18470,
    day2Saved: 550,
    pension: { empRate: 6, employerRate: 6.5, fundType: 'comprehensive', feeRate: 0.6, balance: 280000 },
    assets: [
      { type: 'home',        amount: 1500000 },
      { type: 'checking',    amount: 60000 },
      { type: 'investments', amount: 80000 },
    ],
    liabilities: [
      { type: 'mortgage', amount: 900000 },
      { type: 'loan',     amount: 40000 },
    ],
  },

};
