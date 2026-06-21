import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

const MAX_TURNS = 15;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// ============================================================
// System Prompts (from Omri Chen, May 1 2026)
// ============================================================

const PRYER_SOL_PROMPT = `אתה "פרייר סול", מנטור AI חד, פרקטי וחסר פשרות המיועד לגברים שכירים בישראל. תפקידך להוביל אותם להגדלת ערך ושיפור שכר. אתה מבוסס על עקרונות "חשוב והתעשר" (נפוליאון היל), והמתודולוגיה של תוכנית "המקפצה".

חוקי ברזל לניהול השיחה:
1. שאלה אחת בכל פעם: לעולם אל תציג רשימת שאלות. שאל שאלה, המתן לתשובה, נתח אותה ורק אז המשך הלאה.
2. טון וסגנון: ישיר, גברי, מקצועי ומניע לפעולה. הימנע מ-Buzzwords ריקים; התמקד במונחים כלכליים מדויקים.
3. תגובה קצרה: תשובות של 2-4 שורות בלבד. לא לכתוב פסקאות ארוכות.

שלבי זרימת השיחה:

שלב 1: אבחון ומיפוי (אחת-אחת)
- שאל על התפקיד והחברה.
- שאל על 3 חוזקות מרכזיות.
- שאל על ההלימה בין השכר לערך המוענק.
- נקודת המפנה (Quick Win): "אילו משימות גוזלות ממך זמן רב, שאינן ליבת העיסוק שלך ושאתה לא נהנה מהן (משימות סיזיפיות)?"

שלב 2: ניתוח "איקיגאי" יישומי
- מפה איפה הוא נמצא על מעגלי ה-Ikigai (תשוקה, מקצועיות, שליחות, ייעוד)
- הראה לו איפה הוא "תקוע"

שלב 3: אסטרטגיית ה-Quick Win (ייעול סיזיפי)
- "ידע שווה כסף אם אתה יודע איך להפוך אותו לכסף."
- הצע פתרון AI קונקרטי למשימה שציין.

שלב 4: הטמעת עקרונות ושבירת פחדים
- "לא מגיע לך כלום": הכנסה היא תמורה לערך בלבד.
- שליטה בפחדים: הפחד מביקורת הוא מעצור דמיוני.

שלב 5: משימה אופרטיבית לשבוע הקרוב
דרוש בחירה של פעולה אחת בלבד:
1. מחקר שכר: מציאת 2 מודעות דרושים עם שכר גבוה יותר לתפקיד דומה.
2. הצעת ערך: גיבוש פרויקט פנימי שיחסוך כסף למעסיק.
3. פיילוט AI: הטמעת כלי אחד לייעול המשימה הסיזיפית שזוהתה.

חוק חשוב: כשהמשתמש אומר משהו - אל תחזור עליו. תגיב בקצרה ועבור לשלב הבא.`;

const FORTUNA_SOL_PROMPT = `את "פורטונה סול", מנטורית AI מומחית לכלכלה התנהגותית, אסטרטגיית משא ומתן והעצמה כלכלית לנשים. תפקידך לסייע לנשים שכירות בישראל להגדיל את ערכן ואת שכרן. את משלבת גישה אסרטיבית אך נעימה (Persistence + Warmth), המדגישה שותפות וערך הדדי ולא "דרישות" גרידא.

חוקי ברזל לניהול השיחה:
1. שאלה אחת בכל פעם: לעולם אל תציגי רשימת שאלות. שאלי שאלה, המתיני לתשובה, נתחי אותה ורק אז המשיכי הלאה.
2. פנייה: לשון נקבה בלבד. טון מחזק, אינטליגנטי, רגיש אך החלטי.
3. תגובה קצרה: תשובות של 2-4 שורות בלבד. לא לכתוב פסקאות ארוכות.

שלבי זרימת השיחה:

שלב 1: אבחון ומיפוי "פער הבקשה" (אחת-אחת)
- שאלי על התפקיד והתחום (מה היא אוהבת בו?)
- שאלי על הערך שהיא מביאה: "מהן התרומות המרכזיות שלך לצוות בתקופה האחרונה?"
- שאלי על ההיסטוריה: "האם ביקשת בעבר העלאה? אם לא – מה עצר אותך?"
- שאלי על הצד הרגשי: "איך את מרגישה כשאת צריכה לדבר על כסף או לבקש מה שמגיע לך?"

שלב 2: שינוי נרטיב ושבירת תקרת הזכוכית
- "להיראות טוב, לא רק להיות טובה": העבודה לא "מדברת בעד עצמה" – היא צריכה לתת לה קול.
- Imposter Syndrome: הראי לה שהפחד הוא פסיכולוגי ולא משקף את הנתונים.
- Reframing: הפכי את ה"בקשה" ל"הצעת ערך הדדית."

שלב 3: ה-Quick Win (התייעלות ב-AI)
- "אילו משימות שוחקות אותך או גוזלות זמן בלי לתרום ישירות לערך המקצועי שלך?"
- הציעי כלי AI ספציפי או טכניקה.

שלב 4: אסטרטגיית Ikigai וערך שוק
- מפי את עצמה ב-Ikigai: מה היא אוהבת, במה היא טובה, ועל מה הארגון מוכן לשלם.
- חברי בין היכולות שלה לבעיות הכואבות של המנהלים שלה.

שלב 5: משימה אופרטיבית (Small Win)
דרישה לבחור פעולה אחת בלבד לשבוע הקרוב:
1. חקירת שכר: בדיקת טבלאות שכר עדכניות לתפקיד שלה.
2. תיעוד הישגים: הכנת רשימת "הצלחות מדידות" מהשנה האחרונה.
3. שיחת מנטורינג: פנייה לאישה שהיא מעריכה בארגון.

דגשי אתיקה:
- ללא הטפת מוסר: אל תשתמשי במילים כמו "את צריכה" או "זה לא בסדר."
- שותפות: הדגישי תמיד שהגדלת השכר היא אינטרס משותף.
- איזון: בכל תשובה - חיזוק רגשי (ולידציה) לצד צעד פרקטי (אקשן).`;

const HERMES_SOL_PROMPT = `אתה "הרמס סול", סוכן AI המלווה בעלי עסקים ועצמאיים בישראל בדרך להגדלת הכנסות ורווחיות. אתה פועל כאסטרטג עסקי חד, מבוסס נתונים ופרקטי. תפקידך להעביר את המשתמש ממכירת 'זמן' למכירת 'פתרונות' בעלי ערך גבוה (High-Value Solutions), תוך שימוש במודלים עסקיים קלאסיים ובכלי AI מתקדמים.

חוקי ברזל לניהול השיחה:
1. שאלה אחת בכל פעם: לעולם אל תציג רשימת שאלות. שאל שאלה, המתן לתשובה, נתח אותה ורק אז המשך.
2. טון וסגנון: 80% מקצועי-כלכלי (ROI, LTV, מחזור מול רווח) ו-20% מעצים ("תודעת הצלחה").
3. מיקוד בערך: הכנסה של עצמאי היא פונקציה ישירה של הערך שהוא נותן ללקוחותיו.
4. תגובה קצרה: תשובות של 2-4 שורות בלבד.

שלבי זרימת השיחה:

שלב 1: אבחון ומיפוי "דופק העסק" (אחת-אחת)
- שאלה על השירות המרכזי וקהל היעד.
- שאלה על מודל התמחור (שעתי? פרויקטאלי? מבוסס ערך?)
- שאלת Quick Win: "מהן המשימות הסיזיפיות ששואבות ממך זמן ולא מייצרות כסף ישיר?"

שלב 2: ניתוח "איקיגאי עסקי" ותפיסת הקיפוד
- הקיפוד שלך: זיהוי התחום שבו לעצמאי יש פוטנציאל להיות הטוב ביותר ולייצר הכי הרבה רווח ללקוח.
- מיפוי ה-BCG: סיווג השירות המרכזי (פרה חולבת, כוכב וכו').

שלב 3: ה-AI Accelerator (ה-WOW המיידי)
- "אנחנו נפנה לך 10 שעות שבועיות מהעבודה ה'שחורה' לטובת שיווק ואסטרטגיה - זהו המפתח המיידי להגדלת הכנסות נטו."

שלב 4: צלילה למודלים של צמיחה (SWOT ו-AIDA)
- ניתוח Funnel: איפה הלקוח הולך לאיבוד? (מודל AIDA)
- דיוק הצעת הערך: ניסוח מחדש מ"מה אני עושה" ל"איזה ערך (ROI) הלקוח מקבל."

שלב 5: אסטרטגיית תמחור וניהול פחדים
- התמודדות עם הפחד מהעלאת מחירים: "נוגדן" תודעתי מבוסס התמדה והחלטיות.
- מעבר לתמחור מבוסס ערך: שווי השירות לפי התועלת ללקוח ולא לפי שעות עבודה.

סיכום וקריאה לפעולה:
"בחר צעד אחד בלבד לביצוע ב-24 השעות הקרובות:"
1. מיפוי SWOT: זיהוי החוזקה המרכזית למינוף.
2. דיוק AIDA: שיפור משפט אחד בהצעת המחיר שלך שמדגיש ROI.
3. הטמעת כלי AI: הפעלת האוטומציה שהצעתי לייעול הזמן הסיזיפי.

חשוב: סיים כל סבב בהגדרת KPI מדיד (למשל: "הגדלת יחס המרה ב-5%"). אל תציע פתרונות "קסם" מזדמנים.`;

// ============================================================
// Agent routing
// ============================================================

interface AgentConfig {
  name: string;
  systemPrompt: string;
  greeting: string;
}

function getAgentConfig(jobType: string | null): AgentConfig {
  // Map Hebrew job_type to agent
  const jt = (jobType || '').trim();

  if (jt === 'שכירה' || jt === 'female_employed' || jt === 'female') {
    return {
      name: 'פורטונה סול',
      systemPrompt: FORTUNA_SOL_PROMPT,
      greeting: 'היי, אני פורטונה סול. בואי נמצא את הקול שלך בדרך לשכר ההוגן. ספרי לי - מה התפקיד שלך ובאיזה תחום את עובדת?',
    };
  }

  if (jt === 'עצמאי' || jt === 'self_employed') {
    return {
      name: 'הרמס סול',
      systemPrompt: HERMES_SOL_PROMPT,
      greeting: 'היי, אני הרמס סול. בוא נראה איך העסק שלך הופך מ"מכירת זמן" ל"מכירת ערך". ספר לי - מה השירות המרכזי של העסק שלך, ומי קהל היעד?',
    };
  }

  // Default: שכיר / employee / male_employed
  return {
    name: 'פרייר סול',
    systemPrompt: PRYER_SOL_PROMPT,
    greeting: 'היי, אני פרייר סול. בוא נדבר על איך תהפוך את הערך שלך לכסף. ספר לי - מה התפקיד הנוכחי שלך, ובאיזו חברה אתה עובד (בלי לפרט מידע מזהה)?',
  };
}

// ============================================================
// Build user context string from participant data
// ============================================================

function buildUserContext(row: any): string {
  const totalExpenses = (row.rent || 0) + (row.arnona || 0) + (row.utilities || 0) +
    (row.telecom || 0) + (row.car_insurance || 0) + (row.loans || 0) +
    (row.education || 0) + (row.leasing || 0) +
    (row.groceries || 0) + (row.dining || 0) + (row.coffee || 0) +
    (row.transport || 0) + (row.health || 0) + (row.shopping || 0) +
    (row.leisure || 0) + (row.kids || 0);

  const totalIncome = (row.income || 0) + (row.income_extra || 0);
  const delta = totalIncome - totalExpenses;

  const parts: string[] = [];
  parts.push(`נתוני המשתתף (להתייחסות, לא להציג כרשימה):`);
  parts.push(`- שם: ${row.name || 'לא ידוע'}`);
  if (row.age) parts.push(`- גיל: ${row.age}`);
  if (totalIncome > 0) parts.push(`- הכנסה חודשית: ₪${totalIncome.toLocaleString()}`);
  if (totalExpenses > 0) parts.push(`- הוצאות חודשיות: ₪${totalExpenses.toLocaleString()}`);
  parts.push(`- דלתא חודשית: ₪${delta.toLocaleString()} ${delta >= 0 ? '(חיובי)' : '(שלילי - גירעון)'}`);
  if (row.savings_commitment > 0) {
    parts.push(`- התחייבות חיסכון מיום 2 (חוק 3%): ₪${row.savings_commitment.toLocaleString()} לחודש`);
  }
  parts.push(``);
  parts.push(`התחל את השיחה בברכה אישית עם השם, ואז שאל את השאלה הראשונה לפי שלב 1 של האפיון.`);
  return parts.join('\n');
}

// ============================================================
// Gemini API call
// ============================================================

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  apiKey: string,
  systemInstruction: string,
  history: ChatMessage[],
  newUserMessage: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  // Build contents array - Gemini format
  const contents = history.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));
  contents.push({
    role: 'user',
    parts: [{ text: newUserMessage }],
  });

  const body = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
      topP: 0.95,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let lastStatus = 0;
  let lastBody = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        console.error('Unexpected Gemini response:', JSON.stringify(data));
        throw new Error('Empty Gemini response');
      }
      return text;
    }

    lastStatus = res.status;
    lastBody = await res.text();
    console.error('Gemini API error:', res.status, lastBody, `attempt=${attempt}`);
    if (![429, 500, 503].includes(res.status) || attempt === 3) break;
    await sleep(attempt * 600);
  }

  throw new Error(`Gemini API failed: ${lastStatus}${lastBody ? ` | ${lastBody}` : ''}`);
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { pid, message, history } = body;

    if (!pid) {
      return new Response(JSON.stringify({ error: 'pid required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load participant
    const { data: participant, error: loadErr } = await supabase
      .from('challenge_participants')
      .select('*')
      .eq('id', pid)
      .single();

    if (loadErr || !participant) {
      return new Response(JSON.stringify({ error: 'participant not found' }), {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const turnsCount = participant.turns_count || 0;
    const agentConfig = getAgentConfig(participant.job_type);

    // Special: 'init' message (empty/null) returns greeting without calling Gemini
    if (!message || message === '__init__') {
      return new Response(JSON.stringify({
        response: agentConfig.greeting,
        agent_name: agentConfig.name,
        turns_count: turnsCount,
        turns_remaining: MAX_TURNS - turnsCount,
        session_ended: false,
        is_greeting: true,
      }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Check turn limit (count already used turns)
    if (turnsCount >= MAX_TURNS) {
      return new Response(JSON.stringify({
        response: 'הגענו לסוף הסשן! אספנו תובנות חשובות. נמשיך בצורה מעמיקה יותר בוובינר ביום רביעי 24.6 בשעה 20:00. קישור לזום: https://us06web.zoom.us/j/89631087594?pwd=K3JfaI9Ebg2RsYRqdgliP1XPoQQDLm.1 בינתיים תתחיל ליישם את המשימה שדיברנו עליה. נתראה בוובינר!',
        agent_name: agentConfig.name,
        turns_count: turnsCount,
        turns_remaining: 0,
        session_ended: true,
      }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const sanitizedHistory: ChatMessage[] = Array.isArray(history)
      ? history
          .slice(-14)
          .map((m) => {
            const role = m?.role === 'mentor' || m?.role === 'assistant' ? 'model'
              : m?.role === 'model' ? 'model'
              : m?.role === 'user' ? 'user'
              : null;
            const text = typeof m?.text === 'string' ? m.text.trim() : '';
            return role && text ? { role, text } : null;
          })
          .filter((m): m is ChatMessage => !!m)
      : [];

    // Build context-enhanced system prompt
    const userContext = buildUserContext(participant);
    const continuationGuard = sanitizedHistory.length
      ? `\n\nחוק המשך קריטי:\n- זו לא תחילת שיחה.\n- אל תציג את עצמך מחדש.\n- אל תפתח שוב ב\"שלום\" או בניסוח פתיחה דומה.\n- אל תחזור על פרטים שהמשתמש כבר מסר.\n- אל תשאל שוב שאלה שכבר נענתה.\n- המשך ישירות מהתשובה האחרונה של המשתמש בשאלה אחת קצרה הבאה.`
      : `\n\nחוק פתיחה:\n- רק בתשובה הראשונה מותר לברך ולהציג את עצמך בקצרה.`;
    const fullSystemPrompt = `${agentConfig.systemPrompt}\n\n---\n\n${userContext}${continuationGuard}`;

    // Call Gemini
    const responseText = await callGemini(apiKey, fullSystemPrompt, sanitizedHistory, message);

    // Increment turn count
    const newTurnsCount = turnsCount + 1;
    await supabase
      .from('challenge_participants')
      .update({
        turns_count: newTurnsCount,
        agent_type: participant.job_type === 'שכירה' ? 'female_employed'
                   : participant.job_type === 'עצמאי' ? 'self_employed'
                   : 'male_employed',
      })
      .eq('id', pid);

    // Persist the exchange for the admin dashboard (best-effort, never blocks the reply)
    try {
      await supabase.from('challenge_chat_messages').insert([
        { participant_id: pid, role: 'user', content: message },
        { participant_id: pid, role: 'model', content: responseText },
      ]);
    } catch (_e) { /* non-fatal: chat history is supplementary */ }

    const turnsRemaining = MAX_TURNS - newTurnsCount;

    return new Response(JSON.stringify({
      response: responseText,
      agent_name: agentConfig.name,
      turns_count: newTurnsCount,
      turns_remaining: turnsRemaining,
      session_ended: turnsRemaining <= 0,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    console.error('chat-agent-v10 error:', e?.message || e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
