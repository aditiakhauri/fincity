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

const MAP_PATH_D = "M120,90 L450,90 L780,90 C870,90 870,240 780,240 L450,240 L120,240 C30,240 30,390 120,390 L450,390 L780,390 C870,390 870,540 780,540 L450,540 L120,540 C30,540 30,690 120,690 L450,690 L780,690";

const MAP_POS = [
  [120,90],[450,90],[780,90],
  [780,240],[450,240],[120,240],
  [120,390],[450,390],[780,390],
  [780,540],[450,540],[120,540],
  [120,690],[450,690],[780,690]
];

const MAP_OFFSETS = [0,0.085,0.170,0.207,0.293,0.378,0.415,0.500,0.585,0.623,0.708,0.793,0.830,0.915,1.000];

let _bagAnimPending = null;

function renderMap() {
  document.getElementById('map-coins').textContent = state.coins;
  document.getElementById('map-prog').textContent  = state.done.length + '/15';

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
      <g style="cursor:${cursor}" ${click}>
        <circle cx="${cx}" cy="${cy}" r="${r+18}" fill="rgba(0,200,150,.04)" stroke="none"/>
        <circle cx="${cx}" cy="${cy}" r="${r+9}"  fill="rgba(0,200,150,.07)" stroke="rgba(0,200,150,.18)" stroke-width="1"/>
        <circle cx="${cx}" cy="${cy}" r="${r}"    fill="url(#mn-done)" stroke="#00c896" stroke-width="2.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r-7}"  fill="none" stroke="rgba(0,200,150,.2)" stroke-width="1"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="20">${ch.icon}</text>
        <circle cx="${cx+r-3}" cy="${cy-r+3}" r="12" fill="url(#mn-gold)"/>
        <text x="${cx+r-3}" y="${cy-r+3}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="#1a0e00" font-weight="900">✓</text>
        <text x="${cx}" y="${cy+r+17}" text-anchor="middle" font-size="12.5" fill="#3dffa0" font-weight="700" font-family="system-ui,sans-serif">${label}</text>
        <text x="${cx}" y="${cy+r+32}" text-anchor="middle" font-size="10"   fill="#1e7a50" font-family="system-ui,sans-serif">Ch.${ch.num}</text>
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
    <svg id="map-svg" viewBox="0 0 900 780" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
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
      <rect width="900" height="780" fill="#080816"/>
      <rect width="900" height="780" fill="url(#mn-grid)"/>
      <rect width="900" height="780" fill="url(#mn-vig)"/>

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
      </g>

      <!-- Street-corner circles (give a real city-map feel) -->
      <g fill="none" stroke="#1e1e46" stroke-width="0.8" opacity="0.4">
        <circle cx="870" cy="165" r="75"/> <circle cx="30"  cy="315" r="75"/>
        <circle cx="870" cy="465" r="75"/> <circle cx="30"  cy="615" r="75"/>
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
      <text x="450" y="763" text-anchor="middle" font-size="11" fill="#28285a"
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
  document.getElementById('ch-icon').textContent = ch.icon;
  document.getElementById('ch-title').textContent = ch.title;
  document.getElementById('ch-sub').textContent = `Chapter ${ch.num} · ${ch.tag}`;
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

function initStockGame(el) {
  let budget = 500, shares = 0, price = 50, totalShares = 1000;
  function render() {
    const owned = ((shares / totalShares) * 100).toFixed(1);
    const value = (shares * price).toFixed(0);
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">🍌 BananaCo</div>
        <div class="big-number gold">$${price} / share</div>
        <div style="font-size:12px;color:var(--muted)">Total company: 1,000 shares · Worth $${(price*totalShares).toLocaleString()}</div>
      </div>
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">💵 Your Budget</div><div class="wallet-value" style="color:var(--green)">$${budget}</div></div>
        <div class="wallet-item"><div class="wallet-label">📦 Shares Owned</div><div class="wallet-value" style="color:var(--gold)">${shares}</div></div>
        <div class="wallet-item"><div class="wallet-label">💰 Portfolio Value</div><div class="wallet-value" style="color:var(--accent2)">$${value}</div></div>
      </div>
      <div class="bar-row">
        <div class="bar-labels"><span>Your Ownership</span><span style="color:var(--gold)">${owned}%</span></div>
        <div class="bar-track"><div class="bar-fill gold" style="width:${Math.min(owned,100)}%"></div></div>
      </div>
      <div class="flex gap8 mt16">
        <button class="btn btn-green" style="flex:1" onclick="stockBuy()" ${budget < price ? 'disabled' : ''}>Buy 1 Share (+$${price})</button>
        <button class="btn btn-red" style="flex:1" onclick="stockSell()" ${shares === 0 ? 'disabled' : ''}>Sell 1 Share (-$${price})</button>
      </div>
      <div class="flex gap8 mt8">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="stockBuy5()" ${budget < price*5 ? 'disabled' : ''}>Buy 5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="stockPriceUp()">📈 Price +$5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="stockPriceDown()">📉 Price −$5</button>
      </div>
      ${shares > 0 ? `<div class="info-box green mt12">✅ You own ${owned}% of BananaCo! Your investment is worth $${value}. ${shares >= 100 ? '🎉 Major shareholder!' : 'Keep buying to increase ownership.'}</div>` : `<div class="info-box mt12">👆 Buy shares to become a BananaCo owner. Each share = $${price} and gives you a tiny piece of the company.</div>`}`;
    window.stockBuy = () => { if(budget>=price){budget-=price;shares++;render();} };
    window.stockSell = () => { if(shares>0){budget+=price;shares--;render();} };
    window.stockBuy5 = () => { let n=Math.min(5,Math.floor(budget/price));budget-=n*price;shares+=n;render(); };
    window.stockPriceUp = () => { price+=5; render(); };
    window.stockPriceDown = () => { if(price>10){price-=5;} render(); };
  }
  render();
}

function initBidAskGame(el) {
  let userAction = null;
  function render() {
    el.innerHTML = `
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px">📋 Live Order Book — BananaCo</div>
      <div class="orderbook">
        <div class="ob-side">
          <div class="ob-label ask">ASKS (Sellers)</div>
          <div class="ob-row"><span class="price ask">$54.00</span><span style="color:var(--muted)">200 shares</span></div>
          <div class="ob-row"><span class="price ask">$53.00</span><span style="color:var(--muted)">350 shares</span></div>
          <div class="ob-row"><span class="price ask">$52.00</span><span style="color:var(--muted)">150 shares</span></div>
        </div>
        <div class="ob-side">
          <div class="ob-label bid">BIDS (Buyers)</div>
          <div class="ob-row"><span class="price bid">$48.00</span><span style="color:var(--muted)">300 shares</span></div>
          <div class="ob-row"><span class="price bid">$47.00</span><span style="color:var(--muted)">220 shares</span></div>
          <div class="ob-row"><span class="price bid">$46.00</span><span style="color:var(--muted)">180 shares</span></div>
        </div>
      </div>
      <div style="text-align:center;background:var(--card2);border-radius:8px;padding:10px;margin:10px 0;font-size:13px">
        Spread: <span style="color:var(--red);font-weight:700">$52</span> (ask) − <span style="color:var(--green);font-weight:700">$48</span> (bid) = <span style="color:var(--gold);font-weight:700">$4</span> &nbsp;|&nbsp; Mid: $50
      </div>
      <div class="flex gap8">
        <button class="btn btn-green" style="flex:1" onclick="doBuy()">🛒 Buy Now (pay $52 ask)</button>
        <button class="btn btn-red" style="flex:1" onclick="doSell()">💸 Sell Now (get $48 bid)</button>
      </div>
      ${userAction === 'buy' ? `<div class="info-box green mt12">✅ Order FILLED at $52 (the Ask). Sellers were asking $52 minimum, so that's what you paid. The $4 spread went to the market maker!</div>` : ''}
      ${userAction === 'sell' ? `<div class="info-box red mt12">✅ Order FILLED at $48 (the Bid). Buyers were only willing to pay $48, so that's what you received. You "lost" $4 to the spread.</div>` : ''}
      <div class="info-box mt12">💡 <b>Spread = $4.</b> A market maker buys at $48 (bid) and sells at $52 (ask), pocketing $4 per share. Tighter spreads = fairer prices for traders.</div>`;
    window.doBuy = () => { userAction='buy'; render(); };
    window.doSell = () => { userAction='sell'; render(); };
  }
  render();
}

function initTradingGame(el) {
  let marketPrice = 50, orders = [], limitPrice = 45, orderType = 'market';
  function render() {
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:12px;color:var(--muted)">BananaCo Current Price</div>
        <div class="big-number gold">$${marketPrice}</div>
      </div>
      <div class="flex gap8" style="margin-bottom:12px">
        <button class="btn ${orderType==='market'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setOT('market')">Market Order</button>
        <button class="btn ${orderType==='limit'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setOT('limit')">Limit Order</button>
      </div>
      ${orderType==='market' ? `
        <div class="info-box">⚡ Market Order: Fills IMMEDIATELY at current price ($${marketPrice}). Fast, but no price control.</div>
        <div class="flex gap8 mt12">
          <button class="btn btn-green" style="flex:1" onclick="placeMarket('buy')">Buy Now at $${marketPrice}</button>
          <button class="btn btn-red" style="flex:1" onclick="placeMarket('sell')">Sell Now at $${marketPrice}</button>
        </div>` : `
        <div class="info-box">⏳ Limit Order: Only fills if price reaches your target. You're in control, but may wait forever.</div>
        <div style="margin:12px 0">
          <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px"><span>Limit Buy Price: <b style="color:var(--gold)">$${limitPrice}</b></span><span style="color:var(--muted)">Current: $${marketPrice}</span></div>
          <input type="range" min="30" max="70" value="${limitPrice}" oninput="setLP(this.value)">
        </div>
        <button class="btn btn-primary" style="width:100%;margin-bottom:8px" onclick="placeLimitBuy()">Place Limit Buy at $${limitPrice}</button>
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="movePrice()">📉 Drop market price by $3</button>`}
      <div style="margin-top:14px">
        ${orders.map(o=>`<div class="info-box ${o.filled?'green':'gold'}">${o.filled?'✅':'⏳'} ${o.type.toUpperCase()} ${o.action} · ${o.filled?'Filled at $'+o.price:'Waiting for $'+o.target+' (market: $'+marketPrice+')'}</div>`).join('')}
      </div>`;
    window.setOT = t => { orderType=t; render(); };
    window.setLP = v => { limitPrice=parseInt(v); render(); };
    window.placeMarket = a => {
      orders.unshift({type:'market',action:a,price:marketPrice,filled:true});
      notify('✅ Market '+a+' filled at $'+marketPrice,'ok');
      render();
    };
    window.placeLimitBuy = () => {
      if(limitPrice>=marketPrice){notify('Limit price must be below market price!','bad');return;}
      orders.unshift({type:'limit',action:'buy',target:limitPrice,price:null,filled:false});
      render();
    };
    window.movePrice = () => {
      marketPrice = Math.max(30,marketPrice-3);
      orders = orders.map(o=>{ if(!o.filled&&o.type==='limit'&&marketPrice<=o.target){o.filled=true;o.price=o.target;notify('✅ Limit order filled at $'+o.target,'ok');} return o; });
      render();
    };
  }
  render();
}

function initDividendsGame(el) {
  let shares = 50, price = 40, div = 0;
  function render() {
    const annual = (shares * div).toFixed(2);
    const yld = price > 0 ? ((div / price) * 100).toFixed(2) : '0.00';
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">📦 Shares</div><div class="wallet-value" style="color:var(--accent2)">${shares}</div></div>
        <div class="wallet-item"><div class="wallet-label">💵 Share Price</div><div class="wallet-value" style="color:var(--gold)">$${price}</div></div>
        <div class="wallet-item"><div class="wallet-label">📬 Div/Share</div><div class="wallet-value" style="color:var(--green)">$${div.toFixed(2)}</div></div>
      </div>
      <div style="text-align:center;margin:16px 0">
        <div style="font-size:12px;color:var(--muted)">Annual Dividend Income</div>
        <div class="big-number ${div>0?'green':'muted'}" style="${div===0?'color:var(--muted)':''}">$${annual}</div>
        <div style="font-size:13px;color:var(--muted)">Dividend Yield: <b style="color:var(--gold)">${yld}%</b></div>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:8px">Set dividend per share:</div>
      <input type="range" min="0" max="5" step="0.25" value="${div}" oninput="setDiv(this.value)">
      <div class="flex gap8 mt12">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjShares(-10)">−10 shares</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjShares(10)">+10 shares</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjPrice(-5)">Price −$5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjPrice(5)">Price +$5</button>
      </div>
      <div class="info-box mt12">${div===0?'👆 Drag the slider to set a dividend. Watch how your income changes!':'💰 With '+shares+' shares paying $'+div.toFixed(2)+' each, you earn $'+annual+' per year ('+yld+'% yield). That\'s passive income just for owning shares!'}</div>`;
    window.setDiv = v => { div=parseFloat(v); render(); };
    window.adjShares = n => { shares=Math.max(0,shares+n); render(); };
    window.adjPrice = n => { price=Math.max(5,price+n); render(); };
  }
  render();
}

function initPortfolioGame(el) {
  const assets = [
    { name:'🍌 BananaCo Stock', pct:40, color:'#7c6dfa' },
    { name:'🥇 GoldCorp', pct:20, color:'#f5c518' },
    { name:'⛽ OilPlus Energy', pct:15, color:'#ff6080' },
    { name:'🏛️ FinCity Bonds', pct:15, color:'#00c896' },
    { name:'💵 Cash', pct:10, color:'#4fc3f7' }
  ];
  function render() {
    const total = assets.reduce((s,a)=>s+a.pct,0);
    const svgSize = 130, r = 52, cx = 65, cy = 65;
    let startAngle = -Math.PI/2, paths = '';
    assets.forEach(a=>{
      const slice = (a.pct/100)*Math.PI*2;
      const endAngle = startAngle+slice;
      const x1=cx+r*Math.cos(startAngle), y1=cy+r*Math.sin(startAngle);
      const x2=cx+r*Math.cos(endAngle), y2=cy+r*Math.sin(endAngle);
      const lg = slice>Math.PI?1:0;
      paths+=`<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} Z" fill="${a.color}" opacity=".85"/>`;
      startAngle=endAngle;
    });
    el.innerHTML = `
      <div class="flex gap12" style="align-items:flex-start;flex-wrap:wrap">
        <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" style="flex-shrink:0">${paths}<circle cx="${cx}" cy="${cy}" r="28" fill="var(--card)"/><text x="${cx}" y="${cy+5}" text-anchor="middle" fill="var(--text)" font-size="11">Portfolio</text></svg>
        <div style="flex:1;min-width:180px">
          ${assets.map((a,i)=>`
            <div style="margin-bottom:8px">
              <div class="flex items-center justify-between" style="font-size:12px;margin-bottom:2px">
                <span>${a.name}</span><span style="color:${a.color};font-weight:700">${a.pct}%</span>
              </div>
              <input type="range" min="0" max="100" value="${a.pct}" oninput="setAlloc(${i},this.value)" style="accent-color:${a.color};margin:0">
            </div>`).join('')}
          <div style="font-size:12px;margin-top:8px;color:${total===100?'var(--green)':'var(--red)'}">
            Total: ${total}% ${total===100?'✅ Perfectly allocated':'⚠️ Must equal 100%'}
          </div>
        </div>
      </div>
      <div class="info-box mt12">
        ${total===100 ? '✅ Great allocation! You\'re diversified across stocks, gold, energy, bonds, and cash. No single asset can wipe you out.' : '⚖️ Adjust sliders to allocate your $10,000. Goal: reach exactly 100% total across all assets.'}
      </div>`;
    window.setAlloc = (i,v) => { assets[i].pct=parseInt(v); render(); };
  }
  render();
}

function initVolatilityGame(el) {
  let mode = 'stable', animFrame = null;
  const stablePrices = generatePrices(100, 0.5);
  const volPrices = generatePrices(100, 8);
  function generatePrices(start, vol) {
    let p=[start], v=start;
    for(let i=0;i<59;i++){v=Math.max(10,v+(Math.random()-0.5)*vol*2);p.push(+v.toFixed(2));}
    return p;
  }
  function render() {
    const prices = mode==='stable'?stablePrices:volPrices;
    const min=Math.min(...prices), max=Math.max(...prices);
    const swing = ((max-min)/prices[0]*100).toFixed(1);
    const last = prices[prices.length-1];
    const chg = ((last-prices[0])/prices[0]*100).toFixed(1);
    const w=300,h=120,pad=10;
    const points = prices.map((p,i)=>`${pad+i*(w-2*pad)/59},${pad+(max-p)/(max-min||1)*(h-2*pad)}`).join(' ');
    const color = mode==='stable'?'var(--green)':'var(--accent2)';
    el.innerHTML = `
      <div class="flex gap8" style="margin-bottom:12px">
        <button class="btn ${mode==='stable'?'btn-green':'btn-ghost'} btn-sm" style="flex:1" onclick="setMode('stable')">📊 Stable Asset</button>
        <button class="btn ${mode==='volatile'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setMode('volatile')">🎢 Volatile Asset</button>
      </div>
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;background:var(--card2);border-radius:8px;margin-bottom:12px">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
        <circle cx="${pad+(59)*(w-2*pad)/59}" cy="${pad+(max-last)/(max-min||1)*(h-2*pad)}" r="4" fill="${color}"/>
      </svg>
      <div class="flex gap8">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Price Swing</div>
          <div style="font-size:20px;font-weight:700;color:${color}">${swing}%</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Total Change</div>
          <div style="font-size:20px;font-weight:700;color:${parseFloat(chg)>=0?'var(--green)':'var(--red)'}">${chg}%</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Risk Level</div>
          <div style="font-size:20px;font-weight:700;color:${color}">${mode==='stable'?'Low':'High'}</div>
        </div>
      </div>
      <div class="info-box mt12">${mode==='stable'?'📊 Stable assets (bonds, blue-chip stocks) have small price swings. Lower risk, lower potential return.':'🎢 Volatile assets swing wildly! The same movement that creates big gains can cause massive losses. Higher risk = higher potential reward.'}</div>`;
    window.setMode = m => { mode=m; render(); };
  }
  render();
}

function initInterestGame(el) {
  let principal=1000, rate=5, years=10;
  function render() {
    const compound = principal*Math.pow(1+rate/100,years);
    const simple = principal*(1+rate*years/100);
    const extra = (compound-simple).toFixed(2);
    el.innerHTML = `
      <div>
        <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px"><span>Principal: <b style="color:var(--gold)">$${principal.toLocaleString()}</b></span></div>
        <input type="range" min="100" max="10000" step="100" value="${principal}" oninput="setP(this.value)">
        <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px;margin-top:10px"><span>Annual Rate: <b style="color:var(--accent2)">${rate}%</b></span></div>
        <input type="range" min="1" max="20" step="0.5" value="${rate}" oninput="setR(this.value)">
        <div class="flex items-center justify-between" style="font-size:13px;margin-bottom:4px;margin-top:10px"><span>Years: <b style="color:var(--green)">${years}</b></span></div>
        <input type="range" min="1" max="30" value="${years}" oninput="setY(this.value)">
      </div>
      <div class="flex gap8 mt16">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Compound Interest</div>
          <div style="font-size:20px;font-weight:700;color:var(--green)">$${compound.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Simple Interest</div>
          <div style="font-size:20px;font-weight:700;color:var(--gold)">$${simple.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,',')}</div>
        </div>
      </div>
      <div class="info-box green mt12">🔮 Compound earns <b>$${extra} MORE</b> than simple interest! That's the power of earning interest ON your interest — this gap grows dramatically over time.</div>`;
    window.setP=v=>{principal=parseInt(v);render();};
    window.setR=v=>{rate=parseFloat(v);render();};
    window.setY=v=>{years=parseInt(v);render();};
  }
  render();
}

function initFXGame(el) {
  const rates = { EUR: 0.92, GBP: 0.79, JPY: 149.5, CAD: 1.36 };
  let from='USD', to='EUR', amount=100;
  function render() {
    const rate = to==='USD' ? 1/rates[from] : rates[to];
    const result = (amount * rate).toFixed(2);
    const flags = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', CAD:'🇨🇦' };
    const currencies = ['USD','EUR','GBP','JPY','CAD'];
    el.innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:6px">Amount to convert:</div>
        <input type="number" value="${amount}" oninput="setAmt(this.value)" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 16px;color:var(--text);font-size:20px;font-weight:700;width:160px;text-align:center">
      </div>
      <div class="flex gap8" style="margin-bottom:14px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">FROM</div>
          <div class="flex" style="flex-wrap:wrap;gap:4px">
            ${currencies.map(c=>`<button class="btn btn-sm ${from===c?'btn-primary':'btn-ghost'}" onclick="setFrom('${c}')">${flags[c]} ${c}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="flex gap8" style="margin-bottom:14px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">TO</div>
          <div class="flex" style="flex-wrap:wrap;gap:4px">
            ${currencies.map(c=>`<button class="btn btn-sm ${to===c?'btn-primary':'btn-ghost'}" onclick="setTo('${c}')">${flags[c]} ${c}</button>`).join('')}
          </div>
        </div>
      </div>
      <div style="background:var(--card2);border-radius:12px;padding:18px;text-align:center">
        <div style="font-size:13px;color:var(--muted)">${flags[from]} ${amount} ${from} =</div>
        <div class="big-number accent">${flags[to]} ${result} ${to}</div>
        <div style="font-size:12px;color:var(--muted)">Rate: 1 ${from} = ${rate.toFixed(4)} ${to}</div>
      </div>`;
    window.setAmt=v=>{amount=parseFloat(v)||0;render();};
    window.setFrom=c=>{from=c;if(to===c)to=c==='USD'?'EUR':'USD';render();};
    window.setTo=c=>{to=c;if(from===c)from=c==='USD'?'EUR':'USD';render();};
  }
  render();
}

function initCommodityGame(el) {
  let prices = { Gold: 1950, Oil: 78, Wheat: 290, Coffee: 185 };
  let holdings = { Gold: 0, Oil: 0, Wheat: 0, Coffee: 0 };
  let cash = 1000;
  const icons = { Gold:'🥇', Oil:'⛽', Wheat:'🌾', Coffee:'☕' };
  const events = [
    { text:'⛈️ Bad harvest in Brazil!', effect: { Wheat:+40, Coffee:+30 } },
    { text:'🛢️ OPEC cuts production!', effect: { Oil:+18 } },
    { text:'💵 Strong USD!', effect: { Gold:-25, Oil:-8 } },
    { text:'🌍 Economic boom!', effect: { Gold:-15, Oil:+22, Wheat:+10 } },
    { text:'😨 Market panic! Investors flee to gold!', effect: { Gold:+80, Oil:-15 } }
  ];
  function pv() { return Object.keys(holdings).reduce((s,k)=>s+holdings[k]*prices[k],0); }
  function render() {
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">💵 Cash</div><div class="wallet-value" style="color:var(--green)">$${cash.toFixed(0)}</div></div>
        <div class="wallet-item"><div class="wallet-label">📦 Holdings Value</div><div class="wallet-value" style="color:var(--gold)">$${pv().toFixed(0)}</div></div>
      </div>
      <table class="tbl" style="margin-bottom:12px">
        <tr><th>Commodity</th><th>Price</th><th>Owned</th><th>Actions</th></tr>
        ${Object.keys(prices).map(k=>`
          <tr>
            <td>${icons[k]} ${k}</td>
            <td style="color:var(--gold);font-weight:600">$${prices[k]}</td>
            <td>${holdings[k]}</td>
            <td>
              <button class="btn btn-sm btn-green" onclick="buyComm('${k}')" ${cash<prices[k]?'disabled':''} style="padding:4px 10px;margin-right:4px">Buy</button>
              <button class="btn btn-sm btn-red" onclick="sellComm('${k}')" ${holdings[k]===0?'disabled':''} style="padding:4px 10px">Sell</button>
            </td>
          </tr>`).join('')}
      </table>
      <button class="btn btn-primary" style="width:100%" onclick="triggerEvent()">🎲 Trigger Market Event</button>
      <div id="event-msg"></div>`;
    window.buyComm=k=>{if(cash>=prices[k]){cash-=prices[k];holdings[k]++;render();}};
    window.sellComm=k=>{if(holdings[k]>0){cash+=prices[k];holdings[k]--;render();}};
    window.triggerEvent=()=>{
      const e=events[Math.floor(Math.random()*events.length)];
      Object.entries(e.effect).forEach(([k,v])=>{prices[k]=Math.max(10,prices[k]+v);});
      document.getElementById('event-msg').innerHTML=`<div class="info-box mt8">📢 <b>Event:</b> ${e.text} — see how commodity prices reacted!</div>`;
      render();
    };
  }
  render();
}

function initDerivativesGame(el) {
  let underlying = 100, leverage = 5;
  function render() {
    const deriv = (underlying - 100) * leverage;
    const col = deriv >= 0 ? 'var(--green)' : 'var(--red)';
    const pct = ((underlying-100)/100*100).toFixed(1);
    const derivPct = (pct*leverage).toFixed(1);
    el.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">🛢️ Oil Price (Underlying Asset): <b style="color:var(--gold)">$${underlying}</b></div>
        <input type="range" min="60" max="140" value="${underlying}" oninput="setUnd(this.value)">
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">⚡ Leverage: <b style="color:var(--accent2)">${leverage}x</b></div>
        <input type="range" min="1" max="10" value="${leverage}" oninput="setLev(this.value)">
      </div>
      <div class="flex gap8">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Oil Change</div>
          <div style="font-size:22px;font-weight:700;color:${pct>=0?'var(--green)':'var(--red)'}">${pct}%</div>
        </div>
        <div style="font-size:24px;display:flex;align-items:center">→</div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Derivative P&L</div>
          <div style="font-size:22px;font-weight:700;color:${col}">${deriv>=0?'+':''}$${deriv.toFixed(0)}</div>
          <div style="font-size:11px;color:var(--muted)">${derivPct}%</div>
        </div>
      </div>
      <div class="info-box mt12">${leverage===1?'At 1x leverage, derivative moves match the underlying 1:1.':'⚡ With '+leverage+'x leverage: oil moves '+pct+'% → derivative moves '+derivPct+'%! That\'s the POWER of derivatives. But losses are amplified equally — '+leverage+'x gains, '+leverage+'x losses.'}</div>`;
    window.setUnd=v=>{underlying=parseInt(v);render();};
    window.setLev=v=>{leverage=parseInt(v);render();};
  }
  render();
}

function initOptionsGame(el) {
  let strike=55, premium=3, spotPrice=50, optionType='call';
  function render() {
    const itm = optionType==='call' ? spotPrice>strike : spotPrice<strike;
    let payoff = 0;
    if(optionType==='call') payoff = Math.max(0, spotPrice-strike) - premium;
    else payoff = Math.max(0, strike-spotPrice) - premium;
    const breakeven = optionType==='call' ? strike+premium : strike-premium;
    const col = payoff>0?'var(--green)':payoff<0?'var(--red)':'var(--muted)';
    el.innerHTML = `
      <div class="flex gap8" style="margin-bottom:12px">
        <button class="btn ${optionType==='call'?'btn-primary':'btn-ghost'} btn-sm" style="flex:1" onclick="setOType('call')">📈 Call Option</button>
        <button class="btn ${optionType==='put'?'btn-red':'btn-ghost'} btn-sm" style="flex:1" onclick="setOType('put')">📉 Put Option</button>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px">
        ${optionType==='call'?'Right to BUY at strike price':'Right to SELL at strike price'}
      </div>
      <div class="flex gap8" style="margin-bottom:12px">
        <div style="flex:1"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">Strike: <b style="color:var(--gold)">$${strike}</b></div><input type="range" min="40" max="70" value="${strike}" oninput="setStrike(this.value)"></div>
        <div style="flex:1"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">Premium: <b style="color:var(--red)">$${premium}</b></div><input type="range" min="1" max="10" value="${premium}" oninput="setPrem(this.value)"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">Current Stock Price: <b style="color:var(--accent2)">$${spotPrice}</b></div>
      <input type="range" min="30" max="80" value="${spotPrice}" oninput="setSpot(this.value)">
      <div class="flex gap8 mt12">
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Status</div>
          <div style="font-size:14px;font-weight:700;color:${itm?'var(--green)':'var(--red)'}">${itm?'In The Money ✅':'Out of Money ❌'}</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Break-even</div>
          <div style="font-size:18px;font-weight:700;color:var(--gold)">$${breakeven}</div>
        </div>
        <div style="flex:1;background:var(--card2);border-radius:10px;padding:12px;text-align:center">
          <div style="font-size:11px;color:var(--muted)">Your P&L</div>
          <div style="font-size:18px;font-weight:700;color:${col}">${payoff>0?'+':''}$${payoff.toFixed(2)}</div>
        </div>
      </div>
      <div class="info-box mt12">${optionType==='call'
        ? (itm?`✅ In the money! Stock ($${spotPrice}) > Strike ($${strike}). You can buy at $${strike}, sell at $${spotPrice}. P&L: $${payoff.toFixed(2)}`:`Stock ($${spotPrice}) < Strike ($${strike}). Option is OTM. Max loss = $${premium} premium. You need price above $${breakeven} to profit.`)
        : (itm?`✅ In the money! Stock ($${spotPrice}) < Strike ($${strike}). You can sell at $${strike}, while market is $${spotPrice}. P&L: $${payoff.toFixed(2)}`:`Stock ($${spotPrice}) > Strike ($${strike}). Option is OTM. Max loss = $${premium} premium. You need price below $${breakeven} to profit.`)
      }</div>`;
    window.setStrike=v=>{strike=parseInt(v);render();};
    window.setPrem=v=>{premium=parseInt(v);render();};
    window.setSpot=v=>{spotPrice=parseInt(v);render();};
    window.setOType=t=>{optionType=t;render();};
  }
  render();
}

function initPayoffsGame(el) {
  let buyPrice=50, spotPrice=50;
  const callStrike=55, callPremium=3;
  const putStrike=45, putPremium=2;
  function render() {
    const longStock = spotPrice - buyPrice;
    const longCall = Math.max(0,spotPrice-callStrike)-callPremium;
    const longPut = Math.max(0,putStrike-spotPrice)-putPremium;
    const maxV = 30;
    function bar(v) {
      const pct = Math.min(100,Math.abs(v)/maxV*100);
      const isPos = v>=0;
      return `<div style="flex:1;height:18px;background:var(--card2);border-radius:4px;overflow:visible;position:relative">
        <div style="position:absolute;${isPos?'left:50%':'right:50%'};width:${pct/2}%;height:100%;background:${isPos?'var(--green)':'var(--red)'};border-radius:4px;top:0"></div>
        <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border)"></div>
      </div>`;
    }
    el.innerHTML = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">
        Stock Price at Expiry: <b style="color:var(--accent2)">$${spotPrice}</b>
      </div>
      <input type="range" min="20" max="80" value="${spotPrice}" oninput="setSpot2(this.value)" style="margin-bottom:16px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">P&L Comparison (bought at $${buyPrice}):</div>
      ${[
        {label:'📈 Long Stock', v:longStock},
        {label:'☎️ Long Call ($55 strike, $3 prem)', v:longCall},
        {label:'🛡️ Long Put ($45 strike, $2 prem)', v:longPut}
      ].map(r=>`
        <div class="flex items-center gap8" style="margin-bottom:10px">
          <div style="width:200px;font-size:12px">${r.label}</div>
          ${bar(r.v)}
          <div style="width:56px;text-align:right;font-size:13px;font-weight:700;color:${r.v>=0?'var(--green)':'var(--red)'}">${r.v>0?'+':''}$${r.v.toFixed(2)}</div>
        </div>`).join('')}
      <div class="info-box mt8">
        ${spotPrice>callStrike+callPremium?'🚀 Call option is most profitable above $'+(callStrike+callPremium)+'!':
          spotPrice<putStrike-putPremium?'📉 Put option is most profitable below $'+(putStrike-putPremium)+'!':
          'Stock is in the middle zone. Long stock gives the most linear payoff here.'}
        <br>Notice: <b>Max loss on options = premium paid</b>. Stock has no floor — it can fall to $0!
      </div>`;
    window.setSpot2=v=>{spotPrice=parseInt(v);render();};
  }
  render();
}

function initHedgingGame(el) {
  let stockPrice=50, crashed=false;
  const buyPrice=50, putStrike=48, putPremium=2, shares=100;
  function render() {
    const current = crashed ? 30 : stockPrice;
    const unhedged = (current-buyPrice)*shares;
    const putPayoff = Math.max(0,putStrike-current)*shares;
    const hedged = unhedged + putPayoff - putPremium*shares;
    const costOfHedge = putPremium*shares;
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">📦 Shares</div><div class="wallet-value">${shares} @ $${buyPrice}</div></div>
        <div class="wallet-item"><div class="wallet-label">🛡️ Put Option</div><div class="wallet-value" style="color:var(--green)">Strike $${putStrike}</div></div>
        <div class="wallet-item"><div class="wallet-label">💸 Hedge Cost</div><div class="wallet-value" style="color:var(--red)">-$${costOfHedge}</div></div>
      </div>
      <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:4px">Current Stock Price</div>
      <div class="big-number ${current<buyPrice?'red':'green'}">$${current}</div>
      <div class="hedge-comparison" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0">
        <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px">❌ Without Hedge</div>
          <div style="font-size:22px;font-weight:700;color:${unhedged>=0?'var(--green)':'var(--red)'}">${unhedged>=0?'+':''}$${unhedged}</div>
        </div>
        <div style="background:var(--card2);border-radius:10px;padding:14px;text-align:center;border:1px solid var(--green)">
          <div style="font-size:11px;color:var(--green);margin-bottom:6px">✅ With Hedge</div>
          <div style="font-size:22px;font-weight:700;color:${hedged>=0?'var(--green)':'var(--red)'}">${hedged>=0?'+':''}$${hedged}</div>
        </div>
      </div>
      <div class="flex gap8">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjHedgePrice(-5)">Price −$5</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="adjHedgePrice(5)">Price +$5</button>
        <button class="btn ${crashed?'btn-green':'btn-red'} btn-sm" style="flex:1" onclick="toggleCrash()">${crashed?'📈 Recover':'💥 Crash to $30!'}</button>
      </div>
      <div class="info-box ${hedged>unhedged?'green':''} mt12">
        ${crashed
          ? `💥 Stock crashed to $30! Without hedge: <b style="color:var(--red)">-$${Math.abs(unhedged)} loss</b>. With put option hedge: <b style="color:var(--green)">$${hedged>=0?'+':''}${hedged}</b>. The hedge SAVED $${Math.abs(hedged-unhedged)}!`
          : `🛡️ At $${current}: the hedge costs $${costOfHedge} but protects against big drops. Try crashing the stock to see the protection kick in!`
        }
      </div>`;
    window.adjHedgePrice=v=>{stockPrice=Math.max(10,stockPrice+v);crashed=false;render();};
    window.toggleCrash=()=>{crashed=!crashed;render();};
  }
  render();
}

function initOTCGame(el) {
  let step = 0;
  const steps = [
    { title:'1. Find a Counterparty', desc:'Alex needs a custom $1M interest rate swap. No exchange lists this. Finn calls Goldman Sachs directly.', action:'📞 Call Dealer', color:'var(--accent)' },
    { title:'2. Negotiate Terms', desc:'Goldman quotes: pay fixed 4.5%, receive floating (LIBOR + 0.5%). Duration: 5 years, $1M notional. Alex can negotiate every detail.', action:'🤝 Agree Terms', color:'var(--gold)' },
    { title:'3. Sign ISDA Agreement', desc:'Both parties sign a Master Agreement (ISDA). This legal contract defines what happens if either party defaults — the counterparty risk protection.', action:'✍️ Sign Contract', color:'var(--blue)' },
    { title:'4. Deal Is Live!', desc:'The swap is live. Every 6 months, Alex pays fixed and receives floating rate. No exchange, no clearinghouse — just two parties and a contract.', action:null, color:'var(--green)' }
  ];
  function render() {
    const s = steps[step];
    el.innerHTML = `
      <div style="margin-bottom:14px">
        ${steps.map((st,i)=>`
          <div class="flex items-center gap8 mt8">
            <div style="width:24px;height:24px;border-radius:50%;background:${i<=step?st.color:'var(--border)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i<step?'✓':i+1}</div>
            <div style="font-size:13px;color:${i===step?'var(--text)':i<step?'var(--muted)':'var(--border)'};font-weight:${i===step?700:400}">${st.title}</div>
          </div>`).join('')}
      </div>
      <div class="info-box" style="border-color:${s.color}">
        <b style="color:${s.color}">${s.title}</b><br><br>${s.desc}
      </div>
      ${step<3?`<button class="btn btn-primary mt16" style="width:100%" onclick="otcNext()">${s.action} →</button>`:
        `<div class="info-box green mt12">✅ Deal complete! The key difference from exchange trading: <b>no central guarantee</b>. If Goldman Sachs went bankrupt, Alex faces losses — that's counterparty risk.</div>
        <button class="btn btn-ghost mt8" style="width:100%" onclick="otcReset()">🔄 Start Over</button>`}`;
    window.otcNext=()=>{step=Math.min(3,step+1);render();};
    window.otcReset=()=>{step=0;render();};
  }
  render();
}

function initCryptoGame(el) {
  let wallet=0, usd=100, btcPrice=42000, mineCount=0;
  function render() {
    const portfolioUSD = wallet*btcPrice;
    el.innerHTML = `
      <div class="wallet">
        <div class="wallet-item"><div class="wallet-label">💵 USD</div><div class="wallet-value" style="color:var(--green)">$${usd.toFixed(2)}</div></div>
        <div class="wallet-item"><div class="wallet-label">₿ BTC</div><div class="wallet-value" style="color:var(--gold)">${wallet.toFixed(6)}</div></div>
        <div class="wallet-item"><div class="wallet-label">💎 BTC Value</div><div class="wallet-value" style="color:var(--accent2)">$${portfolioUSD.toFixed(0)}</div></div>
      </div>
      <div style="text-align:center;margin:12px 0">
        <div style="font-size:11px;color:var(--muted)">Bitcoin Price</div>
        <div class="big-number gold">$${btcPrice.toLocaleString()}</div>
      </div>
      <div style="text-align:center;margin-bottom:14px">
        <button class="mine-btn" onclick="mine()">⛏️</button>
        <div style="font-size:12px;color:var(--muted);margin-top:6px">Tap to Mine! (${mineCount} blocks mined)</div>
      </div>
      <div class="flex gap8">
        <button class="btn btn-green btn-sm" style="flex:1" onclick="buyBtc()" ${usd<100?'disabled':''}>Buy $100 of BTC</button>
        <button class="btn btn-red btn-sm" style="flex:1" onclick="sellBtc()" ${wallet<0.001?'disabled':''}>Sell 0.001 BTC</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="priceSwing()">🎢 Price Swing!</button>
      </div>
      <div class="info-box mt12">⛏️ Mining = computers solving hard math to validate transactions. Each solve earns newly created BTC. Real mining uses massive electricity! <br>The 21 million BTC cap means it's deflationary — can't just print more.</div>`;
    window.mine=()=>{wallet+=0.000001;mineCount++;btcPrice+=Math.floor(Math.random()*10-3);render();};
    window.buyBtc=()=>{if(usd>=100){usd-=100;wallet+=100/btcPrice;notify('₿ Bought $100 of Bitcoin!','ok');render();}};
    window.sellBtc=()=>{if(wallet>=0.001){usd+=0.001*btcPrice;wallet-=0.001;notify('💰 Sold 0.001 BTC for $'+(0.001*btcPrice).toFixed(2),'ok');render();}};
    window.priceSwing=()=>{const swing=(Math.random()-0.4)*8000;btcPrice=Math.max(5000,btcPrice+swing);notify((swing>0?'📈 BTC +$':'📉 BTC $')+Math.abs(swing).toFixed(0),swing>0?'ok':'bad');render();};
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
  if (i === q.ans) { state.coins += 20; save(); notify('✅ Correct! +20 coins', 'ok'); }
  else notify('❌ Not quite — see explanation', 'bad');
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
      <div style="color:var(--muted);font-size:13px;margin-bottom:24px">${state.done.length}/15 chapters done · ${state.coins} coins total</div>
      <div class="flex gap8 justify-center flex-wrap">
        ${state.done.length < 15 ? `<button class="btn btn-primary" onclick="openChapter('${CHAPTERS[CHAPTERS.findIndex(c=>c.id===ch.id)+1]?.id}')">Next Chapter →</button>` : ''}
        <button class="btn btn-ghost" onclick="showMap()">🗺️ Back to Map</button>
      </div>
      ${state.done.length===15 ? '<div class="info-box green mt16">🏆 YOU\'VE MASTERED ALL OF FINCITY! Incredible work!</div>' : ''}
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
