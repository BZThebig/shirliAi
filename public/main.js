/********************************************************************
 *  SHIRLEY — Voice Assistant (Full Feature Version)
 ********************************************************************/

const chatDisplay = document.getElementById('chat-display');
const waveContainer = document.getElementById('wave-container');
const syncBtn = document.getElementById('sync-contacts');
const micToggleBtn = document.getElementById('mic-toggle');
const listeningStatus = document.getElementById('listening-status');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsBackdrop = document.getElementById('settings-backdrop');
const closeSettingsBtn = document.getElementById('close-settings');
const naturalConversationToggle = document.getElementById('natural-conversation-toggle');
const muteModeToggle = document.getElementById('mute-mode-toggle');
const longMemoryToggle = document.getElementById('long-memory-toggle');
const clearMemoryBtn = document.getElementById('clear-memory');
const modeToggleBtn = document.getElementById('mode-toggle');

let phoneContacts = [];
let isListening = false;
let isShirleyActive = false;
let silenceTimer;
let audioContext, analyser, dataArray;
let conversationHistory = [];
let bars = [];
let activeTimer = null;
let timerEndTime = null;
let settings = {
  naturalConversation: true,
  mute: false,
  longMemory: true
};

/********************************************************************
 *  זיכרון (localStorage)
 ********************************************************************/
const SETTINGS_KEY = 'shirley_settings_v1';
const MEMORY_KEY = 'shirley_long_memory_v1';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      settings = { ...settings, ...parsed };
    }
  } catch {}
  naturalConversationToggle.checked = settings.naturalConversation;
  muteModeToggle.checked = settings.mute;
  longMemoryToggle.checked = settings.longMemory;
  modeToggleBtn.textContent = settings.naturalConversation ? '💬 מצב: שיחה טבעית' : '🎯 מצב: תשובה יחידה';
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function loadLongMemory() {
  if (!settings.longMemory) return null;
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLongMemory(memoryObj) {
  if (!settings.longMemory) return;
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memoryObj));
  } catch {}
}

/********************************************************************
 *  עיצוב גלים
 ********************************************************************/
function createBars() {
  for (let i = 0; i < 25; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    waveContainer.appendChild(bar);
    bars.push(bar);
  }
}

async function setupAudioVisualizer(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 64;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  function animate() {
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    bars.forEach((bar, i) => {
      const val = dataArray[i] || 0;
      const height = Math.max(4, (val / 255) * 80);
      bar.style.height = `${height}px`;
    });
    requestAnimationFrame(animate);
  }
  animate();
}

/********************************************************************
 *  זיהוי דיבור
 ********************************************************************/
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'he-IL';
  recognition.continuous = true;
  recognition.interimResults = true;
}

function appendMessage(text, type) {
  const msg = document.createElement('div');
  msg.className = `chat-message ${type}`;
  msg.textContent = text;
  chatDisplay.appendChild(msg);
  chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function setListeningUI(active) {
  isListening = active;
  document.body.classList.toggle('listening-active', active);
  micToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  listeningStatus.textContent = active ? 'מקשיבה...' : 'ממתינה להפעלה...';
}

function startRecognition() {
  if (!recognition || isListening) return;
  try {
    recognition.start();
    setListeningUI(true);
  } catch (e) {}
}

function stopRecognition() {
  if (!recognition || !isListening) return;
  try {
    recognition.stop();
    setListeningUI(false);
  } catch (e) {}
}

if (recognition) {
  recognition.onend = () => {
    if (isListening && settings.naturalConversation) {
      setTimeout(() => {
        try { recognition.start(); } catch (e) {}
      }, 400);
    }
  };

  recognition.onresult = (event) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += transcript;
      else interim += transcript;
    }

    const text = (final || interim).trim();
    if (!text) return;

    if (final) appendMessage(`שמעתי: ${final}`, 'user');

    clearTimeout(silenceTimer);

    const wordCount = text.split(/\s+/).length;
    let waitMs = 2200;
    if (wordCount > 4) waitMs = 1600;

    silenceTimer = setTimeout(() => {
      handleSpeech(text);
    }, waitMs);
  };
}

/********************************************************************
 *  פקודות מערכת
 ********************************************************************/
function getHebrewDate() {
  const date = new Date();
  return date.toLocaleDateString('he-IL-u-ca-hebrew', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function openUrlInNewTab(url) {
  window.open(url, '_blank');
}

function handleSystemCommands(text) {
  const lower = text.toLowerCase();

    // מזג אוויר
  if (lower.includes('מזג אוויר') || lower.includes('מה מזג האוויר')) {
    return 'בודקת את מזג האוויר...';
  }

  // שעה
  if (lower.includes('מה השעה')) {
    const now = new Date();
    const time = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return `השעה עכשיו ${time}.`;
  }

  // תאריך לועזי
  if (lower.includes('איזה תאריך') || lower.includes('מה התאריך')) {
    const now = new Date();
    const date = now.toLocaleDateString('he-IL');
    return `היום בתאריך ${date}.`;
  }

  // יום בשבוע
  if (lower.includes('איזה יום') || lower.includes('מה היום')) {
    const now = new Date();
    const weekday = now.toLocaleDateString('he-IL', { weekday: 'long' });
    return `היום יום ${weekday}.`;
  }

  // תאריך עברי
  if (lower.includes('תאריך עברי') || lower.includes('מה היום בלוח השנה העברי')) {
    return `היום בלוח השנה העברי: ${getHebrewDate()}.`;
  }

  // פתיחת שירותים
  if (lower.includes('פתחי ווטסאפ') || lower.includes('פתחי וואטסאפ')) {
    openUrlInNewTab('https://web.whatsapp.com');
    return 'פותחת ווטסאפ.';
  }

  if (lower.includes('פתחי יוטיוב')) {
    openUrlInNewTab('https://www.youtube.com');
    return 'פותחת יוטיוב.';
  }

  if (lower.includes('פתחי פייסבוק')) {
    openUrlInNewTab('https://www.facebook.com');
    return 'פותחת פייסבוק.';
  }

  if (lower.includes('פתחי טלגרם') || lower.includes('טלگرام')) {
    openUrlInNewTab('https://web.telegram.org');
    return 'פותחת טלגרם.';
  }

  if (lower.includes('פתחי גוגל')) {
    openUrlInNewTab('https://www.google.com');
    return 'פותחת גוגל.';
  }

  // "מצלמה" בדפדפן – נדרשת גישה לוידאו (פשוט הסבר)
  if (lower.includes('פתחי מצלמה') || lower.includes('צלמי תמונה')) {
    return 'לא ניתן לפתוח מצלמה ישירות כאפליקציה מהדפדפן, אבל אפשר לבקש גישה למצלמה מתוך אתר מתאים.';
  }

  // ווליום – לא אפשרי לשלוט
  if (lower.includes('הגבירי ווליום') || lower.includes('הנמיכי ווליום')) {
    return 'אני לא יכולה לשלוט בווליום של המכשיר, נסה להשתמש בכפתורי הווליום.';
  }

  // מצב השתקה
  if (lower.includes('השתיקי') || lower.includes('היכנסי למצב שקט')) {
    settings.mute = true;
    muteModeToggle.checked = true;
    saveSettings();
    return 'עברתי למצב שקט. לא אדבר בקול, רק טקסט.';
  }

  if (lower.includes('בטלי השתקה') || lower.includes('צאי ממצב שקט')) {
    settings.mute = false;
    muteModeToggle.checked = false;
    saveSettings();
    return 'מצב השקט בוטל. אחזור לדבר בקול.';
  }

  // טיימר
  if (lower.includes('טיימר')) {
    const match = lower.match(/(\d+)\s*דקות?/);
    if (match) {
      const minutes = parseInt(match[1]);
      timerEndTime = Date.now() + minutes * 60000;

      if (activeTimer) clearInterval(activeTimer);

      activeTimer = setInterval(() => {
        if (Date.now() >= timerEndTime) {
          clearInterval(activeTimer);
          activeTimer = null;
          const text = 'הטיימר הסתיים.';
          appendMessage('⏰ הטיימר הסתיים.', 'ai');
          speak(text);
        }
      }, 1000);

      return `הפעלתי טיימר ל־${minutes} דקות.`;
    }
    return 'כמה דקות להגדיר לטיימר?';
  }

  if (lower.includes('בטלי טיימר') || lower.includes('בטלי את הטיימר')) {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
      return 'הטיימר בוטל.';
    }
    return 'אין טיימר פעיל.';
  }

  if (lower.includes('כמה זמן נשאר')) {
    if (!activeTimer) return 'אין טיימר פעיל.';
    const remaining = Math.max(0, timerEndTime - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `נשארו ${minutes} דקות ו־${seconds} שניות.`;
  }

  return null;
}

/********************************************************************
 *  לוגיקת שיחה
 ********************************************************************/
async function handleSpeech(text) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  // סיום שיחה
  if ((words.includes('ביי') || words.includes('להתראות')) && words.length <= 3) {
    isShirleyActive = false;
    conversationHistory = [];
    speak('להתראות, אני כאן אם תצטרך.');
    appendMessage('להתראות 👋', 'ai');
    if (!settings.naturalConversation) {
      stopRecognition();
    }
    return;
  }

  // פקודות מערכת
  const systemResponse = handleSystemCommands(lower);
  if (systemResponse) {
    appendMessage(systemResponse, 'ai');
    speak(systemResponse);
    return;
  }

  // הפעלה על פי Wake Word
  let cleanCmd = text;
  if (words.includes('שירלי')) {
    isShirleyActive = true;
    cleanCmd = text.replace(/שירלי/gi, '').trim();
  }

  // במצב שיחה טבעית – גם בלי "שירלי"
  if (!words.includes('שירלי') && settings.naturalConversation) {
    isShirleyActive = true;
  }

  if (cleanCmd.trim().length > 0) {
    appendMessage('חושבת...', 'ai');
    await getAIResponse(cleanCmd);
    if (!settings.naturalConversation) {
      // במצב תשובה יחידה – מפסיקים להקשיב אחרי תשובה
      stopRecognition();
    }
  }
}

/********************************************************************
 *  דיבור
 ********************************************************************/
function speak(text) {
  if (settings.mute) return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const cleanText = text
    .replace(/צה"ל/g, 'צהל')
    .replace(/ד"ש/g, 'דש');

  const u = new SpeechSynthesisUtterance(cleanText);
  u.lang = 'he-IL';
  u.rate = 0.95;
  u.pitch = 1.1;

  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find(v => v.lang.includes('he') && (v.name.includes('Google') || v.name.includes('Carmit'))) ||
    voices.find(v => v.lang.includes('he'));
  if (voice) u.voice = voice;

  window.speechSynthesis.speak(u);
}

/********************************************************************
 *  מזג אוויר
 ********************************************************************/
async function getRealWeather() {
  if (!navigator.geolocation) return 'מיקום לא זמין.';
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current_weather=true`
        );
        const data = await res.json();
        resolve(`${Math.round(data.current_weather.temperature)} מעלות.`);
      } catch (e) {
        resolve('מזג האוויר אינו זמין כרגע.');
      }
    }, () => resolve('מיקום חסום.'));
  });
}
  // מזג אוויר — פקודת מערכת מלאה
  if (lower.includes('מזג אוויר') || lower.includes('מה מזג האוויר')) {
    const weather = await getRealWeather();
    appendMessage(`מזג האוויר: ${weather}`, 'ai');
    speak(`מזג האוויר: ${weather}`);
    return;
  }

/********************************************************************
 *  תקשורת עם השרת (AI)
 ********************************************************************/
async function getAIResponse(text) {
  try {
    const weather = text.includes('מזג אוויר') ? await getRealWeather() : '';
    const contactsSummary = phoneContacts
      .map(c => `${c.name?.[0] || ''}:${c.tel?.[0] || ''}`)
      .join(', ');

    const longMemory = loadLongMemory();

    const payload = {
      message: text,
      weather,
      contacts: contactsSummary,
      history: conversationHistory.slice(-8),
      memory: longMemory
    };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    const reply = data.reply || 'לא הצלחתי לחשוב על תשובה כרגע.';
    const newMemory = data.memory || null;

    conversationHistory.push({ role: 'user', content: text });
    conversationHistory.push({ role: 'assistant', content: reply });

    if (newMemory && settings.longMemory) {
      saveLongMemory(newMemory);
    }

    // חיוג
    if (reply.includes('[CALL:')) {
      const match = reply.match(/\[CALL:(.*?)\]/);
      if (match) {
        const phoneNumber = match[1].replace(/\D/g, '');
        if (phoneNumber) {
          const confirmed = confirm(`לחייג אל ${phoneNumber}?`);
          if (confirmed) {
            window.location.href = `tel:${phoneNumber}`;
            return;
          }
        }
      }
    }

    const cleanReply = reply.replace(/\[.*?\]/g, '').trim();
    appendMessage(cleanReply, 'ai');
    speak(cleanReply);
  } catch (e) {
    appendMessage('שגיאת תקשורת עם השרת.', 'ai');
  }
}

/********************************************************************
 *  סנכרון אנשי קשר
 ********************************************************************/
syncBtn.addEventListener('click', async () => {
  if (!navigator.contacts || !navigator.contacts.select) {
    appendMessage('אין תמיכה בסנכרון אנשי קשר בדפדפן זה.', 'ai');
    speak('אין תמיכה בסנכרון אנשי קשר בדפדפן זה.');
    return;
  }

  try {
    const selected = await navigator.contacts.select(['name', 'tel'], { multiple: true });
    phoneContacts = selected;
    appendMessage('סונכרנו אנשי קשר.', 'ai');
    speak('סנכרנתי את אנשי הקשר שלך.');
  } catch (e) {
    appendMessage('לא ניתנה גישה לאנשי קשר.', 'ai');
    speak('לא קיבלתי גישה לאנשי הקשר.');
  }
});

/********************************************************************
 *  כפתור מיקרופון
 ********************************************************************/
micToggleBtn.addEventListener('click', async () => {
  if (!recognition) {
    appendMessage('הדפדפן שלך לא תומך בזיהוי דיבור.', 'ai');
    return;
  }

  if (!isListening) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!audioContext) {
        createBars();
        setupAudioVisualizer(stream);
      }
      startRecognition();
      appendMessage('התחלתי להקשיב.', 'ai');
    } catch (e) {
      appendMessage('חובה לאשר גישה למיקרופון.', 'ai');
    }
  } else {
    stopRecognition();
    appendMessage('הפסקתי להקשיב.', 'ai');
  }
});

/********************************************************************
 *  הגדרות — UI
 ********************************************************************/
settingsBtn.addEventListener('click', () => {
  settingsModal.hidden = false;
});

settingsBackdrop.addEventListener('click', () => {
  settingsModal.hidden = true;
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.hidden = true;
});

naturalConversationToggle.addEventListener('change', () => {
  settings.naturalConversation = naturalConversationToggle.checked;
  modeToggleBtn.textContent = settings.naturalConversation ? '💬 מצב: שיחה טבעית' : '🎯 מצב: תשובה יחידה';
  saveSettings();
});

muteModeToggle.addEventListener('change', () => {
  settings.mute = muteModeToggle.checked;
  saveSettings();
});

longMemoryToggle.addEventListener('change', () => {
  settings.longMemory = longMemoryToggle.checked;
  saveSettings();
});

clearMemoryBtn.addEventListener('click', () => {
  localStorage.removeItem(MEMORY_KEY);
  appendMessage('הזיכרון הארוך נוקה.', 'ai');
});

modeToggleBtn.addEventListener('click', () => {
  settings.naturalConversation = !settings.naturalConversation;
  naturalConversationToggle.checked = settings.naturalConversation;
  modeToggleBtn.textContent = settings.naturalConversation ? '💬 מצב: שיחה טבעית' : '🎯 מצב: תשובה יחידה';
  saveSettings();
});

/********************************************************************
 *  טעינת קולות + הגדרות התחלתיות
 ********************************************************************/
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

loadSettings();