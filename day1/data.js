/* ============================================================================
   FHINK AI · Day 1 · Data
   Static reference data: expense categories, income types, AI insights.
   This file is consumed by script.js to render the UI.
============================================================================ */

window.FHINK_DATA = {

  // ----------------------------------------------------------------
  // EXPENSE CATEGORIES (11 categories, fixed order from the brief)
  // ----------------------------------------------------------------
  categories: [
    {
      id: 'household',
      icon: 'home',
      title: 'משק בית',
      items: [
        { id: 'rent_mortgage', label: 'שכר דירה / משכנתא' },
        { id: 'electricity',   label: 'חשמל' },
        { id: 'water',         label: 'מים' },
        { id: 'gas',           label: 'גז' },
        { id: 'house_committee', label: 'ועד בית' },
        { id: 'other',         label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'insurance',
      icon: 'shield',
      title: 'ביטוחים',
      items: [
        { id: 'car_insurance',     label: 'ביטוח רכב' },
        { id: 'home_insurance',    label: 'ביטוח דירה' },
        { id: 'life_insurance',    label: 'ביטוח חיים' },
        { id: 'health_insurance',  label: 'ביטוח בריאות' },
        { id: 'other',             label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'health',
      icon: 'heart',
      title: 'בריאות',
      items: [
        { id: 'health_fund',  label: 'קופת חולים' },
        { id: 'medicine',     label: 'תרופות' },
        { id: 'dental',       label: 'טיפולי שיניים' },
        { id: 'optics',       label: 'משקפיים / עדשות' },
        { id: 'other',        label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'classes',
      icon: 'activity',
      title: 'חוגים',
      items: [
        { id: 'kids_classes', label: 'חוגים לילדים' },
        { id: 'fitness',      label: 'כושר / ספורט' },
        { id: 'other',        label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'education',
      icon: 'book',
      title: 'חינוך',
      items: [
        { id: 'kindergarten', label: 'גן / מעון' },
        { id: 'afternoon',    label: 'צהרון' },
        { id: 'tuition',      label: 'שכר לימוד' },
        { id: 'other',        label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'transport',
      icon: 'car',
      title: 'תחבורה',
      items: [
        { id: 'fuel',     label: 'דלק' },
        { id: 'public',   label: 'תחבורה ציבורית' },
        { id: 'parking',  label: 'חניה' },
        { id: 'leasing',  label: 'ליסינג / תשלומי רכב' },
        { id: 'other',    label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'comms',
      icon: 'wifi',
      title: 'תקשורת',
      items: [
        { id: 'phone',      label: 'טלפון' },
        { id: 'internet',   label: 'אינטרנט' },
        { id: 'tv',         label: 'טלוויזיה' },
        { id: 'streaming',  label: 'סטרימינג' },
        { id: 'other',      label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'food',
      icon: 'shopping-cart',
      title: 'אוכל',
      items: [
        { id: 'supermarket',  label: 'סופר' },
        { id: 'restaurants',  label: 'אוכל בחוץ' },
        { id: 'coffee',       label: 'קפה' },
        { id: 'delivery',     label: 'משלוחים' },
        { id: 'other',        label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'leisure',
      icon: 'star',
      title: 'פנאי',
      items: [
        { id: 'entertainment', label: 'בילויים' },
        { id: 'vacations',     label: 'חופשות' },
        { id: 'shopping',      label: 'קניות' },
        { id: 'hobbies',       label: 'תחביבים' },
        { id: 'other',         label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'investments',
      icon: 'trending-up',
      title: 'השקעות וחיסכון',
      items: [
        { id: 'training_fund',  label: 'קרן השתלמות' },
        { id: 'extra_pension',  label: 'פנסיה נוספת' },
        { id: 'investments',    label: 'גמל / השקעות' },
        { id: 'kids_savings',   label: 'חיסכון לילדים' },
        { id: 'general_savings',label: 'חיסכון כללי' },
        { id: 'other',          label: 'אחר', isOther: true },
      ],
    },
    {
      id: 'loans',
      icon: 'credit-card',
      title: 'הלוואות',
      items: [
        { id: 'bank_loans',     label: 'הלוואות בנקאיות' },
        { id: 'credit_cards',   label: 'כרטיסי אשראי' },
        { id: 'private_loans',  label: 'הלוואות חוץ-בנקאיות' },
        { id: 'other',          label: 'אחר', isOther: true },
      ],
    },
  ],

  // ----------------------------------------------------------------
  // INCOME TYPES (for the "Additional Income" feature)
  // ----------------------------------------------------------------
  incomeTypes: [
    { value: 'freelance', label: 'פרילנס' },
    { value: 'rent',      label: 'שכר דירה' },
    { value: 'pension',   label: 'פנסיה' },
    { value: 'allowance', label: 'קצבה' },
    { value: 'gift',      label: 'מתנה / סיוע' },
    { value: 'other',     label: 'אחר' },
  ],

  // ----------------------------------------------------------------
  // SVG ICONS (for category headers)
  // ----------------------------------------------------------------
  icons: {
    'home':         '<path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"/>',
    'shield':       '<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/>',
    'heart':        '<path d="M20.8 4.6c-1.5-1.5-4-1.5-5.5 0L12 8 8.7 4.6c-1.5-1.5-4-1.5-5.5 0-1.5 1.5-1.5 4 0 5.5L12 19l8.8-8.9c1.5-1.5 1.5-4 0-5.5z"/>',
    'activity':     '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    'book':         '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    'car':          '<path d="M14 17H9m11 0h2v-3.34a4 4 0 0 0-1.4-3L17.34 7H7L4.4 10.66A4 4 0 0 0 3 14V17h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    'wifi':         '<path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M1.42 9a16 16 0 0 1 21 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/>',
    'shopping-cart':'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    'star':         '<polygon points="12 2 15.1 8.6 22 9.6 17 14.5 18.2 21.3 12 18.1 5.8 21.3 7 14.5 2 9.6 8.9 8.6 12 2"/>',
    'trending-up':  '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'credit-card':  '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
  },

  // ----------------------------------------------------------------
  // AI INSIGHTS — rules-based for the pilot
  // (rule-based for V1; LLM can replace these later)
  // ----------------------------------------------------------------
  insights: {
    deficit: (income, expenses) => {
      const gap = expenses - income;
      return `נראה שיוצא לך כ-₪${gap.toLocaleString('he-IL')} יותר ממה שנכנס. זה לא משהו רע — זה משהו ברור. מחר נתחיל לסגור את זה.`;
    },
    tight: () => `סגרת את החודש כמעט באפס. אין מרווח לנשימה — וזה בדיוק מה שנעבוד עליו בימים הקרובים.`,
    healthy: (income, expenses) => {
      const left = income - expenses;
      const percent = Math.round((left / income) * 100);
      return `נשאר לך כ-₪${left.toLocaleString('he-IL')} בסוף החודש (כ-${percent}% מההכנסה). זו בסיס טוב — נראה איך הופכים אותו לכוח אמיתי.`;
    },
    excellent: (income, expenses) => {
      const left = income - expenses;
      const percent = Math.round((left / income) * 100);
      return `יש לך ${percent}% פנויים בסוף החודש — זה מעולה. בימים הבאים נדבר על איך לגרום לכסף הזה לעבוד בשבילך.`;
    },
    noData: () => `הנתונים שלך לא הושלמו. רוצה לחזור ולמלא? זה ייקח 5 דקות וישנה הכל.`,
  },

};
