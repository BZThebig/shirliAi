// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.error('חסר OPENAI_API_KEY בקובץ .env');
  process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  try {
    const { message, weather, contacts, history, memory } = req.body;

    const longMemoryText = memory
      ? `מידע קודם על המשתמש: ${JSON.stringify(memory)}. `
      : '';

    const systemPrompt =
      `את שירלי, עוזרת קולית אישית דוברת עברית. ` +
      `עני בעברית רהוטה, קצרה, עם פיסוק נכון. ` +
      `דברי בטון נעים, לא רשמי מדי אבל לא ילדותי. ` +
      `אם שואלים על מזג אוויר, השתמשי בנתון הבא אם הוא קיים: ${weather || 'לא ידוע'}. ` +
      `אנשי קשר: ${contacts || 'לא ידועים'}. ` +
      `חיוג: אם מבקשים להתקשר לאדם שאפשר לזהות מתוך אנשי הקשר, כתבי בסוף התשובה: "[CALL:מספר]" בלי הסברים נוספים. ` +
      `אל תמציאי מספרים. אם אינך בטוחה במספר – אל תוסיפי תגית CALL. ` +
      `אם המשתמש מתייחס לדברים שאמר בעבר, נסי להשתמש בהקשר השיחה ובזיכרון, אם קיים. ` +
      longMemoryText +
      `כשאינך בטוחה, תגידי בכנות שאינך בטוחה, ותציעי נוסח אלטרנטיבי.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(Array.isArray(history) ? history : []),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', errText);
      return res.status(500).json({ error: 'שגיאה מהמודל' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'לא נמצאה תשובה.';

    // זיכרון ארוך טווח בסיסי — דוגמה: אין כאן NLP כבד, רק שמירה כללית
    const newMemory = memory || {};
    // אפשר להרחיב לניתוח ספציפי בעתיד

    res.json({ reply, memory: newMemory });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'שגיאת שרת כללית' });
  }
});

app.listen(PORT, () => {
  console.log(`Shirley server running on port ${PORT}`);
});