// ===== LOADING =====
const _loadMsgs = ['Warming up the markets…','Briefing Finn the Fox…','Opening the exchange floors…','FinCity is ready!'];

function runLoader(onDone) {
  const bar = document.getElementById('loading-bar');
  const txt = document.getElementById('loading-text');
  let progress = 0, msgIdx = 0;
  const tick = setInterval(() => {
    progress = Math.min(100, progress + Math.random() * 18 + 8);
    bar.style.width = progress + '%';
    const ni = progress < 35 ? 0 : progress < 65 ? 1 : progress < 92 ? 2 : 3;
    if (ni !== msgIdx) { msgIdx = ni; txt.textContent = _loadMsgs[msgIdx]; }
    if (progress >= 100) {
      clearInterval(tick);
      setTimeout(() => { document.getElementById('loading-screen').classList.add('done'); onDone(); }, 500);
    }
  }, 110);
}

// ===== SCROLL REVEAL =====
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal:not(.visible), .reveal-left:not(.visible)').forEach(el => obs.observe(el));
}

// ===== NARRATION =====
const NARR_LANGS = [
  { code:'en', label:'🇺🇸 English',    speech:'en-US' },
  { code:'es', label:'🇪🇸 Español',    speech:'es-ES' },
  { code:'fr', label:'🇫🇷 Français',   speech:'fr-FR' },
  { code:'de', label:'🇩🇪 Deutsch',    speech:'de-DE' },
  { code:'it', label:'🇮🇹 Italiano',   speech:'it-IT' },
  { code:'pt', label:'🇧🇷 Português',  speech:'pt-BR' },
  { code:'ja', label:'🇯🇵 日本語',      speech:'ja-JP' },
  { code:'zh', label:'🇨🇳 中文',        speech:'zh-CN' },
  { code:'ko', label:'🇰🇷 한국어',      speech:'ko-KR' },
  { code:'hi', label:'🇮🇳 हिन्दी',       speech:'hi-IN' },
  { code:'ar', label:'🇸🇦 العربية',     speech:'ar-SA' },
  { code:'ru', label:'🇷🇺 Русский',     speech:'ru-RU' },
];

const NARR_PROFILES = {
  finn:     { pitch: 0.92, rate: 0.87, pause: 650 },
  alex:     { pitch: 1.12, rate: 0.96, pause: 550 },
  narrator: { pitch: 0.83, rate: 0.81, pause: 850 },
};

// ElevenLabs voice IDs per character
const ELEVEN_VOICES = {
  narrator: 'pNInz6obpgDQGcFmaJgB',  // Adam  — deep, authoritative
  finn:     'ErXwobaYiN019PkySvjV',  // Antoni — warm, friendly
  alex:     'MF3mGyEYCl7XYWbV9V6O',  // Elli   — young, energetic
};

const _nc       = {};     // translation cache
const _elCache  = {};     // ElevenLabs audio cache: voiceId||text → blob URL
let   _ns       = { playing: false, idx: 0, dlgs: [], lang: 'en', timer: null };
const _EL_DEFAULT = 'sk_e45db2093c7934b60492dcc4db262eb6fc68acb3e69b6839';
let   _elKey      = sessionStorage.getItem('fincity_el_key') || _EL_DEFAULT;
if (!sessionStorage.getItem('fincity_el_key')) sessionStorage.setItem('fincity_el_key', _EL_DEFAULT);
let   _curAudio = null;   // currently playing <Audio> for ElevenLabs

// ---------- Gemini AI Game Commentary ----------
const _GEMINI_KEY = sessionStorage.getItem("fincity_gemini_key") || "";
let _gcGen = 0;
async function _gcRefresh(charName, topic, situation) {
  const gen = ++_gcGen;
  const el = document.getElementById('gc-ai-text');
  if (!el) return;
  el.innerHTML = `<span style="opacity:.45;font-style:italic;font-size:12px">✨ thinking…</span>`;
  const who = charName.toLowerCase() === 'alex'
    ? 'Alex, an enthusiastic female financial trader and educator'
    : 'Finn, a friendly male financial analyst and educator';
  const prompt = `You are ${who} in a financial education game for beginners. Topic: ${topic}. Situation: ${situation}. Reply with exactly 1-2 casual, encouraging sentences reacting specifically to what just happened (max 28 words). No markdown, no emojis.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${_GEMINI_KEY}`,
      { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:55,temperature:.85} }),
        signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error();
    const d = await res.json();
    const line = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (line && gen === _gcGen) {
      const el2 = document.getElementById('gc-ai-text');
      if (el2) { el2.style.opacity='0'; setTimeout(()=>{ if(document.getElementById('gc-ai-text')===el2){el2.textContent=line;el2.style.transition='opacity .3s';el2.style.opacity='1';} },150); }
    }
  } catch(_) {
    const el2 = document.getElementById('gc-ai-text');
    if (el2 && gen===_gcGen) el2.textContent = el2.dataset.fb || '';
  }
}

// ---------- Translation ----------
async function _ntranslate(text, lang) {
  if (lang === 'en') return text;
  const k = lang + '||' + text;
  if (_nc[k]) return _nc[k];
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=en|${lang}`
    );
    const d = await r.json();
    _nc[k] = d.responseData?.translatedText || text;
    return _nc[k];
  } catch { return text; }
}

// ---------- Web Speech helpers ----------
function _nBestVoice(speechLang) {
  const voices = window.speechSynthesis?.getVoices() || [];
  const base   = speechLang.split('-')[0];
  const pool   = voices.filter(v => v.lang.startsWith(base));
  if (!pool.length) return null;
  return pool.sort((a, b) => {
    const s = v => {
      const n = v.name.toLowerCase();
      return (!n.includes('compact') ? 3 : 0) + (n.includes('neural')   ? 5 : 0)
           + (n.includes('premium')  ? 4 : 0) + (n.includes('enhanced') ? 3 : 0)
           + (!v.localService        ? 2 : 0);
    };
    return s(b) - s(a);
  })[0];
}

// Sentence-chunked Web Speech — each sentence spoken separately with varied prosody
// so it sounds far more natural than one flat utterance per dialogue line.
async function _nWebSpeak(text, prof, langObj, nextIdx) {
  const voice     = _nBestVoice(langObj.speech);
  const sentences = (text.match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g) || [text])
                      .map(s => s.trim()).filter(Boolean);

  window.speechSynthesis.cancel();
  for (let i = 0; i < sentences.length; i++) {
    if (!_ns.playing) return;
    const s   = sentences[i];
    const isQ = s.endsWith('?');
    const isE = s.endsWith('!');
    await new Promise(resolve => {
      const utt  = new SpeechSynthesisUtterance(s);
      if (voice)  utt.voice  = voice;
      utt.lang   = langObj.speech;
      // Fixed pitch per character — only questions raise pitch slightly
      utt.pitch  = Math.max(0.1, prof.pitch + (isQ ? 0.1 : 0));
      // Fixed rate per character — slightly slower on long sentences
      utt.rate   = Math.max(0.1, prof.rate + (s.length > 80 ? -0.04 : 0));
      utt.volume = 1;
      utt.onend  = resolve;
      utt.onerror = resolve;
      window.speechSynthesis.speak(utt);
    });
    // Natural inter-sentence breath gap
    if (i < sentences.length - 1 && _ns.playing)
      await new Promise(r => setTimeout(r, 55 + Math.random() * 105));
  }
  if (_ns.playing) _ns.timer = setTimeout(() => _nSpeak(nextIdx), prof.pause);
}

// ---------- ElevenLabs ----------
function narrToggleAIPanel() {
  const p = document.getElementById('narr-ai-panel');
  if (!p) return;
  const opening = !p.classList.contains('show');
  p.classList.toggle('show');
  if (opening && _elKey) document.getElementById('el-api-key').value = '•'.repeat(16);
}

function narrActivateAI() {
  const val = document.getElementById('el-api-key')?.value.trim() || '';
  if (!val || val.startsWith('•')) return;
  _elKey = val;
  sessionStorage.setItem('fincity_el_key', val);
  const btn = document.getElementById('narr-ai-btn');
  if (btn) { btn.textContent = '✨ AI ✓'; btn.classList.add('active'); }
  document.getElementById('narr-ai-panel')?.classList.remove('show');
  notify('✨ ElevenLabs AI voices activated!', 'ok');
}

function _narrDeactivateAI() {
  _elKey = '';
  sessionStorage.removeItem('fincity_el_key');
  const btn = document.getElementById('narr-ai-btn');
  if (btn) { btn.textContent = '✨ AI'; btn.classList.remove('active'); }
}

async function _elevenSpeak(text, character) {
  const voiceId  = ELEVEN_VOICES[character] || ELEVEN_VOICES.narrator;
  const cacheKey = voiceId + '||' + text;

  if (!_elCache[cacheKey]) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': _elKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability:         character === 'narrator' ? 0.58 : 0.42,
          similarity_boost:  0.82,
          style:             character === 'narrator' ? 0.22 : 0.58,
          use_speaker_boost: true,
        },
      }),
    });
    if (!res.ok) { _narrDeactivateAI(); throw new Error('ElevenLabs ' + res.status); }
    _elCache[cacheKey] = URL.createObjectURL(await res.blob());
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio(_elCache[cacheKey]);
    _curAudio   = audio;
    audio.onended  = () => { _curAudio = null; resolve(); };
    audio.onerror  = () => { _curAudio = null; reject(new Error('audio error')); };
    audio.play().catch(reject);
  });
}

// ---------- Core speak loop ----------
async function _nSpeak(idx) {
  if (!_ns.playing || idx >= _ns.dlgs.length) { narrStop(); return; }
  _ns.idx = idx;
  const d = _ns.dlgs[idx];

  // Highlight + scroll
  document.querySelectorAll('.dialogue').forEach((el, i) => {
    el.classList.toggle('narr-speaking', i === idx);
    if (i === idx) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Status & waveform
  const who = d.who === 'finn' ? '🦊 Finn' : d.who === 'alex' ? '🧑 Alex' : '📝 Narrator';
  const sEl = document.getElementById('narr-status');
  if (sEl) sEl.textContent = `${who} is speaking…`;
  const wEl = document.getElementById('narr-wave');
  if (wEl) wEl.className = `narr-waveform active ${d.who}`;

  // Pre-translate next lines in background
  for (let i = idx + 1; i < Math.min(idx + 3, _ns.dlgs.length); i++)
    _ntranslate(_ns.dlgs[i].text, _ns.lang);

  const text    = await _ntranslate(d.text, _ns.lang);
  const prof    = NARR_PROFILES[d.who] || NARR_PROFILES.narrator;
  const langObj = NARR_LANGS.find(l => l.code === _ns.lang) || NARR_LANGS[0];

  if (_elKey) {
    try {
      await _elevenSpeak(text, d.who);
      if (_ns.playing) _ns.timer = setTimeout(() => _nSpeak(idx + 1), prof.pause);
    } catch { await _nWebSpeak(text, prof, langObj, idx + 1); }
  } else {
    await _nWebSpeak(text, prof, langObj, idx + 1);
  }
}

// ---------- Controls ----------
function narrToggle() {
  if (_ns.playing) {
    _ns.playing = false;
    if (_curAudio) { _curAudio.pause(); }
    else           { window.speechSynthesis.pause(); }
    const b = document.getElementById('narr-play-btn');
    if (b) { b.textContent = '▶'; b.classList.remove('active'); }
    document.getElementById('narr-wave')?.classList.remove('active');
    const s = document.getElementById('narr-status');
    if (s) s.textContent = 'Paused — tap ▶ to continue';
  } else {
    _ns.playing = true;
    const b = document.getElementById('narr-play-btn');
    if (b) { b.textContent = '⏸'; b.classList.add('active'); }
    if (_curAudio)                       { _curAudio.play(); }
    else if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); }
    else                                 { _nSpeak(_ns.idx); }
  }
}

function narrStop() {
  _ns.playing = false;
  _ns.idx     = 0;
  if (_ns.timer) { clearTimeout(_ns.timer); _ns.timer = null; }
  if (_curAudio) { _curAudio.pause(); _curAudio = null; }
  window.speechSynthesis?.cancel();
  const b = document.getElementById('narr-play-btn');
  if (b) { b.textContent = '▶'; b.classList.remove('active'); }
  const w = document.getElementById('narr-wave');
  if (w)  w.className = 'narr-waveform';
  const s = document.getElementById('narr-status');
  if (s)  s.textContent = '🔊 Tap to listen';
  document.querySelectorAll('.dialogue').forEach(el => el.classList.remove('narr-speaking'));
}

function narrChangeLang(code) {
  const was = _ns.playing;
  narrStop();
  _ns.lang = code;
  if (was) setTimeout(narrToggle, 150);
}

function narrFrom(idx) {
  // Clicking the active line's button stops narration; any other line starts from there
  if (_ns.playing && _ns.idx === idx) { narrStop(); return; }
  narrStop();
  _ns.idx = idx;
  _ns.playing = true;
  const b = document.getElementById('narr-play-btn');
  if (b) { b.textContent = '⏸'; b.classList.add('active'); }
  _nSpeak(idx);
}

function narrInitBar(dialogues) {
  _ns.dlgs = dialogues; _ns.playing = false; _ns.idx = 0;
  if (_ns.timer) { clearTimeout(_ns.timer); _ns.timer = null; }
  if (_curAudio) { _curAudio.pause(); _curAudio = null; }
  window.speechSynthesis?.cancel();
  const sel = document.getElementById('narr-lang');
  if (sel) sel.value = _ns.lang;
  // Reflect ElevenLabs active state in button
  const btn = document.getElementById('narr-ai-btn');
  if (btn) { btn.textContent = _elKey ? '✨ AI ✓' : '✨ AI'; btn.classList.toggle('active', !!_elKey); }
}

document.addEventListener('visibilitychange', () => {
  if (!window.speechSynthesis) return;
  if (document.hidden  && _ns.playing) { if (_curAudio) _curAudio.pause(); else window.speechSynthesis.pause(); }
  if (!document.hidden && _ns.playing) { if (_curAudio) _curAudio.play();  else window.speechSynthesis.resume(); }
});

// ===== CONFIG =====
// Paste your Google OAuth 2.0 Client ID here to enable Google SSO.
// Get one at: https://console.cloud.google.com → APIs & Services → Credentials
const GOOGLE_CLIENT_ID = '';

// ===== SESSION TIMEOUT =====
const _IDLE_LIMIT  = 15 * 60 * 1000;   // 15 min → force logout
const _IDLE_WARN   = 13 * 60 * 1000;   // 13 min → show warning
let _idleTimer     = null;
let _warnFired     = false;

function _touchActivity() {
  if (!currentUser) return;
  sessionStorage.setItem('fincity_activity', Date.now().toString());
  if (_warnFired) {
    _warnFired = false;
    document.getElementById('session-warn-banner').classList.remove('show');
  }
}

function _startActivityWatch() {
  _warnFired = false;
  _touchActivity();
  ['mousemove','click','keydown','scroll','touchstart']
    .forEach(ev => document.addEventListener(ev, _touchActivity, { passive: true }));
  _idleTimer = setInterval(_checkIdle, 20_000);
}

function _stopActivityWatch() {
  ['mousemove','click','keydown','scroll','touchstart']
    .forEach(ev => document.removeEventListener(ev, _touchActivity));
  if (_idleTimer) { clearInterval(_idleTimer); _idleTimer = null; }
  document.getElementById('session-warn-banner')?.classList.remove('show');
}

function _checkIdle() {
  if (!currentUser) return;
  const last = parseInt(sessionStorage.getItem('fincity_activity') || '0');
  const idle  = Date.now() - last;

  if (idle >= _IDLE_LIMIT) {
    _stopActivityWatch();
    sessionStorage.removeItem('fincity_session');
    sessionStorage.removeItem('fincity_activity');
    currentUser = null; currentUserKey = null;
    state = { coins: 0, done: [], current: null, phase: 'story', qIdx: 0, qAnswered: false };
    document.getElementById('session-expired-overlay').classList.add('show');
    return;
  }
  if (idle >= _IDLE_WARN && !_warnFired) {
    _warnFired = true;
    const minsLeft = Math.ceil((_IDLE_LIMIT - idle) / 60000);
    document.getElementById('warn-time').textContent = minsLeft;
    document.getElementById('session-warn-banner').classList.add('show');
  }
}

function dismissExpired() {
  document.getElementById('session-expired-overlay').classList.remove('show');
  showScreen('auth');
}

// ===== GOOGLE SSO =====
function initGoogleSSO() {
  if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) return;
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
}

function signInWithGoogle() {
  if (!GOOGLE_CLIENT_ID) {
    document.getElementById('login-error').textContent =
      'Google SSO not configured — add your Client ID in game.js.';
    return;
  }
  if (!window.google?.accounts?.id) {
    document.getElementById('login-error').textContent = 'Google SDK not ready, please wait a moment.';
    return;
  }
  google.accounts.id.prompt();
}

async function handleGoogleCredential(response) {
  try {
    const b64 = response.credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    const { sub, email, name, picture } = JSON.parse(atob(b64));
    const storageKey = 'sso_google_' + sub;
    const users = getUsers();
    if (!users[storageKey]) {
      users[storageKey] = { username: name || email, email, picture, type: 'google', sub, created: Date.now() };
      saveUsers(users);
    }
    startSession(storageKey, users[storageKey].username);
  } catch {
    document.getElementById('login-error').textContent = 'Google sign-in failed. Please try again.';
  }
}

// ===== AUTH =====
let currentUser    = null;   // display name shown in UI
let currentUserKey = null;   // key used for localStorage

async function hashPassword(pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() { return JSON.parse(localStorage.getItem('fincity_users') || '{}'); }
function saveUsers(u) { localStorage.setItem('fincity_users', JSON.stringify(u)); }

function validatePassword(p) {
  const errs = [];
  if (p.length < 8)        errs.push('8+ characters');
  if (!/[A-Z]/.test(p))   errs.push('an uppercase letter');
  if (!/[a-z]/.test(p))   errs.push('a lowercase letter');
  if (!/[0-9]/.test(p))   errs.push('a number');
  return errs;
}

function updatePasswordRules() {
  const p = document.getElementById('reg-password')?.value || '';
  [['rule-len', p.length >= 8], ['rule-upper', /[A-Z]/.test(p)],
   ['rule-lower', /[a-z]/.test(p)], ['rule-num', /[0-9]/.test(p)]].forEach(([id, ok]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (ok ? '✓ ' : '✗ ') + el.dataset.text;
    el.style.color = ok ? 'var(--green)' : 'var(--muted)';
  });
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const errEl    = document.getElementById('reg-error');
  errEl.textContent = '';

  if (username.length < 3 || username.length > 20) {
    errEl.textContent = 'Username must be 3–20 characters.'; return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errEl.textContent = 'Username: only letters, numbers and underscores.'; return;
  }
  const pwErrs = validatePassword(password);
  if (pwErrs.length) { errEl.textContent = 'Password needs: ' + pwErrs.join(', ') + '.'; return; }
  if (password !== confirm) { errEl.textContent = 'Passwords do not match.'; return; }

  const users = getUsers();
  if (users[username.toLowerCase()]) { errEl.textContent = 'Username already taken.'; return; }

  users[username.toLowerCase()] = { username, hash: await hashPassword(password), created: Date.now() };
  saveUsers(users);
  startSession(username.toLowerCase(), username);
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Please enter your username and password.'; return; }

  const users = getUsers();
  const user  = users[username.toLowerCase()];
  if (!user) { errEl.textContent = 'No account found with that username.'; return; }

  if (await hashPassword(password) !== user.hash) {
    errEl.textContent = 'Incorrect password.'; return;
  }
  startSession(username.toLowerCase(), user.username);
}

function startSession(key, displayName) {
  currentUserKey = key;
  currentUser    = displayName || key;
  sessionStorage.setItem('fincity_session', JSON.stringify({ key, displayName: currentUser }));
  load();
  _renderHomeProgress();
  document.getElementById('map-user').textContent = currentUser;
  _startActivityWatch();
  showScreen('home');
}

function _renderHomeProgress() {
  const done  = state.done || [];
  const total = CHAPTERS.length;
  const pct   = total > 0 ? Math.round((done.length / total) * 100) : 0;

  const nextIdx = CHAPTERS.findIndex(ch => !done.includes(ch.id));
  const nextCh  = nextIdx >= 0 ? CHAPTERS[nextIdx] : null;

  const newUserEl  = document.getElementById('home-new-user');
  const dashEl     = document.getElementById('home-welcome');

  if (done.length === 0) {
    // New / fresh user — show original welcome
    newUserEl.style.display = '';
    dashEl.style.display    = 'none';
    return;
  }

  // Returning user — show progress dashboard
  newUserEl.style.display = 'none';
  dashEl.style.display    = '';

  document.getElementById('home-greeting').textContent =
    done.length === total ? `You mastered FinCity, ${currentUser}!` : `Welcome back, ${currentUser}!`;
  document.getElementById('home-coins-display').textContent = `🪙 ${state.coins} FinCoins`;

  // Progress bar — set via rAF so CSS transition fires
  const barEl = document.getElementById('home-prog-bar');
  barEl.style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => { barEl.style.width = pct + '%'; }));
  document.getElementById('home-prog-text').textContent =
    `${done.length} of ${total} chapters complete${done.length === total ? ' — all done! 🏆' : ''}`;

  // Next chapter card
  const nextEl = document.getElementById('home-next-ch');
  if (nextCh) {
    nextEl.innerHTML = `
      <div class="next-ch-label">Up next</div>
      <div class="next-ch-card" onclick="continueGame()">
        <span class="next-ch-icon">${nextCh.icon}</span>
        <div style="flex:1">
          <div class="next-ch-title">${nextCh.title}</div>
          <div class="next-ch-sub">Chapter ${nextCh.num} · ${nextCh.tag}</div>
        </div>
        <span style="color:var(--accent);font-size:20px">→</span>
      </div>`;
    document.getElementById('continue-btn').style.display = 'inline-flex';
  } else {
    nextEl.innerHTML = `<div class="info-box green" style="text-align:center;margin-bottom:20px">🏆 All 15 chapters mastered!</div>`;
    document.getElementById('continue-btn').style.display = 'none';
  }

  // Completed chapters chips
  const doneSection = document.getElementById('home-done-section');
  const chipsEl     = document.getElementById('home-done-chips');
  if (done.length > 0) {
    chipsEl.innerHTML = done.map(id => {
      const ch = CHAPTERS.find(c => c.id === id);
      return ch ? `<span class="done-chip">${ch.icon} ${ch.title}</span>` : '';
    }).join('');
    doneSection.style.display = '';
  } else {
    doneSection.style.display = 'none';
  }
}

function continueGame() {
  const done  = state.done || [];
  const nextCh = CHAPTERS.find(ch => !done.includes(ch.id));
  if (nextCh) openChapter(nextCh.id);
  else showMap();
}

function logout() {
  _stopActivityWatch();
  sessionStorage.removeItem('fincity_session');
  sessionStorage.removeItem('fincity_activity');
  currentUser = null; currentUserKey = null;
  state = { coins: 0, done: [], current: null, phase: 'story', qIdx: 0, qAnswered: false };
  showScreen('auth');
}

function showAuthTab(tab) {
  document.getElementById('form-login').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tab-login').className    = 'auth-tab' + (tab === 'login'    ? ' active' : '');
  document.getElementById('tab-register').className = 'auth-tab' + (tab === 'register' ? ' active' : '');
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent   = '';
}

function checkSession() {
  const raw = sessionStorage.getItem('fincity_session');
  if (!raw) return;
  try {
    const { key, displayName } = JSON.parse(raw);
    if (key) { startSession(key, displayName); return; }
  } catch {}
  startSession(raw, raw); // legacy: raw was just a username string
}

// ===== STATE =====
let state = {
  coins: 0,
  done: [],
  current: null,
  phase: 'story',
  qIdx: 0,
  qAnswered: false
};

function save() {
  if (currentUserKey) localStorage.setItem('fincity_' + currentUserKey, JSON.stringify(state));
}
function load() {
  if (!currentUserKey) return;
  const d = localStorage.getItem('fincity_' + currentUserKey);
  if (d) state = { ...state, ...JSON.parse(d) };
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function startGame() {
  if (state.done && state.done.length > 0) {
    if (!confirm(`Start over? This will reset your ${state.done.length} completed chapter${state.done.length > 1 ? 's' : ''} and ${state.coins} FinCoins.`)) return;
  }
  state.done = []; state.coins = 0; state.current = null;
  save();
  showMap();
}
function showMap() {
  document.getElementById('map-user').textContent = currentUser || '';
  renderMap();
  showScreen('map');
  if (_bagAnimPending) {
    const { from, to } = _bagAnimPending;
    _bagAnimPending = null;
    // Give the SVG a moment to fully render before starting animation
    setTimeout(() => _triggerBagAnim(from, to), 700);
  }
}

// ===== INIT =====
runLoader(checkSession);

// ===== MAP =====

const MAP_PATH_D = "M120,90 L450,90 L780,90 C870,90 870,240 780,240 L450,240 L120,240 C30,240 30,390 120,390 L450,390 L780,390 C870,390 870,540 780,540 L450,540 L120,540 C30,540 30,690 120,690 L450,690 L780,690 C870,690 870,840 780,840 L450,840 L120,840 C30,840 30,990 120,990 L450,990 L780,990 C870,990 870,1140 780,1140 L450,1140 L120,1140";

const MAP_POS = [
  [120,90],[450,90],[780,90],
  [780,240],[450,240],[120,240],
  [120,390],[450,390],[780,390],
  [780,540],[450,540],[120,540],
  [120,690],[450,690],[780,690],
  [780,840],[450,840],[120,840],
  [120,990],[450,990],[780,990],
  [780,1140],[450,1140],[120,1140]
];

// 23 chapters across 8 rows (last row only uses 2 of 3 slots)
const MAP_OFFSETS = [0,0.052,0.105,0.128,0.180,0.233,0.256,0.308,0.361,0.384,0.436,0.489,0.512,0.564,0.616,0.640,0.692,0.744,0.767,0.820,0.872,0.895,0.948];

let _bagAnimPending = null;

function renderMap() {
  document.getElementById('map-coins').textContent = state.coins;
  document.getElementById('map-prog').textContent  = state.done.length + '/' + CHAPTERS.length;

  const nodesHTML = CHAPTERS.map((ch, i) => {
    const [cx, cy] = MAP_POS[i];
    const done     = state.done.includes(ch.id);
    const unlocked = i === 0 || state.done.includes(CHAPTERS[i - 1].id);
    const isNext   = !done && unlocked;
    const r        = 36;
    const label    = ch.title.length > 14 ? ch.title.slice(0, 13) + '…' : ch.title;
    const click    = unlocked ? `onclick="openChapter('${ch.id}')"` : '';
    const cursor   = unlocked ? 'pointer' : 'default';

    if (done) return `
      <g style="cursor:pointer" ${click}>
        <circle cx="${cx}" cy="${cy}" r="${r+18}" fill="rgba(0,200,150,.06)" stroke="none"/>
        <circle cx="${cx}" cy="${cy}" r="${r+9}"  fill="rgba(0,200,150,.07)" stroke="rgba(0,200,150,.18)" stroke-width="1"/>
        <circle cx="${cx}" cy="${cy}" r="${r}"    fill="url(#mn-done)" stroke="#00c896" stroke-width="2.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r-7}"  fill="none" stroke="rgba(0,200,150,.2)" stroke-width="1"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="20">${ch.icon}</text>
        <circle cx="${cx+r-3}" cy="${cy-r+3}" r="12" fill="url(#mn-gold)"/>
        <text x="${cx+r-3}" y="${cy-r+3}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#1a0e00" font-weight="900">✓</text>
        <text x="${cx}" y="${cy+r+17}" text-anchor="middle" font-size="12.5" fill="#3dffa0" font-weight="700" font-family="system-ui,sans-serif">${label}</text>
        <text x="${cx}" y="${cy+r+32}" text-anchor="middle" font-size="10"   fill="#1e7a50" font-family="system-ui,sans-serif">Ch.${ch.num}</text>
        <text x="${cx}" y="${cy+r+46}" text-anchor="middle" font-size="9.5" fill="#00c896" opacity=".75" font-family="system-ui,sans-serif">↩ Review</text>
      </g>`;

    if (isNext) return `
      <g style="cursor:pointer" ${click}>
        <circle cx="${cx}" cy="${cy}" r="${r+22}" fill="rgba(124,109,250,.03)" stroke="rgba(124,109,250,.15)" stroke-width="1">
          <animate attributeName="r"       values="${r+14};${r+26};${r+14}" dur="2.4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".8;.08;.8"               dur="2.4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${cx}" cy="${cy}" r="${r+10}" fill="rgba(124,109,250,.06)" stroke="rgba(124,109,250,.3)" stroke-width="1.5">
          <animate attributeName="r"       values="${r+6};${r+14};${r+6}"   dur="2.4s" begin="0.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values=".9;.15;.9"               dur="2.4s" begin="0.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${cx}" cy="${cy}" r="${r}"   fill="url(#mn-next)" stroke="#8a78ff" stroke-width="2.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r-7}" fill="none" stroke="rgba(160,144,255,.25)" stroke-width="1"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="20">${ch.icon}</text>
        <text x="${cx}" y="${cy+r+17}" text-anchor="middle" font-size="12.5" fill="#d0c0ff" font-weight="700" font-family="system-ui,sans-serif">${label}</text>
        <text x="${cx}" y="${cy+r+32}" text-anchor="middle" font-size="10"   fill="#6858c0" font-family="system-ui,sans-serif">Ch.${ch.num}</text>
      </g>`;

    return `
      <g style="cursor:${cursor}" ${click}>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0c0c20" stroke="#282848" stroke-width="1.5"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="20" opacity=".28">${ch.icon}</text>
        <text x="${cx}" y="${cy+8}" text-anchor="middle" font-size="13" opacity=".45">🔒</text>
        <text x="${cx}" y="${cy+r+17}" text-anchor="middle" font-size="12" fill="#6060a0" font-family="system-ui,sans-serif">${label}</text>
        <text x="${cx}" y="${cy+r+32}" text-anchor="middle" font-size="10" fill="#3a3a68" font-family="system-ui,sans-serif">Ch.${ch.num}</text>
      </g>`;
  }).join('');

  const g = document.getElementById('chapters-grid');
  g.innerHTML = `
    <div class="map-frame">
    <svg id="map-svg" viewBox="0 0 900 1240" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
      <defs>
        <!-- Progress path gradient -->
        <linearGradient id="mn-pg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#7c6dfa"/>
          <stop offset="55%"  stop-color="#9870f4"/>
          <stop offset="100%" stop-color="#00c896"/>
        </linearGradient>
        <!-- Done node fill -->
        <radialGradient id="mn-done" cx="38%" cy="30%" r="70%">
          <stop offset="0%"   stop-color="#1e5a38"/>
          <stop offset="100%" stop-color="#071510"/>
        </radialGradient>
        <!-- Next node fill -->
        <radialGradient id="mn-next" cx="38%" cy="30%" r="70%">
          <stop offset="0%"   stop-color="#321870"/>
          <stop offset="100%" stop-color="#0e0826"/>
        </radialGradient>
        <!-- Gold ✓ badge -->
        <linearGradient id="mn-gold" x1="20%" y1="10%" x2="80%" y2="90%">
          <stop offset="0%"   stop-color="#ffe566"/>
          <stop offset="100%" stop-color="#c88000"/>
        </linearGradient>
        <!-- Path glow filter -->
        <filter id="mn-pglow" filterUnits="userSpaceOnUse" x="0" y="0" width="900" height="780">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <!-- Money bag glow -->
        <filter id="mn-bglow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <!-- Background grid pattern -->
        <pattern id="mn-grid" width="55" height="55" patternUnits="userSpaceOnUse">
          <path d="M55,0 L0,0 0,55" fill="none" stroke="#14143a" stroke-width="0.7"/>
        </pattern>
        <!-- Vignette -->
        <radialGradient id="mn-vig" cx="50%" cy="50%" r="72%">
          <stop offset="58%"  stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(4,4,18,0.75)"/>
        </radialGradient>
      </defs>

      <!-- Base + grid + vignette -->
      <rect width="900" height="1240" fill="#080816"/>
      <rect width="900" height="1240" fill="url(#mn-grid)"/>
      <rect width="900" height="1240" fill="url(#mn-vig)"/>

      <!-- Subtle city-block shapes -->
      <g fill="none" stroke="#1c1c44" stroke-width="0.7" opacity="0.55">
        <rect x="178" y="108" width="234" height="114" rx="4"/>
        <rect x="488" y="108" width="234" height="114" rx="4"/>
        <rect x="178" y="258" width="234" height="114" rx="4"/>
        <rect x="488" y="258" width="234" height="114" rx="4"/>
        <rect x="178" y="408" width="234" height="114" rx="4"/>
        <rect x="488" y="408" width="234" height="114" rx="4"/>
        <rect x="178" y="558" width="234" height="114" rx="4"/>
        <rect x="488" y="558" width="234" height="114" rx="4"/>
        <rect x="178" y="708" width="234" height="114" rx="4"/>
        <rect x="488" y="708" width="234" height="114" rx="4"/>
        <rect x="178" y="858" width="234" height="114" rx="4"/>
        <rect x="488" y="858" width="234" height="114" rx="4"/>
        <rect x="178" y="1008" width="234" height="114" rx="4"/>
        <rect x="488" y="1008" width="234" height="114" rx="4"/>
      </g>

      <!-- Street-corner circles (give a real city-map feel) -->
      <g fill="none" stroke="#1e1e46" stroke-width="0.8" opacity="0.4">
        <circle cx="870" cy="165" r="75"/> <circle cx="30"  cy="315" r="75"/>
        <circle cx="870" cy="465" r="75"/> <circle cx="30"  cy="615" r="75"/>
        <circle cx="870" cy="765" r="75"/> <circle cx="30"  cy="915" r="75"/>
        <circle cx="870" cy="1065" r="75"/> <circle cx="30" cy="1065" r="75"/>
      </g>

      <!-- City landmark icons -->
      <text x="40"  y="60"  font-size="28" opacity=".32">🏦</text>
      <text x="826" y="60"  font-size="28" opacity=".32">🏢</text>
      <text x="40"  y="178" font-size="22" opacity=".26">🌳</text>
      <text x="834" y="178" font-size="22" opacity=".26">🏪</text>
      <text x="40"  y="328" font-size="22" opacity=".26">🏛️</text>
      <text x="834" y="328" font-size="22" opacity=".26">🌿</text>
      <text x="40"  y="478" font-size="22" opacity=".26">🏗️</text>
      <text x="834" y="478" font-size="22" opacity=".26">🏦</text>
      <text x="40"  y="628" font-size="22" opacity=".26">🌳</text>
      <text x="834" y="628" font-size="22" opacity=".26">🏢</text>

      <!-- Compass rose (bottom-right) -->
      <g transform="translate(854,728)" opacity=".4">
        <circle r="18" fill="none" stroke="#2e2e60" stroke-width="1.2"/>
        <text x="0" y="-6"  text-anchor="middle" font-size="9" fill="#6060a0">N</text>
        <text x="0" y="14"  text-anchor="middle" font-size="9" fill="#6060a0">S</text>
        <text x="-12" y="4" text-anchor="middle" font-size="9" fill="#6060a0">W</text>
        <text x="12"  y="4" text-anchor="middle" font-size="9" fill="#6060a0">E</text>
        <line x1="0" y1="-14" x2="0" y2="14" stroke="#404070" stroke-width="0.8"/>
        <line x1="-14" y1="0" x2="14" y2="0" stroke="#404070" stroke-width="0.8"/>
      </g>

      <!-- FINCITY watermark -->
      <text x="40"  y="778" font-size="22" opacity=".26">🏦</text>
      <text x="834" y="778" font-size="22" opacity=".26">🌳</text>
      <text x="40"  y="928" font-size="22" opacity=".26">🏢</text>
      <text x="834" y="928" font-size="22" opacity=".26">🏛️</text>
      <text x="40"  y="1078" font-size="22" opacity=".26">🌳</text>
      <text x="834" y="1078" font-size="22" opacity=".26">🏗️</text>
      <text x="40"  y="1120" font-size="16" opacity=".22">⚖️ Arb</text>
      <text x="834" y="1120" font-size="16" opacity=".22">🔄 PCP</text>
      <text x="450" y="1222" text-anchor="middle" font-size="11" fill="#28285a"
            font-weight="700" letter-spacing="6" font-family="system-ui,sans-serif">🏙️  F I N C I T Y</text>

      <!-- Dashed background path -->
      <path d="${MAP_PATH_D}" fill="none" stroke="#1e1e44" stroke-width="8"
            stroke-dasharray="0 9999"/>
      <path d="${MAP_PATH_D}" fill="none" stroke="#282860" stroke-width="6"
            stroke-dasharray="14 9" stroke-linecap="round"/>

      <!-- Progress path glow (blurred) -->
      <path id="mn-glow" d="${MAP_PATH_D}" fill="none" stroke="url(#mn-pg)"
            stroke-width="11" stroke-linecap="round" stroke-dasharray="0 9999"
            opacity=".35" filter="url(#mn-pglow)"/>

      <!-- Progress path (crisp) -->
      <path id="map-prog-line" d="${MAP_PATH_D}" fill="none" stroke="url(#mn-pg)"
            stroke-width="5" stroke-linecap="round" stroke-dasharray="0 9999"/>

      <!-- Hidden path for animateMotion -->
      <path id="map-anim-path" d="${MAP_PATH_D}" fill="none" stroke="none"/>

      <!-- Chapter nodes (rendered above path) -->
      ${nodesHTML}

      <!-- Money bag -->
      <g id="map-bag" opacity="0">
        <circle r="24" fill="rgba(245,197,24,.2)" stroke="rgba(255,220,60,.6)" stroke-width="2"
                filter="url(#mn-bglow)"/>
        <text font-size="26" text-anchor="middle" dominant-baseline="middle">💰</text>
        <animateMotion id="map-bag-motion" dur="2s" fill="freeze" begin="indefinite"
                       keyPoints="0;0.001" keyTimes="0;1" calcMode="linear" rotate="auto">
          <mpath href="#map-anim-path"/>
        </animateMotion>
        <animate id="map-bag-fade" attributeName="opacity" begin="indefinite" dur="2s"
                 fill="freeze" values="0;1;1;1;0" keyTimes="0;0.06;0.5;0.94;1"/>
      </g>
    </svg>
    </div>`;

  // Animate progress path length in after SVG is painted
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const ref  = document.getElementById('map-anim-path');
    const line = document.getElementById('map-prog-line');
    const glow = document.getElementById('mn-glow');
    if (!ref) return;
    const total   = ref.getTotalLength ? ref.getTotalLength() : 3880;
    const doneIdx = state.done.length - 1;
    if (doneIdx >= 0) {
      const upTo = Math.min(doneIdx + 1, CHAPTERS.length - 1);
      const da   = `${total * MAP_OFFSETS[upTo]} ${total + 200}`;
      if (line) line.setAttribute('stroke-dasharray', da);
      if (glow) glow.setAttribute('stroke-dasharray', da);
    }
  }));
}

function _triggerBagAnim(fromIdx, toIdx) {
  const motionEl = document.getElementById('map-bag-motion');
  const fadeEl   = document.getElementById('map-bag-fade');
  if (!motionEl || !fadeEl) return;
  motionEl.setAttribute('keyPoints', `${MAP_OFFSETS[fromIdx]};${MAP_OFFSETS[toIdx]}`);
  motionEl.beginElement();
  fadeEl.beginElement();
  setTimeout(() => _sparkleNode(toIdx), 1900);
}

function _sparkleNode(idx) {
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  const [cx, cy] = MAP_POS[idx];
  const ns = 'http://www.w3.org/2000/svg';
  [[0,'#00c896'],[200,'#7c6dfa'],[400,'#00c896']].forEach(([delay, color]) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy);
    c.setAttribute('r', '38'); c.setAttribute('fill', 'none');
    c.setAttribute('stroke', color); c.setAttribute('stroke-width', '2.5');
    const aR = document.createElementNS(ns, 'animate');
    aR.setAttribute('attributeName', 'r');
    aR.setAttribute('values', '38;82'); aR.setAttribute('dur', '0.85s');
    aR.setAttribute('begin', `${delay}ms`); aR.setAttribute('fill', 'freeze');
    const aO = document.createElementNS(ns, 'animate');
    aO.setAttribute('attributeName', 'opacity');
    aO.setAttribute('values', '0.9;0'); aO.setAttribute('dur', '0.85s');
    aO.setAttribute('begin', `${delay}ms`); aO.setAttribute('fill', 'freeze');
    c.appendChild(aR); c.appendChild(aO);
    svg.appendChild(c);
    setTimeout(() => c.remove(), delay + 1000);
  });
}

// ===== CHAPTER =====
function openChapter(id) {
  narrStop();
  state.current = id;
  state.phase = 'story';
  state.qIdx = 0;
  state.qAnswered = false;
  save();
  const ch = CHAPTERS.find(c => c.id === id);
  const isReview = state.done.includes(id);
  document.getElementById('ch-icon').textContent = ch.icon;
  document.getElementById('ch-title').textContent = ch.title;
  document.getElementById('ch-sub').textContent = `Chapter ${ch.num} · ${ch.tag}${isReview ? ' · ↩ Review' : ''}`;
  document.getElementById('ch-coins').textContent = state.coins;
  renderPhase();
  showScreen('chapter');
}

function renderPhase() {
  const ch = CHAPTERS.find(c => c.id === state.current);
  // Phase nav
  const phases = [
    { key: 'story', label: '📖 Story' },
    { key: 'interactive', label: '🎮 Play' },
    { key: 'quiz', label: '🧠 Quiz' }
  ];
  document.getElementById('phase-nav').innerHTML = phases.map((p, i) => {
    const idx = phases.findIndex(x => x.key === state.phase);
    const cls = p.key === state.phase ? 'active' : (i < idx ? 'done' : '');
    return `<span class="phase-step ${cls}">${p.label}</span>${i < 2 ? '<span class="phase-arrow">›</span>' : ''}`;
  }).join('');

  const content = document.getElementById('ch-content');
  if (state.phase === 'story') renderStory(ch, content);
  else if (state.phase === 'interactive') renderInteractive(ch, content);
  else if (state.phase === 'quiz') renderQuiz(ch, content);
}

// ===== STORY =====
function renderStory(ch, el) {
  el.innerHTML = `
    <div class="view-toggle-row">
      <div class="view-toggle">
        <button class="vt-btn active">📖 Story</button>
        <button class="vt-btn" onclick="goInteractive()">🎮 Game</button>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="goQuiz()">🧠 Quiz →</button>
    </div>
    <div class="narr-bar" id="narr-bar">
      <button class="narr-play-btn" id="narr-play-btn" onclick="narrToggle()" title="Play / Pause narration">▶</button>
      <button class="narr-stop-btn" onclick="narrStop()" title="Stop">⏹</button>
      <div class="narr-waveform" id="narr-wave">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <span class="narr-status" id="narr-status">🔊 Tap to listen</span>
      <select id="narr-lang" class="narr-select" onchange="narrChangeLang(this.value)">
        ${NARR_LANGS.map(l => `<option value="${l.code}">${l.label}</option>`).join('')}
      </select>
      <button class="narr-ai-btn" id="narr-ai-btn" onclick="narrToggleAIPanel()" title="Enable AI voices (ElevenLabs)">✨ AI</button>
    </div>
    <div class="narr-ai-panel" id="narr-ai-panel">
      <div style="font-size:13px;font-weight:700;margin-bottom:6px">🎙️ ElevenLabs AI Voice</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Ultra-realistic neural voices — Narrator: Adam · Finn: Antoni · Alex: Elli</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input id="el-api-key" type="password" placeholder="Paste your ElevenLabs API key here"
          style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:9px 13px;color:var(--text);font-size:13px;outline:none;font-family:inherit;transition:border-color .18s"
          onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'"
          onkeydown="if(event.key==='Enter')narrActivateAI()">
        <button class="btn btn-primary btn-sm" onclick="narrActivateAI()">Activate</button>
      </div>
      <div style="font-size:11px;color:var(--muted)">
        Free tier: 10,000 chars/month · <a href="https://elevenlabs.io" target="_blank" rel="noopener" style="color:var(--accent2)">Get API key at elevenlabs.io</a>
      </div>
    </div>
    <div class="ch-body">
      <div class="panel">
        <div class="panel-label">Story</div>
        <div class="scene-box">${ch.scene}</div>
        ${ch.dialogues.map((d, i) => `
          <div class="dialogue reveal" style="transition-delay:${i * 55}ms">
            <div class="dlg-header">
              <div class="dlg-who ${d.who}">${d.who === 'finn' ? '🦊 Finn' : d.who === 'alex' ? '🧑 Alex' : '📝 Narrator'}</div>
              <button class="dlg-speak-btn" onclick="narrFrom(${i})" title="Listen to this line">🔊</button>
            </div>
            <div class="dlg-text ${d.who}">${d.text}</div>
          </div>
        `).join('')}
      </div>
      <div class="panel reveal" style="transition-delay:120ms">
        <div class="panel-label">Key Concept</div>
        <div class="concept-box">
          <h4>💡 What You'll Learn</h4>
          <p>${ch.concept}</p>
        </div>
      </div>
    </div>`;
  narrInitBar(ch.dialogues);
  requestAnimationFrame(initReveal);
}

function goInteractive() {
  narrStop();
  state.phase = 'interactive';
  save();
  renderPhase();
}

function goStory() {
  state.phase = 'story';
  save();
  renderPhase();
}

// ===== INTERACTIVE =====
function renderInteractive(ch, el) {
  el.innerHTML = `
    <div class="view-toggle-row">
      <div class="view-toggle">
        <button class="vt-btn" onclick="goStory()">📖 Story</button>
        <button class="vt-btn active">🎮 Game</button>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="goQuiz()">🧠 Quiz →</button>
    </div>
    <div id="interactive-main" class="panel" style="min-height:420px">
      <div class="panel-label">Interactive Demo</div>
      <div id="game-area"></div>
    </div>`;

  const area = document.getElementById('game-area');
  const games = {
    'equity': initEquityGame,
    'inflation': initInflationGame,
    'bonds': initBondsGame,
    'credit': initCreditGame,
    'taxes': initTaxGame,
    'arbitrage': initArbitrageGame,
    'options-basics': initOptionsBasicsGame,
    'put-call-parity': initPutCallGame,
    'stock-market': initStockGame,
    'bid-ask': initBidAskGame,
    'trading': initTradingGame,
    'dividends': initDividendsGame,
    'portfolio': initPortfolioGame,
    'volatility': initVolatilityGame,
    'interest-rates': initInterestGame,
    'fx-market': initFXGame,
    'commodities': initCommodityGame,
    'derivatives': initDerivativesGame,
    'options': initOptionsGame,
    'payoffs': initPayoffsGame,
    'hedging': initHedgingGame,
    'otc': initOTCGame,
    'crypto': initCryptoGame
  };
  if (games[ch.id]) games[ch.id](area);
}

function goQuiz() {
  narrStop();
  state.phase = 'quiz';
  state.qIdx = 0;
  state.qAnswered = false;
  save();
  renderPhase();
}

// ===== INTERACTIVE GAMES =====

// ── Shared helpers ──────────────────────────────────────────────
function _char(name, mood, text) {
  const p = name.toLowerCase() === 'alex'
    ? { emoji:'👩‍💻', col:'#00c896', bg:'rgba(0,200,150,.1)' }
    : { emoji:'🧑‍💼', col:'#7c6dfa', bg:'rgba(124,109,250,.1)' };
  const moods = { happy:'😄', worried:'😰', thinking:'🤔', excited:'🤩', sad:'😢', cool:'😎', money:'🤑', angry:'😤' };
  const m = moods[mood] || '';
  const safe = text.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return `<div class="gc">
    <div class="gc-av" style="background:${p.bg};border-color:${p.col}">${p.emoji}${m?`<span class="gc-mood">${m}</span>`:''}</div>
    <div class="gc-bubble"><div class="gc-name" style="color:${p.col}">${name.charAt(0).toUpperCase()+name.slice(1)} <span style="font-size:9px;opacity:.4;font-weight:400">✨ AI</span></div><div class="gc-text" id="gc-ai-text" data-fb="${safe}">${text}</div></div>
  </div>`;
}
function _goal(text, cur, max, reward) {
  const pct = max ? Math.min(100,(cur/max)*100) : 0;
  const done = max && cur >= max;
  return `<div class="gp"><div class="gp-row">
    <span style="font-size:16px">${done?'🏆':'🎯'}</span>
    <span style="flex:1;font-size:13px;font-weight:600;color:${done?'var(--green)':'var(--text)'}">${text}</span>
    ${reward?`<span style="font-size:11px;background:rgba(255,197,0,.12);border:1px solid rgba(255,197,0,.25);border-radius:20px;padding:2px 8px;color:var(--gold)">🪙 +${reward}</span>`:''}
  </div>${max?`<div class="gp-bar"><div class="gp-fill" style="width:${pct}%"></div></div>`:''}</div>`;
}
function _sc3(a,b,c) {
  return `<div class="sc sc-3">${[a,b,c].map(x=>`<div class="sc-item"><div class="sc-label">${x[0]}</div><div class="sc-value" style="color:${x[2]||'var(--text)'}">${x[1]}</div></div>`).join('')}</div>`;
}
function _sc2(a,b) {
  return `<div class="sc sc-2">${[a,b].map(x=>`<div class="sc-item"><div class="sc-label">${x[0]}</div><div class="sc-value" style="color:${x[2]||'var(--text)'}">${x[1]}</div></div>`).join('')}</div>`;
}
function _win(emoji, title, msg) {
  setTimeout(_confetti, 80);
  return `<div class="gwin"><div style="font-size:48px;margin-bottom:6px">${emoji}</div><div style="font-size:21px;font-weight:900;color:var(--green);margin-bottom:5px">${title}</div><div style="font-size:13px;color:var(--muted);line-height:1.5">${msg}</div></div>`;
}

// ── Animation Helpers ────────────────────────────────────────────
function _coins(n=6){
  const cx=window.innerWidth*.45+Math.random()*100, cy=window.innerHeight*.42;
  for(let i=0;i<n;i++){
    const el=document.createElement('span');
    el.textContent='🪙';
    el.style.cssText=`position:fixed;left:${cx+(Math.random()-.5)*60}px;top:${cy+(Math.random()-.5)*30}px;font-size:${15+Math.random()*10}px;pointer-events:none;z-index:9999;animation:coinFloat ${0.55+Math.random()*.5}s ease-out ${i*.07}s forwards`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),1400);
  }
}

function _confetti(){
  const cols=['#7c6dfa','#00c896','#f5c518','#ff6080','#4fc3f7','#ff9f43','#a29bfe','#fd79a8'];
  for(let i=0;i<48;i++){
    const el=document.createElement('div');
    el.style.cssText=`position:fixed;width:${5+Math.random()*9}px;height:${5+Math.random()*11}px;background:${cols[i%cols.length]};left:${Math.random()*100}vw;top:-20px;z-index:9999;pointer-events:none;border-radius:${Math.random()>.5?'50%':'2px'};animation:confettiFall ${1.4+Math.random()*2.2}s linear ${Math.random()*.9}s forwards`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),5000);
  }
}

function _shakeGame(){
  const el=document.getElementById('game-area');
  if(!el)return;
  el.style.animation='none'; void el.offsetHeight;
  el.style.animation='gcShake .45s ease';
  setTimeout(()=>el.style.animation='',500);
}

function _bounceChar(){
  const av=document.querySelector('#game-area .gc-av');
  if(!av)return;
  av.style.animation='none'; void av.offsetHeight;
  av.style.animation='gcCharBounce .55s ease';
  setTimeout(()=>av.style.animation='',650);
}

function _flashGame(type='up'){
  const el=document.getElementById('game-area');
  if(!el)return;
  el.style.animation='none'; void el.offsetHeight;
  el.style.animation=`flash${type==='up'?'Green':'Red'} .65s ease`;
  setTimeout(()=>el.style.animation='',750);
}

function _floatNum(text, isPos=true){
  const el=document.createElement('div');
  el.textContent=text;
  el.style.cssText=`position:fixed;left:50%;top:43%;font-size:26px;font-weight:900;color:${isPos?'#00c896':'#ff6080'};pointer-events:none;z-index:9999;text-shadow:0 2px 14px ${isPos?'rgba(0,200,150,.55)':'rgba(255,96,128,.55)'};animation:gameFloatUp 1s ease-out forwards`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1050);
}

function _popEl(id){
  const el=document.getElementById(id);
  if(!el)return;
  el.style.animation='none'; void el.offsetHeight;
  el.style.animation='numPop .38s ease';
  setTimeout(()=>el.style.animation='',450);
}
// ────────────────────────────────────────────────────────────────

function initStockGame(el) {
  let budget=500, shares=0, price=50, day=1, hist=[50], lastNews='', won=false;
  const NEWS=[
    {txt:'🍌 New tropical market opens!', d:+9},
    {txt:'😰 Competitor cuts prices', d:-7},
    {txt:'⛈️ Weather damages crop', d:-11},
    {txt:'📊 Record quarterly profit!', d:+13},
    {txt:'🤝 Partnership with MegaMart!', d:+16},
    {txt:'😬 CEO steps down suddenly', d:-9},
    {txt:'💊 BananaCo enters health drinks!', d:+7},
    {txt:'🌍 Global supply chain issues', d:-6},
  ];
  function total(){ return budget + shares*price; }
  function mood(){ const t=total(); if(t>=750)return'excited'; if(t>=620)return'happy'; if(t<=400)return'worried'; return'thinking'; }
  function charLine(){
    const t=total();
    if(won) return `You did it! We turned $500 into $${t.toFixed(0)}! That's what smart trading looks like! 🚀`;
    if(shares===0&&budget===500) return `Hey! I'm Finn, your stock broker. Goal: grow your $500 to $750. Click 📰 News to advance a trading day!`;
    if(price<35) return `Price is really low... that's a buying opportunity! Buy now and wait for it to recover!`;
    if(price>75) return `Whoa, price is pumping! This might be a great time to sell some shares and lock in profits.`;
    if(t<450) return `We're down... don't panic-sell. Wait for good news!`;
    return `Total portfolio: $${t.toFixed(0)}. Goal is $750 — keep trading smart!`;
  }
  function render(){
    const t=total(); won=t>=750;
    const mini=hist.slice(-18);
    const mn=Math.min(...mini),mx=Math.max(...mini),span=mx-mn||1;
    const W=220,H=45;
    const pts=mini.map((p,i)=>`${(i/(mini.length-1||1))*W},${H-5-(p-mn)/span*(H-10)}`).join(' ');
    const trend=hist.length>1&&price>=hist[hist.length-2];
    el.innerHTML=`
      ${_goal('Grow $500 → $750 by trading BananaCo stock', t-500, 250, 50)}
      ${_char('Finn', mood(), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:13px;margin-bottom:11px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div>
            <div style="font-size:11px;color:var(--muted)">🍌 BananaCo · Day ${day}</div>
            <div style="font-size:30px;font-weight:900;color:var(--gold)">$${price}</div>
            <div style="font-size:11px;color:${trend?'var(--green)':'var(--red)'}">${trend?'▲ rising':'▼ falling'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--muted)">Portfolio Value</div>
            <div style="font-size:18px;font-weight:700;color:${t>=500?'var(--green)':'var(--red)'}">$${t.toFixed(0)}</div>
            <div style="font-size:11px;color:var(--muted)">${((t-500)/500*100).toFixed(1)}% return</div>
          </div>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">
          <polyline points="${pts}" fill="none" stroke="${trend?'#00c896':'#ff6080'}" stroke-width="2.2" stroke-linejoin="round"/>
          <circle cx="${W}" cy="${H-5-(price-mn)/span*(H-10)}" r="3.5" fill="var(--gold)"/>
        </svg>
        ${lastNews?`<div style="font-size:11px;color:var(--muted);margin-top:7px;padding:5px 8px;background:rgba(255,255,255,.04);border-radius:6px">📰 ${lastNews}</div>`:''}
      </div>
      ${_sc3(['💵 Cash','$'+budget,'var(--green)'],['📦 Shares',shares,'var(--gold)'],['📈 Holding','$'+(shares*price).toFixed(0),'var(--accent2)'])}
      ${won ? _win('🏆','Goal Reached!',`You turned $500 into $${t.toFixed(0)} — a ${((t-500)/500*100).toFixed(1)}% return!`) : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <button class="btn btn-green" onclick="sgBuy(1)" ${budget<price?'disabled':''} style="padding:12px 8px">🟢 Buy 1<br><span style="font-size:11px;opacity:.75">Cost: $${price}</span></button>
        <button class="btn btn-red" onclick="sgSell(1)" ${shares===0?'disabled':''} style="padding:12px 8px">🔴 Sell 1<br><span style="font-size:11px;opacity:.75">Get: $${price}</span></button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        <button class="btn btn-ghost btn-sm" onclick="sgBuy(5)" ${budget<price*5?'disabled':''}>Buy ×5</button>
        <button class="btn btn-primary btn-sm btn-pulse" onclick="sgNews()">📰 News Day</button>
        <button class="btn btn-ghost btn-sm" onclick="sgSell(5)" ${shares<5?'disabled':''}>Sell ×5</button>
      </div>`}`;
    window.sgBuy=n=>{const k=Math.min(n,Math.floor(budget/price));if(k>0){budget-=k*price;shares+=k;render();_coins(3);_bounceChar();_floatNum(`+${k} share${k>1?'s':''}`,true);}};
    window.sgSell=n=>{const k=Math.min(n,shares);if(k>0){budget+=k*price;shares-=k;render();_bounceChar();_floatNum(`+$${(k*price).toFixed(0)}`,true);}};
    window.sgNews=()=>{
      const ev=NEWS[Math.floor(Math.random()*NEWS.length)];
      price=Math.max(10,price+ev.d);
      hist.push(price); day++;
      lastNews=ev.txt;
      render();
      if(ev.d>0){_bounceChar();_flashGame('up');_floatNum(`📈 +$${ev.d}`,true);}
      else{_shakeGame();_flashGame('dn');_floatNum(`📉 -$${Math.abs(ev.d)}`,false);}
      _gcRefresh('finn','stock market investing',`News: "${ev.txt}" moved BananaCo to $${price}. User has ${shares} shares ($${(shares*price).toFixed(0)}), $${budget} cash. Total portfolio: $${total().toFixed(0)}.`);
    };
  }
  render();
}

function initBidAskGame(el) {
  let trades=0, totalSpreadCost=0, lastAction=null;
  const scenarios=[
    {bid:48,ask:52,stock:'🍌 BananaCo'},
    {bid:99,ask:101,stock:'🍎 ApplePie Inc'},
    {bid:19,ask:25,stock:'☕ BrewCoin'},
  ];
  let idx=0;
  function render(){
    const sc=scenarios[idx];
    const spread=(sc.ask-sc.bid).toFixed(2);
    const won=trades>=3;
    el.innerHTML=`
      ${_goal('Complete 3 trades — spot the spread cost each time', trades, 3, 40)}
      ${_char('Alex', won?'money':lastAction?'thinking':'cool',
        won ? `Great work! Over ${trades} trades you paid $${totalSpreadCost.toFixed(0)} in spread costs. That's why traders care about tight spreads!` :
        lastAction==='buy' ? `You paid the ASK ($${sc.ask}) — that's $${(sc.ask-((sc.bid+sc.ask)/2)).toFixed(2)} above mid-price. Spread went to the market maker!` :
        lastAction==='sell' ? `You received the BID ($${sc.bid}) — $${(((sc.bid+sc.ask)/2)-sc.bid).toFixed(2)} below mid-price. Same $${(sc.ask-sc.bid)/2} slice taken!` :
        `I'm Alex, a market maker. See how the BID (buy price) and ASK (sell price) differ? That gap is my profit! Try buying or selling.`
      )}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px">${sc.stock} Order Book</div>
        <div class="orderbook">
          <div class="ob-side">
            <div class="ob-label ask">ASKS (Sellers want)</div>
            <div class="ob-row"><span class="price ask">$${(sc.ask+2).toFixed(2)}</span><span style="color:var(--muted)">180 sh</span></div>
            <div class="ob-row"><span class="price ask">$${(sc.ask+1).toFixed(2)}</span><span style="color:var(--muted)">240 sh</span></div>
            <div class="ob-row" style="background:rgba(255,96,128,.08);border-radius:6px"><span class="price ask" style="font-size:15px">$${sc.ask.toFixed(2)}</span><span style="color:var(--muted)">150 sh ←best</span></div>
          </div>
          <div class="ob-side">
            <div class="ob-label bid">BIDS (Buyers pay)</div>
            <div class="ob-row" style="background:rgba(0,200,150,.08);border-radius:6px"><span class="price bid" style="font-size:15px">$${sc.bid.toFixed(2)}</span><span style="color:var(--muted)">300 sh ←best</span></div>
            <div class="ob-row"><span class="price bid">$${(sc.bid-1).toFixed(2)}</span><span style="color:var(--muted)">220 sh</span></div>
            <div class="ob-row"><span class="price bid">$${(sc.bid-2).toFixed(2)}</span><span style="color:var(--muted)">190 sh</span></div>
          </div>
        </div>
        <div style="display:flex;justify-content:center;gap:16px;margin-top:10px;font-size:13px">
          <span>Spread: <b style="color:var(--gold)">$${spread}</b></span>
          <span>Mid-price: <b style="color:var(--muted)">$${((sc.bid+sc.ask)/2).toFixed(2)}</b></span>
        </div>
      </div>
      ${won ? _win('🏆','Market Master!',`You completed all trades and paid $${totalSpreadCost.toFixed(0)} in spread costs. Tight spreads matter — even $1 per trade adds up fast!`) : `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="btn btn-green" onclick="baGo('buy')" style="padding:12px">🛒 BUY<br><span style="font-size:11px;opacity:.75">You pay ask: $${sc.ask}</span></button>
        <button class="btn btn-red" onclick="baGo('sell')" style="padding:12px">💸 SELL<br><span style="font-size:11px;opacity:.75">You get bid: $${sc.bid}</span></button>
      </div>`}
      ${_sc2(['💸 Spread Cost Paid','$'+totalSpreadCost.toFixed(0),'var(--red)'],['✅ Trades Done',trades+'/3','var(--green)'])}`;
    window.baGo=action=>{
      const cost=(sc.ask-sc.bid)/2;
      totalSpreadCost+=cost;
      trades++;
      lastAction=action;
      if(idx<scenarios.length-1)idx++;
      render();
      _bounceChar();
      if(action==='buy'){_flashGame('up');_floatNum(`BUY @ $${sc.ask}`,true);}
      else{_flashGame('dn');_floatNum(`SELL @ $${sc.bid}`,false);}
      _gcRefresh('alex','bid-ask spread and market making',`User just did a ${action} order. Spread was $${(sc.ask-sc.bid).toFixed(2)}, paid $${cost.toFixed(2)} to market maker. Total spread cost so far: $${totalSpreadCost.toFixed(2)}.`);
    };
  }
  render();
}

function initTradingGame(el) {
  let marketPrice=50, orders=[], limitPrice=45, orderType='market', badge={market:false,limit:false};
  function doneCount(){ return orders.filter(o=>o.filled).length; }
  function charLine(){
    if(badge.market&&badge.limit) return `You nailed it! Market order = instant fill, limit order = waits for your price. Two essential tools!`;
    if(badge.market) return `Market order done! Now switch to Limit Order, set a price BELOW market, then drop the price to fill it!`;
    if(doneCount()===0) return `I'm Finn, a rookie trader learning order types. Help me place a Market order first — it fills instantly at any price!`;
    return `Good job! Try the other order type too.`;
  }
  function render(){
    const won=badge.market&&badge.limit;
    el.innerHTML=`
      ${_goal('Place both a Market order AND a filled Limit order', doneCount(), 2, 40)}
      ${_char('Finn', won?'excited':badge.market?'happy':'thinking', charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-size:11px;color:var(--muted)">🍌 BananaCo</div>
            <div style="font-size:28px;font-weight:900;color:var(--gold)">$${marketPrice}</div>
          </div>
          <div style="display:flex;gap:8px">
            <span style="font-size:20px" title="Market order">${badge.market?'✅':'⬜'} Market</span>
            <span style="font-size:20px" title="Limit order">${badge.limit?'✅':'⬜'} Limit</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-sm ${orderType==='market'?'btn-primary':'btn-ghost'}" style="flex:1" onclick="tgOT('market')">⚡ Market Order</button>
          <button class="btn btn-sm ${orderType==='limit'?'btn-primary':'btn-ghost'}" style="flex:1" onclick="tgOT('limit')">⏳ Limit Order</button>
        </div>
        ${orderType==='market'?`
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">⚡ Fills <b>immediately</b> at the current market price. No waiting!</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-green" onclick="tgMarket('buy')">🟢 Buy @ $${marketPrice}</button>
            <button class="btn btn-red" onclick="tgMarket('sell')">🔴 Sell @ $${marketPrice}</button>
          </div>
        `:`
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">⏳ Only fills if price reaches <b style="color:var(--gold)">$${limitPrice}</b>. Set it <b>below</b> market price for a buy.</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Limit price: <b style="color:var(--gold)">$${limitPrice}</b> · Market: $${marketPrice}</div>
          <input type="range" min="30" max="${marketPrice-1}" value="${limitPrice}" oninput="tgLP(this.value)" style="margin-bottom:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-primary" onclick="tgPlaceLimit()">Place Limit Buy @ $${limitPrice}</button>
            <button class="btn btn-ghost btn-sm" onclick="tgDrop()">📉 Drop Price $3</button>
          </div>
        `}
      </div>
      ${won?_win('🏆','Order Types Mastered!','You can now place instant market orders and patient limit orders — two fundamental trading tools.'):''}
      <div style="margin-top:10px">
        ${orders.slice(0,4).map(o=>`
          <div style="display:flex;align-items:center;gap:8px;background:var(--card2);border-radius:8px;padding:8px 10px;margin-bottom:6px;border-left:3px solid ${o.filled?'var(--green)':'var(--gold)'}">
            <span style="font-size:14px">${o.filled?'✅':'⏳'}</span>
            <span style="font-size:12px;flex:1;color:var(--text)"><b>${o.type.toUpperCase()}</b> ${o.action} · ${o.filled?'Filled @ $'+o.price:'Waiting for $'+o.target+' (now: $'+marketPrice+')'}</span>
          </div>`).join('')}
      </div>`;
    window.tgOT=t=>{orderType=t;render();};
    window.tgLP=v=>{limitPrice=parseInt(v);render();};
    window.tgMarket=a=>{orders.unshift({type:'market',action:a,price:marketPrice,filled:true});badge.market=true;notify('⚡ Market '+a+' filled @ $'+marketPrice,'ok');render();};
    window.tgPlaceLimit=()=>{
      if(limitPrice>=marketPrice){notify('Set limit BELOW market price!','bad');return;}
      orders.unshift({type:'limit',action:'buy',target:limitPrice,price:null,filled:false});
      render();
    };
    window.tgDrop=()=>{
      marketPrice=Math.max(25,marketPrice-3);
      orders=orders.map(o=>{if(!o.filled&&o.type==='limit'&&marketPrice<=o.target){o.filled=true;o.price=o.target;badge.limit=true;notify('✅ Limit order filled @ $'+o.target,'ok');}return o;});
      render();
    };
  }
  render();
}

function initDividendsGame(el) {
  let shares=50, price=40, div=0, collected=0, quarters=0;
  function annual(){ return shares*div; }
  function yld(){ return price>0?(div/price*100).toFixed(2):'0.00'; }
  function mood(){ if(annual()>=500)return'money'; if(annual()>=200)return'happy'; if(div>0)return'thinking'; return'neutral'; }
  function charLine(){
    if(annual()>=500) return `$${annual().toFixed(0)}/year — I don't even need to go to work anymore! This is PASSIVE INCOME. 🤑`;
    if(div===0) return `I'm Alex. Dividends are cash a company pays you just for owning shares. Drag the slider to set a dividend and watch the magic!`;
    if(shares<100) return `$${annual().toFixed(0)}/year is a start! Buy more shares to scale up your passive income.`;
    return `${shares} shares × $${div.toFixed(2)} each = $${annual().toFixed(0)}/year. That's ${yld()}% yield. Keep building!`;
  }
  function coinRow(n){
    const coins=Math.min(10,Math.floor(n/5));
    return '🪙'.repeat(Math.max(1,coins));
  }
  function render(){
    const won=annual()>=500;
    el.innerHTML=`
      ${_goal('Build $500/year in dividend income', annual(), 500, 50)}
      ${_char('Alex', mood(), charLine())}
      ${_sc3(['📦 Shares',shares,'var(--accent2)'],['💵 Price','$'+price,'var(--gold)'],['📬 Div/Share','$'+div.toFixed(2),'var(--green)'])}
      <div style="background:var(--card2);border-radius:12px;padding:16px;text-align:center;margin-bottom:12px;position:relative;overflow:hidden">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Annual Dividend Income</div>
        <div style="font-size:40px;font-weight:900;color:${div>0?'var(--green)':'var(--muted)'};margin-bottom:2px">$${annual().toFixed(0)}</div>
        <div style="font-size:13px;color:var(--muted)">Yield: <b style="color:var(--gold)">${yld()}%</b> · Quarterly: <b style="color:var(--green)">$${(annual()/4).toFixed(0)}</b></div>
        ${div>0?`<div style="font-size:18px;margin-top:8px;letter-spacing:2px">${coinRow(annual())}</div>`:''}
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">💰 Dividend per share: <b style="color:var(--green)">$${div.toFixed(2)}</b></div>
        <input type="range" min="0" max="5" step="0.25" value="${div}" oninput="dvSet(this.value)">
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px">
        <button class="btn btn-ghost btn-sm" onclick="dvShares(-10)">−10 shares</button>
        <button class="btn btn-ghost btn-sm" onclick="dvShares(10)">+10 shares</button>
        <button class="btn btn-ghost btn-sm" onclick="dvPrice(-5)">Price −$5</button>
        <button class="btn btn-ghost btn-sm" onclick="dvPrice(5)">Price +$5</button>
      </div>
      ${div>0?`<button class="btn btn-green" style="width:100%;margin-bottom:8px" onclick="dvCollect()">💸 Collect Quarterly Dividend</button>`:''}
      ${collected>0?`<div style="font-size:12px;color:var(--muted);text-align:center">Total collected: <b style="color:var(--gold)">$${collected.toFixed(0)}</b> over ${quarters} quarters</div>`:''}
      ${won?_win('🏆','Passive Income Machine!',`You're earning $${annual().toFixed(0)}/year — money while you sleep! This is the power of dividend investing.`):''}`;
    window.dvSet=v=>{div=parseFloat(v);render();};
    window.dvShares=n=>{shares=Math.max(0,shares+n);render();};
    window.dvPrice=n=>{price=Math.max(5,price+n);render();};
    window.dvCollect=()=>{const q=annual()/4;collected+=q;quarters++;notify('💸 Collected $'+q.toFixed(0)+' dividend!','ok');render();_coins(8);_bounceChar();_floatNum(`+$${q.toFixed(0)} 💸`,true);_gcRefresh('alex','dividend investing and passive income',`Just collected $${q.toFixed(0)} quarterly dividend. ${shares} shares at $${div.toFixed(2)}/share = $${annual().toFixed(0)}/yr. ${yld()}% yield. Total collected: $${collected.toFixed(0)}.`);};
  }
  render();
}

function initPortfolioGame(el) {
  const ASSETS=[
    {name:'🍌 BananaCo Stock',pct:40,color:'#7c6dfa',risk:8},
    {name:'🥇 Gold',pct:20,color:'#f5c518',risk:4},
    {name:'⛽ Energy',pct:15,color:'#ff6080',risk:7},
    {name:'🏛️ FinCity Bonds',pct:15,color:'#00c896',risk:2},
    {name:'💵 Cash',pct:10,color:'#4fc3f7',risk:1},
  ];
  function total(){ return ASSETS.reduce((s,a)=>s+a.pct,0); }
  function riskScore(){ return ASSETS.reduce((s,a)=>s+a.pct*a.risk/100,0).toFixed(1); }
  function charLine(t,rs){
    if(t===100&&parseFloat(rs)<=4.5) return `This is a well-diversified, balanced portfolio! Low risk, spread across 5 asset classes. Smart move! 💼`;
    if(t===100&&parseFloat(rs)>6) return `It's fully allocated, but 100% in risky assets is dangerous. Add more bonds and cash to reduce your risk score.`;
    if(t===100) return `Perfectly allocated at 100%! Risk score is ${rs}/10 — a bit high but manageable. Well done.`;
    if(t>100) return `Uh oh — you're ${t}% which is over 100%! Reduce some allocations.`;
    return `You've allocated ${t}% so far. Reach exactly 100% to build a valid portfolio. Try to keep risk score below 5!`;
  }
  function render(){
    const t=total(), rs=riskScore(), won=t===100&&parseFloat(rs)<=4.5;
    const svgSize=120, r=50, cx=60, cy=60;
    let ang=-Math.PI/2, paths='';
    ASSETS.forEach(a=>{
      if(a.pct===0)return;
      const slice=(a.pct/100)*Math.PI*2;
      const ea=ang+slice;
      const x1=cx+r*Math.cos(ang),y1=cy+r*Math.sin(ang);
      const x2=cx+r*Math.cos(ea),y2=cy+r*Math.sin(ea);
      paths+=`<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${slice>Math.PI?1:0},1 ${x2},${y2} Z" fill="${a.color}" opacity=".88"/>`;
      ang=ea;
    });
    el.innerHTML=`
      ${_goal('Allocate exactly 100% with risk score ≤ 4.5', parseFloat(rs)<=4.5&&t===100?1:0, 1, 50)}
      ${_char('Finn', won?'excited':t>100?'worried':t===100?'happy':'thinking', charLine(t,rs))}
      <div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px">
        <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="flex-shrink:0">
          ${paths}
          <circle cx="${cx}" cy="${cy}" r="26" fill="var(--card)"/>
          <text x="${cx}" y="${cy-4}" text-anchor="middle" fill="var(--text)" font-size="10">${t}%</text>
          <text x="${cx}" y="${cy+9}" text-anchor="middle" fill="${parseFloat(rs)>5?'#ff6080':'#00c896'}" font-size="9">Risk ${rs}</text>
        </svg>
        <div style="flex:1">
          ${ASSETS.map((a,i)=>`<div style="margin-bottom:7px">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
              <span>${a.name}</span><span style="color:${a.color};font-weight:700">${a.pct}%</span>
            </div>
            <input type="range" min="0" max="80" value="${a.pct}" oninput="pfSet(${i},this.value)" style="accent-color:${a.color}">
          </div>`).join('')}
          <div style="font-size:12px;margin-top:4px;color:${t===100?'var(--green)':t>100?'var(--red)':'var(--gold)'}">
            ${t===100?'✅ Fully allocated':'⚠️ Total: '+t+'% (need 100%)'}
          </div>
        </div>
      </div>
      ${_sc2(['📊 Total Allocated',t+'%',t===100?'var(--green)':'var(--red)'],['⚠️ Risk Score',rs+'/10',parseFloat(rs)<=4.5?'var(--green)':'var(--accent2)'])}
      ${won?_win('🏆','Diversification Master!','Perfectly balanced portfolio with low risk. You understand diversification!'):''}`;
    window.pfSet=(i,v)=>{ASSETS[i].pct=parseInt(v);render();};
  }
  render();
}

function initVolatilityGame(el) {
  function gen(start,vol){let p=[start],v=start;for(let i=0;i<59;i++){v=Math.max(5,v+(Math.random()-.5)*vol*2);p.push(+v.toFixed(1));}return p;}
  const DATA={
    stable:{label:'🏛️ Gov Bond',prices:gen(100,.5),color:'#00c896',risk:'Low',desc:'Government bonds barely move. Boring but safe — your $100 stays close to $100.'},
    growth:{label:'🍌 BananaCo',prices:gen(100,4),color:'#7c6dfa',risk:'Medium',desc:'A solid company stock. Some swings, but generally tracks business performance.'},
    crypto:{label:'🚀 MoonCoin',prices:gen(100,14),color:'#f5c518',risk:'Extreme',desc:'Crypto can double or crash -70% in weeks. High potential, massive downside too!'},
  };
  let mode='stable', seen=new Set(['stable']), chose=null;
  function charLine(){
    if(chose) return chose==='stable'?`Good choice for safety! Low swings. But returns are small too — bond yields ~3-5%.`:
      chose==='growth'?`Balanced pick! Stocks can grow 8-12%/yr on average but dip hard in recessions.`:
      `Brave! 😅 MoonCoin is pure speculation. You could 10x or lose everything.`;
    if(seen.size===3) return `You've seen all 3 risk profiles! Which one matches your risk appetite? Click "I'd invest here!" to commit.`;
    return `I'm Alex. Volatility = how wildly a price swings. Compare all 3 assets, then choose which you'd invest in!`;
  }
  function render(){
    const d=DATA[mode];
    const prices=d.prices, mn=Math.min(...prices), mx=Math.max(...prices), span=mx-mn||1;
    const last=prices[prices.length-1];
    const swing=((mx-mn)/prices[0]*100).toFixed(1);
    const chg=((last-prices[0])/prices[0]*100).toFixed(1);
    const W=280,H=100,pad=8;
    const pts=prices.map((p,i)=>`${pad+i*(W-2*pad)/59},${pad+(mx-p)/span*(H-2*pad)}`).join(' ');
    el.innerHTML=`
      ${_goal('Compare all 3 assets, then pick your investment', seen.size, 3, 40)}
      ${_char('Alex', chose?'cool':seen.size===3?'thinking':'thinking', charLine())}
      <div style="display:flex;gap:6px;margin-bottom:10px">
        ${Object.entries(DATA).map(([k,v])=>`
          <button class="btn btn-sm ${mode===k?'btn-primary':'btn-ghost'}" style="flex:1;font-size:11px" onclick="vlMode('${k}')">${v.label}</button>`).join('')}
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-weight:700;color:${d.color}">${d.label}</span>
          <span style="font-size:12px;padding:2px 8px;border-radius:10px;background:${d.risk==='Low'?'rgba(0,200,150,.15)':d.risk==='Medium'?'rgba(124,109,250,.15)':'rgba(255,197,0,.15)'};color:${d.risk==='Low'?'var(--green)':d.risk==='Medium'?'var(--accent)':'var(--gold)'}">Risk: ${d.risk}</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">
          <polyline points="${pts}" fill="none" stroke="${d.color}" stroke-width="2.2" stroke-linejoin="round"/>
          <circle cx="${W-pad}" cy="${pad+(mx-last)/span*(H-2*pad)}" r="4" fill="${d.color}"/>
          <line x1="${pad}" y1="${pad+(mx-prices[0])/span*(H-2*pad)}" x2="${W-pad}" y2="${pad+(mx-prices[0])/span*(H-2*pad)}" stroke="rgba(255,255,255,.1)" stroke-width="1" stroke-dasharray="3,3"/>
        </svg>
        <div style="font-size:11px;color:var(--muted);margin-top:6px">${d.desc}</div>
      </div>
      ${_sc3(['📊 Price Swing',swing+'%',d.color],['📈 Net Change',(chg>0?'+':'')+chg+'%',parseFloat(chg)>=0?'var(--green)':'var(--red)'],['⚠️ Risk',d.risk,d.color])}
      ${!chose?`<button class="btn btn-primary" style="width:100%;margin-top:4px" onclick="vlChoose()">✅ I'd invest in ${d.label}!</button>`:''}
      ${chose?_win('🏆','Risk Assessed!',`You chose ${DATA[chose].label} — ${chose==='stable'?'safety first!':chose==='growth'?'balanced approach!':'high risk, high reward!'}`):''}`;
    window.vlMode=k=>{mode=k;seen.add(k);render();};
    window.vlChoose=()=>{chose=mode;render();};
  }
  render();
}

function initInterestGame(el) {
  let principal=1000, rate=7, years=20, raceYear=0, racing=false, raceTimer=null;
  function comp(y){ return principal*Math.pow(1+rate/100,y); }
  function simp(y){ return principal*(1+rate*y/100); }
  function extra(){ return (comp(years)-simp(years)).toFixed(0); }
  function charLine(){
    if(years>=20&&rate>=7) return `See that gap? At ${years} years, compound beats simple by $${extra()}! Einstein called compound interest the 8th wonder of the world. 🤯`;
    if(raceYear>0) return `Watch the race! 🏁 Finn uses simple interest, Alex uses compound. Same rate — totally different results!`;
    return `I'm Alex. Let's race! Same $${principal.toLocaleString()} at ${rate}% — but I reinvest my interest. Finn doesn't. Watch who wins!`;
  }
  function pct(y){ const mx=Math.max(comp(years),simp(years)); return {c:comp(y)/mx*100, s:simp(y)/mx*100}; }
  function render(){
    const c=comp(years), s=simp(years), extra_=(c-s).toFixed(0);
    const showRace=raceYear>0;
    el.innerHTML=`
      ${_goal(`See compound beat simple by more than $${Math.round(principal*0.5).toLocaleString()}`, Math.max(0,parseFloat(extra_)-principal*0.5), principal, 40)}
      ${_char('Alex', parseFloat(extra_)>500?'excited':raceYear>0?'happy':'thinking', charLine())}
      <div style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">💵 Principal: <b style="color:var(--gold)">$${principal.toLocaleString()}</b></div>
        <input type="range" min="100" max="10000" step="100" value="${principal}" oninput="irP(this.value)">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px;margin-top:8px">📈 Annual Rate: <b style="color:var(--accent2)">${rate}%</b></div>
        <input type="range" min="1" max="20" step=".5" value="${rate}" oninput="irR(this.value)">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px;margin-top:8px">📅 Years: <b style="color:var(--green)">${years}</b></div>
        <input type="range" min="1" max="40" value="${years}" oninput="irY(this.value)">
      </div>
      ${showRace?`
        <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:10px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px;text-align:center">🏁 Year ${raceYear} of ${years}</div>
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>🧑‍💼 Finn (Simple)</span><span style="color:var(--gold)">$${simp(raceYear).toFixed(0)}</span></div>
            <div style="height:14px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct(raceYear).s}%;background:var(--gold);border-radius:4px;transition:width .3s"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>👩‍💻 Alex (Compound)</span><span style="color:var(--green)">$${comp(raceYear).toFixed(0)}</span></div>
            <div style="height:14px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden"><div style="height:100%;width:${pct(raceYear).c}%;background:var(--green);border-radius:4px;transition:width .3s"></div></div>
          </div>
        </div>`:''}
      ${_sc2(['🧑‍💼 Finn (Simple)','$'+s.toFixed(0),'var(--gold)'],['👩‍💻 Alex (Compound)','$'+c.toFixed(0),'var(--green)'])}
      <div style="text-align:center;background:rgba(0,200,150,.08);border:1px solid rgba(0,200,150,.2);border-radius:10px;padding:10px;margin-bottom:10px">
        <div style="font-size:11px;color:var(--muted)">Compound advantage</div>
        <div style="font-size:24px;font-weight:900;color:var(--green)">+$${extra_}</div>
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="irRace()">${racing?'⏹ Stop':'▶ Watch the Race!'}</button>`;
    window.irP=v=>{principal=parseInt(v);render();};
    window.irR=v=>{rate=parseFloat(v);render();};
    window.irY=v=>{years=parseInt(v);raceYear=0;render();};
    window.irRace=()=>{
      if(racing){clearInterval(raceTimer);racing=false;render();return;}
      raceYear=0;racing=true;render();
      raceTimer=setInterval(()=>{
        raceYear=Math.min(raceYear+1,years);
        render();
        if(raceYear>=years){clearInterval(raceTimer);racing=false;setTimeout(()=>{_coins(7);_bounceChar();},200);}
      },200);
    };
  }
  render();
}

function initFXGame(el) {
  const RATES={USD:1,EUR:0.92,GBP:0.79,JPY:149.5,CAD:1.36,INR:83.2};
  const FLAGS={USD:'🇺🇸',EUR:'🇪🇺',GBP:'🇬🇧',JPY:'🇯🇵',CAD:'🇨🇦',INR:'🇮🇳'};
  const CITIES={USD:'New York 🗽',EUR:'Paris 🗼',GBP:'London 🎡',JPY:'Tokyo 🗾',CAD:'Toronto 🍁',INR:'Mumbai 🏙️'};
  let from='USD', to='EUR', amount=100, trips=0;
  function rate(f,t){ return RATES[t]/RATES[f]; }
  function result(){ return (amount*rate(from,to)).toFixed(2); }
  function charLine(){
    if(trips>=3) return `That's ${trips} currency conversions! Every time you convert, the bank takes a tiny cut. Using a card abroad? Same thing — they skim the spread!`;
    if(trips===0) return `I'm Alex, a world traveller! I'm in ${CITIES[from]} with ${FLAGS[from]}${amount} ${from}. Help me convert it for my next destination!`;
    return `Converted! Now in ${CITIES[to]}. Let's keep travelling — try ${trips>=1?'another currency!':'converting more!'}`;
  }
  function render(){
    const res=result(), won=trips>=3;
    const r=rate(from,to);
    el.innerHTML=`
      ${_goal('Complete 3 currency conversions around the world', trips, 3, 40)}
      ${_char('Alex', won?'excited':trips>0?'happy':'cool', charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="text-align:center;margin-bottom:14px">
          <div style="font-size:11px;color:var(--muted)">Amount</div>
          <input type="number" value="${amount}" oninput="fxAmt(this.value)" style="background:transparent;border:none;color:var(--gold);font-size:28px;font-weight:900;width:140px;text-align:center;outline:none">
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
          <div style="font-size:11px;color:var(--muted);width:100%;margin-bottom:2px">FROM</div>
          ${Object.keys(RATES).map(c=>`<button class="btn btn-sm ${from===c?'btn-primary':'btn-ghost'}" onclick="fxFrom('${c}')" style="font-size:12px">${FLAGS[c]} ${c}</button>`).join('')}
        </div>
        <div style="display:flex;align-items:center;justify-content:center;font-size:22px;margin:8px 0">→</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          <div style="font-size:11px;color:var(--muted);width:100%;margin-bottom:2px">TO</div>
          ${Object.keys(RATES).map(c=>`<button class="btn btn-sm ${to===c?'btn-primary':'btn-ghost'}" onclick="fxTo('${c}')" style="font-size:12px">${FLAGS[c]} ${c}</button>`).join('')}
        </div>
        <div style="background:rgba(124,109,250,.08);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:13px;color:var(--muted)">${FLAGS[from]} ${amount} ${from}</div>
          <div style="font-size:11px;color:var(--muted)">÷ ${RATES[from]} × ${RATES[to]} =</div>
          <div style="font-size:32px;font-weight:900;color:var(--accent2)">${FLAGS[to]} ${res} ${to}</div>
          <div style="font-size:11px;color:var(--muted)">1 ${from} = ${r.toFixed(4)} ${to}</div>
        </div>
      </div>
      ${won?_win('🌍','World Traveller!',`You converted across ${trips} borders. Exchange rates affect everything from travel costs to import prices!`):`
      <button class="btn btn-primary" style="width:100%" onclick="fxConvert()">✈️ Convert & Travel to ${CITIES[to]}!</button>`}`;
    window.fxAmt=v=>{amount=parseFloat(v)||0;render();};
    window.fxFrom=c=>{from=c;if(to===c)to=Object.keys(RATES).find(k=>k!==c);render();};
    window.fxTo=c=>{to=c;if(from===c)from=Object.keys(RATES).find(k=>k!==c);render();};
    window.fxConvert=()=>{const newAmt=parseFloat(result());const label=`${FLAGS[to]} ${newAmt.toFixed(0)} ${to}`;from=to;amount=newAmt;trips++;to=Object.keys(RATES).find(k=>k!==from);render();_bounceChar();_floatNum(label,true);};
  }
  render();
}

function initCommodityGame(el) {
  let prices={Gold:1950,Oil:78,Wheat:290,Coffee:185};
  let holdings={Gold:0,Oil:0,Wheat:0,Coffee:0};
  let cash=1000, events=0, lastEvent='';
  const ICONS={Gold:'🥇',Oil:'⛽',Wheat:'🌾',Coffee:'☕'};
  const EVENTS=[
    {txt:'⛈️ Bad harvest in Brazil!',fx:{Wheat:+45,Coffee:+35}},
    {txt:'🛢️ OPEC cuts production!',fx:{Oil:+22}},
    {txt:'💵 USD strengthens sharply',fx:{Gold:-28,Oil:-9}},
    {txt:'🌍 Economic boom globally!',fx:{Oil:+25,Wheat:+12}},
    {txt:'😨 Market panic — flee to gold!',fx:{Gold:+90,Oil:-18}},
    {txt:'☀️ Bumper harvest worldwide',fx:{Wheat:-30,Coffee:-20}},
    {txt:'🔋 Green energy boom',fx:{Oil:-35,Gold:+15}},
  ];
  function pv(){ return Object.keys(holdings).reduce((s,k)=>s+holdings[k]*prices[k],0); }
  function total(){ return cash+pv(); }
  function mood(){ if(total()>=1500)return'money'; if(total()>=1200)return'happy'; if(total()<900)return'worried'; return'thinking'; }
  function charLine(){
    if(total()>=1500) return `$${total().toFixed(0)}! We're commodity kings! 🏆 Buy low, sell high — works for wheat too!`;
    if(events===0) return `I'm Finn on the trading floor! Buy commodities, then trigger a market event — prices will move. Sell high and profit!`;
    if(pv()===0) return `No holdings right now. Buy something before the next event!`;
    return `Portfolio: $${total().toFixed(0)}. Trigger an event to move prices, then sell your winners!`;
  }
  function render(){
    const won=total()>=1500;
    el.innerHTML=`
      ${_goal('Grow $1,000 to $1,500 trading commodities', total()-1000, 500, 50)}
      ${_char('Finn', mood(), charLine())}
      ${_sc2(['💵 Cash','$'+cash.toFixed(0),'var(--green)'],['📦 Holdings','$'+pv().toFixed(0),'var(--gold)'])}
      <div style="background:var(--card2);border-radius:12px;padding:12px;margin-bottom:10px">
        ${Object.keys(prices).map(k=>`
          <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:18px;width:24px">${ICONS[k]}</span>
            <span style="flex:1;font-size:13px;font-weight:600">${k}</span>
            <span style="color:var(--gold);font-weight:700;font-size:14px;width:60px;text-align:right">$${prices[k]}</span>
            <span style="color:var(--muted);font-size:12px;width:30px;text-align:center">${holdings[k]}</span>
            <button class="btn btn-sm btn-green" onclick="cmBuy('${k}')" ${cash<prices[k]?'disabled':''} style="padding:4px 10px">Buy</button>
            <button class="btn btn-sm btn-red" onclick="cmSell('${k}')" ${holdings[k]===0?'disabled':''} style="padding:4px 10px">Sell</button>
          </div>`).join('')}
      </div>
      ${lastEvent?`<div class="info-box gold" style="margin-bottom:10px">📢 ${lastEvent}</div>`:''}
      ${won?_win('🏆','Commodity Trader!',`You turned $1,000 into $${total().toFixed(0)}! Buy before events, sell after — that's commodity trading!`):`
      <button class="btn btn-primary btn-pulse" style="width:100%" onclick="cmEvent()">🎲 Trigger Market Event (${events} triggered)</button>`}`;
    window.cmBuy=k=>{if(cash>=prices[k]){cash-=prices[k];holdings[k]++;render();_coins(2);_floatNum(`+1 ${k}`,true);}};
    window.cmSell=k=>{if(holdings[k]>0){cash+=prices[k];holdings[k]--;render();_floatNum(`+$${prices[k]}`,true);}};
    window.cmEvent=()=>{
      const e=EVENTS[Math.floor(Math.random()*EVENTS.length)];
      const prevTotal=total();
      Object.entries(e.fx).forEach(([k,v])=>{prices[k]=Math.max(10,prices[k]+v);});
      lastEvent=e.txt;events++;render();
      const diff=total()-prevTotal;
      if(diff>=0){_bounceChar();_flashGame('up');_floatNum(`📈 +$${diff.toFixed(0)}`,true);}
      else{_shakeGame();_flashGame('dn');_floatNum(`📉 $${diff.toFixed(0)}`,false);}
      _gcRefresh('finn','commodity trading and market events',`Market event: "${e.txt}". Holdings value: $${pv().toFixed(0)}, cash: $${cash.toFixed(0)}, total: $${total().toFixed(0)}.`);
    };
  }
  render();
}

function initDerivativesGame(el) {
  let underlying=100, leverage=5, scenario=null;
  const SCENARIOS=[
    {label:'📈 Oil rallies +20%',newPrice:120},
    {label:'📉 Oil crashes −30%',newPrice:70},
    {label:'🚀 Oil doubles +100%',newPrice:200},
    {label:'💀 Oil collapses −60%',newPrice:40},
  ];
  function pnl(p){ return (p-100)*leverage; }
  function pct(p){ return ((p-100)/100*100).toFixed(1); }
  function derivPct(p){ return (parseFloat(pct(p))*leverage).toFixed(1); }
  function mood(){
    if(!scenario)return'thinking';
    const p=pnl(underlying);
    if(p>200)return'money';if(p>0)return'happy';if(p<-200)return'sad';return'worried';
  }
  function charLine(){
    if(!scenario) return `I'm Alex. Derivatives let you control a large position with a small deposit. With ${leverage}x leverage, a 10% oil move = ${leverage*10}% for you — both ways!`;
    const p=pnl(underlying);
    if(p>0) return `Oil moved ${pct(underlying)}% and our derivative gained ${derivPct(underlying)}%! Leverage amplified a win. 💰`;
    return `Oil fell ${pct(underlying)}% and we LOST ${Math.abs(derivPct(underlying))}%! Leverage amplifies losses too — this is the danger. ⚠️`;
  }
  function render(){
    const p=pnl(underlying), pctUnd=pct(underlying), pctDeriv=derivPct(underlying);
    const col=p>=0?'var(--green)':'var(--red)';
    const won=scenario!==null;
    el.innerHTML=`
      ${_goal('Experience all 4 leverage scenarios', scenario?1:0, 0, 40)}
      ${_char('Alex', mood(), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">⛽ Oil Price: <b style="color:var(--gold)">$${underlying}</b></div>
        <input type="range" min="20" max="220" value="${underlying}" oninput="dvUnd(this.value)" style="margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">⚡ Leverage: <b style="color:var(--accent2)">${leverage}x</b></div>
        <input type="range" min="1" max="20" value="${leverage}" oninput="dvLev(this.value)">
      </div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-bottom:12px">
        <div style="background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">⛽ Oil Change</div>
          <div style="font-size:22px;font-weight:700;color:${parseFloat(pctUnd)>=0?'var(--green)':'var(--red)'}">${pctUnd}%</div>
          <div style="font-size:11px;color:var(--muted)">$${underlying}/bbl</div>
        </div>
        <div style="font-size:26px;text-align:center">×${leverage}</div>
        <div style="background:var(--card2);border-radius:10px;padding:12px;text-align:center;border:1px solid ${col}40">
          <div style="font-size:10px;color:var(--muted)">📊 Derivative P&L</div>
          <div style="font-size:22px;font-weight:700;color:${col}">${p>=0?'+':''}$${p.toFixed(0)}</div>
          <div style="font-size:11px;color:${col}">${pctDeriv}%</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">📰 Try a scenario:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${SCENARIOS.map(s=>`<button class="btn btn-sm btn-ghost" onclick="dvScene(${s.newPrice})">${s.label}</button>`).join('')}
      </div>`;
    window.dvUnd=v=>{underlying=parseInt(v);scenario='manual';render();};
    window.dvLev=v=>{leverage=parseInt(v);render();};
    window.dvScene=p=>{underlying=p;scenario='scenario';render();};
  }
  render();
}

function initOptionsGame(el) {
  let strike=55, premium=3, spot=50, otype='call', profited=false;
  function payoff(){ return otype==='call'?Math.max(0,spot-strike)-premium:Math.max(0,strike-spot)-premium; }
  function itm(){ return otype==='call'?spot>strike:spot<strike; }
  function breakeven(){ return otype==='call'?strike+premium:strike-premium; }
  function mood(){ const p=payoff(); if(p>5)return'money'; if(p>0)return'happy'; if(p<-1)return'worried'; return'thinking'; }
  function charLine(){
    const p=payoff(), be=breakeven();
    if(profited) return `Yes! P&L +$${p.toFixed(2)} 🎉 Options let you profit from price moves while limiting downside to just the premium you paid.`;
    if(p>0) return `We're in profit! +$${p.toFixed(2)}. The option is in the money — move the expiry price to see different outcomes.`;
    if(itm()) return `Option is In The Money but we haven't broken even yet. Need stock above $${be} to profit.`;
    return `I'm Alex. I bought a ${otype} option: the right to ${otype==='call'?'BUY':'SELL'} at $${strike}. I paid $${premium} premium. Drag the price to see my P&L!`;
  }
  function render(){
    const p=payoff(), col=p>0?'var(--green)':p<0?'var(--red)':'var(--muted)';
    if(p>0) profited=true;
    const W=280,pts=[];
    for(let s=30;s<=90;s+=2){
      const pl=otype==='call'?Math.max(0,s-strike)-premium:Math.max(0,strike-s)-premium;
      pts.push([s,pl]);
    }
    const maxPL=Math.max(...pts.map(x=>x[1])),minPL=Math.min(...pts.map(x=>x[1]));
    const range=maxPL-minPL||1;
    const H=80;
    const svgPts=pts.map(([s,pl])=>`${(s-30)/(60)*W},${H/2-(pl/(range/2))*(H/2*.9)}`).join(' ');
    const spotX=(spot-30)/60*W;
    el.innerHTML=`
      ${_goal('Find a stock price where your option is profitable', profited?1:0, 1, 40)}
      ${_char('Alex', mood(), charLine())}
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-sm ${otype==='call'?'btn-primary':'btn-ghost'}" style="flex:1" onclick="ogType('call')">📈 Call (right to BUY)</button>
        <button class="btn btn-sm ${otype==='put'?'btn-red':'btn-ghost'}" style="flex:1" onclick="ogType('put')">📉 Put (right to SELL)</button>
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:12px;margin-bottom:10px">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;margin-bottom:4px">
          <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
          <polyline points="${svgPts}" fill="none" stroke="var(--accent2)" stroke-width="2.2" stroke-linejoin="round"/>
          <line x1="${spotX}" y1="0" x2="${spotX}" y2="${H}" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4,3"/>
          <circle cx="${spotX}" cy="${H/2-(p/(range/2))*(H/2*.9)}" r="5" fill="${col}"/>
        </svg>
        <div style="font-size:10px;color:var(--muted);text-align:center">← Stock price at expiry → (gold line = current $${spot})</div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">📈 Stock at expiry: <b style="color:var(--accent2)">$${spot}</b></div>
        <input type="range" min="30" max="90" value="${spot}" oninput="ogSpot(this.value)">
        <div style="display:flex;gap:8px;margin-top:8px">
          <div style="flex:1"><div style="font-size:11px;color:var(--muted)">Strike: <b style="color:var(--gold)">$${strike}</b></div><input type="range" min="40" max="70" value="${strike}" oninput="ogStrike(this.value)"></div>
          <div style="flex:1"><div style="font-size:11px;color:var(--muted)">Premium: <b style="color:var(--red)">$${premium}</b></div><input type="range" min="1" max="12" value="${premium}" oninput="ogPrem(this.value)"></div>
        </div>
      </div>
      ${_sc3(['📊 Status',itm()?'In Money ✅':'Out ❌',itm()?'var(--green)':'var(--red)'],['🎯 Break-even','$'+breakeven(),'var(--gold)'],['💰 P&L',(p>0?'+':'')+'$'+p.toFixed(2),col])}
      ${profited?_win('🏆','Profitable Trade!',`Your ${otype} option made +$${p.toFixed(2)}! Key insight: max loss is always limited to the premium paid ($${premium}).`):''}`;
    window.ogType=t=>{otype=t;render();};
    window.ogSpot=v=>{spot=parseInt(v);render();};
    window.ogStrike=v=>{strike=parseInt(v);render();};
    window.ogPrem=v=>{premium=parseInt(v);render();};
  }
  render();
}

function initPayoffsGame(el) {
  let spot=50, challenged=false;
  const INSTRS=[
    {label:'📈 Long Stock',icon:'📈',color:'#7c6dfa',pnl:s=>s-50},
    {label:'☎️ Call ($55K, $3P)',icon:'☎️',color:'#00c896',pnl:s=>Math.max(0,s-55)-3},
    {label:'🛡️ Put ($45K, $2P)',icon:'🛡️',color:'#f5c518',pnl:s=>Math.max(0,45-s)-2},
  ];
  let best=null;
  function charLine(){
    if(best) return `Great! At $${spot}, ${best.label} is best. Different tools win in different market conditions — that's why traders combine them!`;
    if(!challenged) return `I'm Finn. Same stock, 3 different instruments. Drag the price to see how each performs. Figure out when Call > Stock > Put!`;
    return `At $${spot} the payoffs are clear. Try extreme prices — what happens at $20? At $80?`;
  }
  function render(){
    const results=INSTRS.map(r=>({...r,v:r.pnl(spot)}));
    const maxPNL=Math.max(...results.map(r=>r.v));
    best=results.find(r=>r.v===maxPNL);
    const W=280,H=90;
    const ptsAll=INSTRS.map(r=>{
      const arr=[];
      for(let s=20;s<=80;s+=2)arr.push(`${(s-20)/60*W},${H/2-r.pnl(s)/30*35}`);
      return arr.join(' ');
    });
    const spotX=(spot-20)/60*W;
    el.innerHTML=`
      ${_goal('Discover which instrument wins in 3 different price zones', challenged?1:0, 0, 40)}
      ${_char('Finn', best&&best.label.includes('Call')?'excited':best&&best.label.includes('Put')?'happy':'thinking', charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:12px;margin-bottom:10px">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">
          <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
          ${INSTRS.map((r,i)=>`<polyline points="${ptsAll[i]}" fill="none" stroke="${r.color}" stroke-width="2" stroke-linejoin="round" opacity=".85"/>`).join('')}
          <line x1="${spotX}" y1="0" x2="${spotX}" y2="${H}" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4,3"/>
        </svg>
        <div style="display:flex;justify-content:center;gap:14px;margin-top:6px">
          ${INSTRS.map(r=>`<span style="font-size:10px;color:${r.color}">● ${r.label}</span>`).join('')}
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">📍 Stock price at expiry: <b style="color:var(--gold)">$${spot}</b></div>
      <input type="range" min="20" max="80" value="${spot}" oninput="pfSpot(this.value)" style="margin-bottom:12px">
      ${results.map(r=>`
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 10px;background:var(--card2);border-radius:9px;border-left:3px solid ${r.color}${r===best?'':50}">
          <span style="font-size:14px">${r.icon}</span>
          <span style="flex:1;font-size:12px;color:${r===best?'var(--text)':'var(--muted)'}">${r.label}</span>
          <span style="font-weight:700;font-size:14px;color:${r.v>0?'var(--green)':r.v<0?'var(--red)':'var(--muted)'}">${r.v>0?'+':''}$${r.v.toFixed(2)}</span>
          ${r===best?`<span style="font-size:10px;background:rgba(0,200,150,.15);color:var(--green);border-radius:10px;padding:2px 6px">BEST</span>`:''}
        </div>`).join('')}
      <div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5">💡 Options cap max loss at premium. Stock can fall to $0. But calls/puts expire worthless if OTM!</div>`;
    window.pfSpot=v=>{spot=parseInt(v);challenged=true;render();};
  }
  render();
}

function initHedgingGame(el) {
  let sp=50, crashed=false, hedged_on=false, saw_crash=false;
  const SHARES=100, BUY=50, PUT_K=48, PUT_P=2;
  function pnl(p){ return (p-BUY)*SHARES; }
  function hedge_pnl(p){ return pnl(p)+Math.max(0,PUT_K-p)*SHARES-PUT_P*SHARES; }
  function current(){ return crashed?28:sp; }
  function charLine(){
    if(saw_crash&&hedged_on){ const saved=Math.abs(hedge_pnl(current())-pnl(current())); return `The hedge SAVED us $${saved}! Without it: -$${Math.abs(pnl(current()))} loss. WITH it: $${hedge_pnl(current())>=0?'+':''}${hedge_pnl(current())}. Insurance pays off! 🛡️`; }
    if(saw_crash&&!hedged_on) return `Ouch! -$${Math.abs(pnl(current()))} loss with no hedge. Now try with the hedge ON and crash again — see the difference!`;
    if(hedged_on) return `Good — hedge is ON. It costs $${PUT_P*SHARES} but protects you. Now hit Crash to see it save you!`;
    return `I'm Alex. You own 100 BananaCo shares. Without a hedge, a crash is devastating. Turn ON the hedge, then crash the market!`;
  }
  function render(){
    const p=current(), u=pnl(p), h=hedge_pnl(p), col_u=u>=0?'var(--green)':'var(--red)', col_h=h>=0?'var(--green)':'var(--red)';
    const won=saw_crash&&hedged_on;
    el.innerHTML=`
      ${_goal('Survive a market crash WITH the hedge active', won?1:0, 1, 50)}
      ${_char('Alex', saw_crash&&hedged_on?'cool':saw_crash?'worried':hedged_on?'thinking':'thinking', charLine())}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <button class="btn btn-sm ${!hedged_on?'btn-red':'btn-ghost'}" onclick="hgHedge(false)" style="${!hedged_on?'border:2px solid var(--red)':''}">❌ No Hedge</button>
        <button class="btn btn-sm ${hedged_on?'btn-green':'btn-ghost'}" onclick="hgHedge(true)" style="${hedged_on?'border:2px solid var(--green)':''}">🛡️ Hedge ON<br><span style="font-size:10px;opacity:.7">-$${PUT_P*SHARES} cost</span></button>
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <div style="font-size:11px;color:var(--muted)">🍌 BananaCo</div>
            <div style="font-size:28px;font-weight:900;color:${p<BUY?'var(--red)':'var(--green)'}">$${p}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--muted)">100 shares @ $${BUY}</div>
            <div style="font-size:13px;color:var(--muted)">Cost: $${BUY*SHARES}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="background:rgba(255,96,128,.06);border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--muted);margin-bottom:4px">❌ No Hedge P&L</div>
            <div style="font-size:20px;font-weight:700;color:${col_u}">${u>=0?'+':''}$${u}</div>
          </div>
          <div style="background:rgba(0,200,150,.06);border:1px solid rgba(0,200,150,${hedged_on?.3:.1});border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:10px;color:var(--${hedged_on?'green':'muted'});margin-bottom:4px">🛡️ With Hedge P&L</div>
            <div style="font-size:20px;font-weight:700;color:${hedged_on?col_h:'var(--muted)'}">${hedged_on?(h>=0?'+':'')+'$'+h:'—'}</div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="hgAdj(-5)">Price −$5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="hgAdj(5)">Price +$5</button>
        <button class="btn ${crashed?'btn-green':'btn-red'}" style="flex:1" onclick="hgCrash()">${crashed?'📈 Recover':'💥 CRASH!'}</button>
      </div>
      ${won?_win('🛡️','Hedging Expert!',`You survived the crash! Without hedge: -$${Math.abs(u)} loss. With hedge: ${h>=0?'+':''}$${h}. The put option saved $${Math.abs(h-u)}!`):''}`;
    window.hgHedge=v=>{hedged_on=v;render();};
    window.hgAdj=v=>{sp=Math.max(10,sp+v);crashed=false;render();};
    window.hgCrash=()=>{
      crashed=!crashed;if(crashed)saw_crash=true;render();
      const p=current(),u=pnl(p),h=hedge_pnl(p);
      if(crashed){_shakeGame();_flashGame('dn');_floatNum('📉 CRASH!',false);}
      else{_bounceChar();_flashGame('up');_floatNum('📈 Recovery!',true);}
      _gcRefresh('alex','portfolio hedging with put options',`Stock ${crashed?'crashed to $28':'recovered'}. Without hedge: ${u>=0?'+':''}$${u}. With hedge: ${h>=0?'+':''}$${h}. Hedge is ${hedged_on?'ON':'OFF'}.`);
    };
  }
  render();
}

function initOTCGame(el) {
  let step=0;
  const STEPS=[
    {emoji:'📞',title:'Find a Counterparty',who:'finn',mood:'thinking',
      speech:`I need a custom $1M interest rate swap for 5 years. No exchange offers this. I'm calling Goldman Sachs directly...`,
      desc:'OTC markets exist for deals too custom or large for exchanges. Hedge funds, banks, and corporations deal direct.',
      action:'📞 Call Goldman Sachs'},
    {emoji:'🤝',title:'Negotiate Terms',who:'alex',mood:'cool',
      speech:`Goldman here! We quote: you PAY fixed 4.5%, you RECEIVE LIBOR + 0.5%. $1M notional, 5 years. Every detail is negotiable.`,
      desc:'Unlike exchanges with fixed contracts, OTC terms are bespoke — notional, duration, payments — all customizable.',
      action:'🤝 Agree to Terms'},
    {emoji:'✍️',title:'Sign ISDA Agreement',who:'finn',mood:'thinking',
      speech:`We sign the Master ISDA Agreement. This defines what happens if either of us defaults. This is counterparty risk protection.`,
      desc:'ISDA = International Swaps and Derivatives Association. The legal backbone of OTC derivatives.',
      action:'✍️ Sign the Contract'},
    {emoji:'🎉',title:'Deal Is Live!',who:'alex',mood:'excited',
      speech:`The swap is LIVE! Every 6 months, Finn pays fixed 4.5%, I pay LIBOR. No clearinghouse — if one party goes bust, the other is exposed.`,
      desc:'This is the core risk of OTC: counterparty risk. No central guarantee. If Goldman collapses, Finn loses.',
      action:null},
  ];
  function render(){
    const s=STEPS[step], done=step===STEPS.length-1;
    el.innerHTML=`
      ${_goal('Complete the OTC deal in 4 steps', step, 3, 40)}
      ${_char(s.who, s.mood, s.speech)}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="display:flex;gap:10px;margin-bottom:12px">
          ${STEPS.map((st,i)=>`
            <div style="flex:1;text-align:center">
              <div style="width:32px;height:32px;border-radius:50%;background:${i<step?'var(--green)':i===step?'var(--accent)':'var(--border)'};margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-size:${i<step?'16':'14'}px">${i<step?'✓':st.emoji}</div>
              <div style="font-size:9px;color:${i===step?'var(--text)':i<step?'var(--muted)':'var(--border)'}">${st.title.split(' ').slice(0,2).join(' ')}</div>
            </div>
            ${i<STEPS.length-1?`<div style="flex-shrink:0;display:flex;align-items:center;color:var(--border);margin-bottom:14px">→</div>`:''}`).join('')}
        </div>
        <div style="font-size:13px;color:var(--muted);line-height:1.5;padding:10px;background:rgba(255,255,255,.03);border-radius:8px">${s.desc}</div>
      </div>
      ${done
        ? `${_win('🤝','OTC Deal Complete!','No exchange, no clearinghouse — just two parties and a contract. That\'s OTC. The risk: if your counterparty collapses, you\'re exposed.')}<button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="otcReset()">🔄 Start Again</button>`
        : `<button class="btn btn-primary btn-pulse" style="width:100%" onclick="otcStep()">${s.action} →</button>`}`;
    window.otcStep=()=>{step=Math.min(STEPS.length-1,step+1);render();};
    window.otcReset=()=>{step=0;render();};
  }
  render();
}

function initCryptoGame(el) {
  let wallet=0, usd=200, btcPrice=42000, mineCount=0, priceHist=[42000], swings=0;
  function total(){ return usd+wallet*btcPrice; }
  function mood(){ if(total()>=350)return'money'; if(total()>=250)return'happy'; if(total()<150)return'worried'; return'thinking'; }
  function charLine(){
    if(total()>=350) return `$${total().toFixed(0)} total! You mined, bought the dip, sold the peak — you're a crypto native! 🚀`;
    if(mineCount>=5) return `${mineCount} blocks mined! Each block = new BTC entering supply. Real miners use warehouses of GPUs for this.`;
    if(wallet>0) return `Holding ₿${wallet.toFixed(6)} BTC ($${(wallet*btcPrice).toFixed(0)}). Price is volatile — swing it to see what can happen!`;
    return `I'm Alex, a crypto enthusiast. Start by mining BTC (tap ⛏️), then buy low and sell high. Goal: reach $350 total!`;
  }
  function render(){
    const won=total()>=350;
    const mini=priceHist.slice(-15);
    const mn=Math.min(...mini),mx=Math.max(...mini),span=mx-mn||1;
    const W=260,H=50;
    const pts=mini.map((p,i)=>`${(i/(mini.length-1||1))*W},${H-5-(p-mn)/span*(H-10)}`).join(' ');
    const trend=priceHist.length>1&&btcPrice>=priceHist[priceHist.length-2];
    el.innerHTML=`
      ${_goal('Grow $200 to $350 — mine, buy, and trade BTC', total()-200, 150, 50)}
      ${_char('Alex', mood(), charLine())}
      ${_sc3(['💵 USD','$'+usd.toFixed(0),'var(--green)'],['₿ BTC',wallet.toFixed(5),'var(--gold)'],['💎 Total','$'+total().toFixed(0),'var(--accent2)'])}
      <div style="background:var(--card2);border-radius:12px;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <div>
            <div style="font-size:11px;color:var(--muted)">₿ Bitcoin Price</div>
            <div style="font-size:26px;font-weight:900;color:var(--gold)">$${btcPrice.toLocaleString()}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:${trend?'var(--green)':'var(--red)'}">
            ${trend?'▲ Pumping':'▼ Dumping'}<br>
            <span style="color:var(--muted)">${swings} swings</span>
          </div>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block">
          <polyline points="${pts}" fill="none" stroke="${trend?'#00c896':'#ff6080'}" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="${W}" cy="${H-5-(btcPrice-mn)/span*(H-10)}" r="3.5" fill="var(--gold)"/>
        </svg>
      </div>
      <div style="text-align:center;margin-bottom:12px">
        <button class="mine-btn" onclick="cMine()">⛏️</button>
        <div style="font-size:12px;color:var(--muted);margin-top:6px">${mineCount===0?'Tap to mine your first Bitcoin block!':'⛏️ '+mineCount+' blocks mined · earned ₿'+(mineCount*0.000001).toFixed(6)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        <button class="btn btn-green btn-sm" onclick="cBuy()" ${usd<100?'disabled':''}>Buy $100<br><span style="font-size:10px">₿${(100/btcPrice).toFixed(5)}</span></button>
        <button class="btn btn-primary btn-sm" onclick="cSwing()">🎢 Price<br>Swing!</button>
        <button class="btn btn-red btn-sm" onclick="cSell()" ${wallet<0.001?'disabled':''}>Sell 0.001<br><span style="font-size:10px">$${(0.001*btcPrice).toFixed(0)}</span></button>
      </div>
      ${won?_win('🚀','Crypto Pro!',`Total: $${total().toFixed(0)}. You mined, traded, and survived the volatility!`):''}`;
    window.cMine=()=>{wallet+=0.000001;mineCount++;btcPrice=Math.max(5000,btcPrice+(Math.random()*800-300));priceHist.push(btcPrice);render();_coins(2);_bounceChar();};
    window.cBuy=()=>{if(usd>=100){usd-=100;wallet+=100/btcPrice;notify('₿ Bought $100 of BTC!','ok');render();_coins(4);_bounceChar();_floatNum('₿ Bought!',true);}};
    window.cSell=()=>{if(wallet>=0.001){const got=0.001*btcPrice;usd+=got;wallet-=0.001;notify('💰 Sold for $'+got.toFixed(0),'ok');render();}};
    window.cSwing=()=>{
      const s=(Math.random()-.38)*12000;btcPrice=Math.max(3000,btcPrice+s);priceHist.push(btcPrice);swings++;
      notify((s>0?'📈 +$':'📉 −$')+Math.abs(s).toFixed(0),s>0?'ok':'bad');
      render();
      if(s>2000){_coins(5);_bounceChar();_flashGame('up');_floatNum(`🚀 +$${s.toFixed(0)}`,true);}
      else if(s>0){_bounceChar();_flashGame('up');}
      else if(s<-2000){_shakeGame();_flashGame('dn');_floatNum(`💥 -$${Math.abs(s).toFixed(0)}`,false);}
      else{_flashGame('dn');}
      _gcRefresh('alex','Bitcoin and crypto volatility',`BTC price ${s>0?'jumped to':'dropped to'} $${btcPrice.toLocaleString()}. User holds ${wallet.toFixed(5)} BTC ($${(wallet*btcPrice).toFixed(0)}), $${usd.toFixed(0)} cash. Total: $${total().toFixed(0)}.`);
    };
  }
  render();
}

// ===== NEW CHAPTER GAMES =====

function initEquityGame(el) {
  let assets=500000, liabilities=300000;
  function equity(){ return assets-liabilities; }
  function debtPct(){ return (liabilities/assets*100).toFixed(1); }
  function rating(){ const dp=parseFloat(debtPct()); if(dp<20)return{txt:'AAA — Extremely strong',c:'var(--green)'}; if(dp<40)return{txt:'A — Financially healthy',c:'var(--green)'}; if(dp<65)return{txt:'BBB — Acceptable leverage',c:'var(--gold)'}; if(dp<85)return{txt:'BB — High leverage ⚠️',c:'var(--accent2)'}; return{txt:'CCC — Near insolvency 🚨',c:'var(--red)'}; }
  function mood(){ const dp=parseFloat(debtPct()); if(dp<30)return'excited'; if(dp<55)return'happy'; if(dp<75)return'thinking'; return'worried'; }
  function charLine(){
    const e=equity(), dp=debtPct();
    if(equity()<=0) return `We're technically insolvent — liabilities EXCEED assets. No bank will lend to us and shareholders are wiped out! 😱`;
    if(dp<25) return `Equity = $${(e/1000).toFixed(0)}K — we're almost debt-free! Low risk, high financial health. 🏆`;
    return `Equity = Assets ($${(assets/1000).toFixed(0)}K) − Liabilities ($${(liabilities/1000).toFixed(0)}K) = $${(e/1000).toFixed(0)}K. This is what shareholders actually OWN.`;
  }
  function render(){
    const e=equity(), dp=parseFloat(debtPct()), rt=rating();
    const won=e>0&&dp<30;
    const eqW=Math.max(0,e/assets*100), libW=liabilities/assets*100;
    el.innerHTML=`
      ${_goal('Build a company with debt ratio under 30%', won?1:0, 1, 40)}
      ${_char('Finn', mood(), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px;text-align:center">🏢 BananaCo Balance Sheet</div>
        <div style="display:flex;height:28px;border-radius:6px;overflow:hidden;margin-bottom:6px">
          <div style="width:${eqW}%;background:#00c896;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .3s">${eqW>10?'Equity':'.'}</div>
          <div style="width:${libW}%;background:#ff6080;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .3s">${libW>10?'Debt':'.'}</div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)">
          <span style="color:#00c896">Equity: $${(e/1000).toFixed(0)}K</span>
          <span style="color:#ff6080">Liabilities: $${(liabilities/1000).toFixed(0)}K</span>
        </div>
      </div>
      <div style="margin-bottom:10px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">🏗️ Total Assets: <b style="color:#4fc3f7">$${(assets/1000).toFixed(0)}K</b></div>
        <input type="range" min="100000" max="2000000" step="50000" value="${assets}" oninput="eqSet('a',this.value)">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px;margin-top:8px">💳 Liabilities: <b style="color:var(--red)">$${(liabilities/1000).toFixed(0)}K</b></div>
        <input type="range" min="0" max="${assets}" step="10000" value="${Math.min(liabilities,assets)}" oninput="eqSet('l',this.value)">
      </div>
      <div style="background:var(--card2);border-radius:10px;padding:12px;text-align:center;margin-bottom:8px">
        <div style="font-size:11px;color:var(--muted)">Credit Rating</div>
        <div style="font-size:22px;font-weight:900;color:${rt.c}">${rt.txt}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">Debt ratio: ${dp}% · Equity: $${(e/1000).toFixed(0)}K</div>
      </div>
      ${won?_win('🏆','Low-Debt Company!','Debt below 30% — healthy balance sheet, strong equity cushion, and access to cheap credit.'):''}`;
    window.eqSet=(f,v)=>{if(f==='a'){assets=parseInt(v);liabilities=Math.min(liabilities,assets);}else liabilities=parseInt(v);render();};
  }
  render();
}

function initInflationGame(el) {
  let rate=3, yrs=10, invested=false, choice='';
  const BASKET=[{item:'🍞 Bread',price:3},{item:'⛽ Gas/L',price:1.5},{item:'🎬 Cinema',price:12},{item:'☕ Coffee',price:4}];
  function pp(){ return (1000/Math.pow(1+rate/100,yrs)).toFixed(0); }
  function realReturn(nom){ return (nom-rate).toFixed(1); }
  function charLine(){
    if(invested&&parseFloat(realReturn(7))>0) return `Smart! Stocks avg ~7%/yr. Real return after ${rate}% inflation: +${realReturn(7)}%/yr. Your money grows in real terms!`;
    if(invested&&choice==='savings') return `Savings at 1% with ${rate}% inflation = ${realReturn(1)}% REAL return. You're losing purchasing power every year!`;
    if(invested) return `Real return = nominal − inflation. If inflation > return, you're getting poorer even while earning interest!`;
    return `I'm Alex. Inflation silently eats your money's value. $1,000 today buys FAR less in ${yrs} years. Pick an investment to see who beats inflation!`;
  }
  function render(){
    const ppVal=pp();
    const items=BASKET.map(b=>({...b,futurePrice:(b.price*Math.pow(1+rate/100,yrs)).toFixed(2)}));
    el.innerHTML=`
      ${_goal('Discover which asset beats inflation over time', invested?1:0, 1, 40)}
      ${_char('Alex', parseFloat(ppVal)<700?'worried':invested?'happy':'thinking', charLine())}
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div style="flex:1"><div style="font-size:12px;color:var(--muted);margin-bottom:3px">🌡️ Inflation: <b style="color:var(--red)">${rate}%/yr</b></div><input type="range" min="1" max="20" value="${rate}" oninput="infSet('r',this.value)"></div>
        <div style="flex:1"><div style="font-size:12px;color:var(--muted);margin-bottom:3px">📅 Years: <b style="color:var(--gold)">${yrs}</b></div><input type="range" min="1" max="40" value="${yrs}" oninput="infSet('y',this.value)"></div>
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:12px;color:var(--muted)">$1,000 purchasing power in ${yrs} years</div>
          <div style="font-size:22px;font-weight:900;color:${parseFloat(ppVal)<700?'var(--red)':'var(--gold)'}">$${ppVal}</div>
        </div>
        <div style="height:10px;background:rgba(255,255,255,.06);border-radius:5px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${ppVal/10}%;background:linear-gradient(90deg,var(--red),var(--gold));border-radius:5px;transition:width .4s"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
          ${items.map(b=>`<div style="font-size:11px;background:rgba(255,255,255,.05);border-radius:6px;padding:4px 8px"><span>${b.item}</span> <span style="color:var(--muted)">$${b.price}</span> → <span style="color:var(--red)">$${b.futurePrice}</span></div>`).join('')}
        </div>
      </div>
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">Which beats inflation at ${rate}%?</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${[['savings','🏦 Savings (1%)'],['bonds','📄 Bonds (4%)'],['stocks','📈 Stocks (7%)'],['crypto','🚀 Crypto (varies)']].map(([k,l])=>{
          const nom=k==='savings'?1:k==='bonds'?4:k==='stocks'?7:15;
          const real=parseFloat(realReturn(nom));
          const beats=real>0;
          return `<button class="btn btn-sm ${choice===k?'btn-primary':'btn-ghost'}" onclick="infPick('${k}')" style="text-align:left;padding:8px 10px">
            ${l}<br><span style="font-size:10px;color:${beats?'var(--green)':'var(--red)'}">${beats?'+':''}${real}% real</span>
          </button>`;
        }).join('')}
      </div>
      ${invested?_win('💡','Inflation Mastered!',`At ${rate}% inflation over ${yrs} years, only assets beating ${rate}%/yr grow real wealth. Stocks historically win long-term.`):''}`;
    window.infSet=(f,v)=>{if(f==='r')rate=parseInt(v);else yrs=parseInt(v);render();};
    window.infPick=k=>{
      choice=k;invested=true;render();
      const nom=k==='savings'?1:k==='bonds'?4:k==='stocks'?7:15;
      const real=parseFloat((nom-rate).toFixed(1));
      if(real>0){_coins(5);_bounceChar();_floatNum(`+${real}% real return`,true);}
      else{_shakeGame();_flashGame('dn');_floatNum(`${real}% real return`,false);}
      _gcRefresh('alex','inflation and real returns',`User chose ${k} (${nom}% nominal) with ${rate}% inflation over ${yrs} years. Real return: ${real}%/yr. Purchasing power of $1000 falls to $${pp()}.`);
    };
  }
  render();
}

function initBondsGame(el) {
  let coupon=5, mktRate=5, face=1000, term=10, purchased=false;
  function pv(){ return coupon/100*face*(1-Math.pow(1+mktRate/100,-term))/(mktRate/100)+face/Math.pow(1+mktRate/100,term); }
  function status(){ const p=pv(); return p>face+1?{txt:'Premium 📈',c:'var(--green)'}:p<face-1?{txt:'Discount 📉',c:'var(--red)'}:{txt:'At Par ≈',c:'var(--gold)'}; }
  function mood(){ if(mktRate<coupon)return'excited'; if(mktRate>coupon)return'worried'; return'thinking'; }
  function charLine(){
    const s=status();
    if(purchased) return `You bought at $${pv().toFixed(0)}. If market rates drop more, your bond's value rises — you could sell for a profit! That's the bond price-rate seesaw. 🎢`;
    if(mktRate<coupon) return `When market rates FALL below our coupon, our bond becomes premium — worth MORE than face value! Buy now before rates fall further!`;
    if(mktRate>coupon) return `Rates are higher than our coupon... our bond trades at a DISCOUNT. Why buy ours when new bonds pay more?`;
    return `I'm Finn, a bond investor. The golden rule: rates UP → prices DOWN. Rates DOWN → prices UP. Try raising market rates to see the price fall!`;
  }
  function render(){
    const price=pv(), st=status(), won=purchased;
    const annual=coupon/100*face;
    el.innerHTML=`
      ${_goal('Buy a bond trading at premium (market rate < coupon)', purchased?1:0, 1, 40)}
      ${_char('Finn', mood(), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div>
            <div style="font-size:11px;color:var(--muted)">🏛️ Gov Bond ${coupon}% coupon</div>
            <div style="font-size:30px;font-weight:900;color:${st.c}">$${price.toFixed(0)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:700;color:${st.c}">${st.txt}</div>
            <div style="font-size:11px;color:var(--muted)">Face: $${face} · ${term}yr</div>
            <div style="font-size:11px;color:var(--green)">Annual: $${annual.toFixed(0)}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">Coupon Rate: <b style="color:var(--accent2)">${coupon}%</b></div>
        <input type="range" min="1" max="15" step=".5" value="${coupon}" oninput="bdSet('c',this.value)" style="margin-bottom:8px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">Market Rate: <b style="color:var(--gold)">${mktRate}%</b></div>
        <input type="range" min="1" max="15" step=".5" value="${mktRate}" oninput="bdSet('r',this.value)" style="margin-bottom:8px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">Years to Maturity: <b style="color:#4fc3f7">${term}</b></div>
        <input type="range" min="1" max="30" value="${term}" oninput="bdSet('t',this.value)">
      </div>
      ${_sc3(['💵 Price','$'+price.toFixed(0),st.c],['📬 Coupon/yr','$'+annual.toFixed(0),'var(--green)'],['📊 Yield',(annual/price*100).toFixed(2)+'%','var(--gold)'])}
      <div style="font-size:12px;color:var(--muted);line-height:1.45;margin-bottom:8px">${mktRate>coupon?'📉 Rate > coupon → discount. New bonds pay more.':mktRate<coupon?'📈 Rate < coupon → premium. Our old bond pays more!':'⚖️ Same rate → trades at par ($'+face+').'}</div>
      ${!purchased&&mktRate<coupon?`<button class="btn btn-green btn-pulse" style="width:100%" onclick="bdBuy()">🟢 Buy Bond @ $${price.toFixed(0)}</button>`:''}
      ${won?_win('🎉','Bond Investor!',`Bought at $${price.toFixed(0)}! If rates keep falling, your bond's value rises further — capital gain + coupon income!`):''}`;
    window.bdSet=(f,v)=>{if(f==='c')coupon=parseFloat(v);if(f==='r')mktRate=parseFloat(v);if(f==='t')term=parseInt(v);render();};
    window.bdBuy=()=>{purchased=true;render();_coins(4);_bounceChar();_floatNum(`Bond @ $${pv().toFixed(0)}`,pv()>=face);};
  }
  render();
}

function initCreditGame(el) {
  let score=620, events=[];
  const CHOICES=[
    {txt:'💳 Pay credit card on time',delta:+15,cat:'green',why:'Payment history = 35% of score — biggest factor!'},
    {txt:'😬 Miss a payment',delta:-25,cat:'red',why:'Missed payments hurt heavily and stay 7 years on record.'},
    {txt:'📉 Max out your credit card',delta:-20,cat:'red',why:'High utilization (>30%) signals financial stress.'},
    {txt:'💰 Pay down 50% of debt',delta:+30,cat:'green',why:'Lower utilization = better score. Aim for <30%.'},
    {txt:'🏦 Open a new credit card',delta:-8,cat:'gold',why:'Hard inquiry + lower avg account age = small dip.'},
    {txt:'📅 Keep old cards open',delta:+10,cat:'green',why:'Long credit history boosts your score over time.'},
    {txt:'🏠 Apply for a mortgage',delta:-12,cat:'gold',why:'Multiple hard inquiries in 14 days count as one.'},
    {txt:'💳 Mix: add an installment loan',delta:+8,cat:'green',why:'Credit mix (cards + loans) adds ~10% of your score.'},
  ];
  let usedIdx=new Set(), round=0;
  function rating(s){ if(s>=800)return{r:'Exceptional',c:'var(--green)'}; if(s>=740)return{r:'Very Good',c:'var(--green)'}; if(s>=670)return{r:'Good',c:'var(--gold)'}; if(s>=580)return{r:'Fair',c:'var(--accent2)'}; return{r:'Poor',c:'var(--red)'}; }
  function mood(s){ if(s>=780)return'excited'; if(s>=700)return'happy'; if(s>=620)return'thinking'; return'worried'; }
  function charLine(){
    const rt=rating(score);
    if(score>=780) return `${score} — ${rt.r}! Banks will offer you the best interest rates. This score unlocks low-cost mortgages and credit cards!`;
    if(score<620) return `${score} is below average... banks see me as risky. Make smart choices to improve — it takes time but it's worth it!`;
    return `Score: ${score} — ${rt.r}. I'm Alex. Each decision below affects my credit. Goal: reach 780!`;
  }
  function available(){ return CHOICES.filter((_,i)=>!usedIdx.has(i)); }
  function render(){
    const rt=rating(score), won=score>=780;
    const pct=Math.min(100,Math.max(0,(score-300)/550*100));
    el.innerHTML=`
      ${_goal('Bring credit score from 620 to 780', score-620, 160, 50)}
      ${_char('Alex', mood(score), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
          <div>
            <div style="font-size:11px;color:var(--muted)">Credit Score</div>
            <div style="font-size:40px;font-weight:900;color:${rt.c}">${score}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:700;color:${rt.c}">${rt.r}</div>
            <div style="font-size:11px;color:var(--muted)">${round} decisions made</div>
          </div>
        </div>
        <div style="height:10px;background:rgba(255,255,255,.06);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--red),var(--gold) 40%,var(--green) 80%);border-radius:5px;transition:width .4s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:3px"><span>300</span><span>580</span><span>670</span><span>740</span><span>850</span></div>
      </div>
      ${won?_win('🏆','Excellent Credit!','780+ score unlocks the best rates on mortgages, car loans, and credit cards. Responsible behaviour = financial freedom!'):`
      <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">Choose your next financial action:</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${available().slice(0,4).map((c,i)=>`
          <button class="btn btn-ghost" style="text-align:left;padding:10px 12px;border-left:3px solid ${c.cat==='green'?'var(--green)':c.cat==='red'?'var(--red)':'var(--gold)'}" onclick="crChoose(${CHOICES.indexOf(c)})">
            ${c.txt}
          </button>`).join('')}
      </div>`}
      ${events.length>0?`<div style="margin-top:10px">
        ${events.slice(-3).map(e=>`<div style="font-size:11px;color:var(--muted);padding:4px 8px;background:rgba(255,255,255,.03);border-radius:5px;margin-bottom:3px">${e}</div>`).join('')}
      </div>`:''}`;
    window.crChoose=i=>{
      const c=CHOICES[i];
      score=Math.max(300,Math.min(850,score+c.delta));
      usedIdx.add(i); round++;
      events.push(`${c.delta>0?'📈':'📉'} ${c.txt}: ${c.delta>0?'+':''}${c.delta} (${score}) — ${c.why}`);
      render();
      if(c.delta>0){_bounceChar();_flashGame('up');_floatNum(`+${c.delta} pts ✅`,true);}
      else{_shakeGame();_flashGame('dn');_floatNum(`${c.delta} pts`,false);}
      _gcRefresh('alex','credit scores and credit management',`User chose: "${c.txt}". Score ${c.delta>0?'improved':'dropped'} by ${Math.abs(c.delta)} to ${score}. Reason: ${c.why}`);
    };
  }
  render();
}

function initTaxGame(el) {
  let gain=10000, months=8, bracket=24, optimised=false;
  function ltRate(b){ return b<=15?0:b<=35?15:20; }
  function taxAmt(g,m,b){ return m<12?g*b/100:g*ltRate(b)/100; }
  function saving(g,m,b){ return m<12?g*(b-ltRate(b))/100:0; }
  function mood(m,b){ if(m>=12)return'excited'; if(saving(gain,m,b)>2000)return'thinking'; return'worried'; }
  function charLine(){
    const sav=saving(gain,months,bracket);
    if(months>=12) return `Long-term capital gains at ${ltRate(bracket)}% vs ${bracket}% short-term. Waiting saved $${sav.toFixed(0)} in tax — patience really pays! 🏆`;
    if(months<12) return `I'm Finn. I made $${gain.toLocaleString()} on a stock. If I sell NOW I pay ${bracket}% tax. But wait ${12-months} more months and I only pay ${ltRate(bracket)}%!`;
    return `After-tax gain: $${(gain-taxAmt(gain,months,bracket)).toLocaleString()}. Could be more with better timing.`;
  }
  function render(){
    const t=taxAmt(gain,months,bracket), sav=saving(gain,months,bracket);
    const isShort=months<12;
    const won=months>=12;
    el.innerHTML=`
      ${_goal('Switch from short-term to long-term by holding 12+ months', months, 12, 40)}
      ${_char('Finn', mood(months,bracket), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="text-align:center;flex:1">
            <div style="font-size:10px;color:var(--muted)">Tax Rate</div>
            <div style="font-size:28px;font-weight:900;color:${isShort?'var(--red)':'var(--green)'}">${isShort?bracket:ltRate(bracket)}%</div>
            <div style="font-size:11px;color:${isShort?'var(--red)':'var(--green)'}">${isShort?'Short-term':'Long-term ✅'}</div>
          </div>
          <div style="font-size:24px;text-align:center">→</div>
          <div style="text-align:center;flex:1">
            <div style="font-size:10px;color:var(--muted)">After-Tax Gain</div>
            <div style="font-size:28px;font-weight:900;color:var(--green)">$${(gain-t).toLocaleString()}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">💰 Capital Gain: <b style="color:var(--gold)">$${gain.toLocaleString()}</b></div>
        <input type="range" min="1000" max="100000" step="1000" value="${gain}" oninput="txSet('g',this.value)" style="margin-bottom:8px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">📅 Holding Period: <b style="color:${isShort?'var(--red)':'var(--green)'}">${months} month${months!==1?'s':''}</b></div>
        <input type="range" min="1" max="36" value="${months}" oninput="txSet('m',this.value)" style="margin-bottom:8px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:3px">💼 Income Bracket: <b style="color:var(--accent2)">${bracket}%</b></div>
        <input type="range" min="10" max="37" step="1" value="${bracket}" oninput="txSet('b',this.value)">
      </div>
      ${_sc3(['📊 Tax Rate',(isShort?bracket:ltRate(bracket))+'%','var(--red)'],['💸 Tax Owed','-$'+t.toLocaleString(),'var(--red)'],['💚 After-Tax','$'+(gain-t).toLocaleString(),'var(--green)'])}
      ${isShort&&sav>0?`<div style="background:rgba(0,200,150,.07);border:1px solid rgba(0,200,150,.2);border-radius:8px;padding:10px;font-size:12px;margin-top:8px">⏳ Holding ${12-months} more month${12-months!==1?'s':''} would save <b style="color:var(--green)">$${sav.toLocaleString()}</b>! Move the slider to 12+ months.</div>`:''}
      ${won?_win('🎉','Tax Optimised!',`Long-term rate saved $${sav.toFixed(0)}! Holding investments 12+ months is one of the simplest legal tax strategies.`):''}`;
    window.txSet=(f,v)=>{if(f==='g')gain=parseInt(v);if(f==='m')months=parseInt(v);if(f==='b')bracket=parseInt(v);render();};
  }
  render();
}

function initArbitrageGame(el) {
  const CASES=[
    {d:'🍌 BananaCo stock: NYSE $100.00 · NASDAQ $100.60',arb:true,profit:0.6,exp:'Buy on NYSE ($100), sell on NASDAQ ($100.60) → $0.60/share risk-free. Algos close this in milliseconds!'},
    {d:'🥇 Gold London $1,950/oz · Gold New York $1,950/oz',arb:false,profit:0,exp:'Same price, no arb. Any gap under transaction costs is also not worth it.'},
    {d:'EUR/USD=1.10, USD/GBP=0.80 · EUR/GBP quotes 0.90 (should be 0.88)',arb:true,profit:0.02,exp:'Triangular FX arb: €1→$1.10→£0.88 via USD, but market quotes £0.90 direct. Pocket £0.02!'},
    {d:'BananaCo: Call=$6, Put=$3, Stock=$100, Strike=$98. C−P=$3, S−PV(K)=$3',arb:false,profit:0,exp:'C−P = $3 = S−PV(K) = $3. Parity holds exactly — no arb.'},
  ];
  let answers=new Array(CASES.length).fill(null), done=false, score=0;
  function allAnswered(){ return answers.every(a=>a!==null); }
  function charLine(){
    if(done) return `You got ${score}/${CASES.length} right! Arbitrage enforces fair prices globally — if a gap appears, traders exploit it instantly until it vanishes.`;
    const answered=answers.filter(a=>a!==null).length;
    if(answered===0) return `I'm Alex, an arb trader. My job: find identical assets trading at different prices. Spot the 2 real opportunities and I'll lock in risk-free profit!`;
    return `${answered}/${CASES.length} answered. Arb = same thing, different price. Find the gaps!`;
  }
  function render(){
    const correct=done?answers.reduce((s,a,i)=>s+(a===CASES[i].arb?1:0),0):0;
    if(done)score=correct;
    el.innerHTML=`
      ${_goal('Find 2 real arbitrage opportunities (4 scenarios)', done?correct:0, 2, 50)}
      ${_char('Alex', done&&correct>=3?'money':done?'thinking':'cool', charLine())}
      ${CASES.map((c,i)=>`
        <div style="background:var(--card2);border-radius:10px;padding:11px 13px;margin-bottom:8px;border-left:3px solid ${done?(answers[i]===c.arb?'var(--green)':'var(--red)'):'var(--border)'}">
          <div style="font-size:12px;margin-bottom:7px;line-height:1.4">${c.d}</div>
          <div style="display:flex;gap:6px">
            ${[['💰 Arb Exists!',true],['❌ No Arb',false]].map(([lbl,v])=>{
              const sel=answers[i]===v;
              let cls=sel?'btn-primary':'btn-ghost';
              if(done)cls=v===c.arb?'btn-green':(sel?'btn-red':'btn-ghost');
              return `<button class="btn btn-sm ${cls}" onclick="arbSet(${i},${v})" ${done?'disabled':''}>${lbl}</button>`;
            }).join('')}
            ${done&&c.arb?`<span style="font-size:11px;color:var(--green);align-self:center;margin-left:4px">+$${c.profit}/unit!</span>`:''}
          </div>
          ${done?`<div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.4">${answers[i]===c.arb?'✅':'❌'} ${c.exp}</div>`:''}
        </div>`).join('')}
      ${!done?`<button class="btn btn-primary btn-pulse" style="width:100%" onclick="arbCheck()" ${allAnswered()?'':'disabled'}>🔍 Check All Answers</button>`:''}
      ${done?_win('⚖️','Arbitrage Spotter!',`Score: ${correct}/${CASES.length}. Law of One Price: identical assets must trade at the same price globally!`):''}`;
    window.arbSet=(i,v)=>{if(!done){answers[i]=v;render();}};
    window.arbCheck=()=>{
      done=true;const correct=answers.reduce((s,a,i)=>s+(a===CASES[i].arb?1:0),0);render();
      if(correct>=3){_coins(6);_bounceChar();_flashGame('up');}
      else{_shakeGame();_flashGame('dn');}
      _gcRefresh('alex','arbitrage and law of one price',`User scored ${correct}/4 on arbitrage quiz. They ${correct>=3?'mostly correctly':'partially correctly'} identified price discrepancies.`);
    };
  }
  render();
}

function initOptionsBasicsGame(el) {
  let spot=100, strike=100, vol=25, days=90, explored=new Set();
  function norm(x){return 0.5*(1+Math.sign(x)*Math.sqrt(1-Math.exp(-2*x*x/Math.PI)));}
  function price(){
    const t=days/365,s=vol/100;
    const d1=(Math.log(spot/strike)+(0.05+s*s/2)*t)/(s*Math.sqrt(t));
    const d2=d1-s*Math.sqrt(t);
    return {call:spot*norm(d1)-strike*Math.exp(-0.05*t)*norm(d2),intr:Math.max(0,spot-strike),delta:norm(d1)};
  }
  function mood(){ if(explored.size>=3)return'excited'; if(spot>strike)return'happy'; return'thinking'; }
  function charLine(){
    const {call,intr,delta}=price();
    const tv=Math.max(0,call-intr);
    if(explored.size>=3) return `Black-Scholes shows options pricing is math, not magic! 4 inputs → exact fair value. Explore all 4 levers!`;
    if(explored.has('vol')) return `See how vol=${vol}% adds $${tv.toFixed(2)} time value? Higher vol = more chance of a big move = more valuable option!`;
    if(explored.has('spot')) return `At $${spot} spot vs $${strike} strike: ${spot>strike?`ITM! Intrinsic = $${intr}, Delta ${delta.toFixed(2)}`:`OTM. All $${tv.toFixed(2)} is time value.`}`;
    return `I'm Finn. This is Black-Scholes — a Nobel-winning formula for option pricing. Drag any slider to see how each input affects call price!`;
  }
  function render(){
    const {call,intr,delta}=price();
    const tv=Math.max(0,call-intr);
    const itm=spot>strike;
    el.innerHTML=`
      ${_goal('Explore all 4 price drivers (spot, strike, vol, time)', explored.size, 4, 50)}
      ${_char('Finn', mood(), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-size:11px;color:var(--muted)">Call Option Price</div>
            <div style="font-size:32px;font-weight:900;color:var(--green)">$${call.toFixed(2)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;padding:3px 8px;border-radius:8px;background:${itm?'rgba(0,200,150,.15)':'rgba(255,96,128,.12)'};color:${itm?'var(--green)':'var(--red)'}">${itm?'In The Money ✅':'Out of Money ❌'}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">Δ = ${delta.toFixed(3)}</div>
          </div>
        </div>
        <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:4px">
          <div style="width:${intr/call*100||0}%;background:var(--green);transition:width .3s" title="Intrinsic"></div>
          <div style="width:${tv/call*100||100}%;background:var(--accent2);transition:width .3s" title="Time Value"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span style="color:var(--green)">Intrinsic $${intr.toFixed(2)}</span><span style="color:var(--accent2)">Time Value $${tv.toFixed(2)}</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[
          ['📈 Spot Price','$'+spot,60,160,'obgS','spot'],
          ['🎯 Strike','$'+strike,60,160,'obgK','strike'],
          ['🌪️ Volatility',vol+'%',5,80,'obgV','vol'],
          ['📅 Days',days,1,365,'obgD','days'],
        ].map(([l,val,mn,mx,fn,key])=>`
          <div style="background:var(--card2);border-radius:9px;padding:10px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>${l}</span><span style="color:var(--gold)">${val}</span></div>
            <input type="range" min="${mn}" max="${mx}" value="${key==='spot'?spot:key==='strike'?strike:key==='vol'?vol:days}" oninput="${fn}(this.value)" style="margin:0">
          </div>`).join('')}
      </div>
      ${explored.size>=4?_win('🎓','Options Analyst!','You understand all 4 Black-Scholes inputs: spot price, strike, volatility, and time to expiry.'):''}`;
    window.obgS=v=>{spot=parseInt(v);explored.add('spot');render();};
    window.obgK=v=>{strike=parseInt(v);explored.add('strike');render();};
    window.obgV=v=>{vol=parseInt(v);explored.add('vol');render();};
    window.obgD=v=>{days=parseInt(v);explored.add('days');render();};
  }
  render();
}

function initPutCallGame(el) {
  let C=8, P=3, S=100, K=95, foundViolation=false, checks=0;
  const r=5, T=1;
  function pvK(){ return K*Math.exp(-r/100*T); }
  function lhs(){ return C-P; }
  function rhs(){ return S-pvK(); }
  function diff(){ return Math.abs(lhs()-rhs()); }
  function ok(){ return diff()<0.5; }
  function mood(){ if(foundViolation)return'excited'; if(!ok())return'money'; if(checks>2)return'happy'; return'thinking'; }
  function charLine(){
    if(foundViolation) return `You found a violation! C−P=$${lhs().toFixed(2)} ≠ S−PV(K)=$${rhs().toFixed(2)}. Gap of $${diff().toFixed(2)} = arb profit per unit. In real markets this closes in microseconds!`;
    if(!ok()) return `Parity VIOLATED! C−P = $${lhs().toFixed(2)} but S−PV(K) = $${rhs().toFixed(2)}. That's a $${diff().toFixed(2)} gap — risk-free arb exists right now!`;
    if(checks>0) return `C−P = $${lhs().toFixed(2)} and S−PV(K) = $${rhs().toFixed(2)}. Parity holds — no free lunch here. Keep tweaking to find a violation!`;
    return `I'm Alex. Put-call parity says C − P must equal S − PV(K). If it doesn't, arb traders exploit it instantly. Try to find a violation by adjusting the prices!`;
  }
  function render(){
    if(!ok()) foundViolation=true;
    const W=200, H=50;
    const lhsV=lhs(), rhsV=rhs(), maxV=Math.max(Math.abs(lhsV),Math.abs(rhsV),1);
    el.innerHTML=`
      ${_goal('Discover a put-call parity violation (gap > $0.5)', foundViolation?1:0, 1, 50)}
      ${_char('Alex', mood(), charLine())}
      <div style="background:var(--card2);border-radius:12px;padding:14px;margin-bottom:12px;text-align:center">
        <div style="font-size:13px;color:var(--muted);margin-bottom:6px">Put-Call Parity</div>
        <div style="font-size:18px;font-weight:800;color:var(--accent2);letter-spacing:1px">C − P = S − PV(K)</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">where PV(K) = K × e<sup>−rT</sup> = $${pvK().toFixed(2)}</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px">
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--muted)">C − P</div>
            <div style="font-size:28px;font-weight:900;color:var(--accent2)">$${lhsV.toFixed(2)}</div>
          </div>
          <div style="font-size:28px;font-weight:900;color:${ok()?'var(--green)':'var(--red)'}">${ok()?'=':'≠'}</div>
          <div style="text-align:center">
            <div style="font-size:10px;color:var(--muted)">S − PV(K)</div>
            <div style="font-size:28px;font-weight:900;color:var(--gold)">$${rhsV.toFixed(2)}</div>
          </div>
        </div>
        ${!ok()?`<div style="margin-top:8px;font-size:14px;font-weight:700;color:var(--red)">Gap: $${diff().toFixed(2)} — ARB OPPORTUNITY! 🚨</div>`:''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        ${[['📞 Call Price (C)','$'+C,0,30,'pcC'],['🛡️ Put Price (P)','$'+P,0,30,'pcP'],['📈 Spot (S)','$'+S,60,150,'pcS'],['🎯 Strike (K)','$'+K,60,150,'pcK']].map(([l,v,mn,mx,fn])=>`
          <div style="background:var(--card2);border-radius:9px;padding:9px">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:3px"><span>${l}</span><span style="color:var(--gold)">${v}</span></div>
            <input type="range" min="${mn}" max="${mx}" step=".5" value="${l.includes('Call')?C:l.includes('Put')?P:l.includes('Spot')?S:K}" oninput="${fn}(this.value)">
          </div>`).join('')}
      </div>
      ${foundViolation?_win('⚖️','Parity Detective!',`You found a $${diff().toFixed(2)} violation! The formula C−P = S−PV(K) must always hold, or arb traders instantly profit.`):''}`;
    window.pcC=v=>{C=parseFloat(v);checks++;render();};
    window.pcP=v=>{P=parseFloat(v);checks++;render();};
    window.pcS=v=>{S=parseFloat(v);checks++;render();};
    window.pcK=v=>{K=parseFloat(v);checks++;render();};
  }
  render();
}

// ===== QUIZ =====
let _quizSelected = -1;  // index of selected option, -1 = none

function renderQuiz(ch, el) {
  const q = ch.quiz[state.qIdx];
  const total = ch.quiz.length;
  _quizSelected = -1;
  el.innerHTML = `
    <div class="quiz-wrap">
      <div class="panel">
        <div class="panel-label">Quiz — ${ch.title}</div>
        <div style="margin-bottom:16px">
          <div class="bar-track"><div class="bar-fill accent" style="width:${(state.qIdx/total)*100}%"></div></div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">Question ${state.qIdx+1} of ${total}</div>
        </div>
        <div class="quiz-q">${q.q}</div>
        <div class="quiz-opts" id="quiz-opts">
          ${q.opts.map((o,i)=>`<button class="quiz-opt" onclick="selectAnswer(${i})">${String.fromCharCode(65+i)}. ${o}</button>`).join('')}
        </div>
        <button class="btn btn-primary quiz-submit-btn" id="quiz-submit-btn" onclick="submitAnswer()" disabled>Submit Answer</button>
        <div class="quiz-explain" id="quiz-explain">💡 ${q.exp}</div>
        <div class="mt16" id="quiz-next-btn" style="display:none">
          ${state.qIdx<total-1
            ? `<button class="btn btn-primary" style="width:100%" onclick="nextQ()">Next Question →</button>`
            : `<button class="btn btn-gold" style="width:100%" onclick="completeChapter()">🏆 Complete Chapter!</button>`}
        </div>
      </div>
    </div>`;
  state.qAnswered = false;
}

function selectAnswer(i) {
  if (state.qAnswered) return;
  _quizSelected = i;
  document.querySelectorAll('.quiz-opt').forEach((o, idx) => {
    o.classList.toggle('selected', idx === i);
  });
  const submitBtn = document.getElementById('quiz-submit-btn');
  if (submitBtn) submitBtn.disabled = false;
}

function submitAnswer() {
  if (state.qAnswered || _quizSelected < 0) return;
  state.qAnswered = true;
  const i  = _quizSelected;
  const ch = CHAPTERS.find(c => c.id === state.current);
  const q  = ch.quiz[state.qIdx];
  const opts = document.querySelectorAll('.quiz-opt');
  opts.forEach(o => { o.setAttribute('disabled', true); o.classList.remove('selected'); });
  opts[i].classList.add(i === q.ans ? 'correct' : 'wrong');
  if (i !== q.ans) opts[q.ans].classList.add('correct');
  document.getElementById('quiz-submit-btn').style.display = 'none';
  document.getElementById('quiz-explain').classList.add('show');
  document.getElementById('quiz-next-btn').style.display = 'block';
  const alreadyDone = state.done.includes(state.current);
  if (i === q.ans) {
    if (!alreadyDone) { state.coins += 20; save(); notify('✅ Correct! +20 coins', 'ok'); }
    else { state.coins += 10; save(); notify('✅ Correct! +10 revision coins', 'ok'); }
  } else notify('❌ Not quite — see explanation', 'bad');
  // Update coin counter in chapter header
  const coinEl = document.getElementById('ch-coins');
  if (coinEl) coinEl.textContent = state.coins;
}

function nextQ() {
  state.qIdx++;
  state.qAnswered = false;
  save();
  const ch = CHAPTERS.find(c => c.id === state.current);
  renderQuiz(ch, document.getElementById('ch-content'));
}

function completeChapter() {
  const ch    = CHAPTERS.find(c => c.id === state.current);
  const chIdx = CHAPTERS.findIndex(c => c.id === state.current);
  if (!state.done.includes(ch.id)) {
    state.done.push(ch.id);
    state.coins += 100;
    // Queue bag animation: fly from completed chapter to the newly unlocked one
    if (chIdx >= 0 && chIdx + 1 < CHAPTERS.length) {
      _bagAnimPending = { from: chIdx, to: chIdx + 1 };
    }
  }
  save();
  const el = document.getElementById('ch-content');
  el.innerHTML = `
    <div class="complete-card">
      <span class="complete-icon">🎉</span>
      <div class="complete-title">${ch.title} Complete!</div>
      <div class="complete-sub">You've mastered the basics of ${ch.title.toLowerCase()}.</div>
      <div class="coins-badge">🪙 +100 FinCoins</div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:24px">${state.done.length}/${CHAPTERS.length} chapters done · ${state.coins} coins total</div>
      <div class="flex gap8 justify-center flex-wrap">
        ${state.done.length < CHAPTERS.length ? `<button class="btn btn-primary" onclick="openChapter('${CHAPTERS[CHAPTERS.findIndex(c=>c.id===ch.id)+1]?.id}')">Next Chapter →</button>` : ''}
        <button class="btn btn-ghost" onclick="showMap()">🗺️ Back to Map</button>
      </div>
      ${state.done.length === CHAPTERS.length ? '<div class="info-box green mt16">🏆 YOU\'VE MASTERED ALL OF FINCITY! Incredible work!</div>' : ''}
    </div>`;
  document.getElementById('phase-nav').innerHTML = '';
  document.getElementById('ch-coins').textContent = state.coins;
}

// ===== NOTIFICATION =====
function notify(msg, type) {
  const el = document.getElementById('notif');
  document.getElementById('notif-icon').textContent = type === 'ok' ? '✅' : '❌';
  document.getElementById('notif-text').textContent = msg;
  el.className = 'notif show ' + (type === 'ok' ? 'ok' : 'bad');
  setTimeout(() => el.classList.remove('show'), 2800);
}
