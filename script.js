'use strict';
/* ============================================================
   WebOS — script.js
   Sistema operativo simulado, corre en el cliente.
   Ahora con cuentas reales (Firebase Authentication) y guardado
   automático del sistema (Firestore): cada archivo, carpeta,
   preferencia de apariencia y app instalada que un usuario
   registrado modifique se guarda solo y se restaura la próxima
   vez que inicia sesión. Los invitados no guardan nada.
   Proyecto educativo.
   ============================================================ */

/* ================= ICONOGRAFÍA (SVG en línea) ================= */
const ICONS = {
  folder: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>`,
  notepad: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/><path d="M8 12h8M8 16h8M8 9h4"/></svg>`,
  calculator: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6.5h8"/><circle cx="8.2" cy="11.2" r=".6"/><circle cx="12" cy="11.2" r=".6"/><circle cx="15.8" cy="11.2" r=".6"/><circle cx="8.2" cy="14.6" r=".6"/><circle cx="12" cy="14.6" r=".6"/><circle cx="15.8" cy="14.6" r=".6"/><circle cx="8.2" cy="18" r=".6"/><circle cx="12" cy="18" r=".6"/><circle cx="15.8" cy="18" r=".6"/></svg>`,
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M6.5 9.5 10 12l-3.5 2.5"/><path d="M12 15.5h5.5"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18"/><path d="M8 2.5v4M16 2.5v4"/><path d="M7 13.2h2M11 13.2h2M15 13.2h2M7 16.8h2M11 16.8h2"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/><path d="M12 16.2h.01"/></svg>`,
  store: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l1 12.5a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20.5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
  puzzle: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h4a1.5 1.5 0 0 1 1.5 1.5v2.3a1.7 1.7 0 0 0 2.9 1.2 1.7 1.7 0 0 1 2.9 1.2V13a1.5 1.5 0 0 1-1.5 1.5h-2.3a1.7 1.7 0 0 0-1.2 2.9 1.7 1.7 0 0 1-1.2 2.9H11A1.5 1.5 0 0 1 9.5 19v-2.3a1.7 1.7 0 0 0-2.9-1.2A1.7 1.7 0 0 1 3.5 14.3V11A1.5 1.5 0 0 1 5 9.5h2.3A1.7 1.7 0 0 0 8.5 6.6 1.7 1.7 0 0 1 9 3.5Z"/></svg>`,
  weather: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17.5a4 4 0 0 1 .3-8 5.5 5.5 0 0 1 10.6 1.7A3.7 3.7 0 0 1 17 18H7Z"/><path d="M9.5 4V2.5M14.5 4.6l1-1.3M5.5 6.6l-1.2-1"/></svg>`,
  game: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="10" rx="4"/><path d="M7 11v4M5 13h4"/><circle cx="16" cy="11.5" r="1"/><circle cx="18.5" cy="14" r="1"/></svg>`,
  picture: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5.5-5.5L9 17"/></svg>`,
};

/* ================= DATOS ESTÁTICOS ================= */
const WALLPAPERS = [
  { id: 'aurora-1', label: 'Aurora nocturna', css: 'linear-gradient(135deg,#1b1245,#05060f 60%)' },
  { id: 'aurora-2', label: 'Nébula violeta', css: 'linear-gradient(135deg,#3a1c6e,#06040f 60%)' },
  { id: 'aurora-3', label: 'Glaciar', css: 'linear-gradient(135deg,#123a3a,#030a10 60%)' },
  { id: 'solid-1', label: 'Grafito', css: '#14161f' },
];

const STORE_APPS = ['code-editor', 'media-player', 'sticky-notes', 'weather', 'snake-game', 'image-viewer'];

const WMO_CODES = {
  0: ['☀️', 'Despejado'], 1: ['🌤️', 'Mayormente despejado'], 2: ['⛅', 'Parcialmente nublado'], 3: ['☁️', 'Nublado'],
  45: ['🌫️', 'Niebla'], 48: ['🌫️', 'Niebla con escarcha'],
  51: ['🌦️', 'Llovizna ligera'], 53: ['🌦️', 'Llovizna'], 55: ['🌧️', 'Llovizna intensa'],
  61: ['🌦️', 'Lluvia ligera'], 63: ['🌧️', 'Lluvia'], 65: ['🌧️', 'Lluvia intensa'],
  71: ['🌨️', 'Nieve ligera'], 73: ['🌨️', 'Nieve'], 75: ['❄️', 'Nieve intensa'],
  80: ['🌦️', 'Chubascos'], 81: ['🌧️', 'Chubascos intensos'], 82: ['⛈️', 'Chubascos violentos'],
  95: ['⛈️', 'Tormenta'], 96: ['⛈️', 'Tormenta con granizo'], 99: ['⛈️', 'Tormenta severa'],
};
function wmoInfo(code) { return WMO_CODES[code] || ['🌡️', 'Condición desconocida']; }

const BIOS_POST_LINES = [
  'WebOS UEFI BIOS v2.4.1',
  'Copyright (C) WebOS Technologies',
  '',
  'CPU: Núcleo Cuántico Simulado @ 4.20GHz',
  'Verificando memoria... 16384MB OK',
  'Detectando unidad primaria... WebOS Virtual Drive (OK)',
  'Detectando unidad secundaria... no se encontró ninguna',
  'Inicializando controladora de red simulada... OK',
  '',
  'Presioná SUPR para entrar a la configuración',
];

const FE_SHORTCUTS = [
  { label: 'Inicio', path: '/home/usuario', icon: '🏠' },
  { label: 'Documentos', path: '/home/usuario/Documentos', icon: '📄' },
  { label: 'Descargas', path: '/home/usuario/Descargas', icon: '⬇️' },
  { label: 'Imágenes', path: '/home/usuario/Imágenes', icon: '🖼️' },
  { label: 'Música', path: '/home/usuario/Música', icon: '🎵' },
  { label: 'Videos', path: '/home/usuario/Videos', icon: '🎬' },
  { label: 'Papelera', path: '/recycle-bin', icon: '🗑️' },
];

const BOOT_LOGS = [
  'Iniciando kernel de WebOS…',
  'Montando sistema de archivos virtual…',
  'Cargando gestor de ventanas…',
  'Iniciando servicios de red simulada…',
  'Verificando integridad del sistema…',
  'Preparando sesión de usuario…',
];

const DEFAULT_INSTALLED_APPS = ['file-explorer', 'notepad', 'calculator', 'terminal', 'calendar', 'monitor', 'store', 'settings'];

/* ================= ESTADO GLOBAL ================= */
const state = {
  theme: 'dark',
  accent: 'teal',
  wallpaper: 'aurora-1',
  volume: 60,
  dnd: false,
  wifi: true,
  bluetooth: false,
  airplane: false,
  currentUser: null,
  windows: [],
  nextZ: 10,
  nextWinId: 1,
  activeWindowId: null,
  notifications: [],
  installedApps: new Set(DEFAULT_INSTALLED_APPS),
  processes: [],
  events: {},
};
let snapZone = null;

/* ================= UTILIDADES ================= */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function askInput(title, defaultValue, onConfirm) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = `
    <div class="modal-title">${escapeHtml(title)}</div>
    <input type="text" class="modal-input" id="modal-input" value="${escapeHtml(defaultValue || '')}" />
    <div class="modal-actions">
      <button class="modal-cancel">Cancelar</button>
      <button class="modal-ok">Aceptar</button>
    </div>`;
  overlay.classList.remove('hidden');
  const input = box.querySelector('#modal-input');
  input.focus();
  input.select();
  function close() { overlay.classList.add('hidden'); }
  box.querySelector('.modal-cancel').addEventListener('click', close);
  box.querySelector('.modal-ok').addEventListener('click', () => {
    const v = input.value.trim();
    close();
    if (v) onConfirm(v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const v = input.value.trim(); close(); if (v) onConfirm(v); }
    if (e.key === 'Escape') close();
  });
}

/* ================= SISTEMA DE ARCHIVOS VIRTUAL ================= */
function makeFolder() { return { type: 'folder', created: Date.now(), children: {} }; }
function makeFile(content = '') { return { type: 'file', created: Date.now(), modified: Date.now(), content }; }

// Construye un sistema de archivos "de fábrica". Se usa al arrancar y cada
// vez que alguien inicia sesión, para no mezclar los archivos de una cuenta
// con los de otra en la misma pestaña del navegador.
function createDefaultFsRoot() {
  const root = makeFolder();
  root.children = {
    home: Object.assign(makeFolder(), {
      children: {
        usuario: Object.assign(makeFolder(), {
          children: {
            'Documentos': Object.assign(makeFolder(), {
              children: {
                'bienvenida.txt': makeFile(
                  'Bienvenido a WebOS.\n\nEste es un sistema operativo simulado que corre completamente en tu navegador.\nProbá explorar carpetas, escribir notas, abrir la terminal o revisar el monitor del sistema.\n\nCreá una cuenta desde la pantalla de inicio de sesión: tus archivos y tu configuración se guardan solos y te van a estar esperando la próxima vez que entres desde cualquier dispositivo.\n\nProyecto con fines educativos.'
                ),
              },
            }),
            'Descargas': makeFolder(),
            'Imágenes': makeFolder(),
            'Música': makeFolder(),
            'Videos': makeFolder(),
          },
        }),
      },
    }),
    system: makeFolder(),
    applications: makeFolder(),
    temp: makeFolder(),
    'recycle-bin': makeFolder(),
    config: makeFolder(),
  };
  return root;
}
let fsRoot = createDefaultFsRoot();

function splitPath(path) { return String(path).split('/').filter(Boolean); }
function getNode(path) {
  const parts = splitPath(path);
  let node = fsRoot;
  for (const part of parts) {
    if (!node || node.type !== 'folder' || !node.children[part]) return null;
    node = node.children[part];
  }
  return node;
}
function getParentPath(path) {
  const parts = splitPath(path);
  parts.pop();
  return '/' + parts.join('/');
}
function baseName(path) {
  const parts = splitPath(path);
  return parts.length ? parts[parts.length - 1] : '/';
}
function joinPath(dir, name) {
  return (dir === '/' ? '' : dir) + '/' + name;
}
function normalizePath(path) {
  const parts = path.split('/').filter(Boolean);
  const stack = [];
  for (const p of parts) {
    if (p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  return '/' + stack.join('/');
}
function listChildren(path) {
  const node = getNode(path);
  if (!node || node.type !== 'folder') return [];
  return Object.keys(node.children)
    .sort((a, b) => {
      const na = node.children[a], nb = node.children[b];
      if (na.type !== nb.type) return na.type === 'folder' ? -1 : 1;
      return a.localeCompare(b);
    })
    .map((name) => ({ name, path: joinPath(path, name), node: node.children[name] }));
}
function createFolder(path, name) {
  const node = getNode(path);
  if (!node || node.type !== 'folder' || node.children[name]) return false;
  node.children[name] = makeFolder();
  scheduleSave();
  return true;
}
function createFile(path, name, content = '') {
  const node = getNode(path);
  if (!node || node.type !== 'folder' || node.children[name]) return false;
  node.children[name] = makeFile(content);
  scheduleSave();
  return true;
}
function deleteNode(path, permanent = false) {
  const parentPath = getParentPath(path);
  const name = baseName(path);
  const parent = getNode(parentPath);
  if (!parent) return false;
  if (permanent || parentPath === '/recycle-bin') {
    delete parent.children[name];
  } else {
    const node = parent.children[name];
    delete parent.children[name];
    const bin = getNode('/recycle-bin');
    let trashName = name, i = 1;
    while (bin.children[trashName]) trashName = `${name} (${i++})`;
    bin.children[trashName] = node;
  }
  scheduleSave();
  return true;
}
function renameNode(path, newName) {
  const parentPath = getParentPath(path);
  const name = baseName(path);
  const parent = getNode(parentPath);
  if (!parent || parent.children[newName]) return false;
  parent.children[newName] = parent.children[name];
  delete parent.children[name];
  scheduleSave();
  return true;
}
function writeFile(path, content) {
  const node = getNode(path);
  if (!node || node.type !== 'file') return false;
  node.content = content;
  node.modified = Date.now();
  scheduleSave();
  return true;
}
function fileGlyph(name) {
  if (/\.(txt|md)$/i.test(name)) return '📄';
  if (/\.(png|jpg|jpeg|gif|svg)$/i.test(name)) return '🖼️';
  if (/\.(mp3|wav)$/i.test(name)) return '🎵';
  if (/\.(mp4|mov)$/i.test(name)) return '🎬';
  return '📄';
}

/* ================= PERSISTENCIA EN LA NUBE (FIREBASE) =================
   Cada cuenta registrada guarda su propio sistema de archivos (fsRoot),
   apariencia (tema/acento/fondo), apps instaladas y recordatorios del
   calendario. El guardado se dispara solo (con un pequeño retraso, para
   no escribir en Firestore en cada tecla) cada vez que algo cambia, y se
   vuelve a cargar automáticamente al iniciar sesión. Los invitados no
   tienen cuenta, así que su sesión no se guarda en ningún lado. */
let saveTimer = null;
function isCloudUser() {
  return !!(state.currentUser && state.currentUser.id && state.currentUser.id !== 'invitado');
}
function serializeState() {
  return {
    fs: fsRoot,
    theme: state.theme,
    accent: state.accent,
    wallpaper: state.wallpaper,
    installedApps: Array.from(state.installedApps),
    events: state.events,
  };
}
function applyState(data) {
  if (!data) return;
  if (data.fs) fsRoot = data.fs;
  if (data.theme) setTheme(data.theme);
  if (data.accent) setAccent(data.accent);
  if (data.wallpaper) setWallpaper(data.wallpaper);
  if (Array.isArray(data.installedApps)) state.installedApps = new Set(data.installedApps);
  if (data.events) state.events = data.events;
}
function scheduleSave() {
  if (!isCloudUser() || !window.WebOSFirebase || !window.WebOSFirebase.isConfigured) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    window.WebOSFirebase.saveUserState(state.currentUser.id, serializeState());
  }, 1200);
}
function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  if (isCloudUser() && window.WebOSFirebase && window.WebOSFirebase.isConfigured) {
    window.WebOSFirebase.saveUserState(state.currentUser.id, serializeState());
  }
}

/* ================= NOTIFICACIONES Y TOASTS ================= */
function notify(title, msg) {
  const n = { id: Date.now() + Math.random(), title, msg, time: new Date() };
  state.notifications.unshift(n);
  if (state.notifications.length > 50) state.notifications.pop();
  updateNotifBadge();
  renderNotifications();
  if (!state.dnd) showToast(title, msg);
}
function showToast(title, msg) {
  const layer = document.getElementById('toast-layer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="t-title">${escapeHtml(title)}</div><div class="t-msg">${escapeHtml(msg)}</div>`;
  layer.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease, transform .3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(24px)';
    setTimeout(() => el.remove(), 320);
  }, 4200);
}
function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const n = state.notifications.length;
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.classList.toggle('hidden', n === 0);
}
function renderNotifications() {
  const list = document.getElementById('notification-list');
  if (!list) return;
  list.innerHTML = '';
  if (state.notifications.length === 0) {
    list.innerHTML = `<div class="notif-empty">Sin notificaciones</div>`;
    return;
  }
  state.notifications.forEach((n) => {
    const div = document.createElement('div');
    div.className = 'notif-item';
    div.innerHTML = `<div class="n-title">${escapeHtml(n.title)}</div><div class="n-msg">${escapeHtml(n.msg)}</div><div class="n-time">${n.time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>`;
    list.appendChild(div);
  });
}

/* ================= FONDO ANIMADO (AURORA + ESTRELLAS) ================= */
function initAurora(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, stars = [];
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Usamos el tamaño de la ventana (no canvas.clientWidth/Height): las 4 pantallas
    // ocupan siempre todo el viewport, y varias empiezan ocultas (display:none), lo
    // que dejaría al canvas "congelado" en 0x0 si midiéramos el propio elemento.
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(30, Math.floor((w * h) / 9000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h * 0.75,
      r: Math.random() * 1.3 + 0.3, tw: Math.random() * Math.PI * 2, sp: Math.random() * 0.02 + 0.01,
    }));
  }
  window.addEventListener('resize', resize);
  resize();
  const bands = [
    { color: '45,212,191', speed: 0.011, amp: 34, base: 0.30, wl: 0.006 },
    { color: '139,92,246', speed: 0.008, amp: 44, base: 0.42, wl: 0.004 },
    { color: '236,72,153', speed: 0.013, amp: 26, base: 0.5, wl: 0.008 },
  ];
  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    stars.forEach((s) => {
      const a = 0.35 + Math.sin(t * 0.001 * s.sp * 40 + s.tw) * 0.35;
      ctx.globalAlpha = Math.max(0, Math.min(1, a + 0.3));
      ctx.fillStyle = '#e8ecff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    bands.forEach((b, i) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 18) {
        const y = h * b.base + Math.sin(x * b.wl + t * b.speed * 0.06 + i * 2) * b.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, h * b.base - b.amp, 0, h);
      grad.addColorStop(0, `rgba(${b.color},.20)`);
      grad.addColorStop(1, `rgba(${b.color},0)`);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function initAuroraCanvases() {
  ['boot-canvas', 'lock-canvas', 'login-canvas', 'bg-canvas'].forEach((id) => {
    const c = document.getElementById(id);
    if (c) initAurora(c);
  });
}

/* ================= GESTOR DE VENTANAS ================= */
function openApp(appId, opts = {}) {
  const app = APPS[appId];
  if (!app) return null;
  if (app.singleton) {
    const existing = state.windows.find((w) => w.appId === appId);
    if (existing) { restoreWindow(existing.id); focusWindow(existing.id); return existing; }
  }
  const id = state.nextWinId++;
  const isMobile = window.innerWidth < 800;
  const size = app.defaultSize;
  const openCount = state.windows.length;
  const win = {
    id, appId, title: app.name, data: {},
    x: 60 + (openCount * 26) % 220,
    y: 50 + (openCount * 22) % 160,
    w: isMobile ? window.innerWidth : size.w,
    h: isMobile ? window.innerHeight - 56 : size.h,
    minimized: false, maximized: isMobile, prevRect: null, el: null,
  };
  state.windows.push(win);
  buildWindowDOM(win, opts);
  focusWindow(win.id);
  renderTaskbarApps();
  return win;
}

function buildWindowDOM(win, opts) {
  const layer = document.getElementById('windows-layer');
  const el = document.createElement('div');
  el.className = 'window';
  el.dataset.winid = String(win.id);
  el.dataset.app = win.appId;
  el.style.left = win.x + 'px';
  el.style.top = win.y + 'px';
  el.style.width = win.w + 'px';
  el.style.height = win.h + 'px';
  el.innerHTML = `
    <div class="titlebar">
      <span class="tb-icon">${APPS[win.appId].icon}</span>
      <span class="tb-title">${escapeHtml(win.title)}</span>
      <div class="tb-controls">
        <button class="tb-min" title="Minimizar">─</button>
        <button class="tb-max" title="Maximizar">▢</button>
        <button class="tb-close" title="Cerrar">✕</button>
      </div>
    </div>
    <div class="win-body"></div>
    <div class="resize-handle rh-n"></div><div class="resize-handle rh-s"></div>
    <div class="resize-handle rh-e"></div><div class="resize-handle rh-w"></div>
    <div class="resize-handle rh-ne"></div><div class="resize-handle rh-nw"></div>
    <div class="resize-handle rh-se"></div><div class="resize-handle rh-sw"></div>`;
  layer.appendChild(el);
  win.el = el;
  if (win.maximized) { el.classList.add('maximized'); applyMaximizedStyle(win); }
  wireWindowControls(win);
  makeDraggable(win);
  makeResizable(win);
  el.addEventListener('pointerdown', () => focusWindow(win.id));
  const body = el.querySelector('.win-body');
  APPS[win.appId].render(body, win, opts || {});
}

function wireWindowControls(win) {
  win.el.querySelector('.tb-close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(win.id); });
  win.el.querySelector('.tb-min').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(win.id); });
  win.el.querySelector('.tb-max').addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(win.id); });
  win.el.querySelector('.titlebar').addEventListener('dblclick', (e) => {
    if (e.target.closest('.tb-controls')) return;
    toggleMaximize(win.id);
  });
}
function updateWindowTitle(win, subtitle) {
  win.title = APPS[win.appId].name + (subtitle ? ' — ' + subtitle : '');
  const t = win.el.querySelector('.tb-title');
  if (t) t.textContent = win.title;
  renderTaskbarApps();
}
function closeWindow(id) {
  const win = state.windows.find((w) => w.id === id);
  if (!win) return;
  if (win.data && win.data.mediaInterval) clearInterval(win.data.mediaInterval);
  if (win.data && win.data.snakeInterval) clearInterval(win.data.snakeInterval);
  win.el.remove();
  state.windows = state.windows.filter((w) => w.id !== id);
  if (state.activeWindowId === id) state.activeWindowId = null;
  renderTaskbarApps();
}
function minimizeWindow(id) {
  const win = state.windows.find((w) => w.id === id);
  if (!win) return;
  win.minimized = true;
  win.el.style.display = 'none';
  renderTaskbarApps();
}
function restoreWindow(id) {
  const win = state.windows.find((w) => w.id === id);
  if (!win) return;
  win.minimized = false;
  win.el.style.display = 'flex';
  focusWindow(id);
}
function toggleMaximize(id) {
  const win = state.windows.find((w) => w.id === id);
  if (!win) return;
  if (win.maximized) {
    win.maximized = false;
    win.el.classList.remove('maximized');
    if (win.prevRect) Object.assign(win, win.prevRect);
    applyRectStyle(win);
  } else {
    win.prevRect = { x: win.x, y: win.y, w: win.w, h: win.h };
    win.maximized = true;
    win.el.classList.add('maximized');
    applyMaximizedStyle(win);
  }
}
function applyMaximizedStyle(win) {
  win.el.style.left = '0px';
  win.el.style.top = '0px';
  win.el.style.width = '100%';
  win.el.style.height = 'calc(100% - var(--taskbar-h))';
}
function applyRectStyle(win) {
  win.el.style.left = win.x + 'px';
  win.el.style.top = win.y + 'px';
  win.el.style.width = win.w + 'px';
  win.el.style.height = win.h + 'px';
}
function focusWindow(id) {
  state.windows.forEach((w) => { if (w.el) w.el.classList.remove('focused'); });
  const win = state.windows.find((w) => w.id === id);
  if (!win) return;
  state.nextZ++;
  win.el.style.zIndex = String(state.nextZ);
  win.el.classList.add('focused');
  state.activeWindowId = id;
  renderTaskbarApps();
}

function getSnapPreviewEl() {
  let el = document.getElementById('snap-preview');
  if (!el) {
    el = document.createElement('div');
    el.id = 'snap-preview';
    el.className = 'snap-preview hidden';
    document.getElementById('windows-layer').appendChild(el);
  }
  return el;
}
function showPreviewRect(x, y, w, h) {
  const el = getSnapPreviewEl();
  el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
  el.classList.remove('hidden');
}
function hideSnapPreview() { const el = document.getElementById('snap-preview'); if (el) el.classList.add('hidden'); }
function updateSnapPreview(x, y) {
  const w = window.innerWidth, h = window.innerHeight - 56;
  if (x < 24) { snapZone = 'left'; showPreviewRect(0, 0, w / 2, h); }
  else if (x > w - 24) { snapZone = 'right'; showPreviewRect(w / 2, 0, w / 2, h); }
  else if (y < 10) { snapZone = 'top'; showPreviewRect(0, 0, w, h); }
  else { snapZone = null; hideSnapPreview(); }
}
function applySnapIfNeeded(win) {
  if (!snapZone) return;
  const w = window.innerWidth, h = window.innerHeight - 56;
  if (snapZone === 'left') { win.x = 0; win.y = 0; win.w = w / 2; win.h = h; applyRectStyle(win); }
  else if (snapZone === 'right') { win.x = w / 2; win.y = 0; win.w = w / 2; win.h = h; applyRectStyle(win); }
  else if (snapZone === 'top') { toggleMaximize(win.id); }
  snapZone = null;
}
function makeDraggable(win) {
  const tb = win.el.querySelector('.titlebar');
  let dragging = false, startX = 0, startY = 0, originX = 0, originY = 0;
  tb.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tb-controls') || win.maximized) return;
    dragging = true; startX = e.clientX; startY = e.clientY; originX = win.x; originY = win.y;
    tb.setPointerCapture(e.pointerId);
  });
  tb.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    win.x = originX + (e.clientX - startX);
    win.y = Math.max(0, originY + (e.clientY - startY));
    win.el.style.left = win.x + 'px';
    win.el.style.top = win.y + 'px';
    updateSnapPreview(e.clientX, e.clientY);
  });
  tb.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    applySnapIfNeeded(win);
    hideSnapPreview();
  });
}
function makeResizable(win) {
  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
    const handle = win.el.querySelector('.rh-' + dir);
    let resizing = false, startX = 0, startY = 0, orig = null;
    handle.addEventListener('pointerdown', (e) => {
      if (win.maximized) return;
      resizing = true; startX = e.clientX; startY = e.clientY;
      orig = { x: win.x, y: win.y, w: win.w, h: win.h };
      handle.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      let { x, y, w, h } = orig;
      if (dir.includes('e')) w = Math.max(260, orig.w + dx);
      if (dir.includes('s')) h = Math.max(180, orig.h + dy);
      if (dir.includes('w')) { w = Math.max(260, orig.w - dx); x = orig.x + orig.w - w; }
      if (dir.includes('n')) { h = Math.max(180, orig.h - dy); y = orig.y + orig.h - h; }
      win.x = x; win.y = y; win.w = w; win.h = h;
      applyRectStyle(win);
    });
    handle.addEventListener('pointerup', () => { resizing = false; });
  });
}
function cycleWindows() {
  const openWins = state.windows.filter((w) => !w.minimized);
  if (openWins.length < 2) return;
  const idx = openWins.findIndex((w) => w.id === state.activeWindowId);
  const next = openWins[(idx + 1) % openWins.length];
  focusWindow(next.id);
}

/* ================= ESCRITORIO, BARRA DE TAREAS Y MENÚS ================= */
const DESKTOP_ORDER = ['file-explorer', 'notepad', 'calculator', 'terminal', 'calendar', 'monitor', 'store', 'settings', 'code-editor', 'media-player', 'sticky-notes', 'weather', 'snake-game', 'image-viewer'];

function renderDesktopIcons() {
  const box = document.getElementById('desktop-icons');
  box.innerHTML = '';
  DESKTOP_ORDER.filter((id) => state.installedApps.has(id)).forEach((id) => {
    const app = APPS[id];
    const div = document.createElement('button');
    div.className = 'desktop-icon';
    div.innerHTML = `<span class="di-glyph">${app.icon}</span><span class="di-label">${escapeHtml(app.name)}</span>`;
    div.addEventListener('click', () => {
      document.querySelectorAll('.desktop-icon').forEach((x) => x.classList.remove('selected'));
      div.classList.add('selected');
    });
    div.addEventListener('dblclick', () => openApp(id));
    div.addEventListener('keydown', (e) => { if (e.key === 'Enter') openApp(id); });
    box.appendChild(div);
  });
}

function renderTaskbarApps() {
  const box = document.getElementById('taskbar-apps');
  box.innerHTML = '';
  state.windows.forEach((win) => {
    const b = document.createElement('button');
    const isActive = state.activeWindowId === win.id && !win.minimized;
    b.className = 'taskbar-app running' + (isActive ? ' active' : '');
    b.innerHTML = APPS[win.appId].icon;
    b.title = win.title;
    b.addEventListener('click', () => {
      if (win.minimized || state.activeWindowId !== win.id) restoreWindow(win.id);
      else minimizeWindow(win.id);
    });
    box.appendChild(b);
  });
}

function renderStartMenu() {
  const pinnedBox = document.getElementById('start-pinned');
  const allBox = document.getElementById('start-all');
  pinnedBox.innerHTML = ''; allBox.innerHTML = '';
  const installed = DESKTOP_ORDER.filter((id) => state.installedApps.has(id));
  installed.filter((id) => APPS[id].pinned).forEach((id) => {
    const b = document.createElement('button');
    b.className = 'app-tile';
    b.innerHTML = `${APPS[id].icon}<span class="tile-label">${escapeHtml(APPS[id].name)}</span>`;
    b.addEventListener('click', () => { openApp(id); closeStartMenu(); });
    pinnedBox.appendChild(b);
  });
  installed.forEach((id) => {
    const b = document.createElement('button');
    b.className = 'app-row';
    b.innerHTML = `${APPS[id].icon}<span>${escapeHtml(APPS[id].name)}</span>`;
    b.addEventListener('click', () => { openApp(id); closeStartMenu(); });
    allBox.appendChild(b);
  });
  const startUser = document.getElementById('start-user');
  startUser.textContent = `${state.currentUser ? state.currentUser.avatar : '🙂'} ${state.currentUser ? state.currentUser.name : 'Usuario'}`;
}
function filterStartMenu(term) {
  const t = term.trim().toLowerCase();
  document.querySelectorAll('#start-all .app-row').forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(t) ? 'flex' : 'none';
  });
}
function openStartMenu() {
  renderStartMenu();
  document.getElementById('start-menu').classList.remove('hidden');
  const s = document.getElementById('start-search');
  s.value = ''; s.focus();
}
function closeStartMenu() { document.getElementById('start-menu').classList.add('hidden'); }

function showContextMenu(x, y, items) {
  const cm = document.getElementById('context-menu');
  cm.innerHTML = '';
  items.forEach((it) => {
    if (it.sep) { const d = document.createElement('div'); d.className = 'cm-sep'; cm.appendChild(d); return; }
    const b = document.createElement('button');
    b.className = 'cm-item' + (it.danger ? ' danger' : '');
    b.textContent = it.label;
    if (it.disabled) b.disabled = true;
    b.addEventListener('click', () => { hideContextMenu(); if (it.action) it.action(); });
    cm.appendChild(b);
  });
  cm.classList.remove('hidden');
  const menuW = 210, menuH = cm.offsetHeight || 200;
  cm.style.left = Math.min(x, window.innerWidth - menuW - 8) + 'px';
  cm.style.top = Math.min(y, window.innerHeight - menuH - 8) + 'px';
}
function hideContextMenu() { document.getElementById('context-menu').classList.add('hidden'); }

/* ================= RELOJ, CENTRO DE CONTROL Y ENERGÍA ================= */
function tickClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dateStrShort = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('tray-time', timeStr);
  set('tray-date', dateStrShort);
  set('lock-clock', timeStr);
  set('lock-date', now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
}
function playTestBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = (state.volume / 100) * 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch (err) { /* audio no disponible en este navegador */ }
}
function setTheme(theme) { state.theme = theme; document.documentElement.setAttribute('data-theme', theme); }
function setAccent(accent) { state.accent = accent; document.documentElement.setAttribute('data-accent', accent); }
function setWallpaper(id) { state.wallpaper = id; document.documentElement.setAttribute('data-wallpaper', id); }

function showScreen(id) {
  ['bios-screen', 'boot-screen', 'lock-screen', 'login-screen', 'desktop', 'shutdown-screen'].forEach((s) => {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  });
}

/* ================= BIOS / UEFI ================= */
const biosSettings = [
  { id: 'turbo', label: 'Modo Turbo', value: true },
  { id: 'rgb', label: 'Iluminación RGB del gabinete', value: true },
  { id: 'fastboot', label: 'Arranque rápido', value: false },
  { id: 'bootOrder', label: 'Orden de arranque', value: 'WebOS Virtual Drive', readonly: true },
];
let biosSelectedRow = 0;
let biosSkip = false;
let biosEnterSetupRequested = false;
function runBios() {
  showScreen('bios-screen');
  document.getElementById('bios-setup').classList.add('hidden');
  document.getElementById('bios-post').classList.remove('hidden');
  const pre = document.getElementById('bios-post-text');
  pre.textContent = '';
  biosSkip = false;
  biosEnterSetupRequested = false;
  let li = 0;
  function typeLine() {
    if (biosSkip) { pre.textContent = BIOS_POST_LINES.join('\n'); finishBiosPost(); return; }
    if (li >= BIOS_POST_LINES.length) { setTimeout(finishBiosPost, 500); return; }
    pre.textContent += BIOS_POST_LINES[li] + '\n';
    li++;
    setTimeout(typeLine, 130);
  }
  typeLine();
}
function finishBiosPost() {
  if (biosEnterSetupRequested) openBiosSetup();
  else runBoot();
}
function openBiosSetup() {
  document.getElementById('bios-post').classList.add('hidden');
  document.getElementById('bios-setup').classList.remove('hidden');
  biosSelectedRow = 0;
  renderBiosSetup();
}
function renderBiosSetup() {
  const rows = document.getElementById('bios-setup-rows');
  rows.innerHTML = biosSettings.map((s, i) => {
    const val = typeof s.value === 'boolean' ? (s.value ? 'Activado' : 'Desactivado') : s.value;
    return `<div class="bios-row ${i === biosSelectedRow ? 'sel' : ''}"><span>${escapeHtml(s.label)}</span><span>${escapeHtml(String(val))}</span></div>`;
  }).join('');
}
function handleBiosSetupKey(e) {
  e.preventDefault();
  if (e.key === 'ArrowDown') { biosSelectedRow = (biosSelectedRow + 1) % biosSettings.length; renderBiosSetup(); }
  else if (e.key === 'ArrowUp') { biosSelectedRow = (biosSelectedRow - 1 + biosSettings.length) % biosSettings.length; renderBiosSetup(); }
  else if (e.key === 'Enter') {
    const s = biosSettings[biosSelectedRow];
    if (typeof s.value === 'boolean' && !s.readonly) { s.value = !s.value; renderBiosSetup(); }
  } else if (e.key === 'F10' || e.key === 'Escape') {
    runBoot();
  }
}
function runBoot() {
  showScreen('boot-screen');
  const fill = document.getElementById('boot-progress-fill');
  const log = document.getElementById('boot-log');
  fill.style.width = '0%';
  let i = 0;
  const total = BOOT_LOGS.length;
  function step() {
    if (i >= total) { setTimeout(() => showScreen('lock-screen'), 300); return; }
    log.textContent = BOOT_LOGS[i];
    fill.style.width = Math.round(((i + 1) / total) * 100) + '%';
    i++;
    setTimeout(step, 420);
  }
  step();
}
let loginMode = 'login'; // 'login' | 'register'
function goToLogin() {
  showScreen('login-screen');
  setLoginMode('login');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  updateFirebaseNote();
}
function setLoginMode(mode) {
  loginMode = mode;
  const nameInput = document.getElementById('login-name');
  const heading = document.getElementById('login-heading');
  const submitBtn = document.getElementById('login-submit-btn');
  const toggle = document.getElementById('login-toggle');
  if (mode === 'register') {
    nameInput.classList.remove('hidden');
    heading.textContent = 'Crear cuenta';
    submitBtn.textContent = 'Crear cuenta →';
    toggle.textContent = '¿Ya tenés cuenta? Iniciá sesión';
  } else {
    nameInput.classList.add('hidden');
    heading.textContent = 'Iniciar sesión';
    submitBtn.textContent = 'Iniciar sesión →';
    toggle.textContent = '¿No tenés cuenta? Creá una';
  }
  showLoginError('');
}
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}
function updateFirebaseNote() {
  const note = document.getElementById('login-fb-note');
  if (window.WebOSFirebase && window.WebOSFirebase.isConfigured) {
    note.textContent = 'Tu cuenta se guarda de forma segura con Firebase Authentication. Tus cambios se sincronizan solos.';
  } else {
    note.textContent = 'Firebase no está configurado todavía: usá "Continuar como invitado" o completá firebase-config.js.';
  }
}
function traduceErrorFirebase(err) {
  const code = err && err.code;
  const map = {
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Iniciá sesión en vez de crear una nueva.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/user-not-found': 'No existe ninguna cuenta con ese correo.',
    'auth/wrong-password': 'La contraseña es incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/too-many-requests': 'Demasiados intentos. Probá de nuevo en unos minutos.',
  };
  return map[code] || (err && err.message) || 'Ocurrió un error inesperado.';
}
async function logIn(user) {
  state.currentUser = user;
  // Cerramos cualquier ventana que hubiera quedado abierta y reiniciamos el
  // estado local a los valores por defecto ANTES de intentar cargar los
  // datos guardados de esta cuenta, para no mezclar información entre
  // distintos usuarios que inicien sesión en la misma pestaña.
  [...state.windows].forEach((w) => closeWindow(w.id));
  fsRoot = createDefaultFsRoot();
  setTheme('dark');
  setAccent('teal');
  setWallpaper('aurora-1');
  state.installedApps = new Set(DEFAULT_INSTALLED_APPS);
  state.events = {};

  if (isCloudUser() && window.WebOSFirebase && window.WebOSFirebase.isConfigured) {
    try {
      const saved = await window.WebOSFirebase.loadUserState(user.id);
      if (saved) applyState(saved);
    } catch (err) {
      console.error('WebOS: no se pudo cargar tu información guardada.', err);
      notify('WebOS', 'No se pudo cargar tu información guardada. Se abrió un sistema nuevo.');
    }
  }

  showScreen('desktop');
  renderDesktopIcons();
  renderStartMenu();
  renderTaskbarApps();
  updateNotifBadge();
  renderNotifications();
  tickClock();
  setTimeout(() => notify('Bienvenido a WebOS', `Sesión iniciada como ${user.name}. Abrí el menú de inicio para explorar las aplicaciones.`), 700);
}
function goToShutdown() {
  showScreen('shutdown-screen');
  const txt = document.getElementById('shutdown-text');
  txt.textContent = 'Apagando WebOS…';
  setTimeout(() => { txt.textContent = 'WebOS está apagado. Hacé clic para encenderlo de nuevo.'; }, 1200);
}
function handlePower(action) {
  closeStartMenu();
  flushSave();
  if (action === 'lock') showScreen('lock-screen');
  else if (action === 'logout') {
    [...state.windows].forEach((w) => closeWindow(w.id));
    state.currentUser = null;
    if (window.WebOSFirebase) window.WebOSFirebase.logoutUser();
    goToLogin();
  }
  else if (action === 'restart') runBios();
  else if (action === 'shutdown') goToShutdown();
}

/* ================= MOTOR MATEMÁTICO (sin eval) ================= */
function toJsExpr(str) {
  return str.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'PI');
}
function factorial(n) {
  n = Math.round(n);
  if (n < 0) return NaN;
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}
function evalMathExpr(input) {
  let i = 0;
  const peek = () => input[i];
  const eat = () => input[i++];
  const skip = () => { while (input[i] === ' ') i++; };
  function parseExpr() {
    let v = parseTerm();
    for (;;) {
      skip();
      if (peek() === '+') { eat(); v += parseTerm(); }
      else if (peek() === '-') { eat(); v -= parseTerm(); }
      else break;
    }
    return v;
  }
  function parseTerm() {
    let v = parsePow();
    for (;;) {
      skip();
      if (peek() === '*') { eat(); v *= parsePow(); }
      else if (peek() === '/') { eat(); v /= parsePow(); }
      else if (peek() === '%') { eat(); v = v / 100; }
      else break;
    }
    return v;
  }
  function parsePow() {
    const v = parseUnary();
    skip();
    if (peek() === '^') { eat(); const exp = parsePow(); return Math.pow(v, exp); }
    return v;
  }
  function parseUnary() {
    skip();
    if (peek() === '-') { eat(); return -parseUnary(); }
    return parsePostfix();
  }
  function parsePostfix() {
    let v = parseAtom();
    skip();
    while (peek() === '!') { eat(); v = factorial(v); skip(); }
    return v;
  }
  function parseAtom() {
    skip();
    if (peek() === '(') { eat(); const v = parseExpr(); skip(); if (peek() === ')') eat(); return v; }
    const funcs = ['sin', 'cos', 'tan', 'ln', 'log', '√'];
    for (const f of funcs) {
      if (input.startsWith(f, i)) {
        i += f.length; skip();
        if (peek() === '(') {
          eat(); const v = parseExpr(); skip(); if (peek() === ')') eat();
          if (f === 'sin') return Math.sin(v);
          if (f === 'cos') return Math.cos(v);
          if (f === 'tan') return Math.tan(v);
          if (f === 'ln') return Math.log(v);
          if (f === 'log') return Math.log10(v);
          if (f === '√') return Math.sqrt(v);
        }
      }
    }
    if (input.startsWith('PI', i)) { i += 2; return Math.PI; }
    const start = i;
    while (/[0-9.]/.test(peek() || '')) i++;
    if (start === i) throw new Error('parse error');
    return parseFloat(input.slice(start, i));
  }
  const result = parseExpr();
  if (Number.isNaN(result)) throw new Error('NaN');
  return result;
}
function formatNum(n) {
  if (!isFinite(n)) return 'Error';
  return Number(n.toPrecision(12)).toString();
}

/* ================= APP: EXPLORADOR DE ARCHIVOS ================= */
function renderFileExplorer(container, win, opts) {
  win.data.path = win.data.path || (opts && opts.path) || '/home/usuario';
  win.data.view = win.data.view || 'grid';
  container.innerHTML = `
    <div class="fe-wrap">
      <div class="fe-sidebar" id="fe-side-${win.id}"></div>
      <div class="fe-main">
        <div class="app-toolbar">
          <button data-act="up">⬆ Subir</button>
          <button data-act="new-folder">📁+ Carpeta</button>
          <button data-act="new-file">📄+ Archivo</button>
          <button data-act="toggle-view">${win.data.view === 'grid' ? '☰ Lista' : '▦ Cuadrícula'}</button>
        </div>
        <div class="fe-path"></div>
        <div class="fe-items ${win.data.view === 'list' ? 'list-view' : ''}"></div>
      </div>
    </div>`;
  const side = container.querySelector(`#fe-side-${win.id}`);
  FE_SHORTCUTS.forEach((s) => {
    const b = document.createElement('button');
    b.textContent = s.icon + ' ' + s.label;
    if (win.data.path === s.path) b.classList.add('active');
    b.addEventListener('click', () => { win.data.path = s.path; renderFileExplorer(container, win); });
    side.appendChild(b);
  });
  container.querySelector('[data-act="up"]').addEventListener('click', () => {
    if (win.data.path !== '/') { win.data.path = getParentPath(win.data.path) || '/'; renderFileExplorer(container, win); }
  });
  container.querySelector('[data-act="new-folder"]').addEventListener('click', () => {
    askInput('Nombre de la nueva carpeta', 'Nueva carpeta', (name) => {
      if (createFolder(win.data.path, name)) renderFileExplorer(container, win);
      else notify('Explorador de archivos', 'No se pudo crear la carpeta (¿ya existe?)');
    });
  });
  container.querySelector('[data-act="new-file"]').addEventListener('click', () => {
    askInput('Nombre del nuevo archivo', 'nuevo.txt', (name) => {
      if (createFile(win.data.path, name, '')) renderFileExplorer(container, win);
      else notify('Explorador de archivos', 'No se pudo crear el archivo (¿ya existe?)');
    });
  });
  container.querySelector('[data-act="toggle-view"]').addEventListener('click', () => {
    win.data.view = win.data.view === 'grid' ? 'list' : 'grid';
    renderFileExplorer(container, win);
  });
  container.querySelector('.fe-path').textContent = win.data.path;
  const itemsEl = container.querySelector('.fe-items');
  const items = listChildren(win.data.path);
  if (items.length === 0) itemsEl.innerHTML = `<div class="app-empty">📭<br/>Esta carpeta está vacía</div>`;
  items.forEach((it) => {
    const div = document.createElement('div');
    div.className = 'fe-item';
    div.innerHTML = `<span class="fe-glyph">${it.node.type === 'folder' ? '📁' : fileGlyph(it.name)}</span><span class="fe-name">${escapeHtml(it.name)}</span>`;
    div.addEventListener('click', () => {
      itemsEl.querySelectorAll('.fe-item').forEach((x) => x.classList.remove('selected'));
      div.classList.add('selected');
    });
    div.addEventListener('dblclick', () => {
      if (it.node.type === 'folder') { win.data.path = it.path; renderFileExplorer(container, win); }
      else if (/\.(png|jpg|jpeg|gif|svg)$/i.test(it.name)) openApp('image-viewer', { src: it.node.content, fileName: it.name });
      else openApp('notepad', { path: it.path });
    });
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault(); e.stopPropagation();
      const inTrash = win.data.path === '/recycle-bin';
      showContextMenu(e.pageX, e.pageY, [
        { label: 'Abrir', action: () => { if (it.node.type === 'folder') { win.data.path = it.path; renderFileExplorer(container, win); } else if (/\.(png|jpg|jpeg|gif|svg)$/i.test(it.name)) openApp('image-viewer', { src: it.node.content, fileName: it.name }); else openApp('notepad', { path: it.path }); } },
        { label: 'Renombrar', action: () => askInput('Nuevo nombre', it.name, (n) => { if (renameNode(it.path, n)) renderFileExplorer(container, win); }) },
        { sep: true },
        { label: inTrash ? 'Eliminar definitivamente' : 'Eliminar', danger: true, action: () => { deleteNode(it.path, inTrash); renderFileExplorer(container, win); notify('Explorador de archivos', `"${it.name}" eliminado`); } },
      ]);
    });
    itemsEl.appendChild(div);
  });
  itemsEl.addEventListener('contextmenu', (e) => {
    if (e.target !== itemsEl) return;
    e.preventDefault();
    showContextMenu(e.pageX, e.pageY, [
      { label: '📁+ Nueva carpeta', action: () => container.querySelector('[data-act="new-folder"]').click() },
      { label: '📄+ Nuevo archivo', action: () => container.querySelector('[data-act="new-file"]').click() },
    ]);
  });
}

/* ================= APP: BLOC DE NOTAS ================= */
function renderNotepad(container, win, opts) {
  if (win.data.path === undefined) win.data.path = (opts && opts.path) || null;
  if (win.data.content === undefined) {
    const node = win.data.path ? getNode(win.data.path) : null;
    win.data.content = node && node.type === 'file' ? node.content : '';
  }
  container.innerHTML = `
    <div class="np-wrap">
      <div class="app-toolbar">
        <button data-act="save" class="primary">💾 Guardar</button>
        <button data-act="save-as">Guardar como…</button>
        <span style="flex:1"></span>
        <span style="font-size:.68rem;color:var(--text-dim)">Texto plano / Markdown básico</span>
      </div>
      <textarea class="np-textarea" spellcheck="false">${escapeHtml(win.data.content)}</textarea>
      <div class="np-status"></div>
    </div>`;
  const ta = container.querySelector('textarea');
  const status = container.querySelector('.np-status');
  status.textContent = win.data.path ? win.data.path : 'Sin guardar';
  ta.addEventListener('input', () => { win.data.content = ta.value; status.textContent = (win.data.path || 'Sin guardar') + ' • cambios sin guardar'; });
  container.querySelector('[data-act="save"]').addEventListener('click', () => {
    if (win.data.path) {
      writeFile(win.data.path, ta.value);
      status.textContent = win.data.path + ' • guardado';
      notify('Bloc de notas', 'Archivo guardado');
    } else {
      container.querySelector('[data-act="save-as"]').click();
    }
  });
  container.querySelector('[data-act="save-as"]').addEventListener('click', () => {
    askInput('Guardar como (nombre de archivo)', win.data.path ? baseName(win.data.path) : 'nota.txt', (name) => {
      if (!name.includes('.')) name += '.txt';
      const dir = '/home/usuario/Documentos';
      const target = joinPath(dir, name);
      if (!getNode(target)) createFile(dir, name, ta.value); else writeFile(target, ta.value);
      win.data.path = target;
      status.textContent = target + ' • guardado';
      updateWindowTitle(win, name);
      notify('Bloc de notas', `Guardado en ${target}`);
    });
  });
  updateWindowTitle(win, win.data.path ? baseName(win.data.path) : 'Sin título');
}

/* ================= APP: CALCULADORA ================= */
function calcPress(win, key) {
  const opKeys = ['÷', '×', '−', '+', '^'];
  if (key === 'C') { win.data.expr = ''; win.data.hist = ''; }
  else if (key === '⌫') { win.data.expr = win.data.expr.slice(0, -1); }
  else if (key === '=') {
    try {
      const result = evalMathExpr(toJsExpr(win.data.expr));
      win.data.hist = win.data.expr + ' =';
      win.data.expr = formatNum(result);
    } catch (e) { win.data.expr = 'Error'; }
  }
  else if (key === 'π') { win.data.expr += 'π'; }
  else if (['sin', 'cos', 'tan', 'ln', 'log', '√'].includes(key)) { win.data.expr += key + '('; }
  else if (key === 'x²') { win.data.expr += '^2'; }
  else { win.data.expr += key; }
  const valEl = win.el.querySelector(`#calc-val-${win.id}`);
  const histEl = win.el.querySelector(`#calc-hist-${win.id}`);
  if (valEl) valEl.textContent = win.data.expr || '0';
  if (histEl) histEl.textContent = win.data.hist || '';
}
function renderCalculator(container, win) {
  win.data.expr = win.data.expr || '';
  win.data.mode = win.data.mode || 'basic';
  win.data.hist = win.data.hist || '';
  container.innerHTML = `
    <div class="calc-wrap">
      <div class="calc-mode">
        <button data-mode="basic" class="${win.data.mode === 'basic' ? 'active' : ''}">Básica</button>
        <button data-mode="scientific" class="${win.data.mode === 'scientific' ? 'active' : ''}">Científica</button>
      </div>
      <div class="calc-display">
        <div class="calc-history" id="calc-hist-${win.id}">${escapeHtml(win.data.hist)}</div>
        <div class="calc-value" id="calc-val-${win.id}">${escapeHtml(win.data.expr || '0')}</div>
      </div>
      <div class="calc-grid ${win.data.mode === 'scientific' ? 'scientific' : ''}" id="calc-grid-${win.id}"></div>
    </div>`;
  const basicKeys = ['C', '(', ')', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+', '='];
  const sciExtra = ['sin', 'cos', 'tan', '√', 'x²', 'ln', 'log', 'π', '^', '!'];
  const grid = container.querySelector(`#calc-grid-${win.id}`);
  const keys = win.data.mode === 'scientific' ? [...sciExtra, ...basicKeys] : basicKeys;
  keys.forEach((k) => {
    const b = document.createElement('button');
    b.className = 'calc-btn' + (['÷', '×', '−', '+', '^'].includes(k) ? ' op' : '') + (k === '=' ? ' equal' : '');
    b.textContent = k;
    b.addEventListener('click', () => calcPress(win, k));
    grid.appendChild(b);
  });
  container.querySelectorAll('.calc-mode button').forEach((b) => {
    b.addEventListener('click', () => { win.data.mode = b.dataset.mode; renderCalculator(container, win); });
  });
}

/* ================= APP: TERMINAL ================= */
function termResolvePath(cwd, arg) {
  if (!arg) return cwd;
  if (arg === '~') return '/home/usuario';
  if (arg.startsWith('/')) return normalizePath(arg);
  return normalizePath(cwd + '/' + arg);
}
function runTermCommand(win, raw) {
  const print = (txt = '') => { win.data.linesEl.insertAdjacentHTML('beforeend', `<div class="term-line">${escapeHtml(txt)}</div>`); };
  win.data.history.push(raw);
  win.data.histIndex = win.data.history.length;
  const trimmed = raw.trim();
  if (!trimmed) return;
  const [cmd, ...args] = trimmed.split(/\s+/);
  const cwd = win.data.cwd;
  switch (cmd) {
    case 'help': print('Comandos: ls, pwd, cd, mkdir, touch, rm, cp, mv, cat, echo, tree, find, grep, clear, history, whoami, date, ps, kill, help'); break;
    case 'pwd': print(cwd); break;
    case 'whoami': print((state.currentUser && state.currentUser.name) || 'usuario'); break;
    case 'date': print(new Date().toString()); break;
    case 'clear': win.data.linesEl.innerHTML = ''; break;
    case 'history': win.data.history.forEach((h, idx) => print(`${idx + 1}  ${h}`)); break;
    case 'ls': {
      const target = termResolvePath(cwd, args[0]);
      const node = getNode(target);
      if (!node) { print(`ls: no se puede acceder a '${args[0] || target}': no existe`); break; }
      const items = listChildren(target);
      print(items.map((it) => (it.node.type === 'folder' ? it.name + '/' : it.name)).join('   '));
      break;
    }
    case 'cd': {
      const target = args[0] ? termResolvePath(cwd, args[0]) : '/home/usuario';
      const node = getNode(target);
      if (!node || node.type !== 'folder') print(`cd: no existe el directorio: ${args[0] || ''}`);
      else win.data.cwd = target;
      break;
    }
    case 'mkdir':
      if (!args[0]) print('mkdir: falta el nombre de la carpeta');
      else if (!createFolder(cwd, args[0])) print(`mkdir: no se pudo crear '${args[0]}' (¿ya existe?)`);
      break;
    case 'touch':
      if (!args[0]) print('touch: falta el nombre del archivo');
      else if (!getNode(joinPath(cwd, args[0]))) createFile(cwd, args[0], '');
      break;
    case 'rm': {
      if (!args[0]) { print('rm: falta el archivo'); break; }
      const target = termResolvePath(cwd, args[0]);
      if (!getNode(target)) { print(`rm: no existe '${args[0]}'`); break; }
      deleteNode(target);
      print(`'${args[0]}' movido a la papelera`);
      break;
    }
    case 'cat': {
      if (!args[0]) { print('cat: falta el archivo'); break; }
      const node = getNode(termResolvePath(cwd, args[0]));
      if (!node) print(`cat: no existe '${args[0]}'`);
      else if (node.type === 'folder') print(`cat: ${args[0]} es un directorio`);
      else print(node.content || '');
      break;
    }
    case 'echo': print(args.join(' ')); break;
    case 'cp': {
      if (args.length < 2) { print('cp: uso: cp origen destino'); break; }
      const srcPath = termResolvePath(cwd, args[0]);
      const src = getNode(srcPath);
      if (!src) { print('cp: origen no existe'); break; }
      const destPath = termResolvePath(cwd, args[1]);
      const destNode = getNode(destPath);
      const destParent = destNode && destNode.type === 'folder' ? destPath : getParentPath(destPath);
      const destName = destNode && destNode.type === 'folder' ? baseName(srcPath) : baseName(destPath);
      const parentNode = getNode(destParent);
      if (!parentNode) { print('cp: destino inválido'); break; }
      parentNode.children[destName] = JSON.parse(JSON.stringify(src));
      scheduleSave();
      break;
    }
    case 'mv': {
      if (args.length < 2) { print('mv: uso: mv origen destino'); break; }
      const srcPath = termResolvePath(cwd, args[0]);
      const src = getNode(srcPath);
      if (!src) { print('mv: origen no existe'); break; }
      const destPath = termResolvePath(cwd, args[1]);
      const destNode = getNode(destPath);
      const destParent = destNode && destNode.type === 'folder' ? destPath : getParentPath(destPath);
      const destName = destNode && destNode.type === 'folder' ? baseName(srcPath) : baseName(destPath);
      const parentNode = getNode(destParent);
      if (!parentNode) { print('mv: destino inválido'); break; }
      parentNode.children[destName] = src;
      delete getNode(getParentPath(srcPath)).children[baseName(srcPath)];
      scheduleSave();
      break;
    }
    case 'tree': {
      const target = args[0] ? termResolvePath(cwd, args[0]) : cwd;
      const lines = [];
      (function walk(path, depth) {
        listChildren(path).forEach((it) => {
          lines.push('  '.repeat(depth) + (it.node.type === 'folder' ? '📁 ' : '📄 ') + it.name);
          if (it.node.type === 'folder') walk(it.path, depth + 1);
        });
      })(target, 0);
      print(lines.join('\n') || '(vacío)');
      break;
    }
    case 'find': {
      const term = (args[0] || '').toLowerCase();
      const results = [];
      (function walk(path) {
        listChildren(path).forEach((it) => {
          if (it.name.toLowerCase().includes(term)) results.push(it.path);
          if (it.node.type === 'folder') walk(it.path);
        });
      })('/');
      print(results.join('\n') || 'sin resultados');
      break;
    }
    case 'grep': {
      if (args.length < 2) { print('grep: uso: grep patrón archivo'); break; }
      const node = getNode(termResolvePath(cwd, args[1]));
      if (!node || node.type !== 'file') { print('grep: archivo no válido'); break; }
      const matches = (node.content || '').split('\n').filter((l) => l.toLowerCase().includes(args[0].toLowerCase()));
      print(matches.join('\n') || 'sin coincidencias');
      break;
    }
    case 'ps': state.processes.forEach((p) => print(`${p.pid}\t${p.name}\t${p.status}`)); break;
    case 'kill': {
      const pid = parseInt(args[0], 10);
      const idx = state.processes.findIndex((p) => p.pid === pid);
      if (idx === -1) print(`kill: no existe el proceso ${args[0]}`);
      else { state.processes.splice(idx, 1); print(`proceso ${pid} finalizado`); }
      break;
    }
    default: print(`${cmd}: comando no encontrado (probá "help")`);
  }
}
function addTermPromptLine(win) {
  const row = document.createElement('div');
  row.className = 'term-prompt-row';
  row.innerHTML = `<span class="term-prompt">usuario@webos:${escapeHtml(win.data.cwd)}$</span><input class="term-input" autocomplete="off" spellcheck="false"/>`;
  win.data.linesEl.appendChild(row);
  const input = row.querySelector('.term-input');
  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value;
      row.innerHTML = `<span class="term-prompt">usuario@webos:${escapeHtml(win.data.cwd)}$</span> ${escapeHtml(val)}`;
      runTermCommand(win, val);
      addTermPromptLine(win);
      win.data.linesEl.scrollTop = win.data.linesEl.scrollHeight;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (win.data.histIndex > 0) { win.data.histIndex--; input.value = win.data.history[win.data.histIndex] || ''; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (win.data.histIndex < win.data.history.length) { win.data.histIndex++; input.value = win.data.history[win.data.histIndex] || ''; }
    }
  });
}
function renderTerminal(container, win) {
  win.data.cwd = win.data.cwd || '/home/usuario';
  win.data.history = win.data.history || [];
  win.data.histIndex = win.data.history.length;
  container.innerHTML = `<div class="term-wrap"><div class="term-line">WebOS Terminal — escribí "help" para ver los comandos disponibles.</div></div>`;
  win.data.linesEl = container.querySelector('.term-wrap');
  addTermPromptLine(win);
  win.data.linesEl.addEventListener('click', () => {
    const inp = win.data.linesEl.querySelector('.term-input:last-of-type');
    if (inp) inp.focus();
  });
}

/* ================= APP: CALENDARIO ================= */
function renderCalendar(container, win) {
  win.data.viewDate = win.data.viewDate || new Date();
  win.data.selectedDate = win.data.selectedDate || formatDateKey(new Date());
  const d = win.data.viewDate;
  const year = d.getFullYear(), month = d.getMonth();
  const monthName = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = formatDateKey(new Date());
  let cells = '';
  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((x) => { cells += `<div class="cal-dow">${x}</div>`; });
  for (let i = 0; i < firstDow; i++) cells += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasEvent = !!state.events[key];
    cells += `<button class="cal-day ${key === todayKey ? 'today' : ''}" data-key="${key}">${day}${hasEvent ? '<span class="dot"></span>' : ''}</button>`;
  }
  container.innerHTML = `
    <div class="cal-wrap">
      <div class="cal-header"><button data-nav="-1">‹</button><h3>${escapeHtml(monthName)}</h3><button data-nav="1">›</button></div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-events">
        <div id="cal-selected-label-${win.id}">Seleccioná un día para ver o agregar un recordatorio</div>
        <input type="text" id="cal-event-input-${win.id}" placeholder="Escribí un recordatorio y presioná Enter…" />
      </div>
    </div>`;
  container.querySelector('[data-nav="-1"]').addEventListener('click', () => { win.data.viewDate = new Date(year, month - 1, 1); renderCalendar(container, win); });
  container.querySelector('[data-nav="1"]').addEventListener('click', () => { win.data.viewDate = new Date(year, month + 1, 1); renderCalendar(container, win); });
  const input = container.querySelector(`#cal-event-input-${win.id}`);
  const label = container.querySelector(`#cal-selected-label-${win.id}`);
  function selectDay(key) {
    win.data.selectedDate = key;
    label.textContent = `${key} — ${state.events[key] ? state.events[key] : 'sin recordatorios'}`;
    input.value = state.events[key] || '';
  }
  container.querySelectorAll('.cal-day[data-key]').forEach((btn) => btn.addEventListener('click', () => selectDay(btn.dataset.key)));
  if (container.querySelector(`[data-key="${win.data.selectedDate}"]`)) selectDay(win.data.selectedDate);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = input.value.trim();
      if (v) { state.events[win.data.selectedDate] = v; notify('Calendario', 'Recordatorio guardado'); }
      else delete state.events[win.data.selectedDate];
      scheduleSave();
      renderCalendar(container, win);
    }
  });
}

/* ================= APP: MONITOR DEL SISTEMA ================= */
function seedProcesses() {
  const names = ['kernel_task', 'webos.desktopd', 'window-manager', 'fs.service', 'notif.center', 'net.daemon', 'audio.mixer', 'update.checker', 'terminal.session', 'app.store'];
  state.processes = names.map((n, idx) => ({ pid: 100 + idx, name: n, status: 'ejecutando', priority: idx < 2 ? 'alta' : 'normal', cpu: Math.random() * 8, mem: Math.random() * 180 + 40 }));
}
function refreshMonitorBody(win) {
  const body = win.el.querySelector(`#mon-body-${win.id}`);
  if (!body) return;
  if (win.data.tab === 'proc') {
    body.innerHTML = `
      <table class="mon-proc-table">
        <thead><tr><th>PID</th><th>Proceso</th><th>Estado</th><th>CPU</th><th>Memoria</th><th></th></tr></thead>
        <tbody>${state.processes.map((p) => `
          <tr><td>${p.pid}</td><td>${escapeHtml(p.name)}</td><td>${p.status}</td><td>${p.cpu.toFixed(1)}%</td><td>${p.mem.toFixed(0)} MB</td>
          <td><button data-kill="${p.pid}">Finalizar</button></td></tr>`).join('')}</tbody>
      </table>`;
    body.querySelectorAll('[data-kill]').forEach((b) => {
      b.addEventListener('click', () => {
        const pid = Number(b.dataset.kill);
        state.processes = state.processes.filter((p) => p.pid !== pid);
        notify('Monitor del sistema', `Proceso ${pid} finalizado`);
        refreshMonitorBody(win);
      });
    });
  } else {
    const cpuTotal = state.processes.length ? Math.min(100, state.processes.reduce((a, p) => a + p.cpu, 0) / state.processes.length) : 0;
    const memTotal = state.processes.length ? Math.min(100, state.processes.reduce((a, p) => a + p.mem, 0) / 20) : 0;
    const netKbps = (Math.random() * 800 + 50).toFixed(0);
    const temp = (42 + Math.random() * 8).toFixed(1);
    body.innerHTML = `
      <div class="mon-stat-grid">
        <div class="mon-stat-card"><div class="label">CPU</div><div class="value">${cpuTotal.toFixed(0)}%</div><div class="mon-bar-track"><div class="mon-bar-fill" style="width:${cpuTotal}%"></div></div></div>
        <div class="mon-stat-card"><div class="label">Memoria</div><div class="value">${memTotal.toFixed(0)}%</div><div class="mon-bar-track"><div class="mon-bar-fill" style="width:${memTotal}%"></div></div></div>
        <div class="mon-stat-card"><div class="label">Disco</div><div class="value">63%</div><div class="mon-bar-track"><div class="mon-bar-fill" style="width:63%"></div></div></div>
        <div class="mon-stat-card"><div class="label">Red</div><div class="value">${netKbps} KB/s</div></div>
        <div class="mon-stat-card"><div class="label">Temperatura</div><div class="value">${temp}°C</div></div>
        <div class="mon-stat-card"><div class="label">Procesos activos</div><div class="value">${state.processes.length}</div></div>
      </div>`;
  }
}
function renderMonitor(container, win) {
  win.data.tab = win.data.tab || 'perf';
  container.innerHTML = `
    <div class="mon-tabs">
      <button data-tab="perf" class="${win.data.tab === 'perf' ? 'active' : ''}">Rendimiento</button>
      <button data-tab="proc" class="${win.data.tab === 'proc' ? 'active' : ''}">Procesos</button>
    </div>
    <div class="mon-body" id="mon-body-${win.id}"></div>`;
  container.querySelectorAll('.mon-tabs button').forEach((b) => b.addEventListener('click', () => { win.data.tab = b.dataset.tab; renderMonitor(container, win); }));
  refreshMonitorBody(win);
}

/* ================= APP: CONFIGURACIÓN ================= */
function renderSettings(container, win) {
  win.data.section = win.data.section || 'appearance';
  container.innerHTML = `
    <div class="set-wrap">
      <div class="set-nav">
        <button data-s="appearance">🎨 Apariencia</button>
        <button data-s="privacy">🛡️ Privacidad y permisos</button>
        <button data-s="datetime">🕐 Fecha y hora</button>
        <button data-s="about">ℹ️ Acerca de</button>
      </div>
      <div class="set-body"></div>
    </div>`;
  const nav = container.querySelector('.set-nav');
  nav.querySelectorAll('button').forEach((b) => {
    if (b.dataset.s === win.data.section) b.classList.add('active');
    b.addEventListener('click', () => { win.data.section = b.dataset.s; renderSettings(container, win); });
  });
  const body = container.querySelector('.set-body');
  if (win.data.section === 'appearance') {
    body.innerHTML = `
      <h3>Apariencia</h3>
      <div class="set-row"><div><div class="set-label">Tema oscuro</div><div class="set-sub">Cambiá entre modo claro y oscuro</div></div><button class="toggle" id="theme-toggle" data-on="${state.theme === 'dark'}"></button></div>
      <div class="set-row" style="flex-direction:column;align-items:flex-start;gap:10px"><div class="set-label">Color de acento</div><div class="swatch-row" id="accent-row"></div></div>
      <div class="set-row" style="flex-direction:column;align-items:flex-start;gap:10px;border-bottom:none"><div class="set-label">Fondo de pantalla</div><div class="wallpaper-row" id="wallpaper-row"></div></div>`;
    body.querySelector('#theme-toggle').addEventListener('click', (e) => {
      setTheme(state.theme === 'dark' ? 'light' : 'dark');
      e.currentTarget.dataset.on = String(state.theme === 'dark');
      scheduleSave();
    });
    const accentRow = body.querySelector('#accent-row');
    [['teal', '#2dd4bf'], ['violet', '#8b5cf6'], ['pink', '#ec4899'], ['blue', '#60a5fa']].forEach(([id, color]) => {
      const s = document.createElement('button');
      s.className = 'swatch' + (state.accent === id ? ' active' : '');
      s.style.background = color;
      s.addEventListener('click', () => { setAccent(id); scheduleSave(); renderSettings(container, win); });
      accentRow.appendChild(s);
    });
    const wpRow = body.querySelector('#wallpaper-row');
    WALLPAPERS.forEach((wp) => {
      const s = document.createElement('button');
      s.className = 'wallpaper-swatch' + (state.wallpaper === wp.id ? ' active' : '');
      s.style.background = wp.css;
      s.title = wp.label;
      s.addEventListener('click', () => { setWallpaper(wp.id); scheduleSave(); renderSettings(container, win); });
      wpRow.appendChild(s);
    });
  } else if (win.data.section === 'privacy') {
    body.innerHTML = `<h3>Privacidad y permisos</h3><p style="font-size:.72rem;color:var(--text-dim);margin-top:-6px">Permisos simulados con fines demostrativos.</p>` +
      Object.keys(APPS).filter((id) => state.installedApps.has(id)).map((id) => `
        <div class="set-row"><div><div class="set-label">${escapeHtml(APPS[id].name)}</div><div class="set-sub">Acceso a archivos y notificaciones</div></div><button class="toggle" data-perm="${id}" data-on="true"></button></div>
      `).join('');
    body.querySelectorAll('[data-perm]').forEach((t) => t.addEventListener('click', () => { t.dataset.on = t.dataset.on === 'true' ? 'false' : 'true'; }));
  } else if (win.data.section === 'datetime') {
    const now = new Date();
    body.innerHTML = `<h3>Fecha y hora</h3>
      <div class="set-row"><div class="set-label">Hora actual</div><div>${now.toLocaleTimeString('es-ES')}</div></div>
      <div class="set-row"><div class="set-label">Fecha</div><div>${now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
      <div class="set-row" style="border-bottom:none"><div class="set-label">Zona horaria</div><div>${Intl.DateTimeFormat().resolvedOptions().timeZone}</div></div>`;
  } else if (win.data.section === 'about') {
    body.innerHTML = `<h3>Acerca de WebOS</h3>
      <div class="set-row"><div class="set-label">Versión</div><div>WebOS 1.0 (demo educativa)</div></div>
      <div class="set-row"><div class="set-label">Motor</div><div>HTML, CSS y JavaScript — sin frameworks</div></div>
      <div class="set-row"><div class="set-label">Usuario actual</div><div>${state.currentUser ? escapeHtml(state.currentUser.name) : '—'}</div></div>
      <div class="set-row" style="border-bottom:none"><div class="set-label">Aplicaciones instaladas</div><div>${state.installedApps.size}</div></div>`;
  }
}

/* ================= APP: TIENDA DE APLICACIONES ================= */
function renderStore(container, win) {
  container.innerHTML = `<div class="store-wrap"><div class="store-grid"></div></div>`;
  const grid = container.querySelector('.store-grid');
  STORE_APPS.forEach((id) => {
    const app = APPS[id];
    const installed = state.installedApps.has(id);
    const card = document.createElement('div');
    card.className = 'store-card';
    card.innerHTML = `<div class="sc-icon">${app.emoji}</div><div class="sc-name">${escapeHtml(app.name)}</div><div class="sc-desc">${escapeHtml(app.desc)}</div>
      <button class="${installed ? 'installed' : ''}">${installed ? '✓ Instalada — Desinstalar' : 'Instalar'}</button>`;
    card.querySelector('button').addEventListener('click', () => {
      if (state.installedApps.has(id)) { state.installedApps.delete(id); notify('Tienda de aplicaciones', `${app.name} desinstalada`); }
      else { state.installedApps.add(id); notify('Tienda de aplicaciones', `${app.name} instalada`); }
      scheduleSave();
      renderDesktopIcons(); renderStartMenu(); renderStore(container, win);
    });
    grid.appendChild(card);
  });
}

/* ================= APPS INSTALABLES: EDITOR / MULTIMEDIA / NOTAS ================= */
function renderCodeEditor(container, win) {
  if (win.data.content === undefined) win.data.content = '// Escribí tu código acá\nfunction saludo(nombre) {\n  return `Hola, ${nombre}!`;\n}\n';
  container.innerHTML = `<div class="code-wrap"><div class="code-lines"></div><textarea class="code-area" spellcheck="false">${escapeHtml(win.data.content)}</textarea></div>`;
  const ta = container.querySelector('textarea');
  const lines = container.querySelector('.code-lines');
  function updateLines() {
    const n = ta.value.split('\n').length;
    lines.innerHTML = Array.from({ length: n }, (_, idx) => idx + 1).join('<br/>');
  }
  ta.addEventListener('input', () => { win.data.content = ta.value; updateLines(); });
  ta.addEventListener('scroll', () => { lines.scrollTop = ta.scrollTop; });
  updateLines();
}
function renderMediaPlayer(container, win) {
  const tracks = [
    { name: 'Deriva estelar', artist: 'Sintetizadores del Sur', dur: 222 },
    { name: 'Aurora sobre el río', artist: 'Colectivo Nébula', dur: 198 },
    { name: 'Código binario', artist: 'Bauti & la máquina', dur: 174 },
  ];
  if (win.data.track === undefined) win.data.track = 0;
  if (win.data.progress === undefined) win.data.progress = 0;
  if (win.data.playing === undefined) win.data.playing = false;
  function draw() {
    const t = tracks[win.data.track];
    container.innerHTML = `
      <div class="media-wrap">
        <div class="media-art">🎧</div>
        <div class="media-track">${escapeHtml(t.name)}</div>
        <div class="media-artist">${escapeHtml(t.artist)}</div>
        <div class="media-bar"><div class="media-bar-fill" style="width:${(win.data.progress / t.dur) * 100}%"></div></div>
        <div class="media-controls">
          <button data-a="prev">⏮</button>
          <button data-a="play" class="play">${win.data.playing ? '⏸' : '▶'}</button>
          <button data-a="next">⏭</button>
        </div>
        <div style="font-size:.65rem;color:var(--text-dim)">Demostración de interfaz — sin audio real</div>
      </div>`;
    container.querySelector('[data-a="play"]').addEventListener('click', () => { win.data.playing = !win.data.playing; draw(); });
    container.querySelector('[data-a="next"]').addEventListener('click', () => { win.data.track = (win.data.track + 1) % tracks.length; win.data.progress = 0; draw(); });
    container.querySelector('[data-a="prev"]').addEventListener('click', () => { win.data.track = (win.data.track - 1 + tracks.length) % tracks.length; win.data.progress = 0; draw(); });
  }
  draw();
  if (win.data.mediaInterval) clearInterval(win.data.mediaInterval);
  win.data.mediaInterval = setInterval(() => {
    if (win.data.playing) {
      const t = tracks[win.data.track];
      win.data.progress = (win.data.progress + 1) % t.dur;
      const fill = container.querySelector('.media-bar-fill');
      if (fill) fill.style.width = (win.data.progress / t.dur) * 100 + '%';
    }
  }, 1000);
}
function renderStickyNotes(container, win) {
  if (win.data.content === undefined) win.data.content = 'Notas rápidas…';
  container.innerHTML = `<div class="sticky-wrap"><textarea spellcheck="false">${escapeHtml(win.data.content)}</textarea></div>`;
  container.querySelector('textarea').addEventListener('input', (e) => { win.data.content = e.target.value; });
}

/* ================= APP: CLIMA (API real, sin clave) ================= */
async function fetchWeatherByCity(city) {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`);
  const geo = await geoRes.json();
  if (!geo.results || !geo.results.length) throw new Error('No se encontró esa ciudad');
  const { latitude, longitude, name, country } = geo.results[0];
  const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`);
  const w = await wRes.json();
  return { name, country, current: w.current, daily: w.daily };
}
function renderWeather(container, win) {
  if (win.data.city === undefined) win.data.city = 'Buenos Aires';
  if (win.data.result === undefined) win.data.result = null;
  win.data.loading = false;
  win.data.error = '';
  function draw() {
    container.innerHTML = `
      <div class="wx-wrap">
        <div class="app-toolbar">
          <input type="text" class="wx-input" id="wx-city-${win.id}" placeholder="Buscar ciudad…" value="${escapeHtml(win.data.city)}" />
          <button data-act="wx-search" class="primary">Buscar</button>
        </div>
        <div class="wx-body" id="wx-body-${win.id}"></div>
      </div>`;
    const body = container.querySelector(`#wx-body-${win.id}`);
    if (win.data.loading) body.innerHTML = `<div class="app-empty">🌐<br/>Consultando el clima…</div>`;
    else if (win.data.error) body.innerHTML = `<div class="app-empty">⚠️<br/>${escapeHtml(win.data.error)}</div>`;
    else if (win.data.result) drawResult(body);
    container.querySelector('[data-act="wx-search"]').addEventListener('click', doSearch);
    container.querySelector(`#wx-city-${win.id}`).addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  }
  function drawResult(body) {
    const r = win.data.result;
    const [icon, desc] = wmoInfo(r.current.weather_code);
    body.innerHTML = `
      <div class="wx-current">
        <div class="wx-icon">${icon}</div>
        <div class="wx-temp">${Math.round(r.current.temperature_2m)}°C</div>
        <div class="wx-desc">${escapeHtml(desc)}</div>
        <div class="wx-place">${escapeHtml(r.name)}, ${escapeHtml(r.country)}</div>
        <div class="wx-sub">Humedad ${r.current.relative_humidity_2m}% · Viento ${Math.round(r.current.wind_speed_10m)} km/h</div>
      </div>
      <div class="wx-days">${r.daily.time.slice(0, 5).map((d, i) => {
        const [ic] = wmoInfo(r.daily.weather_code[i]);
        const day = new Date(d).toLocaleDateString('es-ES', { weekday: 'short' });
        return `<div class="wx-day"><div>${day}</div><div>${ic}</div><div>${Math.round(r.daily.temperature_2m_max[i])}°/${Math.round(r.daily.temperature_2m_min[i])}°</div></div>`;
      }).join('')}</div>`;
  }
  async function doSearch() {
    const input = container.querySelector(`#wx-city-${win.id}`);
    const city = input.value.trim();
    if (!city) return;
    win.data.city = city; win.data.loading = true; win.data.error = ''; win.data.result = null;
    draw();
    try {
      win.data.result = await fetchWeatherByCity(city);
      win.data.loading = false;
      draw();
    } catch (err) {
      win.data.loading = false;
      win.data.error = 'No se pudo obtener el clima. Verificá el nombre de la ciudad o tu conexión.';
      draw();
    }
  }
  draw();
  if (!win.data.result) doSearch();
}

/* ================= APP: SNAKE ================= */
function renderSnakeGame(container, win) {
  container.innerHTML = `
    <div class="snake-wrap">
      <div class="snake-hud"><span>Puntaje: <b id="snake-score-${win.id}">0</b></span><button data-act="restart">Reiniciar</button></div>
      <canvas id="snake-canvas-${win.id}" width="360" height="360"></canvas>
      <div class="snake-hint">Hacé clic en el juego y usá las flechas del teclado.</div>
    </div>`;
  const canvas = container.querySelector(`#snake-canvas-${win.id}`);
  const ctx = canvas.getContext('2d');
  const cell = 18, cols = canvas.width / cell, rows = canvas.height / cell;
  let snake, dir, nextDir, food, score, alive;
  function reset() {
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
    score = 0; alive = true;
    placeFood();
    container.querySelector(`#snake-score-${win.id}`).textContent = '0';
  }
  function placeFood() {
    do { food = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }; }
    while (snake.some((s) => s.x === food.x && s.y === food.y));
  }
  function tick() {
    if (!alive) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows || snake.some((s) => s.x === head.x && s.y === head.y)) {
      alive = false; draw(); notify('Snake', `Juego terminado — puntaje ${score}`); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score++;
      container.querySelector(`#snake-score-${win.id}`).textContent = String(score);
      placeFood();
    } else snake.pop();
    draw();
  }
  function draw() {
    ctx.fillStyle = '#080a12'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(food.x * cell, food.y * cell, cell - 2, cell - 2);
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#2dd4bf' : '#60a5fa';
      ctx.fillRect(s.x * cell, s.y * cell, cell - 2, cell - 2);
    });
    if (!alive) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '15px monospace'; ctx.textAlign = 'center';
      ctx.fillText('Juego terminado', canvas.width / 2, canvas.height / 2 - 8);
      ctx.fillText('clic en Reiniciar', canvas.width / 2, canvas.height / 2 + 12);
    }
  }
  function onKey(e) {
    const map = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    if (d.x === -dir.x && d.y === -dir.y) return;
    nextDir = d;
  }
  canvas.tabIndex = 0;
  canvas.addEventListener('click', () => canvas.focus());
  canvas.addEventListener('keydown', onKey);
  container.querySelector('[data-act="restart"]').addEventListener('click', reset);
  reset(); draw();
  if (win.data.snakeInterval) clearInterval(win.data.snakeInterval);
  win.data.snakeInterval = setInterval(tick, 140);
}

/* ================= APP: VISOR DE IMÁGENES ================= */
function renderImageViewer(container, win, opts) {
  if (win.data.src === undefined) win.data.src = (opts && opts.src) || null;
  if (win.data.fileName === undefined) win.data.fileName = (opts && opts.fileName) || null;
  win.data.rotation = win.data.rotation || 0;
  win.data.zoom = win.data.zoom || 1;
  container.innerHTML = `
    <div class="iv-wrap">
      <div class="app-toolbar">
        <button data-act="open">🖼️ Abrir imagen…</button>
        <button data-act="save">💾 Guardar en Imágenes</button>
        <button data-act="rotate">⟳ Rotar</button>
        <button data-act="zoom-in">＋</button>
        <button data-act="zoom-out">－</button>
        <input type="file" accept="image/*" id="iv-file-${win.id}" style="display:none" />
      </div>
      <div class="iv-canvas">
        ${win.data.src ? `<img id="iv-img-${win.id}" src="${win.data.src}" style="transform:rotate(${win.data.rotation}deg) scale(${win.data.zoom})" />` : `<div class="app-empty">🖼️<br/>Abrí una imagen desde tu computadora para verla acá</div>`}
      </div>
    </div>`;
  const fileInput = container.querySelector(`#iv-file-${win.id}`);
  container.querySelector('[data-act="open"]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      win.data.src = reader.result;
      win.data.fileName = file.name;
      win.data.rotation = 0; win.data.zoom = 1;
      renderImageViewer(container, win, {});
    };
    reader.readAsDataURL(file);
  });
  container.querySelector('[data-act="save"]').addEventListener('click', () => {
    if (!win.data.src) { notify('Visor de imágenes', 'Primero abrí una imagen'); return; }
    const name = win.data.fileName || `imagen-${Date.now()}.png`;
    const dir = '/home/usuario/Imágenes';
    if (!getNode(joinPath(dir, name))) createFile(dir, name, win.data.src);
    else writeFile(joinPath(dir, name), win.data.src);
    notify('Visor de imágenes', `Guardada en ${dir}/${name}`);
  });
  container.querySelector('[data-act="rotate"]').addEventListener('click', () => { win.data.rotation = (win.data.rotation + 90) % 360; applyImgTransform(); });
  container.querySelector('[data-act="zoom-in"]').addEventListener('click', () => { win.data.zoom = Math.min(3, win.data.zoom + 0.2); applyImgTransform(); });
  container.querySelector('[data-act="zoom-out"]').addEventListener('click', () => { win.data.zoom = Math.max(0.2, win.data.zoom - 0.2); applyImgTransform(); });
  function applyImgTransform() {
    const img = container.querySelector(`#iv-img-${win.id}`);
    if (img) img.style.transform = `rotate(${win.data.rotation}deg) scale(${win.data.zoom})`;
  }
}

/* ================= REGISTRO DE APLICACIONES ================= */
const APPS = {
  'file-explorer': { name: 'Explorador de archivos', icon: ICONS.folder, defaultSize: { w: 760, h: 500 }, singleton: false, pinned: true, render: renderFileExplorer },
  'notepad': { name: 'Bloc de notas', icon: ICONS.notepad, defaultSize: { w: 520, h: 440 }, singleton: false, pinned: true, render: renderNotepad },
  'calculator': { name: 'Calculadora', icon: ICONS.calculator, defaultSize: { w: 300, h: 460 }, singleton: false, pinned: true, render: renderCalculator },
  'terminal': { name: 'Terminal', icon: ICONS.terminal, defaultSize: { w: 620, h: 400 }, singleton: false, pinned: true, render: renderTerminal },
  'calendar': { name: 'Calendario', icon: ICONS.calendar, defaultSize: { w: 460, h: 480 }, singleton: false, pinned: false, render: renderCalendar },
  'monitor': { name: 'Monitor del sistema', icon: ICONS.monitor, defaultSize: { w: 600, h: 460 }, singleton: true, pinned: false, render: renderMonitor },
  'store': { name: 'Tienda de aplicaciones', icon: ICONS.store, defaultSize: { w: 600, h: 440 }, singleton: true, pinned: false, render: renderStore },
  'settings': { name: 'Configuración', icon: ICONS.settings, defaultSize: { w: 620, h: 460 }, singleton: true, pinned: true, render: renderSettings },
  'code-editor': { name: 'Editor de código', icon: ICONS.puzzle, emoji: '💻', desc: 'Editor de texto simple con números de línea, ideal para HTML, CSS y JS.', defaultSize: { w: 560, h: 420 }, singleton: false, pinned: false, installable: true, render: renderCodeEditor },
  'media-player': { name: 'Reproductor multimedia', icon: ICONS.puzzle, emoji: '🎵', desc: 'Reproductor de demostración con lista de pistas simuladas.', defaultSize: { w: 360, h: 440 }, singleton: false, pinned: false, installable: true, render: renderMediaPlayer },
  'sticky-notes': { name: 'Notas rápidas', icon: ICONS.puzzle, emoji: '🗒️', desc: 'Una nota adhesiva siempre a mano para ideas rápidas.', defaultSize: { w: 300, h: 340 }, singleton: false, pinned: false, installable: true, render: renderStickyNotes },
  'weather': { name: 'Clima', icon: ICONS.weather, emoji: '⛅', desc: 'Pronóstico real por ciudad usando una API pública, sin necesidad de clave.', defaultSize: { w: 340, h: 460 }, singleton: false, pinned: false, installable: true, render: renderWeather },
  'snake-game': { name: 'Snake', icon: ICONS.game, emoji: '🐍', desc: 'El clásico juego de la serpiente, jugable con las flechas del teclado.', defaultSize: { w: 400, h: 460 }, singleton: false, pinned: false, installable: true, render: renderSnakeGame },
  'image-viewer': { name: 'Visor de imágenes', icon: ICONS.picture, emoji: '🖼️', desc: 'Abrí fotos desde tu computadora y probá zoom y rotación.', defaultSize: { w: 520, h: 440 }, singleton: false, pinned: false, installable: true, render: renderImageViewer },
};

/* ================= EVENTOS ESTÁTICOS (una sola vez) ================= */
function wireStaticEventListeners() {
  document.getElementById('start-button').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('start-menu').classList.contains('hidden') ? openStartMenu() : closeStartMenu();
  });
  document.getElementById('start-search').addEventListener('input', (e) => filterStartMenu(e.target.value));
  document.getElementById('taskbar-search').addEventListener('click', openStartMenu);

  document.getElementById('tray-notifications').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('notification-panel').classList.toggle('hidden');
    document.getElementById('control-center').classList.add('hidden');
  });
  document.getElementById('clear-notifications').addEventListener('click', () => { state.notifications = []; updateNotifBadge(); renderNotifications(); });

  document.getElementById('tray-controls').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('control-center').classList.toggle('hidden');
    document.getElementById('notification-panel').classList.add('hidden');
  });
  document.getElementById('tray-clock').addEventListener('click', (e) => { e.stopPropagation(); openApp('calendar'); });

  ['cc-wifi', 'cc-bt', 'cc-dnd', 'cc-airplane'].forEach((id) => {
    document.getElementById(id).addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const on = btn.dataset.on === 'true';
      btn.dataset.on = String(!on);
      if (id === 'cc-dnd') state.dnd = !on;
      if (id === 'cc-wifi') state.wifi = !on;
      if (id === 'cc-bt') state.bluetooth = !on;
      if (id === 'cc-airplane') state.airplane = !on;
    });
  });
  document.getElementById('cc-brightness').addEventListener('input', (e) => {
    document.getElementById('dim-overlay').style.opacity = String((100 - Number(e.target.value)) / 140);
  });
  document.getElementById('cc-volume').addEventListener('input', (e) => { state.volume = Number(e.target.value); });
  document.getElementById('cc-test-sound').addEventListener('click', playTestBeep);

  document.getElementById('login-toggle').addEventListener('click', () => setLoginMode(loginMode === 'login' ? 'register' : 'login'));
  document.getElementById('login-guest').addEventListener('click', () => {
    logIn({ id: 'invitado', name: 'Invitado', avatar: '🙂' });
  });
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoginError('');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const name = document.getElementById('login-name').value.trim();
    const submitBtn = document.getElementById('login-submit-btn');
    if (!window.WebOSFirebase || !window.WebOSFirebase.isConfigured) {
      showLoginError('Firebase no está configurado. Usá "Continuar como invitado" o completá firebase-config.js.');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Un momento…';
    try {
      let profile;
      if (loginMode === 'register') {
        if (!name) throw new Error('Ingresá un nombre para tu cuenta.');
        profile = await window.WebOSFirebase.registerUser(name, email, password);
      } else {
        profile = await window.WebOSFirebase.loginUser(email, password);
      }
      logIn({ id: profile.uid, name: profile.name, avatar: profile.avatar || '🙂' });
    } catch (err) {
      showLoginError(traduceErrorFirebase(err));
      submitBtn.disabled = false;
      setLoginMode(loginMode);
    }
  });
  document.querySelectorAll('[data-power]').forEach((btn) => btn.addEventListener('click', () => handlePower(btn.dataset.power)));

  document.getElementById('lock-screen').addEventListener('click', goToLogin);
  document.getElementById('shutdown-screen').addEventListener('click', runBoot);

  document.getElementById('desktop').addEventListener('contextmenu', (e) => {
    if (e.target.closest('.window') || e.target.closest('.desktop-icon') || e.target.closest('.taskbar')) return;
    e.preventDefault();
    showContextMenu(e.pageX, e.pageY, [
      { label: '🔄 Actualizar', action: () => notify('Escritorio', 'Escritorio actualizado') },
      { label: '🎨 Personalizar', action: () => openApp('settings') },
      { sep: true },
      { label: '🛒 Tienda de aplicaciones', action: () => openApp('store') },
    ]);
  });

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#context-menu')) hideContextMenu();
    if (!e.target.closest('#start-menu') && !e.target.closest('#start-button') && !e.target.closest('#taskbar-search')) closeStartMenu();
    if (!e.target.closest('#notification-panel') && !e.target.closest('#tray-notifications')) document.getElementById('notification-panel').classList.add('hidden');
    if (!e.target.closest('#control-center') && !e.target.closest('#tray-controls')) document.getElementById('control-center').classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('bios-screen').classList.contains('hidden')) {
      if (!document.getElementById('bios-setup').classList.contains('hidden')) { handleBiosSetupKey(e); return; }
      if (e.key === 'Delete') { biosEnterSetupRequested = true; biosSkip = true; }
      else { biosSkip = true; }
      return;
    }
    if (!document.getElementById('lock-screen').classList.contains('hidden')) { goToLogin(); return; }
    if (document.getElementById('desktop').classList.contains('hidden')) return;
    if (e.key === 'Escape') {
      closeStartMenu(); hideContextMenu();
      document.getElementById('notification-panel').classList.add('hidden');
      document.getElementById('control-center').classList.add('hidden');
    }
    if (e.altKey && e.key === 'Tab') { e.preventDefault(); cycleWindows(); }
  });

  // Si Firebase todavía no había terminado de inicializarse cuando se mostró
  // la pantalla de inicio de sesión, actualizamos el aviso apenas esté listo.
  window.addEventListener('webos-firebase-ready', () => {
    if (!document.getElementById('login-screen').classList.contains('hidden')) updateFirebaseNote();
  });
}

/* ================= PROCESOS EN SEGUNDO PLANO ================= */
setInterval(() => {
  state.processes.forEach((p) => {
    p.cpu = Math.max(0, Math.min(100, p.cpu + (Math.random() * 6 - 3)));
    p.mem = Math.max(20, p.mem + (Math.random() * 10 - 5));
  });
  state.windows.filter((w) => w.appId === 'monitor').forEach((w) => refreshMonitorBody(w));
}, 2000);

/* ================= INICIO ================= */
seedProcesses();
initAuroraCanvases();
wireStaticEventListeners();
// Guarda cualquier cambio pendiente si el usuario cierra o recarga la pestaña.
window.addEventListener('beforeunload', flushSave);
tickClock();
setInterval(tickClock, 5000);
runBios();
