/* ============================================================================
   FHINK AI · Day 2 · Data
   - Day-1 category/item index, each item mapped to a bucket:
     'need' (צורך) / 'want' (רצון) / 'save' (חיסכון)
   - Bucket definitions (order per the Day-2 brief: צורך → רצון → חיסכון)
   - Trim quick-options
   - Video slots (Guy + Omri) — placeholders until real videos arrive
   - Rule-based AI insights for the Day-2 summary
   - Demo Day-1 dataset (used only when fhink_day1_v1 is absent)
============================================================================ */

window.FHINK_DAY2_DATA = {

  // ----------------------------------------------------------------
  // BUCKETS — luxuries first (win the day there), then need.
  // 'save' is never shown in the trim flow (kept for the basics sums).
  // ----------------------------------------------------------------
  buckets: [
    {
      id: 'want',
      icon: 'star',
      title: 'רצון',
      subtitle: 'המותרות — כאן הכי קל לנצח את היום',
      trimmable: true,
    },
    {
      id: 'need',
      icon: 'anchor',
      title: 'צורך',
      subtitle: 'ואם רוצים עוד — קיזוז עדין גם כאן',
      trimmable: true,
    },
    {
      id: 'save',
      icon: 'trending-up',
      title: 'חיסכון',
      subtitle: 'בחיסכון לא נוגעים — זה העתיד שלך',
      trimmable: false,
    },
  ],

  // ----------------------------------------------------------------
  // DAY-1 CATEGORIES with bucket per item
  // (identical ids to Day 1 — this is how the data connects)
  // ----------------------------------------------------------------
  categories: [
    {
      id: 'household',
      title: 'משק בית',
      items: [
        { id: 'rent_mortgage',   label: 'שכר דירה / משכנתא', bucket: 'need' },
        { id: 'electricity',     label: 'חשמל',               bucket: 'need' },
        { id: 'water',           label: 'מים',                bucket: 'need' },
        { id: 'gas',             label: 'גז',                 bucket: 'need' },
        { id: 'house_committee', label: 'ועד בית',            bucket: 'need' },
        { id: 'other',           label: 'אחר', isOther: true, bucket: 'need' },
      ],
    },
    {
      id: 'insurance',
      title: 'ביטוחים',
      items: [
        { id: 'car_insurance',    label: 'ביטוח רכב',    bucket: 'need' },
        { id: 'home_insurance',   label: 'ביטוח דירה',   bucket: 'need' },
        { id: 'life_insurance',   label: 'ביטוח חיים',   bucket: 'need' },
        { id: 'health_insurance', label: 'ביטוח בריאות', bucket: 'need' },
        { id: 'other',            label: 'אחר', isOther: true, bucket: 'need' },
      ],
    },
    {
      id: 'health',
      title: 'בריאות',
      items: [
        { id: 'health_fund', label: 'קופת חולים',        bucket: 'need' },
        { id: 'medicine',    label: 'תרופות',             bucket: 'need' },
        { id: 'dental',      label: 'טיפולי שיניים',      bucket: 'need' },
        { id: 'optics',      label: 'משקפיים / עדשות',    bucket: 'need' },
        { id: 'other',       label: 'אחר', isOther: true, bucket: 'need' },
      ],
    },
    {
      id: 'classes',
      title: 'חוגים',
      items: [
        { id: 'kids_classes', label: 'חוגים לילדים',      bucket: 'need' },
        { id: 'fitness',      label: 'כושר / ספורט',      bucket: 'want' },
        { id: 'other',        label: 'אחר', isOther: true, bucket: 'want' },
      ],
    },
    {
      id: 'education',
      title: 'חינוך',
      items: [
        { id: 'kindergarten', label: 'גן / מעון',          bucket: 'need' },
        { id: 'afternoon',    label: 'צהרון',              bucket: 'need' },
        { id: 'tuition',      label: 'שכר לימוד',          bucket: 'need' },
        { id: 'other',        label: 'אחר', isOther: true, bucket: 'need' },
      ],
    },
    {
      id: 'transport',
      title: 'תחבורה',
      items: [
        { id: 'fuel',    label: 'דלק',                  bucket: 'need' },
        { id: 'public',  label: 'תחבורה ציבורית',       bucket: 'need' },
        { id: 'parking', label: 'חניה',                 bucket: 'need' },
        { id: 'leasing', label: 'ליסינג / תשלומי רכב',  bucket: 'need' },
        { id: 'other',   label: 'אחר', isOther: true,   bucket: 'need' },
      ],
    },
    {
      id: 'comms',
      title: 'תקשורת',
      items: [
        { id: 'phone',     label: 'טלפון',              bucket: 'need' },
        { id: 'internet',  label: 'אינטרנט',            bucket: 'need' },
        { id: 'tv',        label: 'טלוויזיה',           bucket: 'want' },
        { id: 'streaming', label: 'סטרימינג',           bucket: 'want' },
        { id: 'other',     label: 'אחר', isOther: true, bucket: 'need' },
      ],
    },
    {
      id: 'food',
      title: 'אוכל',
      items: [
        { id: 'supermarket', label: 'סופר',              bucket: 'need' },
        { id: 'restaurants', label: 'אוכל בחוץ',         bucket: 'want' },
        { id: 'coffee',      label: 'קפה',               bucket: 'want' },
        { id: 'delivery',    label: 'משלוחים',           bucket: 'want' },
        { id: 'other',       label: 'אחר', isOther: true, bucket: 'want' },
      ],
    },
    {
      id: 'leisure',
      title: 'פנאי',
      items: [
        { id: 'entertainment', label: 'בילויים',           bucket: 'want' },
        { id: 'vacations',     label: 'חופשות',            bucket: 'want' },
        { id: 'shopping',      label: 'קניות',             bucket: 'want' },
        { id: 'hobbies',       label: 'תחביבים',           bucket: 'want' },
        { id: 'other',         label: 'אחר', isOther: true, bucket: 'want' },
      ],
    },
    {
      id: 'investments',
      title: 'השקעות וחיסכון',
      items: [
        { id: 'training_fund',   label: 'קרן השתלמות',   bucket: 'save', day4: true },
        { id: 'extra_pension',   label: 'פנסיה נוספת',   bucket: 'save', day4: true },
        { id: 'investments',     label: 'גמל / השקעות',  bucket: 'save' },
        { id: 'kids_savings',    label: 'חיסכון לילדים', bucket: 'save' },
        { id: 'general_savings', label: 'חיסכון כללי',   bucket: 'save' },
        { id: 'other',           label: 'אחר', isOther: true, bucket: 'save' },
      ],
    },
    {
      id: 'loans',
      title: 'הלוואות',
      items: [
        { id: 'bank_loans',    label: 'הלוואות בנקאיות',      bucket: 'need' },
        { id: 'credit_cards',  label: 'כרטיסי אשראי',         bucket: 'need' },
        { id: 'private_loans', label: 'הלוואות חוץ-בנקאיות',  bucket: 'need' },
        { id: 'other',         label: 'אחר', isOther: true,   bucket: 'need' },
      ],
    },
  ],

  // ----------------------------------------------------------------
  // TRIM QUICK-OPTIONS (per item)
  // ----------------------------------------------------------------
  trimOptions: [
    { key: 'none',   label: 'ללא שינוי', pct: 0 },
    { key: 'p3',     label: '3%-',  pct: 3 },
    { key: 'p5',     label: '5%-',  pct: 5 },
    { key: 'p10',    label: '10%-', pct: 10 },
    { key: 'custom', label: 'סכום אחר' },
  ],

  // ----------------------------------------------------------------
  // VIDEO SLOTS (placeholders — wire real sources via the `src` field)
  // ----------------------------------------------------------------
  videos: [
    {
      id: 'guy',
      who: 'גיא · על המערכת',
      title: 'איך בוחרים איפה לצמצם',
      desc: 'הסבר קצר על המסך הבא: איך המערכת מחלקת את ההוצאות ואיך מסמנים צמצום.',
      duration: '2:10',
      poster: 'abstract',
      src: '', // ← wire real video URL here
    },
    {
      id: 'omri',
      who: 'עמרי חן · דוקטורנט לכלכלה',
      title: 'צורך, רצון, חיסכון — וה-3% שמשנים הכל',
      desc: 'ההסבר המקצועי: למה דווקא צמצום קטן ועקבי מייצר את התוצאה הגדולה.',
      duration: '3:25',
      poster: 'omri',
      src: '', // ← wire real video URL here
    },
  ],

  // ----------------------------------------------------------------
  // SVG ICONS
  // ----------------------------------------------------------------
  icons: {
    'anchor':      '<path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>',
    'star':        '<polygon points="12 2 15.1 8.6 22 9.6 17 14.5 18.2 21.3 12 18.1 5.8 21.3 7 14.5 2 9.6 8.9 8.6 12 2"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'lock':        '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    'play':        '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
    'check':       '<polyline points="20 6 9 17 4 12"/>',
  },

  // ----------------------------------------------------------------
  // AI INSIGHTS — rule-based for the pilot (LLM can replace later)
  // ----------------------------------------------------------------
  insights: {
    hit: (saved, target, yearly) =>
      `עמדת ביעד של היום — ₪${target.toLocaleString('he-IL')} — ובחרת צמצומים של ₪${saved.toLocaleString('he-IL')} בחודש. במצטבר זה ₪${yearly.toLocaleString('he-IL')} בשנה, בלי לשנות את איכות החיים. בדיוק ככה נראית עצמאות כלכלית בתחילתה.`,
    exceeded: (saved, target, yearly) =>
      `לא רק שעמדת ביעד (₪${target.toLocaleString('he-IL')}) — עברת אותו: ₪${saved.toLocaleString('he-IL')} בחודש, שהם ₪${yearly.toLocaleString('he-IL')} בשנה. מחר ניקח את המומנטום הזה לצד של ההכנסות.`,
    partial: (saved, target) =>
      `בחרת צמצומים של ₪${saved.toLocaleString('he-IL')} מתוך יעד של ₪${target.toLocaleString('he-IL')}. גם זו התחלה אמיתית — ואפשר לחזור ולהשלים את הפער בכל רגע. ההרגל חשוב מהמספר.`,
    closesGap: (saved, gap) =>
      ` שווה לשים לב: הצמצום שבחרת מכסה ${Math.min(100, Math.round((saved / gap) * 100))}% מהפער החודשי שזיהינו ביום 1.`,
    none: () =>
      `עוד לא נבחרו צמצומים. אפשר לחזור למסך הקודם ולבחור אפילו סעיף אחד קטן — 3% זה פחות ממה שזה נשמע.`,
  },

  // ----------------------------------------------------------------
  // DEMO DAY-1 DATASET
  // Used ONLY when localStorage has no fhink_day1_v1 record,
  // so the screens are alive in client reviews. Shaped exactly
  // like the Day-1 state object.
  // ----------------------------------------------------------------
  demoDay1: {
    basics: {
      salary: '14800',
      additionalIncomes: [
        { type: 'freelance', amount: '3200', otherDetail: '' },
      ],
    },
    expenses: {
      household:   { rent_mortgage: { amount: '4500' }, electricity: { amount: '380' }, water: { amount: '130' }, gas: { amount: '90' }, house_committee: { amount: '180' } },
      insurance:   { car_insurance: { amount: '220' }, home_insurance: { amount: '140' }, life_insurance: { amount: '190' }, health_insurance: { amount: '300' } },
      health:      { health_fund: { amount: '250' }, medicine: { amount: '120' } },
      classes:     { kids_classes: { amount: '320' }, fitness: { amount: '180' } },
      education:   { kindergarten: { amount: '1650' } },
      transport:   { fuel: { amount: '900' }, parking: { amount: '150' } },
      comms:       { phone: { amount: '120' }, internet: { amount: '100' }, tv: { amount: '80' }, streaming: { amount: '70' } },
      food:        { supermarket: { amount: '3200' }, restaurants: { amount: '750' }, coffee: { amount: '200' }, delivery: { amount: '250' } },
      leisure:     { entertainment: { amount: '450' }, vacations: { amount: '400' }, shopping: { amount: '600' }, hobbies: { amount: '150' } },
      investments: { training_fund: { amount: '500' }, kids_savings: { amount: '300' } },
      loans:       { bank_loans: { amount: '1200' }, credit_cards: { amount: '400' } },
    },
  },

};
