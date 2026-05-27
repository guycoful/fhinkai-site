CREATE TABLE IF NOT EXISTS public.sync_board_state (
  slug text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_board_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sync_board_state (slug, payload, updated_by)
VALUES (
  'omri-pilot',
  jsonb_build_object(
    'title', 'לוח סנכרון - פיילוט עומרי',
    'description', 'לוח עבודה משותף לצוות הפיילוט. לעדכן רק את מה שצריך כדי שלא נאבד החלטות וחסימות.',
    'columns', jsonb_build_array(
      jsonb_build_object(
        'id', 'todo',
        'title', 'לבדיקה',
        'color', 'amber',
        'items', jsonb_build_array(
          jsonb_build_object(
            'id', 'seed-1',
            'title', 'להכריע איזה יום 1 עולה לפרודקשן',
            'owner', 'גיא',
            'due', '',
            'notes', 'READY החדש חי. day1 החדש עדיין לא מחובר.',
            'updatedAt', now()
          )
        )
      ),
      jsonb_build_object(
        'id', 'doing',
        'title', 'בתהליך',
        'color', 'blue',
        'items', jsonb_build_array(
          jsonb_build_object(
            'id', 'seed-2',
            'title', 'איסוף לידים וחימום לקראת 7/6',
            'owner', 'עומרי',
            'due', '2026-06-07',
            'notes', 'הנעילה של pilot מכוונת ולא באג.',
            'updatedAt', now()
          )
        )
      ),
      jsonb_build_object(
        'id', 'done',
        'title', 'סגור',
        'color', 'green',
        'items', jsonb_build_array(
          jsonb_build_object(
            'id', 'seed-3',
            'title', 'אימות שהנעילה עד 7/6 תקינה',
            'owner', 'גיא',
            'due', '',
            'notes', 'אומת בקוד ובפרודקשן.',
            'updatedAt', now()
          )
        )
      )
    ),
    'notes', jsonb_build_object(
      'general', 'המטרה: שלא דברים ייפלו בין הכיסאות.',
      'omri', 'המערכת נעולה בכוונה. הפער האמיתי כרגע הוא סנכרון הציפיות והעיצוב.',
      'guy', 'לא פותחים את האתגר לפני 7/6. לא משנים gate בלי החלטה עסקית.'
    )
  ),
  'migration'
)
ON CONFLICT (slug) DO NOTHING;
