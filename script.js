/* ============================================================================
   WINDOWS 12 — SIMULACIÓN CONCEPTUAL
   script.js — Lógica completa del sistema (JavaScript puro, sin librerías)

   Índice de módulos:
     1.  Estado global (OS)
     2.  Utilidades generales
     3.  Motor de sonido (Web Audio API)
     4.  Reloj / fecha del sistema
     5.  Sistema de arranque (Boot)
     6.  Pantalla de bloqueo
     7.  Sistema de archivos virtual
     8.  Iconos de escritorio
     9.  Menú contextual genérico
     10. Gestor de ventanas
     11. Barra de tareas
     12. Menú Inicio
     13. Buscador global
     14. Centro de control
     15. Centro de notificaciones / Toasts
     16. Panel de widgets
     17. Vista de tareas / escritorios virtuales
     18. Alt+Tab
     19. Modal de energía
     20. Registro de aplicaciones
     21. Aplicaciones (cada una en su propia sección)
     22. Inicialización general
   ============================================================================ */

"use strict";

/* ============================================================================
   1. ESTADO GLOBAL
============================================================================ */
const OS = {
  booted:false,
  locked:true,
  theme:"dark",                // 'dark' | 'light'
  accent:"#0078d4",
  wallpaperId:"aurora",
  brightness:80,
  volume:60,
  muted:false,
  wifiOn:true,
  bluetoothOn:false,
  airplaneOn:false,
  dndOn:false,
  batterySaverOn:false,
  accessibilityOn:false,
  batteryPct:87,
  batteryCharging:true,
  autohideTaskbar:false,
  zCounter:100,
  windows:{},                 // id -> window state object
  windowOrder:[],             // z-order stack of ids
  activeWindowId:null,
  desktops:[{id:1,name:"Escritorio 1",windows:[]}],
  currentDesktop:1,
  desktopIcons:[],            // {id,name,icon,type,x,y,appId,path}
  selectedIconIds:[],
  notifications:[],           // {id,title,msg,icon,time,app}
  recentApps:[],              // recently opened app ids
  pinnedApps:["fileExplorer","browser","aiAssistant","settings","calculator","notepad","terminal"],
  installedApps:["store"],    // apps installed via store (extra)
  clipboard:null,             // {type:'copy'|'cut', items:[...], sourcePath}
  draggingIcon:false,
  contextTarget:null,
  nextWinId:1,
  nextIconId:1,
  nextFileId:1,
  nextNotifId:1,
  cpuHistory:[],
  ramHistory:[],
  altTabIndex:0
};

/* ============================================================================
   2. UTILIDADES GENERALES
============================================================================ */
const $ = (sel,ctx)=> (ctx||document).querySelector(sel);
const $$ = (sel,ctx)=> Array.from((ctx||document).querySelectorAll(sel));
const el = (tag,cls,html)=>{
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html!==undefined) e.innerHTML = html;
  return e;
};
function uid(prefix){ return prefix + "_" + Math.random().toString(36).slice(2,9); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function pad2(n){ return n.toString().padStart(2,"0"); }
function escapeHtml(str){
  if(str===undefined||str===null) return "";
  return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function formatBytes(bytes){
  if(bytes < 1024) return bytes+" B";
  if(bytes < 1024*1024) return (bytes/1024).toFixed(1)+" KB";
  if(bytes < 1024*1024*1024) return (bytes/1024/1024).toFixed(1)+" MB";
  return (bytes/1024/1024/1024).toFixed(2)+" GB";
}
function throttle(fn,ms){
  let last=0, timer=null;
  return function(...args){
    const now=Date.now();
    if(now-last>=ms){ last=now; fn.apply(this,args); }
    else{
      clearTimeout(timer);
      timer=setTimeout(()=>{ last=Date.now(); fn.apply(this,args); }, ms-(now-last));
    }
  };
}
function debounce(fn,ms){
  let t=null;
  return function(...args){ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args),ms); };
}
const WEEKDAYS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const WEEKDAYS_SHORT = ["dom","lun","mar","mié","jue","vie","sáb"];
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function formatTime(d){
  return pad2(d.getHours())+":"+pad2(d.getMinutes());
}
function formatTimeSec(d){
  return pad2(d.getHours())+":"+pad2(d.getMinutes())+":"+pad2(d.getSeconds());
}
function formatFullDate(d){
  return WEEKDAYS[d.getDay()].charAt(0).toUpperCase()+WEEKDAYS[d.getDay()].slice(1)+", "+d.getDate()+" de "+MONTHS[d.getMonth()];
}
function formatShortDate(d){
  return pad2(d.getDate())+"/"+pad2(d.getMonth()+1)+"/"+d.getFullYear();
}

/* Ripple effect para botones (efecto Material/Fluent) */
function attachRipple(container){
  container.addEventListener("pointerdown",(e)=>{
    const target = e.target.closest(".app-btn,.calc-btn,.tb-btn,.tb-app,.cm-item,.store-install-btn,.round-btn,.paint-tool-btn");
    if(!target) return;
    const rect = target.getBoundingClientRect();
    const ripple = el("span","ripple");
    const size = Math.max(rect.width,rect.height);
    ripple.style.width = ripple.style.height = size+"px";
    ripple.style.left = (e.clientX-rect.left-size/2)+"px";
    ripple.style.top = (e.clientY-rect.top-size/2)+"px";
    if(getComputedStyle(target).position==="static") target.style.position="relative";
    target.style.overflow = target.style.overflow || "hidden";
    target.appendChild(ripple);
    setTimeout(()=>ripple.remove(),500);
  });
}

/* ============================================================================
   3. MOTOR DE SONIDO (Web Audio API — sin archivos externos)
============================================================================ */
const SoundEngine = (()=>{
  let ctx = null;
  function getCtx(){
    if(!ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if(ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function masterGainValue(){
    if(OS.muted) return 0;
    return clamp(OS.volume,0,100)/100 * 0.5;
  }
  function tone({freq=440, duration=0.15, type="sine", startGain=masterGainValue(), endGain=0.0001, delay=0, glideTo=null}={}){
    try{
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime+delay);
      if(glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime+delay+duration);
      gain.gain.setValueAtTime(startGain, c.currentTime+delay);
      gain.gain.exponentialRampToValueAtTime(endGain, c.currentTime+delay+duration);
      osc.connect(gain).connect(c.destination);
      osc.start(c.currentTime+delay);
      osc.stop(c.currentTime+delay+duration+0.02);
    }catch(e){ /* silencioso si el navegador bloquea audio antes de interacción */ }
  }
  return {
    open(){ tone({freq:520,duration:.09,type:"sine",glideTo:760}); },
    close(){ tone({freq:600,duration:.1,type:"sine",glideTo:320}); },
    minimize(){ tone({freq:500,duration:.08,type:"sine",glideTo:260}); },
    maximize(){ tone({freq:420,duration:.09,type:"sine",glideTo:640}); },
    click(){ tone({freq:800,duration:.035,type:"triangle",startGain:masterGainValue()*0.6}); },
    hover(){ tone({freq:1200,duration:.02,type:"sine",startGain:masterGainValue()*0.15}); },
    error(){ tone({freq:220,duration:.14,type:"square",startGain:masterGainValue()*0.5}); tone({freq:180,duration:.16,type:"square",delay:.07,startGain:masterGainValue()*0.4}); },
    notify(){ tone({freq:900,duration:.09,type:"sine"}); tone({freq:1300,duration:.12,type:"sine",delay:.1}); },
    startup(){ tone({freq:300,duration:.4,type:"sine",glideTo:900,startGain:masterGainValue()*0.7}); tone({freq:450,duration:.5,type:"sine",glideTo:1200,delay:.15,startGain:masterGainValue()*0.5}); },
    unlock(){ tone({freq:700,duration:.12,type:"sine",glideTo:1000}); },
    lock(){ tone({freq:700,duration:.12,type:"sine",glideTo:400}); },
    toggleOn(){ tone({freq:660,duration:.06,type:"sine",glideTo:880}); },
    toggleOff(){ tone({freq:660,duration:.06,type:"sine",glideTo:440}); },
    typing(){ tone({freq:1000+Math.random()*300,duration:.015,type:"square",startGain:masterGainValue()*0.12}); }
  };
})();

/* ============================================================================
   4. RELOJ / FECHA DEL SISTEMA
============================================================================ */
function tickClock(){
  const now = new Date();
  const t = formatTime(now);
  const d = formatShortDate(now);
  const trayTime = $("#trayTime"); if(trayTime) trayTime.textContent = t;
  const trayDate = $("#trayDate"); if(trayDate) trayDate.textContent = d;
  const lockClock = $("#lockClock"); if(lockClock) lockClock.textContent = t;
  const lockDate = $("#lockDate"); if(lockDate) lockDate.textContent = formatFullDate(now);
  const ncDate = $("#ncDate"); if(ncDate) ncDate.textContent = formatFullDate(now);
  // Notificar a apps abiertas que necesiten refrescar el reloj (Reloj, Widgets)
  document.dispatchEvent(new CustomEvent("os:clocktick",{detail:{now}}));
}
setInterval(tickClock,1000);

/* Simulación de batería: fluctúa lentamente */
function tickBattery(){
  if(OS.batteryCharging){
    OS.batteryPct = clamp(OS.batteryPct + 1, 0, 100);
    if(OS.batteryPct>=100) OS.batteryCharging=false;
  } else {
    OS.batteryPct = clamp(OS.batteryPct - 1, 0, 100);
    if(OS.batteryPct<=15 && Math.random()<0.5) OS.batteryCharging=true;
  }
  const pctText = OS.batteryPct+"%";
  const t1=$("#trayBatteryText"); if(t1) t1.textContent=pctText;
  const t2=$("#lockBatteryText"); if(t2) t2.textContent=pctText;
  const t3=$("#ccBatteryPct"); if(t3) t3.textContent=pctText;
  const t4=$("#ccBatterySub"); if(t4) t4.textContent=pctText+(OS.batteryCharging?" · Cargando":" disponible");
  document.dispatchEvent(new CustomEvent("os:batterytick"));
  if(OS.batteryPct===20 && !OS.batteryCharging){
    NotificationCenter.push({title:"Batería baja",msg:"Al 20%. Considera conectar el cargador.",icon:"🔋",app:"Sistema"});
  }
}
setInterval(tickBattery, 45000);

/* Simulación de uso de CPU / RAM para Task Manager y Widgets */
function tickPerf(){
  const baseCpu = 8 + OS.windowOrder.length*4;
  const cpu = clamp(baseCpu + (Math.random()*18-9), 2, 97);
  const baseRam = 28 + OS.windowOrder.length*5;
  const ram = clamp(baseRam + (Math.random()*10-5), 10, 95);
  OS.cpuHistory.push(cpu); if(OS.cpuHistory.length>40) OS.cpuHistory.shift();
  OS.ramHistory.push(ram); if(OS.ramHistory.length>40) OS.ramHistory.shift();
  document.dispatchEvent(new CustomEvent("os:perftick",{detail:{cpu,ram}}));
}
setInterval(tickPerf, 1400);

/* ============================================================================
   5. SISTEMA DE ARRANQUE (BOOT)
============================================================================ */
const BOOT_MESSAGES = [
  "Iniciando Windows 12…",
  "Cargando componentes del núcleo…",
  "Preparando Fluent Shell…",
  "Comprobando dispositivos…",
  "Cargando perfil de usuario…",
  "Casi listo…"
];
function runBootSequence(){
  const fill = $("#bootProgressFill");
  const status = $("#bootStatus");
  let progress = 0;
  let msgIndex = 0;
  status.textContent = BOOT_MESSAGES[0];
  const interval = setInterval(()=>{
    progress += Math.random()*13 + 6;
    if(progress >= 100){
      progress = 100;
      fill.style.width = "100%";
      clearInterval(interval);
      SoundEngine.startup();
      setTimeout(finishBoot, 500);
      return;
    }
    fill.style.width = progress+"%";
    const newMsgIndex = Math.min(BOOT_MESSAGES.length-1, Math.floor((progress/100)*BOOT_MESSAGES.length));
    if(newMsgIndex !== msgIndex){ msgIndex = newMsgIndex; status.textContent = BOOT_MESSAGES[msgIndex]; }
  }, 220);
}
function finishBoot(){
  $("#boot-screen").classList.add("hidden");
  OS.booted = true;
  setTimeout(()=>{ $("#boot-screen").style.display="none"; }, 650);
}

/* ============================================================================
   6. PANTALLA DE BLOQUEO
============================================================================ */
function initLockScreen(){
  const lockScreen = $("#lock-screen");
  const lockSignin = $("#lockSignin");
  const pwdInput = $("#lockPasswordInput");
  const submitBtn = $("#lockSubmitBtn");
  const errorEl = $("#signinError");
  const backBtn = $("#signinBack");

  function showSignin(){
    lockScreen.classList.add("signin-active");
    setTimeout(()=>pwdInput.focus(), 260);
  }
  lockScreen.addEventListener("click",(e)=>{
    if(lockScreen.classList.contains("signin-active")) return;
    showSignin();
  });
  document.addEventListener("keydown",(e)=>{
    if(OS.locked && OS.booted && !lockScreen.classList.contains("signin-active") && !lockScreen.classList.contains("hidden")){
      showSignin();
    }
  });
  backBtn.addEventListener("click",(e)=>{
    e.stopPropagation();
    lockScreen.classList.remove("signin-active");
    pwdInput.value="";
    errorEl.textContent="";
  });
  function tryUnlock(){
    // Simulación educativa: cualquier valor (incluso vacío) desbloquea, para no bloquear al usuario.
    errorEl.textContent="";
    unlockSystem();
  }
  submitBtn.addEventListener("click",(e)=>{ e.stopPropagation(); tryUnlock(); });
  pwdInput.addEventListener("keydown",(e)=>{
    e.stopPropagation();
    if(e.key==="Enter") tryUnlock();
  });
  pwdInput.addEventListener("click",(e)=>e.stopPropagation());
  lockSignin.addEventListener("click",(e)=>e.stopPropagation());
}
function unlockSystem(){
  SoundEngine.unlock();
  OS.locked = false;
  $("#lock-screen").classList.add("hidden");
  document.dispatchEvent(new CustomEvent("os:unlocked"));
  setTimeout(()=>{
    NotificationCenter.push({title:"Bienvenido de nuevo",msg:"Sesión iniciada correctamente. Todo listo.",icon:"👋",app:"Sistema"});
  }, 900);
}
function lockSystem(){
  SoundEngine.lock();
  OS.locked = true;
  const lockScreen = $("#lock-screen");
  lockScreen.classList.remove("hidden");
  lockScreen.classList.remove("signin-active");
  $("#startSearchInput") && closeStartMenu();
  closeAllFlyouts();
}

/* ============================================================================
   7. SISTEMA DE ARCHIVOS VIRTUAL (100% en memoria, seguro y educativo)
============================================================================ */
const FS = (()=>{
  const nodes = {};

  function icon_for(node){
    if(node.type==="folder") return node.id==="recyclebin" ? "🗑️" : "📁";
    const ext=(node.ext||"").toLowerCase();
    if(["png","jpg","jpeg","gif","webp"].includes(ext)) return "🖼️";
    if(["mp3","wav","ogg"].includes(ext)) return "🎵";
    if(["mp4","mov","webm"].includes(ext)) return "🎬";
    if(ext==="pdf") return "📕";
    if(ext==="txt") return "📄";
    if(ext==="rtf"||ext==="doc"||ext==="docx") return "📝";
    if(ext==="xlsx"||ext==="csv") return "📊";
    if(ext==="zip"||ext==="rar") return "🗜️";
    if(ext==="exe") return "⚙️";
    return "📦";
  }

  function makeNode(opts){
    const id = opts.id || uid("fs");
    const node = Object.assign({
      id, name:"Nuevo elemento", type:"file", kind:"text", ext:"txt",
      content:"", parent:null, children:null, dateModified:new Date(),
      locked:false, x:null, y:null, size: opts.size||0
    }, opts);
    if(node.type==="folder" && !node.children) node.children=[];
    nodes[id]=node;
    return node;
  }

  function get(id){ return nodes[id]; }
  function getChildren(id){
    const n = nodes[id];
    if(!n || n.type!=="folder") return [];
    if(id==="thispc") return ["documents","downloads","pictures","videos","music","desktop"].map(x=>nodes[x]).filter(Boolean);
    return (n.children||[]).map(cid=>nodes[cid]).filter(Boolean);
  }
  function pathChain(id){
    const chain=[]; let cur = nodes[id];
    while(cur){ chain.unshift(cur); cur = cur.parent ? nodes[cur.parent] : null; }
    return chain;
  }
  function createFolder(parentId,name){
    const parent = nodes[parentId];
    const n = makeNode({name:name||"Nueva carpeta", type:"folder", parent:parentId, children:[]});
    if(parent && parent.children) parent.children.push(n.id);
    return n;
  }
  function createFile(parentId,name,kind,content,ext){
    const parent = nodes[parentId];
    const n = makeNode({name:name||"Nuevo archivo.txt", type:"file", kind:kind||"text", content:content||"", ext:ext||"txt", parent:parentId, size:(content||"").length});
    if(parent && parent.children) parent.children.push(n.id);
    return n;
  }
  function rename(id,newName){
    const n = nodes[id]; if(!n || n.locked) return false;
    n.name = newName; n.dateModified = new Date();
    return true;
  }
  function removeFromParentArray(id){
    const n = nodes[id]; if(!n || !n.parent) return;
    const p = nodes[n.parent];
    if(p && p.children) p.children = p.children.filter(c=>c!==id);
  }
  function deleteToRecycle(id){
    const n = nodes[id]; if(!n || n.locked) return false;
    removeFromParentArray(id);
    n.originalParent = n.parent;
    n.parent = "recyclebin";
    n.deletedAt = new Date();
    nodes["recyclebin"].children.push(id);
    return true;
  }
  function restore(id){
    const n = nodes[id]; if(!n) return false;
    nodes["recyclebin"].children = nodes["recyclebin"].children.filter(c=>c!==id);
    n.parent = n.originalParent || "documents";
    const p = nodes[n.parent];
    if(p && p.children) p.children.push(id);
    return true;
  }
  function permanentDelete(id){
    const n = nodes[id]; if(!n) return false;
    if(n.type==="folder" && n.children){ n.children.slice().forEach(cid=>permanentDelete(cid)); }
    removeFromParentArray(id);
    if(n.parent==="recyclebin"){ nodes["recyclebin"].children = nodes["recyclebin"].children.filter(c=>c!==id); }
    delete nodes[id];
    return true;
  }
  function moveTo(id,newParentId){
    const n = nodes[id]; if(!n || n.locked) return false;
    if(id===newParentId) return false;
    removeFromParentArray(id);
    n.parent = newParentId;
    const p = nodes[newParentId];
    if(p && p.children) p.children.push(id);
    return true;
  }
  function searchAll(query){
    query = query.toLowerCase();
    return Object.values(nodes).filter(n=>n.name.toLowerCase().includes(query) && n.parent!=="recyclebin" && n.id!=="recyclebin");
  }
  function uniqueName(parentId, baseName){
    const siblings = getChildren(parentId).map(c=>c.name);
    if(!siblings.includes(baseName)) return baseName;
    let i=2;
    const dot = baseName.lastIndexOf(".");
    const stem = dot>0 ? baseName.slice(0,dot) : baseName;
    const ext = dot>0 ? baseName.slice(dot) : "";
    while(siblings.includes(stem+" ("+i+")"+ext)) i++;
    return stem+" ("+i+")"+ext;
  }

  /* --- Semillas iniciales del sistema de archivos --- */
  makeNode({id:"thispc", name:"Este equipo", type:"folder", locked:true, parent:null});
  makeNode({id:"desktop", name:"Escritorio", type:"folder", parent:"thispc", children:[]});
  makeNode({id:"documents", name:"Documentos", type:"folder", parent:"thispc", children:[]});
  makeNode({id:"downloads", name:"Descargas", type:"folder", parent:"thispc", children:[]});
  makeNode({id:"pictures", name:"Imágenes", type:"folder", parent:"thispc", children:[]});
  makeNode({id:"videos", name:"Vídeos", type:"folder", parent:"thispc", children:[]});
  makeNode({id:"music", name:"Música", type:"folder", parent:"thispc", children:[]});
  makeNode({id:"recyclebin", name:"Papelera de reciclaje", type:"folder", locked:true, parent:null, children:[]});

  createFile("desktop","Bienvenido a Windows 12.txt","text",
"Bienvenido a esta simulación conceptual de Windows 12.\r\n\r\nEste proyecto es una recreación educativa e independiente, inspirada en conceptos filtrados y en el lenguaje de diseño Fluent de Microsoft. No representa un producto oficial.\r\n\r\nExplora el menú Inicio, el Explorador de archivos, la Terminal y el resto de aplicaciones incluidas. ¡Disfruta!","txt");
  createFolder("desktop","Mis proyectos");
  createFile("documents","Informe anual.txt","text","Informe anual de actividades.\r\n\r\n1. Resumen ejecutivo\r\n2. Resultados\r\n3. Conclusiones","txt");
  createFile("documents","Notas de reunión.txt","text","Notas de la reunión de equipo:\r\n- Revisar cronograma\r\n- Actualizar diseño\r\n- Preparar demo","txt");
  createFolder("documents","Proyectos personales");
  createFile("downloads","Instalador_Demo.exe","binary","","exe");
  createFile("downloads","reporte_2026.pdf","pdf","Documento PDF simulado.","pdf");
  createFile("pictures","Amanecer.jpg","image","🌅","jpg");
  createFile("pictures","Montañas.jpg","image","🏔️","jpg");
  createFile("pictures","Ciudad de noche.jpg","image","🌃","jpg");
  createFile("pictures","Playa.jpg","image","🏖️","jpg");
  createFile("music","Ambient Chill.mp3","audio","","mp3");
  createFile("music","Lo-fi Focus.mp3","audio","","mp3");

  return {
    nodes, get, getChildren, pathChain, createFolder, createFile, rename,
    deleteToRecycle, restore, permanentDelete, moveTo, searchAll, uniqueName, icon_for
  };
})();

/* ============================================================================
   9. MENÚ CONTEXTUAL GENÉRICO (usado por escritorio, explorador, etc.)
============================================================================ */
const ContextMenu = (()=>{
  const menuEl = ()=> $("#context-menu");
  function build(items){
    return items.map(item=>{
      if(item.separator) return '<div class="cm-sep"></div>';
      const disabled = item.disabled ? "disabled" : "";
      return `<li class="cm-item ${disabled}" data-cm-id="${item.id}">
        <span class="cm-icon">${item.icon||""}</span>
        <span class="cm-label">${escapeHtml(item.label)}</span>
        ${item.shortcut?`<span class="cm-shortcut">${item.shortcut}</span>`:""}
      </li>`;
    }).join("");
  }
  function show(x,y,items){
    const menu = menuEl();
    menu.innerHTML = build(items);
    menu.classList.add("open");
    // posicionamiento con límites de pantalla
    const rect0 = menu.getBoundingClientRect();
    let left = x, top = y;
    menu.style.left="0px"; menu.style.top="0px";
    const w = menu.offsetWidth, h = menu.offsetHeight;
    if(left + w > window.innerWidth-8) left = window.innerWidth - w - 8;
    if(top + h > window.innerHeight-8) top = window.innerHeight - h - 8;
    menu.style.left = left+"px";
    menu.style.top = top+"px";
    menu.onclick = (e)=>{
      const li = e.target.closest(".cm-item");
      if(!li || li.classList.contains("disabled")) return;
      const item = items.find(i=>i.id===li.dataset.cmId);
      hide();
      if(item && item.action) item.action();
    };
  }
  function hide(){ menuEl().classList.remove("open"); }
  document.addEventListener("pointerdown",(e)=>{
    if(!e.target.closest("#context-menu")) hide();
  });
  window.addEventListener("blur",hide);
  return { show, hide };
})();

/* ============================================================================
   8. ICONOS DE ESCRITORIO
============================================================================ */
const DesktopIcons = (()=>{
  const GRID_W = 96, GRID_H = 100, PAD_TOP = 16, PAD_LEFT = 10;
  let selected = new Set();

  function specialIcons(){
    return [
      {id:"thispc", name:"Este equipo", icon:"💻", special:true},
      {id:"recyclebin", name: FS.getChildren("recyclebin").length ? "Papelera de reciclaje (llena)" : "Papelera de reciclaje", icon: FS.getChildren("recyclebin").length ? "🗑️" : "🗑️", special:true}
    ];
  }
  function allIconNodes(){
    return [...specialIcons(), ...FS.getChildren("desktop")];
  }
  function assignDefaultPositions(){
    const maxRows = Math.max(4, Math.floor((window.innerHeight - PAD_TOP - 90) / GRID_H));
    let col=0,row=0;
    allIconNodes().forEach(node=>{
      const fsNode = FS.get(node.id) || node;
      if(fsNode.x===null || fsNode.x===undefined){
        fsNode.x = PAD_LEFT + col*GRID_W;
        fsNode.y = PAD_TOP + row*GRID_H;
        row++;
        if(row>=maxRows){ row=0; col++; }
      }
    });
  }
  function render(){
    assignDefaultPositions();
    const container = $("#desktopIcons");
    container.innerHTML = "";
    allIconNodes().forEach(node=>{
      const fsNode = FS.get(node.id) || node;
      const div = el("div","desktop-icon");
      div.dataset.id = node.id;
      div.style.left = fsNode.x+"px";
      div.style.top = fsNode.y+"px";
      if(selected.has(node.id)) div.classList.add("selected");
      const iconChar = node.special ? node.icon : FS.icon_for(fsNode);
      div.innerHTML = `<div class="di-icon">${iconChar}</div><div class="di-label">${escapeHtml(fsNode.name)}</div>`;
      container.appendChild(div);
      wireIconEvents(div, node);
    });
  }

  function clearSelection(){ selected.clear(); $$(".desktop-icon").forEach(d=>d.classList.remove("selected")); }
  function selectOnly(id){ selected.clear(); selected.add(id); syncSelectedClasses(); }
  function toggleSelect(id){ selected.has(id)?selected.delete(id):selected.add(id); syncSelectedClasses(); }
  function syncSelectedClasses(){
    $$(".desktop-icon").forEach(d=> d.classList.toggle("selected", selected.has(d.dataset.id)));
  }

  function openIcon(id){
    if(id==="thispc"){ AppManager.open("fileExplorer",{path:"thispc"}); return; }
    if(id==="recyclebin"){ AppManager.open("recycleBin",{}); return; }
    const node = FS.get(id);
    if(!node) return;
    if(node.type==="folder"){ AppManager.open("fileExplorer",{path:id}); return; }
    openFileWithDefaultApp(node);
  }

  function wireIconEvents(div,node){
    let dragging=false, moved=false, startX=0, startY=0, origX=0, origY=0;
    let clickTimer=null;

    div.addEventListener("pointerdown",(e)=>{
      e.stopPropagation();
      if(e.button===2) return; // el botón derecho lo maneja contextmenu
      if(!selected.has(node.id) && !e.ctrlKey && !e.shiftKey) selectOnly(node.id);
      else if(e.ctrlKey || e.shiftKey) toggleSelect(node.id);
      else syncSelectedClasses();
      dragging = true; moved=false;
      startX = e.clientX; startY = e.clientY;
      const fsNode = FS.get(node.id) || node;
      origX = fsNode.x; origY = fsNode.y;
      div.setPointerCapture(e.pointerId);
    });
    div.addEventListener("pointermove",(e)=>{
      if(!dragging) return;
      const dx = e.clientX-startX, dy=e.clientY-startY;
      if(Math.abs(dx)>3 || Math.abs(dy)>3) moved=true;
      if(moved){
        div.classList.add("dragging");
        const fsNode = FS.get(node.id) || node;
        fsNode.x = clamp(origX+dx, 0, window.innerWidth-90);
        fsNode.y = clamp(origY+dy, 0, window.innerHeight-140);
        div.style.left = fsNode.x+"px";
        div.style.top = fsNode.y+"px";
      }
    });
    div.addEventListener("pointerup",(e)=>{
      dragging=false;
      div.classList.remove("dragging");
      if(!moved){
        clearTimeout(clickTimer);
        clickTimer = setTimeout(()=>{}, 200);
        if(div._lastClick && Date.now()-div._lastClick < 380){
          openIcon(node.id);
          div._lastClick=0;
        } else {
          div._lastClick = Date.now();
        }
      }
    });
    div.addEventListener("contextmenu",(e)=>{
      e.preventDefault(); e.stopPropagation();
      if(!selected.has(node.id)) selectOnly(node.id);
      showIconContextMenu(e.clientX,e.clientY,node);
    });
  }

  function startRename(id){
    const div = $(`.desktop-icon[data-id="${id}"]`);
    if(!div) return;
    const node = FS.get(id);
    if(!node || node.locked) return;
    const labelEl = $(".di-label",div);
    const input = el("input","di-rename");
    input.value = node.name;
    labelEl.replaceWith(input);
    input.focus(); input.select();
    function commit(){
      const val = input.value.trim();
      if(val) FS.rename(id,val);
      render();
    }
    input.addEventListener("blur",commit);
    input.addEventListener("keydown",(e)=>{
      e.stopPropagation();
      if(e.key==="Enter") input.blur();
      if(e.key==="Escape"){ input.value=node.name; input.blur(); }
    });
  }

  function deleteSelected(){
    let count=0;
    selected.forEach(id=>{
      const node = FS.get(id);
      if(node && !node.locked){ FS.deleteToRecycle(id); count++; }
    });
    selected.clear();
    render();
    if(count) NotificationCenter.push({title:"Elemento(s) eliminado(s)",msg:count+" elemento(s) movido(s) a la papelera de reciclaje.",icon:"🗑️",app:"Sistema"});
  }

  function showIconContextMenu(x,y,node){
    const isFolder = node.type==="folder" || node.special;
    const items = [
      {id:"open",label:"Abrir",icon:"📂",action:()=>openIcon(node.id)},
      {separator:true},
    ];
    if(!node.special){
      items.push({id:"rename",label:"Cambiar nombre",icon:"✏️",shortcut:"F2",action:()=>startRename(node.id)});
      items.push({id:"delete",label:"Eliminar",icon:"🗑️",shortcut:"Supr",action:deleteSelected});
      items.push({separator:true});
      items.push({id:"copy",label:"Copiar",icon:"📋",action:()=>{OS.clipboard={type:"copy",ids:[...selected]};}});
      items.push({id:"cut",label:"Cortar",icon:"✂️",action:()=>{OS.clipboard={type:"cut",ids:[...selected]};}});
    }
    if(node.id==="recyclebin"){
      items.push({id:"empty",label:"Vaciar papelera",icon:"🧹",action:()=>{
        FS.getChildren("recyclebin").forEach(n=>FS.permanentDelete(n.id));
        render();
        NotificationCenter.push({title:"Papelera vaciada",msg:"Todos los elementos se eliminaron permanentemente.",icon:"🗑️",app:"Sistema"});
      }});
    }
    items.push({separator:true});
    items.push({id:"props",label:"Propiedades",icon:"ℹ️",action:()=>{
      Toast.show({title:node.name, msg:(node.type==="folder"?"Carpeta":"Archivo")+" · Modificado: "+(FS.get(node.id)?formatShortDate(new Date(FS.get(node.id).dateModified)):formatShortDate(new Date())), icon:"ℹ️"});
    }});
    ContextMenu.show(x,y,items);
  }

  function showDesktopContextMenu(x,y){
    const items = [
      {id:"new-folder",label:"Nueva carpeta",icon:"📁",action:()=>{
        const n = FS.createFolder("desktop", FS.uniqueName("desktop","Nueva carpeta"));
        render(); setTimeout(()=>startRename(n.id),50);
      }},
      {id:"new-file",label:"Nuevo documento de texto",icon:"📄",action:()=>{
        const n = FS.createFile("desktop", FS.uniqueName("desktop","Nuevo documento de texto.txt"),"text","","txt");
        render(); setTimeout(()=>startRename(n.id),50);
      }},
      {separator:true},
      {id:"paste",label:"Pegar",icon:"📌",disabled:!OS.clipboard,action:()=>{
        if(!OS.clipboard) return;
        OS.clipboard.ids.forEach(id=>{
          if(OS.clipboard.type==="cut") FS.moveTo(id,"desktop");
          else{
            const src = FS.get(id);
            if(src){
              if(src.type==="folder") FS.createFolder("desktop", FS.uniqueName("desktop","Copia de "+src.name));
              else FS.createFile("desktop", FS.uniqueName("desktop","Copia de "+src.name), src.kind, src.content, src.ext);
            }
          }
        });
        if(OS.clipboard.type==="cut") OS.clipboard=null;
        render();
      }},
      {separator:true},
      {id:"refresh",label:"Actualizar",icon:"🔄",action:render},
      {id:"sort",label:"Ordenar por nombre",icon:"↕️",action:()=>{
        const d = FS.get("desktop");
        d.children.sort((a,b)=>FS.get(a).name.localeCompare(FS.get(b).name));
        render();
      }},
      {separator:true},
      {id:"personalize",label:"Personalizar",icon:"🎨",action:()=>AppManager.open("settings",{page:"personalization"})},
      {id:"display",label:"Configuración de pantalla",icon:"🖥️",action:()=>AppManager.open("settings",{page:"system"})}
    ];
    ContextMenu.show(x,y,items);
  }

  function initDesktopSurface(){
    const desktop = $("#desktop");
    const selBox = $("#selectionBox");
    let boxStart=null;

    desktop.addEventListener("pointerdown",(e)=>{
      if(e.target!==desktop && e.target.id!=="wallpaper" && e.target.id!=="wallpaperOverlay" && e.target.id!=="desktopIcons") return;
      if(e.button===2) return;
      clearSelection();
      boxStart = {x:e.clientX,y:e.clientY};
      selBox.style.display="block";
      selBox.style.left=e.clientX+"px"; selBox.style.top=e.clientY+"px";
      selBox.style.width="0px"; selBox.style.height="0px";
      desktop.setPointerCapture(e.pointerId);
    });
    desktop.addEventListener("pointermove",(e)=>{
      if(!boxStart) return;
      const x1=Math.min(boxStart.x,e.clientX), x2=Math.max(boxStart.x,e.clientX);
      const y1=Math.min(boxStart.y,e.clientY), y2=Math.max(boxStart.y,e.clientY);
      selBox.style.left=x1+"px"; selBox.style.top=y1+"px";
      selBox.style.width=(x2-x1)+"px"; selBox.style.height=(y2-y1)+"px";
      $$(".desktop-icon").forEach(div=>{
        const r = div.getBoundingClientRect();
        const overlap = !(r.right<x1||r.left>x2||r.bottom<y1||r.top>y2);
        div.classList.toggle("selected",overlap);
        if(overlap) selected.add(div.dataset.id); else selected.delete(div.dataset.id);
      });
    });
    desktop.addEventListener("pointerup",()=>{
      boxStart=null; selBox.style.display="none";
    });
    desktop.addEventListener("contextmenu",(e)=>{
      e.preventDefault();
      if(e.target===desktop || e.target.id==="wallpaper" || e.target.id==="wallpaperOverlay" || e.target.id==="desktopIcons"){
        showDesktopContextMenu(e.clientX,e.clientY);
      }
    });
    document.addEventListener("keydown",(e)=>{
      if(OS.locked) return;
      const activeTag = document.activeElement.tagName;
      if(activeTag==="INPUT"||activeTag==="TEXTAREA"||document.activeElement.isContentEditable) return;
      if(!selected.size) return;
      if(e.key==="Delete") deleteSelected();
      if(e.key==="F2" && selected.size===1) startRename([...selected][0]);
    });
  }

  return { render, initDesktopSurface, clearSelection, deleteSelected, startRename };
})();

/* ============================================================================
   10. GESTOR DE VENTANAS
============================================================================ */
const WindowManager = (()=>{
  const layer = ()=> $("#windowsLayer");
  const SNAP_MARGIN = 24;

  function nextZ(){ OS.zCounter++; return OS.zCounter; }

  function isSmallScreen(){ return window.innerWidth < 760 || window.innerHeight < 560; }

  function createWindow(opts){
    const id = "win"+(OS.nextWinId++);
    const maxW = Math.max(300, window.innerWidth-16);
    const maxH = Math.max(220, window.innerHeight-16);
    const width = Math.min(opts.width || 760, maxW);
    const height = Math.min(opts.height || 520, maxH);
    const cascadeOffset = (OS.windowOrder.length % 8) * 26;
    const x = opts.x!==undefined ? opts.x : clamp(120+cascadeOffset, 8, window.innerWidth-width-8);
    const y = opts.y!==undefined ? opts.y : clamp(70+cascadeOffset, 8, window.innerHeight-height-90);

    const winState = {
      id, appId:opts.appId, title:opts.title||"Aplicación", icon:opts.icon||"🗔",
      x,y,width,height, prevRect:null, maximized:false, minimized:false,
      resizable: opts.resizable!==false, maximizable: opts.maximizable!==false,
      desktopId: OS.currentDesktop, onClose: opts.onClose||null
    };
    OS.windows[id] = winState;
    OS.windowOrder.push(id);

    const winEl = el("div","win");
    winEl.style.left=x+"px"; winEl.style.top=y+"px";
    winEl.style.width=width+"px"; winEl.style.height=height+"px";
    winEl.style.zIndex = nextZ();
    winEl.dataset.id = id;
    winEl.innerHTML = `
      <div class="win-titlebar">
        <span class="win-icon">${winState.icon}</span>
        <span class="win-title">${escapeHtml(winState.title)}</span>
        <div class="win-controls">
          <button class="win-ctrl-btn wc-min" title="Minimizar" aria-label="Minimizar">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="10" x2="11" y2="10" stroke="currentColor" stroke-width="1.4"/></svg>
          </button>
          <button class="win-ctrl-btn wc-max" title="Maximizar" aria-label="Maximizar">
            <svg width="11" height="11" viewBox="0 0 11 11"><rect x="0.75" y="0.75" width="9.5" height="9.5" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <button class="win-ctrl-btn close" title="Cerrar" aria-label="Cerrar">
            <svg width="12" height="12" viewBox="0 0 12 12"><line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.4"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="1.4"/></svg>
          </button>
        </div>
      </div>
      <div class="win-body"></div>
      ${winState.resizable ? `
      <div class="win-resize-handle rh-n"></div><div class="win-resize-handle rh-s"></div>
      <div class="win-resize-handle rh-e"></div><div class="win-resize-handle rh-w"></div>
      <div class="win-resize-handle rh-ne"></div><div class="win-resize-handle rh-nw"></div>
      <div class="win-resize-handle rh-se"></div><div class="win-resize-handle rh-sw"></div>` : ""}
    `;
    layer().appendChild(winEl);
    winState.el = winEl;
    winState.bodyEl = $(".win-body",winEl);

    wireTitlebar(winState);
    if(winState.resizable) wireResize(winState);
    wireControls(winState);
    winEl.addEventListener("pointerdown",()=>focusWindow(id),true);

    focusWindow(id);
    SoundEngine.open();
    Taskbar.syncRunning();
    registerRecentApp(opts.appId, opts.title, opts.icon);
    if(isSmallScreen() && winState.maximizable){
      setTimeout(()=>toggleMaximize(id,true), 10);
    }
    return winState;
  }

  function wireControls(ws){
    $(".wc-min",ws.el).addEventListener("click",(e)=>{ e.stopPropagation(); minimize(ws.id); });
    $(".wc-max",ws.el).addEventListener("click",(e)=>{ e.stopPropagation(); toggleMaximize(ws.id); });
    $(".close",ws.el).addEventListener("click",(e)=>{ e.stopPropagation(); closeWindow(ws.id); });
    $(".wc-max",ws.el).addEventListener("dblclick",(e)=>e.stopPropagation());
  }

  function wireTitlebar(ws){
    const bar = $(".win-titlebar",ws.el);
    let dragging=false, startX,startY, origX,origY;
    bar.addEventListener("dblclick",(e)=>{ if(e.target.closest(".win-controls")) return; toggleMaximize(ws.id); });
    bar.addEventListener("pointerdown",(e)=>{
      if(e.target.closest(".win-controls")) return;
      dragging = true;
      startX=e.clientX; startY=e.clientY;
      origX=ws.x; origY=ws.y;
      bar.classList.add("dragging-cursor");
      bar.setPointerCapture(e.pointerId);
      focusWindow(ws.id);
    });
    bar.addEventListener("pointermove",(e)=>{
      if(!dragging) return;
      const dx=e.clientX-startX, dy=e.clientY-startY;
      if(ws.maximized && (Math.abs(dx)>6||Math.abs(dy)>6)){
        // al arrastrar una ventana maximizada, se restaura bajo el cursor
        restoreFromMaximize(ws, e.clientX);
        origX = ws.x; origY = ws.y; startX=e.clientX; startY=e.clientY;
      }
      ws.x = clamp(origX+dx, -ws.width+80, window.innerWidth-80);
      ws.y = clamp(origY+dy, 0, window.innerHeight-40);
      ws.el.style.left=ws.x+"px"; ws.el.style.top=ws.y+"px";
      updateSnapPreview(e.clientX,e.clientY);
    });
    bar.addEventListener("pointerup",(e)=>{
      if(!dragging) return;
      dragging=false;
      bar.classList.remove("dragging-cursor");
      applySnapIfNeeded(ws, e.clientX, e.clientY);
      $("#snapPreview").style.display="none";
    });
  }

  function updateSnapPreview(cx,cy){
    const prev = $("#snapPreview");
    const zone = detectSnapZone(cx,cy);
    if(!zone){ prev.style.display="none"; return; }
    const rect = zoneRect(zone);
    prev.style.display="block";
    prev.style.left=rect.x+"px"; prev.style.top=rect.y+"px";
    prev.style.width=rect.w+"px"; prev.style.height=rect.h+"px";
  }
  function detectSnapZone(cx,cy){
    const W=window.innerWidth, H=window.innerHeight;
    if(cy < SNAP_MARGIN) return "top";
    if(cx < SNAP_MARGIN) return "left";
    if(cx > W-SNAP_MARGIN) return "right";
    return null;
  }
  function zoneRect(zone){
    const W=window.innerWidth, H=window.innerHeight-8;
    if(zone==="left") return {x:0,y:0,w:W/2,h:H};
    if(zone==="right") return {x:W/2,y:0,w:W/2,h:H};
    if(zone==="top") return {x:0,y:0,w:W,h:H};
    return {x:0,y:0,w:W,h:H};
  }
  function applySnapIfNeeded(ws,cx,cy){
    const zone = detectSnapZone(cx,cy);
    if(!zone) return;
    if(zone==="top"){ toggleMaximize(ws.id,true); return; }
    const r = zoneRect(zone);
    if(!ws.prevRect) ws.prevRect = {x:ws.x,y:ws.y,width:ws.width,height:ws.height};
    ws.el.classList.add("snapping");
    ws.x=r.x; ws.y=r.y; ws.width=r.w; ws.height=r.h;
    Object.assign(ws.el.style,{left:r.x+"px",top:r.y+"px",width:r.w+"px",height:r.h+"px"});
    setTimeout(()=>ws.el.classList.remove("snapping"),200);
    SoundEngine.maximize();
  }

  function wireResize(ws){
    const dirs = ["n","s","e","w","ne","nw","se","sw"];
    dirs.forEach(dir=>{
      const handle = $(".rh-"+dir,ws.el);
      if(!handle) return;
      let resizing=false, startX,startY,startW,startH,startL,startT;
      handle.addEventListener("pointerdown",(e)=>{
        e.stopPropagation();
        resizing=true;
        startX=e.clientX; startY=e.clientY;
        startW=ws.width; startH=ws.height; startL=ws.x; startT=ws.y;
        handle.setPointerCapture(e.pointerId);
        focusWindow(ws.id);
      });
      handle.addEventListener("pointermove",(e)=>{
        if(!resizing) return;
        const dx=e.clientX-startX, dy=e.clientY-startY;
        let newW=startW,newH=startH,newL=startL,newT=startT;
        if(dir.includes("e")) newW = clamp(startW+dx,340,window.innerWidth-startL);
        if(dir.includes("s")) newH = clamp(startH+dy,220,window.innerHeight-startT);
        if(dir.includes("w")){ newW = clamp(startW-dx,340,startL+startW); newL = startL+startW-newW; }
        if(dir.includes("n")){ newH = clamp(startH-dy,220,startT+startH); newT = startT+startH-newH; }
        ws.width=newW; ws.height=newH; ws.x=newL; ws.y=newT;
        Object.assign(ws.el.style,{width:newW+"px",height:newH+"px",left:newL+"px",top:newT+"px"});
      });
      handle.addEventListener("pointerup",()=>{ resizing=false; });
    });
  }

  function focusWindow(id){
    const ws = OS.windows[id];
    if(!ws || ws.minimized) return;
    OS.activeWindowId = id;
    OS.windowOrder = OS.windowOrder.filter(w=>w!==id);
    OS.windowOrder.push(id);
    ws.el.style.zIndex = nextZ();
    $$(".win").forEach(w=>w.classList.remove("focused"));
    ws.el.classList.add("focused");
    Taskbar.syncRunning();
  }

  function minimize(id){
    const ws = OS.windows[id]; if(!ws) return;
    ws.el.classList.add("minimizing");
    SoundEngine.minimize();
    setTimeout(()=>{
      ws.minimized = true;
      ws.el.style.display="none";
      ws.el.classList.remove("minimizing");
      Taskbar.syncRunning();
    },190);
  }
  function restoreWindow(id){
    const ws = OS.windows[id]; if(!ws) return;
    ws.minimized=false;
    ws.el.style.display="flex";
    focusWindow(id);
  }
  function toggleMaximize(id,forceMax){
    const ws = OS.windows[id]; if(!ws || !ws.maximizable) return;
    if(!ws.maximized || forceMax){
      ws.prevRect = {x:ws.x,y:ws.y,width:ws.width,height:ws.height};
      ws.maximized = true;
      ws.el.classList.add("maximized");
      Object.assign(ws.el.style,{left:"0px",top:"0px",width:"100vw",height:"calc(100vh - 8px)"});
      SoundEngine.maximize();
    } else {
      restoreFromMaximize(ws);
    }
    focusWindow(id);
  }
  function restoreFromMaximize(ws,cursorX){
    ws.maximized=false;
    ws.el.classList.remove("maximized");
    const r = ws.prevRect || {x:100,y:80,width:760,height:520};
    if(cursorX!==undefined){
      r.x = clamp(cursorX - r.width/2, 0, window.innerWidth-r.width);
    }
    ws.x=r.x; ws.y=r.y; ws.width=r.width; ws.height=r.height;
    Object.assign(ws.el.style,{left:r.x+"px",top:r.y+"px",width:r.width+"px",height:r.height+"px"});
  }
  function closeWindow(id){
    const ws = OS.windows[id]; if(!ws) return;
    if(ws.onClose) { try{ ws.onClose(); }catch(e){} }
    ws.el.classList.add("closing");
    SoundEngine.close();
    setTimeout(()=>{
      ws.el.remove();
      delete OS.windows[id];
      OS.windowOrder = OS.windowOrder.filter(w=>w!==id);
      if(OS.activeWindowId===id) OS.activeWindowId = OS.windowOrder[OS.windowOrder.length-1]||null;
      Taskbar.syncRunning();
    },170);
  }
  function closeAllForApp(appId){
    Object.values(OS.windows).filter(w=>w.appId===appId).forEach(w=>closeWindow(w.id));
  }
  function windowsForCurrentDesktop(){
    return OS.windowOrder.map(id=>OS.windows[id]).filter(w=>w && w.desktopId===OS.currentDesktop);
  }
  function setWindowTitle(id,title){
    const ws = OS.windows[id]; if(!ws) return;
    ws.title = title;
    $(".win-title",ws.el).textContent = title;
    Taskbar.syncRunning();
  }

  return {
    createWindow, closeWindow, minimize, restoreWindow, toggleMaximize,
    focusWindow, closeAllForApp, windowsForCurrentDesktop, setWindowTitle
  };
})();

function registerRecentApp(appId,title,icon){
  OS.recentApps = OS.recentApps.filter(a=>a.appId!==appId);
  OS.recentApps.unshift({appId,title,icon,time:new Date()});
  if(OS.recentApps.length>8) OS.recentApps.pop();
  StartMenu.renderRecent();
}

/* ============================================================================
   11. BARRA DE TAREAS
============================================================================ */
const Taskbar = (()=>{
  const APP_ICONS = {}; // se rellena desde AppManager.registerIcons()

  function iconFor(appId){ return (window.APP_REGISTRY && APP_REGISTRY[appId]) ? APP_REGISTRY[appId].icon : "🗔"; }
  function nameFor(appId){ return (window.APP_REGISTRY && APP_REGISTRY[appId]) ? APP_REGISTRY[appId].name : appId; }

  function renderPinned(){
    const box = $("#tbPinned");
    box.innerHTML = "";
    OS.pinnedApps.forEach(appId=>{
      const runningWin = Object.values(OS.windows).find(w=>w.appId===appId);
      const btn = el("button","tb-app"+(runningWin?" running":"")+(runningWin&&OS.activeWindowId===runningWin.id?" focused":""));
      btn.title = nameFor(appId);
      btn.textContent = iconFor(appId);
      btn.addEventListener("click",()=>{
        SoundEngine.click();
        if(runningWin){
          if(runningWin.minimized) WindowManager.restoreWindow(runningWin.id);
          else if(OS.activeWindowId===runningWin.id) WindowManager.minimize(runningWin.id);
          else WindowManager.focusWindow(runningWin.id);
        } else {
          AppManager.open(appId,{});
        }
      });
      btn.addEventListener("contextmenu",(e)=>{
        e.preventDefault();
        ContextMenu.show(e.clientX,e.clientY,[
          {id:"open",label:"Abrir",icon:"📂",action:()=>AppManager.open(appId,{})},
          {id:"unpin",label:"Desanclar de la barra de tareas",icon:"📌",action:()=>{
            OS.pinnedApps = OS.pinnedApps.filter(a=>a!==appId); renderPinned(); StartMenu.renderPinned();
          }}
        ]);
      });
      box.appendChild(btn);
    });
  }

  function syncRunning(){
    renderPinned();
    const box = $("#tbRunning");
    box.innerHTML = "";
    const seen = new Set();
    OS.windowOrder.forEach(id=>{
      const ws = OS.windows[id];
      if(!ws || OS.pinnedApps.includes(ws.appId) || seen.has(ws.appId) || ws.desktopId!==OS.currentDesktop) return;
      seen.add(ws.appId);
      const btn = el("button","tb-app running"+(OS.activeWindowId===id?" focused":""));
      btn.title = ws.title;
      btn.textContent = ws.icon;
      btn.addEventListener("click",()=>{
        SoundEngine.click();
        if(ws.minimized) WindowManager.restoreWindow(id);
        else if(OS.activeWindowId===id) WindowManager.minimize(id);
        else WindowManager.focusWindow(id);
      });
      btn.addEventListener("contextmenu",(e)=>{
        e.preventDefault();
        ContextMenu.show(e.clientX,e.clientY,[
          {id:"close",label:"Cerrar ventana",icon:"✖️",action:()=>WindowManager.closeWindow(id)},
          {id:"pin",label:"Anclar a la barra de tareas",icon:"📌",action:()=>{
            if(!OS.pinnedApps.includes(ws.appId)) OS.pinnedApps.push(ws.appId);
            renderPinned(); syncRunning();
          }}
        ]);
      });
      box.appendChild(btn);
    });
  }

  function initAutohide(){
    let hideTimer=null;
    document.addEventListener("mousemove",(e)=>{
      if(!OS.autohideTaskbar) return;
      const taskbar = $("#taskbar");
      if(e.clientY > window.innerHeight-90){
        taskbar.classList.remove("autohide-hidden");
        clearTimeout(hideTimer);
      } else {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(()=>{
          if(!anyFlyoutOpen()) taskbar.classList.add("autohide-hidden");
        },900);
      }
    });
  }
  function anyFlyoutOpen(){
    return $("#start-menu").classList.contains("open") ||
           $("#control-center").classList.contains("open") ||
           $("#notification-center").classList.contains("open") ||
           $("#widgets-panel").classList.contains("open");
  }

  function initTrayClock(){
    $("#trayClock").addEventListener("click",()=>{ SoundEngine.click(); NotificationCenter.toggle(); });
    $("#trayNotif").addEventListener("click",()=>{ SoundEngine.click(); NotificationCenter.toggle(); });
    $("#trayCluster").addEventListener("click",()=>{ SoundEngine.click(); ControlCenter.toggle(); });
    $("#trayLang").addEventListener("click",()=>{
      Toast.show({title:"Idioma",msg:"Español (España) — es el único idioma disponible en esta simulación.",icon:"🌐"});
    });
    $("#trayIcons").addEventListener("click",()=>{
      Toast.show({title:"Iconos ocultos",msg:"No hay iconos ocultos en este momento.",icon:"🔼"});
    });
  }

  return { renderPinned, syncRunning, initAutohide, initTrayClock };
})();

/* ============================================================================
   12. MENÚ INICIO
============================================================================ */
const StartMenu = (()=>{
  function isOpen(){ return $("#start-menu").classList.contains("open"); }
  function open(){
    closeAllFlyouts();
    $("#start-menu").classList.add("open");
    renderPinned(); renderRecent();
    setTimeout(()=>$("#startSearchInput").focus(),120);
    SoundEngine.click();
  }
  function close(){ $("#start-menu").classList.remove("open"); $("#startSearchInput").value=""; }
  function toggle(){ isOpen() ? close() : open(); }

  function renderPinned(){
    const grid = $("#startPinnedGrid");
    grid.innerHTML="";
    const list = [...new Set([...OS.pinnedApps, ...Object.keys(APP_REGISTRY).slice(0,18)])];
    list.forEach(appId=>{
      const app = APP_REGISTRY[appId]; if(!app) return;
      const tile = el("button","start-app-tile");
      tile.innerHTML = `<span class="sat-icon">${app.icon}</span><span class="sat-label">${escapeHtml(app.name)}</span>`;
      tile.addEventListener("click",()=>{ close(); AppManager.open(appId,{}); });
      tile.addEventListener("contextmenu",(e)=>{
        e.preventDefault();
        const pinned = OS.pinnedApps.includes(appId);
        ContextMenu.show(e.clientX,e.clientY,[
          {id:"open",label:"Abrir",icon:"📂",action:()=>{close();AppManager.open(appId,{});}},
          {id:"pin",label:pinned?"Desanclar de inicio":"Anclar a inicio",icon:"📌",action:()=>{
            if(pinned) OS.pinnedApps = OS.pinnedApps.filter(a=>a!==appId);
            else OS.pinnedApps.push(appId);
            renderPinned(); Taskbar.renderPinned();
          }}
        ]);
      });
      grid.appendChild(tile);
    });
  }
  function renderRecent(){
    const list = $("#startRecentList");
    list.innerHTML="";
    if(!OS.recentApps.length){
      list.innerHTML = `<p style="color:var(--text-3);font-size:12px;padding:10px 6px;">Tus aplicaciones usadas recientemente aparecerán aquí.</p>`;
      return;
    }
    OS.recentApps.slice(0,6).forEach(r=>{
      const item = el("div","start-recent-item");
      item.innerHTML = `<span class="sri-icon">${r.icon}</span><span>${escapeHtml(r.title)}</span><span class="sri-meta">Reciente</span>`;
      item.addEventListener("click",()=>{ close(); AppManager.open(r.appId,{}); });
      list.appendChild(item);
    });
  }
  function initEvents(){
    $("#btnStart").addEventListener("click",(e)=>{ e.stopPropagation(); toggle(); });
    $("#startSearchInput").addEventListener("input",(e)=>{
      GlobalSearch.renderInline(e.target.value); // reutiliza motor de búsqueda (ver módulo 13)
    });
    $("#startAllApps").addEventListener("click",()=>{
      Toast.show({title:"Todas las aplicaciones",msg:"Mostrando aplicaciones fijadas y recomendadas. Usa el buscador para encontrar cualquier app instalada.",icon:"🗂️"});
    });
    $("#startMoreRecent").addEventListener("click",()=>{
      Toast.show({title:"Actividad reciente",msg: OS.recentApps.length ? "Mostrando tus "+OS.recentApps.length+" aplicaciones más recientes." : "Aún no has abierto ninguna aplicación.",icon:"🕘"});
    });
    $("#startUserBtn").addEventListener("click",(e)=>{
      e.stopPropagation();
      ContextMenu.show(e.clientX,e.clientY+10,[
        {id:"account",label:"Configuración de cuenta",icon:"👤",action:()=>{close();AppManager.open("settings",{page:"accounts"});}},
        {id:"lock",label:"Bloquear",icon:"🔒",action:()=>{close();lockSystem();}},
        {id:"signout",label:"Cerrar sesión",icon:"🚪",action:()=>{close();PowerModal.show("signout");}}
      ]);
    });
    $("#startSleepBtn").addEventListener("click",()=>{ close(); PowerModal.show("sleep"); });
    $("#startPowerBtn").addEventListener("click",(e)=>{
      e.stopPropagation();
      ContextMenu.show(e.clientX-140,e.clientY-140,[
        {id:"sleep",label:"Suspender",icon:"🌙",action:()=>PowerModal.show("sleep")},
        {id:"shutdown",label:"Apagar",icon:"⏻",action:()=>PowerModal.show("shutdown")},
        {id:"restart",label:"Reiniciar",icon:"🔄",action:()=>PowerModal.show("restart")}
      ]);
    });
    document.addEventListener("pointerdown",(e)=>{
      if(isOpen() && !e.target.closest("#start-menu") && !e.target.closest("#btnStart")) close();
    });
  }
  return { open, close, toggle, isOpen, renderPinned, renderRecent, initEvents };
})();

function closeAllFlyouts(){
  StartMenu.close();
  $("#search-overlay").classList.remove("open");
  $("#control-center").classList.remove("open");
  $("#notification-center").classList.remove("open");
  $("#widgets-panel").classList.remove("open");
  ContextMenu.hide();
}

/* ============================================================================
   13. BUSCADOR GLOBAL
============================================================================ */
const GlobalSearch = (()=>{
  function isOpen(){ return $("#search-overlay").classList.contains("open"); }
  function open(){
    closeAllFlyouts();
    $("#search-overlay").classList.add("open");
    setTimeout(()=>$("#globalSearchInput").focus(),80);
    render("");
  }
  function close(){ $("#search-overlay").classList.remove("open"); $("#globalSearchInput").value=""; }
  function toggle(){ isOpen()?close():open(); }

  function collectResults(query){
    const q = query.trim().toLowerCase();
    if(!q) return {apps:[],files:[],settings:[]};
    const apps = Object.entries(APP_REGISTRY).filter(([id,a])=>a.name.toLowerCase().includes(q)).map(([id,a])=>({id,...a}));
    const files = FS.searchAll(q).slice(0,8);
    const settingsPages = SETTINGS_PAGES.filter(p=>p.title.toLowerCase().includes(q));
    return {apps,files,settings:settingsPages};
  }

  function itemRow(icon,title,sub,onClick){
    const div = el("div","search-result-item");
    div.innerHTML = `<span class="sr-icon">${icon}</span><span class="sr-text"><span class="sr-title">${escapeHtml(title)}</span><span class="sr-sub">${escapeHtml(sub)}</span></span>`;
    div.addEventListener("click",onClick);
    return div;
  }

  function render(query){
    const box = $("#searchResults");
    box.innerHTML="";
    if(!query.trim()){
      box.innerHTML = `<p class="search-empty">Empieza a escribir para buscar aplicaciones, archivos y ajustes.</p>`;
      return;
    }
    const {apps,files,settings} = collectResults(query);
    if(!apps.length && !files.length && !settings.length){
      box.innerHTML = `<p class="search-empty">Sin resultados para "${escapeHtml(query)}".</p>`;
      return;
    }
    if(apps.length){
      box.appendChild(el("div","search-cat-label","Aplicaciones"));
      apps.forEach(a=> box.appendChild(itemRow(a.icon,a.name,"Aplicación",()=>{close();AppManager.open(a.id,{});})));
    }
    if(files.length){
      box.appendChild(el("div","search-cat-label","Archivos"));
      files.forEach(f=> box.appendChild(itemRow(FS.icon_for(f),f.name, f.type==="folder"?"Carpeta":"Archivo",()=>{
        close();
        if(f.type==="folder") AppManager.open("fileExplorer",{path:f.id});
        else openFileWithDefaultApp(f);
      })));
    }
    if(settings.length){
      box.appendChild(el("div","search-cat-label","Configuración"));
      settings.forEach(s=> box.appendChild(itemRow("⚙️",s.title,"Configuración",()=>{close();AppManager.open("settings",{page:s.id});})));
    }
  }
  function renderInline(query){
    // Cuando se escribe en el menú Inicio, se abre el buscador con esos resultados
    if(query.trim()){
      $("#start-menu").classList.remove("open");
      open();
      $("#globalSearchInput").value = query;
      render(query);
    }
  }
  function initEvents(){
    $("#btnSearch").addEventListener("click",(e)=>{ e.stopPropagation(); toggle(); });
    $("#globalSearchInput").addEventListener("input",(e)=> render(e.target.value));
    document.addEventListener("pointerdown",(e)=>{
      if(isOpen() && !e.target.closest(".search-panel") && !e.target.closest("#btnSearch")) close();
    });
    document.addEventListener("keydown",(e)=>{
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); open(); }
      if(e.key==="Escape"){ close(); StartMenu.close(); ControlCenter.close(); NotificationCenter.close(); WidgetsPanel.close(); AltTabManager.close(); }
    });
  }
  return { open, close, toggle, render, renderInline, initEvents };
})();

/* ============================================================================
   14. CENTRO DE CONTROL
============================================================================ */
const ControlCenter = (()=>{
  const TOGGLES = [
    {id:"wifi", icon:"📶", title:"Wi-Fi", key:"wifiOn", sub:()=>OS.wifiOn?"Red-Hogar-5G":"Desactivado"},
    {id:"bluetooth", icon:"🔷", title:"Bluetooth", key:"bluetoothOn", sub:()=>OS.bluetoothOn?"Activado":"Desactivado"},
    {id:"airplane", icon:"✈️", title:"Modo avión", key:"airplaneOn", sub:()=>OS.airplaneOn?"Activado":"Desactivado"},
    {id:"dnd", icon:"🌙", title:"No molestar", key:"dndOn", sub:()=>OS.dndOn?"Activado":"Desactivado"},
    {id:"theme", icon:"🌗", title:"Modo oscuro", key:"themeToggle", sub:()=>OS.theme==="dark"?"Activado":"Desactivado"},
    {id:"battersaver", icon:"🔋", title:"Ahorro de energía", key:"batterySaverOn", sub:()=>OS.batterySaverOn?"Activado":"Desactivado"},
    {id:"accessibility", icon:"♿", title:"Accesibilidad", key:"accessibilityOn", sub:()=>OS.accessibilityOn?"Activado":"Desactivado"},
    {id:"autohide", icon:"📐", title:"Autoocultar barra", key:"autohideTaskbar", sub:()=>OS.autohideTaskbar?"Activado":"Desactivado"}
  ];
  function render(){
    const box = $("#ccToggles");
    box.innerHTML="";
    TOGGLES.forEach(t=>{
      const active = t.key==="themeToggle" ? OS.theme==="dark" : OS[t.key];
      const btn = el("button","cc-toggle"+(active?" active":""));
      btn.innerHTML = `<span class="cc-t-icon">${t.icon}</span><span class="cc-t-text"><span class="cc-t-title">${t.title}</span><span class="cc-t-sub">${t.sub()}</span></span>`;
      btn.addEventListener("click",()=>{
        if(t.key==="themeToggle"){ ThemeManager.toggle(); }
        else { OS[t.key] = !OS[t.key]; onToggleSideEffect(t.id); }
        OS[t.key] ? SoundEngine.toggleOn() : SoundEngine.toggleOff();
        render();
      });
      box.appendChild(btn);
    });
  }
  function onToggleSideEffect(id){
    if(id==="wifi") Toast.show({title:"Wi-Fi", msg: OS.wifiOn?"Conectado a Red-Hogar-5G":"Wi-Fi desactivado", icon:"📶"});
    if(id==="airplane" && OS.airplaneOn){ OS.wifiOn=false; OS.bluetoothOn=false; Toast.show({title:"Modo avión activado", msg:"Wi-Fi y Bluetooth desactivados.", icon:"✈️"}); }
    if(id==="dnd") Toast.show({title:"No molestar", msg: OS.dndOn?"Las notificaciones se silenciarán.":"Notificaciones reactivadas.", icon:"🌙"});
  }
  function isOpen(){ return $("#control-center").classList.contains("open"); }
  function open(){ closeAllFlyouts(); render(); $("#control-center").classList.add("open"); }
  function close(){ $("#control-center").classList.remove("open"); }
  function toggle(){ isOpen()?close():open(); }

  function initEvents(){
    const brightness = $("#brightnessSlider"), brightnessVal = $("#brightnessVal");
    brightness.addEventListener("input",()=>{
      OS.brightness = +brightness.value;
      brightnessVal.textContent = OS.brightness+"%";
      $("#screenBrightness").style.opacity = (100-OS.brightness)/100 * 0.72;
    });
    const volume = $("#volumeSlider"), volumeVal = $("#volumeVal");
    volume.addEventListener("input",()=>{
      OS.volume = +volume.value; OS.muted = OS.volume===0;
      volumeVal.textContent = OS.volume+"%";
    });
    volume.addEventListener("change",()=>SoundEngine.click());
    $("#ccWifiCard").addEventListener("click",()=>{ AppManager.open("settings",{page:"network"}); close(); });
    $("#ccBatteryCard").addEventListener("click",()=>{ AppManager.open("settings",{page:"power"}); close(); });
    $("#ccEditBtn").addEventListener("click",()=>{ Toast.show({title:"Editar accesos rápidos",msg:"Función disponible próximamente en esta simulación.",icon:"✎"}); });
    document.addEventListener("pointerdown",(e)=>{
      if(isOpen() && !e.target.closest("#control-center") && !e.target.closest("#trayCluster")) close();
    });
  }
  return { render, open, close, toggle, isOpen, initEvents };
})();

/* ============================================================================
   15. CENTRO DE NOTIFICACIONES / TOASTS
============================================================================ */
const NotificationCenter = (()=>{
  function push(n){
    const notif = {
      id:"notif"+(OS.nextNotifId++), title:n.title, msg:n.msg, icon:n.icon||"🔔",
      app:n.app||"Sistema", time:new Date()
    };
    OS.notifications.unshift(notif);
    if(OS.notifications.length>50) OS.notifications.pop();
    render();
    $("#notifDot").hidden = false;
    if(!OS.dndOn){
      Toast.show({title:notif.title,msg:notif.msg,icon:notif.icon});
      SoundEngine.notify();
    }
    return notif;
  }
  function dismiss(id){
    OS.notifications = OS.notifications.filter(n=>n.id!==id);
    render();
  }
  function clearAll(){ OS.notifications=[]; render(); }
  function timeAgo(date){
    const diff = Math.floor((Date.now()-date.getTime())/1000);
    if(diff<60) return "Ahora";
    if(diff<3600) return Math.floor(diff/60)+" min";
    if(diff<86400) return Math.floor(diff/3600)+" h";
    return Math.floor(diff/86400)+" d";
  }
  function render(){
    const list = $("#ncList");
    list.innerHTML="";
    $("#ncEmpty").classList.toggle("show", OS.notifications.length===0);
    $("#notifDot").hidden = OS.notifications.length===0;
    OS.notifications.forEach(n=>{
      const item = el("div","nc-item");
      item.innerHTML = `
        <span class="nc-icon">${n.icon}</span>
        <div class="nc-body">
          <div class="nc-title">${escapeHtml(n.title)} <span style="color:var(--text-3);font-weight:400;">· ${escapeHtml(n.app)}</span></div>
          <div class="nc-msg">${escapeHtml(n.msg)}</div>
          <div class="nc-time">${timeAgo(n.time)}</div>
        </div>
        <button class="nc-close" title="Descartar">✕</button>`;
      $(".nc-close",item).addEventListener("click",(e)=>{ e.stopPropagation(); dismiss(n.id); });
      list.appendChild(item);
    });
    renderMiniCalendar();
  }
  function renderMiniCalendar(){
    const box = $("#ncCalendarMini");
    const now = new Date();
    const first = new Date(now.getFullYear(),now.getMonth(),1);
    const startDow = first.getDay();
    const daysInMonth = new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    let html = `<div class="mini-cal-head"><span>${MONTHS[now.getMonth()]} de ${now.getFullYear()}</span></div><div class="mini-cal-grid">`;
    WEEKDAYS_SHORT.forEach(d=> html+=`<div class="dow">${d}</div>`);
    for(let i=0;i<startDow;i++) html+=`<div class="day other">${new Date(now.getFullYear(),now.getMonth(),0).getDate()-startDow+i+1}</div>`;
    for(let d=1; d<=daysInMonth; d++){
      html += `<div class="day${d===now.getDate()?" today":""}">${d}</div>`;
    }
    html += `</div>`;
    box.innerHTML = html;
  }
  function isOpen(){ return $("#notification-center").classList.contains("open"); }
  function open(){ closeAllFlyouts(); render(); $("#notification-center").classList.add("open"); }
  function close(){ $("#notification-center").classList.remove("open"); }
  function toggle(){ isOpen()?close():open(); }
  function initEvents(){
    $("#ncClearAll").addEventListener("click",clearAll);
    document.addEventListener("pointerdown",(e)=>{
      if(isOpen() && !e.target.closest("#notification-center") && !e.target.closest("#trayNotif") && !e.target.closest("#trayClock")) close();
    });
  }
  return { push, dismiss, clearAll, render, open, close, toggle, isOpen, initEvents };
})();

const Toast = (()=>{
  function show({title,msg,icon="🔔",duration=4200}){
    const container = $("#toast-container");
    const t = el("div","toast");
    t.innerHTML = `<span class="toast-icon">${icon}</span>
      <div><div class="toast-title">${escapeHtml(title)}</div><div class="toast-msg">${escapeHtml(msg||"")}</div></div>
      <button class="toast-close">✕</button>`;
    container.appendChild(t);
    const remove = ()=>{ t.classList.add("hide"); setTimeout(()=>t.remove(),240); };
    $(".toast-close",t).addEventListener("click",remove);
    const timer = setTimeout(remove,duration);
    t.addEventListener("pointerenter",()=>clearTimeout(timer));
  }
  return { show };
})();

/* ============================================================================
   16. PANEL DE WIDGETS
============================================================================ */
const WidgetsPanel = (()=>{
  const WEATHER_CITIES = [
    {city:"Madrid", temp:24, cond:"Soleado", icon:"☀️"},
    {city:"Buenos Aires", temp:18, cond:"Parcialmente nublado", icon:"⛅"},
    {city:"Ciudad de México", temp:21, cond:"Lluvia ligera", icon:"🌦️"},
    {city:"Bogotá", temp:16, cond:"Nublado", icon:"☁️"}
  ];
  const NEWS_ITEMS = [
    {cat:"Tecnología", title:"Nuevos avances en interfaces de escritorio impulsadas por IA", icon:"💻"},
    {cat:"Ciencia", title:"Descubren un exoplaneta con condiciones potencialmente habitables", icon:"🔭"},
    {cat:"Economía", title:"Los mercados cierran la semana con ligeras subidas", icon:"📈"},
    {cat:"Cultura", title:"Estrena una exposición inmersiva de arte digital", icon:"🎨"},
    {cat:"Deportes", title:"Final histórica marcada por un cierre ajustado", icon:"🏆"}
  ];
  let currentCity = 0;

  function renderClockWidget(){
    const now = new Date();
    return `<div class="widget-card" id="widgetClock">
      <h4>Reloj</h4>
      <div class="widget-clock-big">${formatTime(now)}</div>
      <div class="widget-clock-sub">${formatFullDate(now)}</div>
    </div>`;
  }
  function renderWeatherWidget(){
    const w = WEATHER_CITIES[currentCity];
    return `<div class="widget-card" id="widgetWeather">
      <h4>Clima <span style="font-size:10.5px;cursor:pointer;" id="weatherCycle">cambiar ciudad ›</span></h4>
      <div class="widget-weather-row">
        <div><div class="widget-weather-temp">${w.temp}°</div><div class="widget-weather-city">${w.city} · ${w.cond}</div></div>
        <div class="widget-weather-icon">${w.icon}</div>
      </div>
    </div>`;
  }
  function renderCalendarWidget(){
    const now = new Date();
    const first = new Date(now.getFullYear(),now.getMonth(),1);
    const startDow = first.getDay();
    const daysInMonth = new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    let grid = "";
    WEEKDAYS_SHORT.forEach(d=> grid+=`<div class="dow">${d}</div>`);
    for(let i=0;i<startDow;i++) grid+=`<div class="day other"></div>`;
    for(let d=1; d<=daysInMonth; d++) grid += `<div class="day${d===now.getDate()?" today":""}">${d}</div>`;
    return `<div class="widget-card"><h4>Calendario</h4><div class="widget-cal-grid">${grid}</div></div>`;
  }
  function renderNewsWidget(){
    return `<div class="widget-card"><h4>Noticias para ti</h4>
      ${NEWS_ITEMS.slice(0,4).map(n=>`<div class="widget-news-item">
        <div class="widget-news-thumb">${n.icon}</div>
        <div><div class="widget-news-title">${n.title}</div><div class="widget-news-cat">${n.cat}</div></div>
      </div>`).join("")}
    </div>`;
  }
  function renderPerfWidget(){
    const cpu = OS.cpuHistory[OS.cpuHistory.length-1]||12;
    const ram = OS.ramHistory[OS.ramHistory.length-1]||38;
    const disk = 61;
    return `<div class="widget-card" id="widgetPerf"><h4>Rendimiento del sistema</h4>
      <div class="widget-perf-row"><span class="widget-perf-label">CPU</span><div class="widget-perf-bar"><div class="widget-perf-fill" style="width:${cpu}%"></div></div><span class="widget-perf-val">${cpu|0}%</span></div>
      <div class="widget-perf-row"><span class="widget-perf-label">Memoria</span><div class="widget-perf-bar"><div class="widget-perf-fill" style="width:${ram}%"></div></div><span class="widget-perf-val">${ram|0}%</span></div>
      <div class="widget-perf-row"><span class="widget-perf-label">Disco</span><div class="widget-perf-bar"><div class="widget-perf-fill" style="width:${disk}%"></div></div><span class="widget-perf-val">${disk}%</span></div>
    </div>`;
  }
  function renderNotesWidget(){
    return `<div class="widget-card"><h4>Notas rápidas</h4>
      <textarea class="widget-notes-area" id="widgetNotesArea" placeholder="Escribe una nota rápida…">${escapeHtml(OS.quickNote||"")}</textarea>
    </div>`;
  }
  function renderAll(){
    const box = $("#widgetsScroll");
    box.innerHTML = renderClockWidget()+renderWeatherWidget()+renderPerfWidget()+renderCalendarWidget()+renderNotesWidget()+renderNewsWidget();
    $("#weatherCycle").addEventListener("click",()=>{
      currentCity = (currentCity+1)%WEATHER_CITIES.length;
      $("#widgetWeather").outerHTML = renderWeatherWidget();
      $("#weatherCycle").addEventListener("click",arguments.callee);
    });
    $("#widgetNotesArea").addEventListener("input",(e)=>{ OS.quickNote = e.target.value; });
  }
  document.addEventListener("os:clocktick",()=>{
    const c = $("#widgetClock"); if(c) c.outerHTML = renderClockWidget();
  });
  document.addEventListener("os:perftick",()=>{
    const p = $("#widgetPerf"); if(p) p.outerHTML = renderPerfWidget();
  });

  function isOpen(){ return $("#widgets-panel").classList.contains("open"); }
  function open(){ closeAllFlyouts(); renderAll(); $("#widgets-panel").classList.add("open"); }
  function close(){ $("#widgets-panel").classList.remove("open"); }
  function toggle(){ isOpen()?close():open(); }
  function initEvents(){
    $("#btnWidgets").addEventListener("click",(e)=>{ e.stopPropagation(); SoundEngine.click(); toggle(); });
    document.addEventListener("pointerdown",(e)=>{
      if(isOpen() && !e.target.closest("#widgets-panel") && !e.target.closest("#btnWidgets")) close();
    });
  }
  return { open, close, toggle, isOpen, renderAll, initEvents };
})();

/* ============================================================================
   17. VISTA DE TAREAS / ESCRITORIOS VIRTUALES
============================================================================ */
const TaskView = (()=>{
  function isOpen(){ return $("#task-view").classList.contains("open"); }
  function open(){
    closeAllFlyouts();
    renderDesktops();
    renderWindows();
    $("#task-view").classList.add("open");
  }
  function close(){ $("#task-view").classList.remove("open"); }
  function toggle(){ isOpen()?close():open(); }

  function renderDesktops(){
    const box = $("#taskviewDesktops");
    box.innerHTML="";
    OS.desktops.forEach((d,i)=>{
      const card = el("div","tv-desktop"+(d.id===OS.currentDesktop?" active":""));
      card.innerHTML = `<span style="font-size:20px;">🖥️</span><span class="tv-desktop-label">${escapeHtml(d.name)}</span>
        ${OS.desktops.length>1?'<button class="tv-desktop-close">✕</button>':""}`;
      card.addEventListener("click",(e)=>{
        if(e.target.closest(".tv-desktop-close")) return;
        OS.currentDesktop = d.id;
        applyDesktopVisibility();
        renderDesktops(); renderWindows(); Taskbar.syncRunning();
      });
      const closeBtn = $(".tv-desktop-close",card);
      if(closeBtn) closeBtn.addEventListener("click",(e)=>{
        e.stopPropagation();
        Object.values(OS.windows).filter(w=>w.desktopId===d.id).forEach(w=>{ w.desktopId = OS.desktops[0].id; });
        OS.desktops = OS.desktops.filter(x=>x.id!==d.id);
        if(OS.currentDesktop===d.id) OS.currentDesktop = OS.desktops[0].id;
        applyDesktopVisibility(); renderDesktops(); renderWindows(); Taskbar.syncRunning();
      });
      box.appendChild(card);
    });
    const addBtn = el("div","tv-add-desktop","+<span style='font-size:10px;'>Nuevo escritorio</span>");
    addBtn.addEventListener("click",()=>{
      const newId = Math.max(...OS.desktops.map(d=>d.id))+1;
      OS.desktops.push({id:newId,name:"Escritorio "+OS.desktops.length,windows:[]});
      renderDesktops();
    });
    box.appendChild(addBtn);
  }
  function renderWindows(){
    const box = $("#taskviewWindows");
    box.innerHTML="";
    const wins = OS.windowOrder.map(id=>OS.windows[id]).filter(w=>w && w.desktopId===OS.currentDesktop);
    if(!wins.length){
      box.innerHTML = `<div class="empty-state" style="color:rgba(255,255,255,.6);"><span class="es-icon">🗔</span><p>No hay ventanas abiertas en este escritorio</p></div>`;
      return;
    }
    wins.forEach(w=>{
      const card = el("div","tv-win-card");
      card.innerHTML = `<div class="tv-win-thumb">${w.icon}</div><div class="tv-win-title">${w.icon} ${escapeHtml(w.title)}</div>`;
      card.addEventListener("click",()=>{ close(); WindowManager.restoreWindow(w.id); });
      box.appendChild(card);
    });
  }
  function applyDesktopVisibility(){
    Object.values(OS.windows).forEach(w=>{
      w.el.style.display = (w.desktopId===OS.currentDesktop && !w.minimized) ? "flex" : "none";
    });
  }
  function initEvents(){
    $("#btnTaskView").addEventListener("click",(e)=>{ e.stopPropagation(); SoundEngine.click(); toggle(); });
    $("#task-view").addEventListener("click",(e)=>{ if(e.target.id==="task-view") close(); });
  }
  return { open, close, toggle, isOpen, initEvents, applyDesktopVisibility };
})();

/* ============================================================================
   18. ALT+TAB
============================================================================ */
const AltTabManager = (()=>{
  function isOpen(){ return $("#alt-tab-overlay").classList.contains("open"); }
  function render(){
    const strip = $("#altTabStrip");
    strip.innerHTML="";
    const wins = WindowManager.windowsForCurrentDesktop();
    wins.forEach((w,i)=>{
      const item = el("div","alt-tab-item"+(i===OS.altTabIndex?" active":""));
      item.innerHTML = `<div class="ati-icon">${w.icon}</div><div class="ati-title">${escapeHtml(w.title)}</div>`;
      strip.appendChild(item);
    });
  }
  function open(){
    const wins = WindowManager.windowsForCurrentDesktop();
    if(wins.length<1) return;
    OS.altTabIndex = wins.length>1 ? 1 : 0;
    render();
    $("#alt-tab-overlay").classList.add("open");
  }
  function step(){
    const wins = WindowManager.windowsForCurrentDesktop();
    if(!wins.length) return;
    OS.altTabIndex = (OS.altTabIndex+1) % wins.length;
    render();
  }
  function close(){
    const wins = WindowManager.windowsForCurrentDesktop();
    if($("#alt-tab-overlay").classList.contains("open") && wins[OS.altTabIndex]){
      WindowManager.restoreWindow(wins[OS.altTabIndex].id);
    }
    $("#alt-tab-overlay").classList.remove("open");
  }
  function initEvents(){
    document.addEventListener("keydown",(e)=>{
      if(e.altKey && e.key==="Tab"){
        e.preventDefault();
        if(!isOpen()) open(); else step();
      }
    });
    document.addEventListener("keyup",(e)=>{
      if(e.key==="Alt" && isOpen()) close();
    });
  }
  return { open, close, step, isOpen, initEvents };
})();

/* ============================================================================
   19. MODAL DE ENERGÍA
============================================================================ */
const PowerModal = (()=>{
  let currentAction=null;
  const TEXTS = {
    shutdown:{title:"¿Apagar el equipo?", desc:"Se cerrarán todas las aplicaciones abiertas.", confirm:"Apagar"},
    restart:{title:"¿Reiniciar el equipo?", desc:"El equipo se reiniciará y volverá a la pantalla de bloqueo.", confirm:"Reiniciar"},
    sleep:{title:"¿Suspender el equipo?", desc:"La sesión se bloqueará y el consumo se reducirá.", confirm:"Suspender"},
    signout:{title:"¿Cerrar sesión?", desc:"Se cerrarán todas las aplicaciones abiertas y volverás a la pantalla de bloqueo.", confirm:"Cerrar sesión"}
  };
  function show(action){
    currentAction = action;
    const t = TEXTS[action];
    $("#powerModalTitle").textContent = t.title;
    $("#powerModalDesc").textContent = t.desc;
    $("#powerModalConfirm").textContent = t.confirm;
    $("#power-modal").classList.add("open");
  }
  function hide(){ $("#power-modal").classList.remove("open"); }
  function confirmAction(){
    hide();
    if(currentAction==="shutdown"){
      Object.keys(OS.windows).forEach(id=>WindowManager.closeWindow(id));
      $("#boot-screen").style.display="flex";
      $("#boot-screen").classList.remove("hidden");
      $("#bootStatus").textContent="Apagando…";
      $("#bootProgressFill").style.width="0%";
      setTimeout(()=>{
        $("#bootStatus").textContent = "Puedes cerrar esta pestaña. (Simulación: recarga la página para volver a encender el equipo.)";
      },900);
    } else if(currentAction==="restart"){
      Object.keys(OS.windows).forEach(id=>WindowManager.closeWindow(id));
      $("#boot-screen").style.display="flex";
      $("#boot-screen").classList.remove("hidden");
      $("#bootProgressFill").style.width="0%";
      setTimeout(()=>{ runBootSequence(); setTimeout(()=>{ lockSystem(); },200); },300);
    } else if(currentAction==="sleep" || currentAction==="signout"){
      Object.keys(OS.windows).forEach(id=>WindowManager.closeWindow(id));
      lockSystem();
    }
  }
  function initEvents(){
    $("#powerModalCancel").addEventListener("click",hide);
    $("#powerModalConfirm").addEventListener("click",confirmAction);
    $("#power-modal").addEventListener("click",(e)=>{ if(e.target.id==="power-modal") hide(); });
  }
  return { show, hide, initEvents };
})();

/* ============================================================================
   20a. GESTOR DE TEMA Y FONDO DE PANTALLA
============================================================================ */
const WALLPAPERS = {
  aurora: {name:"Aurora (animado)", css:"", animated:true},
  bloom:  {name:"Bloom", css:"linear-gradient(135deg,#ff9a8b,#ff6a88 40%,#8e5fe0)"},
  ocean:  {name:"Océano profundo", css:"linear-gradient(160deg,#003973,#0078d4 60%,#60cdff)"},
  forest: {name:"Bosque", css:"linear-gradient(150deg,#0f2027,#203a43,#2c5364)"},
  sunset: {name:"Atardecer", css:"linear-gradient(135deg,#f7971e,#ffd200 50%,#ff512f)"},
  mono:   {name:"Minimal gris", css:"linear-gradient(160deg,#232526,#414345)"},
  candy:  {name:"Candy", css:"linear-gradient(135deg,#a18cd1,#fbc2eb)"},
  mint:   {name:"Menta", css:"linear-gradient(150deg,#11998e,#38ef7d)"}
};
const ThemeManager = (()=>{
  function apply(){
    document.body.classList.toggle("theme-light", OS.theme==="light");
  }
  function toggle(){ OS.theme = OS.theme==="dark"?"light":"dark"; apply(); }
  function set(theme){ OS.theme=theme; apply(); }
  return { apply, toggle, set };
})();
const WallpaperManager = (()=>{
  function apply(id){
    OS.wallpaperId = id;
    const wp = WALLPAPERS[id] || WALLPAPERS.aurora;
    const wallpaperEl = $("#wallpaper");
    const lockBg = $("#lockBg");
    wallpaperEl.classList.toggle("animated-aurora", !!wp.animated);
    lockBg.classList.toggle("animated-aurora", !!wp.animated);
    if(!wp.animated){
      document.documentElement.style.setProperty("--wallpaper-current", wp.css);
    } else {
      document.documentElement.style.removeProperty("--wallpaper-current");
    }
  }
  return { apply };
})();

/* ============================================================================
   20b. AYUDANTES DE ARCHIVOS Y APERTURA POR DEFECTO
============================================================================ */
function openFileWithDefaultApp(node){
  if(!node) return;
  if(node.kind==="text") AppManager.open("notepad",{fileId:node.id});
  else if(node.kind==="image") AppManager.open("imageViewer",{fileId:node.id});
  else if(node.kind==="audio") AppManager.open("mediaPlayer",{fileId:node.id});
  else if(node.kind==="pdf") AppManager.open("pdfViewer",{fileId:node.id});
  else if(node.kind==="binary" && node.ext==="exe") Toast.show({title:"No se puede ejecutar",msg:"Por seguridad, esta simulación no ejecuta archivos reales.",icon:"⚠️"});
  else AppManager.open("notepad",{fileId:node.id});
}

/* ============================================================================
   20c. REGISTRO DE APLICACIONES Y GESTOR DE APERTURA
============================================================================ */
const APP_REGISTRY = {}; // se rellena más abajo con APP_REGISTRY[id] = {name,icon,width,height,render}

const AppManager = (()=>{
  function open(appId, params){
    const app = APP_REGISTRY[appId];
    if(!app){ Toast.show({title:"Aplicación no encontrada",msg:appId,icon:"⚠️"}); return; }
    if(app.singleInstance){
      const existing = Object.values(OS.windows).find(w=>w.appId===appId);
      if(existing){ WindowManager.restoreWindow(existing.id); return; }
    }
    const ws = WindowManager.createWindow({
      appId, title:app.name, icon:app.icon,
      width:app.width||760, height:app.height||520,
      resizable:app.resizable!==false, maximizable:app.maximizable!==false
    });
    try{
      app.render(ws.bodyEl, ws, params||{});
    }catch(err){
      ws.bodyEl.innerHTML = `<div class="empty-state"><span class="es-icon">⚠️</span><p>Error al cargar la aplicación.</p></div>`;
      console.error("Error en app",appId,err);
    }
    return ws;
  }
  return { open };
})();

const SETTINGS_PAGES = [
  {id:"system", title:"Sistema", icon:"🖥️"},
  {id:"personalization", title:"Personalización", icon:"🎨"},
  {id:"apps", title:"Aplicaciones", icon:"📦"},
  {id:"accounts", title:"Cuentas", icon:"👤"},
  {id:"timelang", title:"Hora e idioma", icon:"🕐"},
  {id:"accessibility", title:"Accesibilidad", icon:"♿"},
  {id:"privacy", title:"Privacidad y seguridad", icon:"🛡️"},
  {id:"network", title:"Red e Internet", icon:"📶"},
  {id:"power", title:"Energía y batería", icon:"🔋"},
  {id:"storage", title:"Almacenamiento", icon:"💾"},
  {id:"windowsupdate", title:"Windows Update", icon:"🔄"},
  {id:"about", title:"Acerca de", icon:"ℹ️"}
];

/* ============================================================================
   21a. APLICACIÓN — EXPLORADOR DE ARCHIVOS
============================================================================ */
(function registerFileExplorer(){
  function render(body, ws, params){
    const state = {
      path: params.path || "thispc",
      history: [params.path || "thispc"],
      historyIndex: 0,
      view: "grid",
      selected: new Set()
    };
    body.innerHTML = `
      <div class="app-root">
        <div class="app-toolbar">
          <button class="app-icon-btn" data-a="back" title="Atrás">←</button>
          <button class="app-icon-btn" data-a="fwd" title="Adelante">→</button>
          <button class="app-icon-btn" data-a="up" title="Subir">↑</button>
          <button class="app-icon-btn" data-a="refresh" title="Actualizar">🔄</button>
          <div class="app-sep-v"></div>
          <button class="app-btn" data-a="newfolder">📁 Nueva carpeta</button>
          <button class="app-btn" data-a="newfile">📄 Nuevo archivo</button>
          <div class="app-sep-v"></div>
          <button class="app-btn" data-a="copy">📋 Copiar</button>
          <button class="app-btn" data-a="cut">✂️ Cortar</button>
          <button class="app-btn" data-a="paste">📌 Pegar</button>
          <button class="app-btn" data-a="delete">🗑️ Eliminar</button>
          <div class="app-sep-v"></div>
          <button class="app-icon-btn" data-a="viewgrid" title="Iconos">▦</button>
          <button class="app-icon-btn" data-a="viewlist" title="Lista">☰</button>
        </div>
        <div class="app-body-flex">
          <div class="fe-sidebar">
            <h5>Accesos rápidos</h5>
            <div class="fe-nav-item" data-nav="thispc">💻 Este equipo</div>
            <div class="fe-nav-item" data-nav="desktop">🖥️ Escritorio</div>
            <div class="fe-nav-item" data-nav="documents">📄 Documentos</div>
            <div class="fe-nav-item" data-nav="downloads">⬇️ Descargas</div>
            <div class="fe-nav-item" data-nav="pictures">🖼️ Imágenes</div>
            <div class="fe-nav-item" data-nav="videos">🎬 Vídeos</div>
            <div class="fe-nav-item" data-nav="music">🎵 Música</div>
            <div class="fe-nav-item" data-nav="recyclebin">🗑️ Papelera de reciclaje</div>
          </div>
          <div class="fe-main">
            <div class="fe-addressbar">
              <div class="fe-breadcrumbs" id="feBreadcrumbs_${ws.id}"></div>
              <input type="text" class="fe-search-box" id="feSearch_${ws.id}" placeholder="Buscar en esta carpeta">
            </div>
            <div class="fe-content" id="feContent_${ws.id}"></div>
          </div>
        </div>
        <div class="app-statusbar"><span id="feStatus_${ws.id}"></span><span id="feSelStatus_${ws.id}"></span></div>
      </div>`;

    function crumbs(){
      const box = $("#feBreadcrumbs_"+ws.id);
      if(state.path==="recyclebin"){ box.innerHTML=`<span class="fe-crumb current">Papelera de reciclaje</span>`; return; }
      const chain = FS.pathChain(state.path);
      box.innerHTML = chain.map((n,i)=>`<span class="fe-crumb${i===chain.length-1?" current":""}" data-crumb="${n.id}">${escapeHtml(n.name)}</span>`).join(`<span style="color:var(--text-3)">›</span>`);
      $$(".fe-crumb",box).forEach(c=>c.addEventListener("click",()=>navigateTo(c.dataset.crumb)));
    }
    function content(){
      const box = $("#feContent_"+ws.id);
      const items = FS.getChildren(state.path);
      $("#feStatus_"+ws.id).textContent = items.length+" elemento(s)";
      $("#feSelStatus_"+ws.id).textContent = state.selected.size ? state.selected.size+" seleccionado(s)" : "";
      if(!items.length){
        box.innerHTML = `<div class="empty-state"><span class="es-icon">📭</span><p>Esta carpeta está vacía</p></div>`;
        return;
      }
      if(state.view==="grid"){
        box.className = "fe-content";
        box.innerHTML = `<div class="fe-grid">${items.map(it=>`
          <div class="fe-item${state.selected.has(it.id)?" selected":""}" data-id="${it.id}">
            <div class="fi-icon">${FS.icon_for(it)}</div>
            <div class="fi-label">${escapeHtml(it.name)}</div>
          </div>`).join("")}</div>`;
      } else {
        box.innerHTML = `<div class="fe-list">
          <div class="fe-list-head"><span class="fe-col-name">Nombre</span><span class="fe-col-date">Modificado</span><span class="fe-col-type">Tipo</span><span class="fe-col-size">Tamaño</span></div>
          ${items.map(it=>`
          <div class="fe-list-row${state.selected.has(it.id)?" selected":""}" data-id="${it.id}">
            <span class="fe-col-name">${FS.icon_for(it)} ${escapeHtml(it.name)}</span>
            <span class="fe-col-date">${formatShortDate(new Date(it.dateModified))}</span>
            <span class="fe-col-type">${it.type==="folder"?"Carpeta":("Archivo ."+(it.ext||""))}</span>
            <span class="fe-col-size">${it.type==="folder"?"—":formatBytes(it.size||0)}</span>
          </div>`).join("")}
        </div>`;
      }
      wireItems();
    }
    function wireItems(){
      $$(".fe-item, .fe-list-row", body).forEach(row=>{
        row.addEventListener("click",(e)=>{
          if(!e.ctrlKey) state.selected.clear();
          state.selected.has(row.dataset.id) ? state.selected.delete(row.dataset.id) : state.selected.add(row.dataset.id);
          content();
        });
        row.addEventListener("dblclick",()=>{
          const node = FS.get(row.dataset.id);
          if(node.type==="folder") navigateTo(node.id);
          else openFileWithDefaultApp(node);
        });
        row.addEventListener("contextmenu",(e)=>{
          e.preventDefault();
          if(!state.selected.has(row.dataset.id)){ state.selected.clear(); state.selected.add(row.dataset.id); content(); }
          const node = FS.get(row.dataset.id);
          ContextMenu.show(e.clientX,e.clientY, itemMenu(node));
        });
      });
    }
    function itemMenu(node){
      const items = [{id:"open",label:"Abrir",icon:"📂",action:()=>node.type==="folder"?navigateTo(node.id):openFileWithDefaultApp(node)}];
      if(state.path==="recyclebin"){
        items.push({id:"restore",label:"Restaurar",icon:"♻️",action:()=>{FS.restore(node.id);content();}});
        items.push({id:"perm-delete",label:"Eliminar permanentemente",icon:"🗑️",action:()=>{FS.permanentDelete(node.id);content();}});
        return items;
      }
      items.push({separator:true});
      items.push({id:"rename",label:"Cambiar nombre",icon:"✏️",disabled:node.locked,action:()=>renameItem(node)});
      items.push({id:"copy",label:"Copiar",icon:"📋",action:()=>doCopy()});
      items.push({id:"cut",label:"Cortar",icon:"✂️",disabled:node.locked,action:()=>doCut()});
      items.push({id:"delete",label:"Eliminar",icon:"🗑️",disabled:node.locked,action:()=>doDelete()});
      items.push({separator:true});
      items.push({id:"props",label:"Propiedades",icon:"ℹ️",action:()=>Toast.show({title:node.name,msg:(node.type==="folder"?"Carpeta":"Archivo")+" · "+formatBytes(node.size||0),icon:"ℹ️"})});
      return items;
    }
    function renameItem(node){
      const newName = prompt("Nuevo nombre:", node.name);
      if(newName && newName.trim()){ FS.rename(node.id,newName.trim()); content(); }
    }
    function doCopy(){ OS.clipboard = {type:"copy", ids:[...state.selected]}; Toast.show({title:"Copiado",msg:state.selected.size+" elemento(s) al portapapeles.",icon:"📋"}); }
    function doCut(){ OS.clipboard = {type:"cut", ids:[...state.selected]}; Toast.show({title:"Cortado",msg:state.selected.size+" elemento(s) al portapapeles.",icon:"✂️"}); }
    function doDelete(){
      state.selected.forEach(id=>{ const n=FS.get(id); if(n && !n.locked) FS.deleteToRecycle(id); });
      state.selected.clear(); content(); DesktopIcons.render();
    }
    function doPaste(){
      if(!OS.clipboard) return;
      OS.clipboard.ids.forEach(id=>{
        if(OS.clipboard.type==="cut") FS.moveTo(id,state.path);
        else{
          const src = FS.get(id);
          if(src){
            if(src.type==="folder") FS.createFolder(state.path, FS.uniqueName(state.path,"Copia de "+src.name));
            else FS.createFile(state.path, FS.uniqueName(state.path,"Copia de "+src.name), src.kind, src.content, src.ext);
          }
        }
      });
      if(OS.clipboard.type==="cut") OS.clipboard=null;
      content(); DesktopIcons.render();
    }
    function navigateTo(path){
      state.path = path;
      state.selected.clear();
      state.history = state.history.slice(0,state.historyIndex+1);
      state.history.push(path);
      state.historyIndex = state.history.length-1;
      refresh();
    }
    function refresh(){
      crumbs(); content();
      WindowManager.setWindowTitle(ws.id, state.path==="recyclebin"?"Papelera de reciclaje":(FS.get(state.path)?FS.get(state.path).name:"Explorador"));
    }
    $$(".fe-nav-item",body).forEach(item=> item.addEventListener("click",()=>navigateTo(item.dataset.nav)));
    $(".app-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      const a = btn.dataset.a;
      if(a==="back" && state.historyIndex>0){ state.historyIndex--; state.path=state.history[state.historyIndex]; refresh(); }
      if(a==="fwd" && state.historyIndex<state.history.length-1){ state.historyIndex++; state.path=state.history[state.historyIndex]; refresh(); }
      if(a==="up"){ const chain=FS.pathChain(state.path); if(chain.length>1) navigateTo(chain[chain.length-2].id); }
      if(a==="refresh") refresh();
      if(a==="newfolder"){ const n=FS.createFolder(state.path, FS.uniqueName(state.path,"Nueva carpeta")); content(); DesktopIcons.render(); }
      if(a==="newfile"){ const n=FS.createFile(state.path, FS.uniqueName(state.path,"Nuevo documento de texto.txt"),"text","","txt"); content(); DesktopIcons.render(); }
      if(a==="copy") doCopy();
      if(a==="cut") doCut();
      if(a==="paste") doPaste();
      if(a==="delete") doDelete();
      if(a==="viewgrid"){ state.view="grid"; content(); }
      if(a==="viewlist"){ state.view="list"; content(); }
    });
    $("#feSearch_"+ws.id).addEventListener("input",(e)=>{
      const q = e.target.value.toLowerCase();
      $$(".fe-item,.fe-list-row",body).forEach(row=>{
        const node = FS.get(row.dataset.id);
        row.style.display = node.name.toLowerCase().includes(q) ? "" : "none";
      });
    });
    refresh();
  }
  APP_REGISTRY.fileExplorer = {name:"Explorador de archivos", icon:"📁", width:820, height:560, render};
})();

/* ============================================================================
   21b. APLICACIÓN — PAPELERA DE RECICLAJE
============================================================================ */
(function registerRecycleBin(){
  function render(body, ws){
    body.innerHTML = `<div class="app-root">
      <div class="app-toolbar">
        <button class="app-btn" data-a="restoreall">♻️ Restaurar todo</button>
        <button class="app-btn" data-a="empty">🧹 Vaciar papelera</button>
      </div>
      <div class="recycle-bin-root" id="rbContent_${ws.id}"></div>
    </div>`;
    function refresh(){
      const items = FS.getChildren("recyclebin");
      const box = $("#rbContent_"+ws.id);
      if(!items.length){ box.innerHTML = `<div class="empty-state"><span class="es-icon">🗑️</span><p>La papelera de reciclaje está vacía</p></div>`; return; }
      box.innerHTML = `<div class="fe-grid">${items.map(it=>`
        <div class="fe-item" data-id="${it.id}">
          <div class="fi-icon">${FS.icon_for(it)}</div>
          <div class="fi-label">${escapeHtml(it.name)}</div>
        </div>`).join("")}</div>`;
      $$(".fe-item",box).forEach(row=>{
        row.addEventListener("contextmenu",(e)=>{
          e.preventDefault();
          ContextMenu.show(e.clientX,e.clientY,[
            {id:"restore",label:"Restaurar",icon:"♻️",action:()=>{FS.restore(row.dataset.id);refresh();DesktopIcons.render();}},
            {id:"delete",label:"Eliminar permanentemente",icon:"🗑️",action:()=>{FS.permanentDelete(row.dataset.id);refresh();}}
          ]);
        });
        row.addEventListener("dblclick",()=>{FS.restore(row.dataset.id);refresh();DesktopIcons.render();});
      });
    }
    $(".app-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="restoreall"){ FS.getChildren("recyclebin").slice().forEach(n=>FS.restore(n.id)); refresh(); DesktopIcons.render(); }
      if(btn.dataset.a==="empty"){ FS.getChildren("recyclebin").slice().forEach(n=>FS.permanentDelete(n.id)); refresh(); NotificationCenter.push({title:"Papelera vaciada",msg:"Todos los elementos se eliminaron permanentemente.",icon:"🗑️",app:"Sistema"}); }
    });
    refresh();
  }
  APP_REGISTRY.recycleBin = {name:"Papelera de reciclaje", icon:"🗑️", width:640, height:460, render};
})();

/* ============================================================================
   21c. APLICACIÓN — CONFIGURACIÓN
============================================================================ */
(function registerSettings(){
  function toggleHtml(id,checked){ return `<div class="toggle-switch${checked?" on":""}" data-toggle="${id}"></div>`; }

  function pageSystem(){
    return `<h2>Sistema</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Resolución de pantalla</span><span class="settings-row-sub">${window.innerWidth}×${window.innerHeight} (recomendado)</span></div></div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Escala</span><span class="settings-row-sub">100% (recomendado)</span></div></div>
      </div>
      <h3>Sonido</h3>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Volumen del sistema</span></div><input type="range" class="settings-slider" style="width:160px" id="sysVolumeSlider" min="0" max="100" value="${OS.volume}"></div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Silenciar</span></div>${toggleHtml("mute",OS.muted)}</div>
      </div>
      <h3>Notificaciones</h3>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">No molestar</span><span class="settings-row-sub">Silencia notificaciones y avisos</span></div>${toggleHtml("dnd",OS.dndOn)}</div>
      </div>`;
  }
  function pagePersonalization(){
    return `<h2>Personalización</h2>
      <h3>Tema</h3>
      <div class="theme-swatch-row">
        <div class="theme-swatch${OS.theme==="dark"?" active":""}" data-theme="dark"><div class="ts-preview" style="background:#1b1b1f;"></div><div class="ts-label">Oscuro</div></div>
        <div class="theme-swatch${OS.theme==="light"?" active":""}" data-theme="light"><div class="ts-preview" style="background:#e9edf3;"></div><div class="ts-label">Claro</div></div>
      </div>
      <h3>Fondo de escritorio</h3>
      <div class="wallpaper-grid">
        ${Object.entries(WALLPAPERS).map(([id,w])=>`<div class="wallpaper-thumb${OS.wallpaperId===id?" active":""}" data-wp="${id}" style="background:${w.animated?"linear-gradient(120deg,#062b47,#3c1a63,#0c3b4f)":w.css}" title="${w.name}"></div>`).join("")}
      </div>
      <h3>Color de acento</h3>
      <div class="accent-color-row">
        ${["#0078d4","#8e5fe0","#e0527a","#e0a125","#2fa86a","#12b3c9"].map(c=>`<div class="accent-swatch${OS.accent===c?" active":""}" data-accent="${c}" style="background:${c}"></div>`).join("")}
      </div>
      <h3>Barra de tareas</h3>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Ocultar automáticamente la barra de tareas</span></div>${toggleHtml("autohide",OS.autohideTaskbar)}</div>
      </div>`;
  }
  function pageApps(){
    const installed = [...new Set([...Object.keys(APP_REGISTRY)])];
    return `<h2>Aplicaciones</h2><h3>Aplicaciones instaladas (${installed.length})</h3>
      <div class="settings-card">
        ${installed.map(id=>`<div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">${APP_REGISTRY[id].icon} ${APP_REGISTRY[id].name}</span><span class="settings-row-sub">Aplicación del sistema</span></div></div>`).join("")}
      </div>`;
  }
  function pageAccounts(){
    return `<h2>Cuentas</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title" style="font-size:16px;">👤 Usuario</span><span class="settings-row-sub">Cuenta local · Administrador</span></div></div>
      </div>
      <h3>Opciones de inicio de sesión</h3>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Contraseña</span><span class="settings-row-sub">Cualquier valor desbloquea esta simulación</span></div></div>
      </div>`;
  }
  function pageTimeLang(){
    const now = new Date();
    return `<h2>Hora e idioma</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Fecha y hora actual</span><span class="settings-row-sub">${formatFullDate(now)}, ${formatTimeSec(now)}</span></div></div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Zona horaria</span><span class="settings-row-sub">(UTC${-new Date().getTimezoneOffset()/60>=0?"+":""}${-new Date().getTimezoneOffset()/60}) Hora local del navegador</span></div></div>
      </div>
      <h3>Idioma</h3>
      <div class="settings-card"><div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Idioma del sistema</span><span class="settings-row-sub">Español (España)</span></div></div></div>`;
  }
  function pageAccessibility(){
    return `<h2>Accesibilidad</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Filtros de color / Alto contraste</span></div>${toggleHtml("accessibility",OS.accessibilityOn)}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Texto más grande</span></div>${toggleHtml("largetext",false)}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Reducir movimiento</span></div>${toggleHtml("reducemotion",false)}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Narrador</span></div>${toggleHtml("narrator",false)}</div>
      </div>`;
  }
  function pagePrivacy(){
    return `<h2>Privacidad y seguridad</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Permisos de cámara</span><span class="settings-row-sub">Simulados, sin acceso real al hardware</span></div>${toggleHtml("camperm",true)}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Permisos de micrófono</span><span class="settings-row-sub">Simulados, sin acceso real al hardware</span></div>${toggleHtml("micperm",true)}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Historial de actividad</span></div>${toggleHtml("activity",true)}</div>
      </div>`;
  }
  function pageNetwork(){
    return `<h2>Red e Internet</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Wi-Fi</span><span class="settings-row-sub">${OS.wifiOn?"Conectado a Red-Hogar-5G":"Desactivado"}</span></div>${toggleHtml("wifi",OS.wifiOn)}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Modo avión</span></div>${toggleHtml("airplane",OS.airplaneOn)}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Bluetooth</span></div>${toggleHtml("bluetooth",OS.bluetoothOn)}</div>
      </div>`;
  }
  function pagePower(){
    return `<h2>Energía y batería</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Batería</span><span class="settings-row-sub">${OS.batteryPct}% ${OS.batteryCharging?"· Cargando":"disponible"}</span></div></div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Ahorro de energía</span></div>${toggleHtml("battersaver",OS.batterySaverOn)}</div>
      </div>
      <h3>Pantalla y suspensión</h3>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Brillo</span></div><input type="range" class="settings-slider" style="width:160px" id="sysBrightnessSlider" min="10" max="100" value="${OS.brightness}"></div>
      </div>`;
  }
  function pageStorage(){
    const segments = [
      {label:"Sistema", pct:22, color:"#0078d4"},
      {label:"Aplicaciones", pct:18, color:"#8e5fe0"},
      {label:"Documentos", pct:12, color:"#60cdff"},
      {label:"Imágenes y vídeo", pct:20, color:"#e0527a"},
      {label:"Libre", pct:28, color:"var(--surface-hover)"}
    ];
    return `<h2>Almacenamiento</h2>
      <div class="settings-card">
        <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px;">512 GB de almacenamiento simulado</p>
        <div class="storage-bar-seg">${segments.map(s=>`<div style="width:${s.pct}%;background:${s.color};"></div>`).join("")}</div>
        <div class="storage-legend">${segments.map(s=>`<div class="storage-legend-item"><span class="storage-legend-dot" style="background:${s.color};"></span>${s.label} · ${s.pct}%</div>`).join("")}</div>
      </div>`;
  }
  function pageWindowsUpdate(){
    return `<h2>Windows Update</h2>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title" style="color:var(--success);">✓ Estás al día</span><span class="settings-row-sub">Última comprobación: hoy</span></div>
        <button class="app-btn primary" id="btnCheckUpdates">Buscar actualizaciones</button></div>
      </div>`;
  }
  function pageAbout(){
    return `<h2>Acerca de</h2>
      <div class="settings-card">
        <dl class="about-grid">
          <dt>Edición</dt><dd>Windows 12 (Simulación conceptual)</dd>
          <dt>Versión</dt><dd>26H1 — Concept Build</dd>
          <dt>Procesador</dt><dd>CPU virtual simulada</dd>
          <dt>RAM instalada</dt><dd>16,0 GB (simulada)</dd>
          <dt>Tipo de sistema</dt><dd>Sistema simulado de 64 bits</dd>
          <dt>Nombre del dispositivo</dt><dd>WEB-SIMULATOR</dd>
        </dl>
        <p style="margin-top:14px;font-size:11.5px;color:var(--text-3);">Este proyecto es una recreación educativa e independiente inspirada en Windows 11/12 y en el lenguaje de diseño Fluent de Microsoft. No es un producto oficial ni está afiliado a Microsoft Corporation.</p>
      </div>`;
  }
  const PAGES = {
    system:pageSystem, personalization:pagePersonalization, apps:pageApps, accounts:pageAccounts,
    timelang:pageTimeLang, accessibility:pageAccessibility, privacy:pagePrivacy, network:pageNetwork,
    power:pagePower, storage:pageStorage, windowsupdate:pageWindowsUpdate, about:pageAbout
  };

  function render(body, ws, params){
    const state = {page: params.page || "system"};
    body.innerHTML = `<div class="settings-root">
      <div class="settings-nav">
        <input type="text" class="settings-search" id="setSearch_${ws.id}" placeholder="Buscar en Configuración">
        ${SETTINGS_PAGES.map(p=>`<div class="settings-nav-item${state.page===p.id?" active":""}" data-page="${p.id}">${p.icon} ${p.title}</div>`).join("")}
      </div>
      <div class="settings-content" id="setContent_${ws.id}"></div>
    </div>`;
    function renderPage(){
      $$(".settings-nav-item",body).forEach(i=>i.classList.toggle("active", i.dataset.page===state.page));
      $("#setContent_"+ws.id).innerHTML = (PAGES[state.page]||pageSystem)();
      wirePageControls();
      WindowManager.setWindowTitle(ws.id, "Configuración — "+(SETTINGS_PAGES.find(p=>p.id===state.page)||{}).title);
    }
    function wirePageControls(){
      const content = $("#setContent_"+ws.id);
      $$("[data-toggle]",content).forEach(t=>{
        t.addEventListener("click",()=>{
          const key = t.dataset.toggle;
          SoundEngine.toggleOn();
          if(key==="mute"){ OS.muted=!OS.muted; }
          else if(key==="dnd"){ OS.dndOn=!OS.dndOn; }
          else if(key==="wifi"){ OS.wifiOn=!OS.wifiOn; }
          else if(key==="airplane"){ OS.airplaneOn=!OS.airplaneOn; }
          else if(key==="bluetooth"){ OS.bluetoothOn=!OS.bluetoothOn; }
          else if(key==="battersaver"){ OS.batterySaverOn=!OS.batterySaverOn; }
          else if(key==="autohide"){ OS.autohideTaskbar=!OS.autohideTaskbar; }
          else if(key==="accessibility"){ OS.accessibilityOn=!OS.accessibilityOn; }
          else { t.classList.toggle("on"); }
          renderPage();
        });
      });
      $$(".theme-swatch",content).forEach(s=> s.addEventListener("click",()=>{ ThemeManager.set(s.dataset.theme); renderPage(); }));
      $$(".wallpaper-thumb",content).forEach(s=> s.addEventListener("click",()=>{ WallpaperManager.apply(s.dataset.wp); renderPage(); }));
      $$(".accent-swatch",content).forEach(s=> s.addEventListener("click",()=>{
        OS.accent = s.dataset.accent;
        document.documentElement.style.setProperty("--accent-2", OS.accent);
        renderPage();
      }));
      const vs = $("#sysVolumeSlider",content); if(vs) vs.addEventListener("input",(e)=>{ OS.volume=+e.target.value; OS.muted=OS.volume===0; $("#volumeSlider").value=OS.volume; });
      const bs = $("#sysBrightnessSlider",content); if(bs) bs.addEventListener("input",(e)=>{ OS.brightness=+e.target.value; $("#screenBrightness").style.opacity=(100-OS.brightness)/100*0.72; $("#brightnessSlider").value=OS.brightness; });
      const upd = $("#btnCheckUpdates",content); if(upd) upd.addEventListener("click",()=>{ Toast.show({title:"Windows Update",msg:"No hay actualizaciones nuevas disponibles.",icon:"🔄"}); });
    }
    $$(".settings-nav-item",body).forEach(item=> item.addEventListener("click",()=>{ state.page=item.dataset.page; renderPage(); }));
    $("#setSearch_"+ws.id).addEventListener("input",(e)=>{
      const q = e.target.value.toLowerCase();
      $$(".settings-nav-item",body).forEach(i=> i.style.display = i.textContent.toLowerCase().includes(q) ? "" : "none");
    });
    renderPage();
  }
  APP_REGISTRY.settings = {name:"Configuración", icon:"⚙️", width:860, height:600, render};
})();

/* ============================================================================
   21d. APLICACIÓN — CALCULADORA
============================================================================ */
(function registerCalculator(){
  function render(body, ws){
    const state = {mode:"standard", expr:"", result:"0", justEvaluated:false};
    body.innerHTML = `<div class="calc-root">
      <div class="calc-mode-tabs">
        <div class="calc-mode-tab active" data-mode="standard">Estándar</div>
        <div class="calc-mode-tab" data-mode="scientific">Científica</div>
      </div>
      <div class="calc-display">
        <div class="calc-expr" id="calcExpr_${ws.id}">&nbsp;</div>
        <div class="calc-result" id="calcResult_${ws.id}">0</div>
      </div>
      <div class="calc-grid" id="calcGrid_${ws.id}"></div>
    </div>`;
    const STD_BTNS = [
      ["C","clear"],["⌫","back"],["%","op"],["÷","op"],
      ["7","d"],["8","d"],["9","d"],["×","op"],
      ["4","d"],["5","d"],["6","d"],["−","op"],
      ["1","d"],["2","d"],["3","d"],["+","op"],
      ["±","neg"],["0","d"],[".","d"],["=","eq"]
    ];
    const SCI_BTNS = [
      ["sin","fn"],["cos","fn"],["tan","fn"],["√","fn"],["C","clear"],
      ["ln","fn"],["log","fn"],["(","op"],[")","op"],["⌫","back"],
      ["7","d"],["8","d"],["9","d"],["÷","op"],["x²","fn"],
      ["4","d"],["5","d"],["6","d"],["×","op"],["xʸ","fn"],
      ["1","d"],["2","d"],["3","d"],["−","op"],["π","fn"],
      ["0","d"],[".","d"],["±","neg"],["+","op"],["=","eq"]
    ];
    function buildGrid(){
      const grid = $("#calcGrid_"+ws.id);
      const btns = state.mode==="standard" ? STD_BTNS : SCI_BTNS;
      grid.className = "calc-grid"+(state.mode==="scientific"?" calc-sci-grid":"");
      grid.innerHTML = btns.map(([label,type])=>`<button class="calc-btn ${type==="op"?"op":type==="eq"?"eq":type==="fn"?"fn":""}" data-b="${escapeHtml(label)}" data-t="${type}">${label}</button>`).join("");
      $$(".calc-btn",grid).forEach(b=> b.addEventListener("click",()=>handlePress(b.dataset.b,b.dataset.t)));
    }
    function updateDisplay(){
      $("#calcExpr_"+ws.id).textContent = state.expr || "\u00A0";
      $("#calcResult_"+ws.id).textContent = state.result;
    }
    function toEvalString(expr){
      return expr.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-").replace(/π/g,"("+Math.PI+")")
        .replace(/√\(?(-?\d+\.?\d*)\)?/g, (m,n)=>"Math.sqrt("+n+")")
        .replace(/sin\(?(-?\d+\.?\d*)\)?/g,(m,n)=>"Math.sin("+n+")")
        .replace(/cos\(?(-?\d+\.?\d*)\)?/g,(m,n)=>"Math.cos("+n+")")
        .replace(/tan\(?(-?\d+\.?\d*)\)?/g,(m,n)=>"Math.tan("+n+")")
        .replace(/ln\(?(-?\d+\.?\d*)\)?/g,(m,n)=>"Math.log("+n+")")
        .replace(/log\(?(-?\d+\.?\d*)\)?/g,(m,n)=>"Math.log10("+n+")");
    }
    function safeEval(str){
      try{
        if(!/^[0-9+\-*/().\sMathsqrtcolgpiPI]*$/.test(str)) throw new Error("chars");
        // eslint-disable-next-line no-new-func
        const val = Function('"use strict";return ('+str+')')();
        if(typeof val!=="number" || !isFinite(val)) throw new Error("nan");
        return val;
      }catch(e){ return null; }
    }
    function handlePress(label,type){
      SoundEngine.click();
      if(type==="clear"){ state.expr=""; state.result="0"; updateDisplay(); return; }
      if(type==="back"){ state.expr = state.expr.slice(0,-1); updateDisplay(); return; }
      if(type==="neg"){
        if(state.result && state.result!=="0"){ state.result = (parseFloat(state.result)*-1).toString(); state.expr = state.result; }
        updateDisplay(); return;
      }
      if(type==="eq"){
        const evaluated = safeEval(toEvalString(state.expr));
        if(evaluated===null){ state.result="Error"; SoundEngine.error(); }
        else { state.result = Number.isInteger(evaluated)?evaluated.toString():parseFloat(evaluated.toFixed(10)).toString(); state.expr=state.result; }
        updateDisplay(); return;
      }
      if(type==="fn"){
        const map = {"x²":"^2 -> sq", "xʸ":"^"};
        if(label==="x²"){
          const val = safeEval(toEvalString(state.expr||state.result));
          if(val!==null){ state.result=(val*val).toString(); state.expr=state.result; }
        } else if(label==="xʸ"){
          state.expr += "^";
        } else {
          state.expr += label+"(";
        }
        updateDisplay(); return;
      }
      // dígitos y operadores
      if(label==="."){
        const lastNum = state.expr.split(/[+\-×÷]/).pop();
        if(lastNum.includes(".")) return;
      }
      state.expr += label;
      updateDisplay();
    }
    $$(".calc-mode-tab",body).forEach(tab=> tab.addEventListener("click",()=>{
      state.mode = tab.dataset.mode;
      $$(".calc-mode-tab",body).forEach(t=>t.classList.toggle("active",t===tab));
      buildGrid();
    }));
    buildGrid(); updateDisplay();
  }
  APP_REGISTRY.calculator = {name:"Calculadora", icon:"🧮", width:340, height:520, resizable:false, render};
})();

/* ============================================================================
   21e. APLICACIÓN — BLOC DE NOTAS
============================================================================ */
(function registerNotepad(){
  function render(body, ws, params){
    const fileNode = params.fileId ? FS.get(params.fileId) : null;
    const state = {fileId: fileNode?fileNode.id:null, dirty:false};
    body.innerHTML = `<div class="app-root">
      <div class="app-toolbar">
        <button class="app-btn" data-a="new">📄 Nuevo</button>
        <button class="app-btn" data-a="save">💾 Guardar</button>
        <div class="app-sep-v"></div>
        <button class="app-btn" data-a="wrap">↩️ Ajuste de línea</button>
      </div>
      <textarea class="notepad-editor" id="npEditor_${ws.id}" spellcheck="false" placeholder="Escribe algo…"></textarea>
      <div class="app-statusbar"><span id="npStatus_${ws.id}">Listo</span><span id="npCount_${ws.id}">0 caracteres</span></div>
    </div>`;
    const editor = $("#npEditor_"+ws.id);
    editor.value = fileNode ? fileNode.content : "";
    WindowManager.setWindowTitle(ws.id, (fileNode?fileNode.name:"Sin título")+" - Bloc de notas");
    function updateCount(){ $("#npCount_"+ws.id).textContent = editor.value.length+" caracteres"; }
    editor.addEventListener("input",()=>{
      state.dirty = true;
      $("#npStatus_"+ws.id).textContent = "Modificado";
      updateCount();
    });
    $(".app-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="new"){ editor.value=""; state.fileId=null; WindowManager.setWindowTitle(ws.id,"Sin título - Bloc de notas"); updateCount(); }
      if(btn.dataset.a==="save"){
        if(state.fileId){
          const n = FS.get(state.fileId); n.content = editor.value; n.size = editor.value.length; n.dateModified=new Date();
        } else {
          const n = FS.createFile("documents", FS.uniqueName("documents","Nuevo documento de texto.txt"),"text",editor.value,"txt");
          state.fileId = n.id;
          WindowManager.setWindowTitle(ws.id, n.name+" - Bloc de notas");
        }
        state.dirty=false;
        $("#npStatus_"+ws.id).textContent = "Guardado";
        Toast.show({title:"Guardado",msg:"El archivo se guardó correctamente.",icon:"💾"});
      }
      if(btn.dataset.a==="wrap"){ editor.style.whiteSpace = editor.style.whiteSpace==="pre" ? "pre-wrap" : "pre"; }
    });
    updateCount();
  }
  APP_REGISTRY.notepad = {name:"Bloc de notas", icon:"📝", width:600, height:480, render};
})();

/* ============================================================================
   21f. APLICACIÓN — EDITOR DE TEXTO ENRIQUECIDO
============================================================================ */
(function registerRichText(){
  function render(body, ws){
    body.innerHTML = `<div class="app-root">
      <div class="app-toolbar richtext-toolbar">
        <button class="app-icon-btn" data-cmd="bold" style="font-weight:800;">B</button>
        <button class="app-icon-btn" data-cmd="italic" style="font-style:italic;">I</button>
        <button class="app-icon-btn" data-cmd="underline" style="text-decoration:underline;">U</button>
        <div class="app-sep-v"></div>
        <select class="rt-select" data-cmd="fontSize">
          <option value="3">Normal</option><option value="5">Grande</option><option value="1">Pequeño</option><option value="7">Enorme</option>
        </select>
        <div class="app-sep-v"></div>
        <button class="app-icon-btn" data-cmd="insertUnorderedList">• Lista</button>
        <button class="app-icon-btn" data-cmd="insertOrderedList">1. Lista</button>
        <button class="app-icon-btn" data-cmd="justifyLeft">⯇</button>
        <button class="app-icon-btn" data-cmd="justifyCenter">≡</button>
        <button class="app-icon-btn" data-cmd="justifyRight">⯈</button>
        <div class="app-sep-v"></div>
        <button class="app-btn" data-a="save">💾 Guardar</button>
      </div>
      <div class="richtext-body" contenteditable="true" id="rtBody_${ws.id}">
        <h2>Documento sin título</h2>
        <p>Empieza a escribir aquí. Puedes usar la barra de herramientas para dar formato al texto: negrita, cursiva, subrayado, listas y alineación.</p>
      </div>
    </div>`;
    const bodyEl = $("#rtBody_"+ws.id);
    $(".richtext-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-cmd]"); if(!btn || btn.tagName==="SELECT") return;
      document.execCommand(btn.dataset.cmd,false,null);
      bodyEl.focus();
    });
    $('[data-cmd="fontSize"]',body).addEventListener("change",(e)=>{ document.execCommand("fontSize",false,e.target.value); bodyEl.focus(); });
    $(".app-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest('[data-a="save"]'); if(!btn) return;
      const n = FS.createFile("documents", FS.uniqueName("documents","Documento enriquecido.txt"),"text",bodyEl.innerText,"txt");
      Toast.show({title:"Guardado",msg:"Documento guardado como texto plano en Documentos.",icon:"💾"});
    });
  }
  APP_REGISTRY.richTextEditor = {name:"Editor de texto enriquecido", icon:"🖋️", width:700, height:560, render};
})();

/* ============================================================================
   21g. APLICACIÓN — PAINT
============================================================================ */
(function registerPaint(){
  const COLORS = ["#000000","#ffffff","#e81123","#ff8c00","#fff100","#107c10","#00b7c3","#0078d4","#8e5fe0","#e3008c","#a0522d","#767676"];
  function render(body, ws){
    body.innerHTML = `<div class="paint-root">
      <div class="paint-toolbar">
        <div class="paint-tools">
          <button class="paint-tool-btn active" data-tool="pencil" title="Lápiz">✏️</button>
          <button class="paint-tool-btn" data-tool="eraser" title="Borrador">🧽</button>
          <button class="paint-tool-btn" data-tool="line" title="Línea">📏</button>
          <button class="paint-tool-btn" data-tool="rect" title="Rectángulo">▭</button>
          <button class="paint-tool-btn" data-tool="circle" title="Elipse">◯</button>
          <button class="paint-tool-btn" data-tool="fill" title="Rellenar">🪣</button>
        </div>
        <div class="app-sep-v"></div>
        <input type="range" class="paint-size-input" min="1" max="40" value="4" id="paintSize_${ws.id}">
        <div class="app-sep-v"></div>
        <div class="paint-colors" id="paintColors_${ws.id}">
          ${COLORS.map((c,i)=>`<div class="paint-color-swatch${i===0?" active":""}" data-color="${c}" style="background:${c};"></div>`).join("")}
          <input type="color" id="paintCustomColor_${ws.id}" style="width:22px;height:22px;border:none;background:none;">
        </div>
        <div class="app-sep-v"></div>
        <button class="app-btn" data-a="clear">🗑️ Limpiar</button>
        <button class="app-btn" data-a="save">💾 Guardar</button>
      </div>
      <div class="paint-canvas-wrap">
        <canvas id="paintCanvas_${ws.id}" width="900" height="560"></canvas>
      </div>
    </div>`;
    const canvas = $("#paintCanvas_"+ws.id);
    const ctx2d = canvas.getContext("2d");
    ctx2d.fillStyle = "#ffffff"; ctx2d.fillRect(0,0,canvas.width,canvas.height);
    let tool="pencil", color="#000000", size=4, drawing=false, startX=0,startY=0, snapshot=null;

    function getPos(e){
      const r = canvas.getBoundingClientRect();
      return {x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height)};
    }
    canvas.addEventListener("pointerdown",(e)=>{
      drawing = true;
      const p = getPos(e); startX=p.x; startY=p.y;
      snapshot = ctx2d.getImageData(0,0,canvas.width,canvas.height);
      if(tool==="pencil"||tool==="eraser"){
        ctx2d.beginPath(); ctx2d.moveTo(p.x,p.y);
      }
      if(tool==="fill"){ floodFill(Math.floor(p.x),Math.floor(p.y),color); drawing=false; }
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove",(e)=>{
      if(!drawing) return;
      const p = getPos(e);
      if(tool==="pencil"||tool==="eraser"){
        ctx2d.strokeStyle = tool==="eraser" ? "#ffffff" : color;
        ctx2d.lineWidth = tool==="eraser" ? size*2.4 : size;
        ctx2d.lineCap="round"; ctx2d.lineJoin="round";
        ctx2d.lineTo(p.x,p.y); ctx2d.stroke();
      } else if(["line","rect","circle"].includes(tool)){
        ctx2d.putImageData(snapshot,0,0);
        ctx2d.strokeStyle=color; ctx2d.lineWidth=size; ctx2d.lineCap="round";
        ctx2d.beginPath();
        if(tool==="line"){ ctx2d.moveTo(startX,startY); ctx2d.lineTo(p.x,p.y); }
        if(tool==="rect"){ ctx2d.rect(startX,startY,p.x-startX,p.y-startY); }
        if(tool==="circle"){
          const rx=Math.abs(p.x-startX)/2, ry=Math.abs(p.y-startY)/2;
          ctx2d.ellipse((startX+p.x)/2,(startY+p.y)/2,rx,ry,0,0,Math.PI*2);
        }
        ctx2d.stroke();
      }
    });
    canvas.addEventListener("pointerup",()=>{ drawing=false; });

    function floodFill(x,y,fillColor){
      const img = ctx2d.getImageData(0,0,canvas.width,canvas.height);
      const data = img.data;
      const w=canvas.width,h=canvas.height;
      const idx=(x,y)=>(y*w+x)*4;
      if(x<0||y<0||x>=w||y>=h) return;
      const target = [data[idx(x,y)],data[idx(x,y)+1],data[idx(x,y)+2],data[idx(x,y)+3]];
      const fillRgb = hexToRgb(fillColor);
      if(target[0]===fillRgb[0]&&target[1]===fillRgb[1]&&target[2]===fillRgb[2]) return;
      const stack=[[x,y]]; let iterations=0;
      while(stack.length && iterations<400000){
        iterations++;
        const [cx,cy]=stack.pop();
        if(cx<0||cy<0||cx>=w||cy>=h) continue;
        const i=idx(cx,cy);
        if(data[i]!==target[0]||data[i+1]!==target[1]||data[i+2]!==target[2]||data[i+3]!==target[3]) continue;
        data[i]=fillRgb[0];data[i+1]=fillRgb[1];data[i+2]=fillRgb[2];data[i+3]=255;
        stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
      }
      ctx2d.putImageData(img,0,0);
    }
    function hexToRgb(hex){
      const v = parseInt(hex.replace("#",""),16);
      return [(v>>16)&255,(v>>8)&255,v&255,255];
    }
    $$(".paint-tool-btn",body).forEach(btn=> btn.addEventListener("click",()=>{
      tool = btn.dataset.tool;
      $$(".paint-tool-btn",body).forEach(b=>b.classList.toggle("active",b===btn));
    }));
    $$(".paint-color-swatch",body).forEach(sw=> sw.addEventListener("click",()=>{
      color = sw.dataset.color;
      $$(".paint-color-swatch",body).forEach(s=>s.classList.toggle("active",s===sw));
    }));
    $("#paintCustomColor_"+ws.id).addEventListener("input",(e)=>{ color=e.target.value; });
    $("#paintSize_"+ws.id).addEventListener("input",(e)=>{ size=+e.target.value; });
    $(".paint-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="clear"){ ctx2d.fillStyle="#ffffff"; ctx2d.fillRect(0,0,canvas.width,canvas.height); }
      if(btn.dataset.a==="save"){
        const n = FS.createFile("pictures", FS.uniqueName("pictures","Dibujo de Paint.png"),"image","🎨","png");
        Toast.show({title:"Guardado",msg:"El dibujo se guardó en Imágenes.",icon:"💾"});
        DesktopIcons.render();
      }
    });
  }
  APP_REGISTRY.paint = {name:"Paint", icon:"🎨", width:960, height:660, render};
})();

/* ============================================================================
   21h. APLICACIÓN — TERMINAL
============================================================================ */
(function registerTerminal(){
  function render(body, ws){
    body.innerHTML = `<div class="terminal-root" id="termRoot_${ws.id}" tabindex="0"></div>`;
    const root = $("#termRoot_"+ws.id);
    let cwd = "C:\\Usuarios\\Usuario";
    const history=[]; let histIndex=-1;

    function println(text,cls){
      const line = el("div","terminal-line"+(cls?" "+cls:""));
      line.textContent = text;
      root.insertBefore(line, promptLine());
      root.scrollTop = root.scrollHeight;
    }
    function printHtml(html){
      const line = el("div","terminal-line");
      line.innerHTML = html;
      root.insertBefore(line, promptLine());
      root.scrollTop = root.scrollHeight;
    }
    function promptLine(){ return $(".terminal-prompt-line",root); }

    function newPromptLine(){
      const old = promptLine(); if(old) old.remove();
      const line = el("div","terminal-prompt-line");
      line.innerHTML = `<span class="terminal-prompt-label">${escapeHtml(cwd)}&gt;</span><input type="text" class="terminal-input" autocomplete="off" spellcheck="false">`;
      root.appendChild(line);
      const input = $(".terminal-input",line);
      input.addEventListener("keydown",(e)=>{
        e.stopPropagation();
        if(e.key==="Enter"){
          const cmd = input.value;
          println(cwd+"> "+cmd);
          if(cmd.trim()){ history.push(cmd); histIndex=history.length; }
          runCommand(cmd.trim());
          newPromptLine();
        } else if(e.key==="ArrowUp"){
          if(histIndex>0){ histIndex--; input.value=history[histIndex]; }
        } else if(e.key==="ArrowDown"){
          if(histIndex<history.length-1){ histIndex++; input.value=history[histIndex]; } else { histIndex=history.length; input.value=""; }
        }
      });
      root.addEventListener("click",()=>input.focus(),{once:true});
      input.focus();
      root.scrollTop = root.scrollHeight;
    }

    function runCommand(cmdRaw){
      const [cmd,...args] = cmdRaw.split(" ");
      const c = (cmd||"").toLowerCase();
      switch(c){
        case "": break;
        case "help":
          println("Comandos disponibles:");
          ["help — Muestra esta ayuda","dir — Lista archivos de la carpeta actual (simulado)","cls — Limpia la pantalla","echo [texto] — Muestra un texto","date — Muestra la fecha actual","time — Muestra la hora actual","ver — Muestra la versión del sistema","systeminfo — Información del sistema","whoami — Usuario actual","color [código] — Simula cambio de color","exit — Cierra la terminal"].forEach(l=>println("  "+l));
          break;
        case "dir":
          println(" El volumen de la unidad C es Windows12Sim");
          FS.getChildren("documents").forEach(n=> println("  "+(n.type==="folder"?"<DIR>":"     ")+"\t"+n.name));
          break;
        case "cls": $$(".terminal-line",root).forEach(l=>l.remove()); break;
        case "echo": println(args.join(" ")); break;
        case "date": println("La fecha actual es: "+formatShortDate(new Date())); break;
        case "time": println("La hora actual es: "+formatTimeSec(new Date())); break;
        case "ver": println("Windows 12 [Simulación conceptual — Build 26100.concept]"); break;
        case "whoami": println("web-simulator\\usuario"); break;
        case "systeminfo":
          printHtml(`<span class="terminal-accent">Nombre del host:</span> WEB-SIMULATOR<br>
          <span class="terminal-accent">Nombre del SO:</span> Windows 12 (Simulación conceptual)<br>
          <span class="terminal-accent">Versión del SO:</span> 26100.concept<br>
          <span class="terminal-accent">Fabricante del sistema:</span> Navegador web<br>
          <span class="terminal-accent">Memoria física total:</span> 16.384 MB (simulada)<br>
          <span class="terminal-accent">Zona horaria:</span> Local del navegador`);
          break;
        case "color": println("Color simulado actualizado."); break;
        case "cd":
          if(args[0]) println("(Simulado) No es posible cambiar de unidad en este entorno educativo.");
          else println(cwd);
          break;
        case "mkdir": case "md":
          if(args[0]){ FS.createFolder("documents",args.join(" ")); println("Carpeta creada en Documentos: "+args.join(" ")); DesktopIcons.render(); }
          else println("Uso: mkdir [nombre]");
          break;
        case "cipher": println("Cifrando... (simulado) Operación completada."); break;
        case "ping":
          println("Haciendo ping a "+(args[0]||"localhost")+" con 32 bytes de datos:");
          for(let i=0;i<4;i++) println(`Respuesta desde ${args[0]||"127.0.0.1"}: bytes=32 tiempo=${(Math.random()*20+1).toFixed(0)}ms TTL=64`);
          break;
        case "exit": WindowManager.closeWindow(ws.id); break;
        default:
          println(`'${cmd}' no se reconoce como un comando interno o externo. Escribe 'help' para ver los comandos disponibles.`,"terminal-error");
          SoundEngine.error();
      }
    }
    println("Microsoft Windows [Versión 12.0 — Simulación conceptual]");
    println("(c) Simulación educativa. Todos los derechos reservados a sus respectivos autores.");
    println("");
    root.appendChild(el("div","terminal-prompt-line"));
    newPromptLine();
  }
  APP_REGISTRY.terminal = {name:"Terminal", icon:"⌨️", width:680, height:440, render};
})();

/* ============================================================================
   21i. APLICACIÓN — ADMINISTRADOR DE TAREAS
============================================================================ */
(function registerTaskManager(){
  const PROC_NAMES = ["Explorador Fluent","Copiloto IA","Servicio de indexación","Motor de renderizado","Antimalware Service","Servicio de audio Windows","Runtime del sistema","Print Spooler","Servicio de red","Actualizador en segundo plano"];
  function render(body, ws){
    const state = {tab:"processes", procs: PROC_NAMES.map(name=>({name, cpu:Math.random()*8, ram:Math.random()*300+40, id:uid("p")}))};
    body.innerHTML = `<div class="app-root">
      <div class="tm-tabs">
        <div class="tm-tab active" data-tab="processes">Procesos</div>
        <div class="tm-tab" data-tab="performance">Rendimiento</div>
        <div class="tm-tab" data-tab="apps">Aplicaciones</div>
        <div class="tm-tab" data-tab="services">Servicios</div>
      </div>
      <div id="tmContent_${ws.id}" style="flex:1;overflow:auto;"></div>
    </div>`;
    function renderProcesses(){
      const rows = state.procs.map(p=>`<tr data-id="${p.id}">
        <td>⚙️ ${p.name}</td>
        <td><span class="tm-bar-mini"><span class="tm-bar-mini-fill" style="width:${Math.min(100,p.cpu*8)}%;"></span></span>${p.cpu.toFixed(1)}%</td>
        <td>${p.ram.toFixed(0)} MB</td>
        <td>0 MB/s</td>
      </tr>`).join("");
      const winRows = OS.windowOrder.map(id=>OS.windows[id]).filter(Boolean).map(w=>`<tr data-winid="${w.id}">
        <td>${w.icon} ${escapeHtml(w.title)}</td><td>${(Math.random()*12).toFixed(1)}%</td><td>${(Math.random()*200+80).toFixed(0)} MB</td><td>0 MB/s</td>
      </tr>`).join("");
      $("#tmContent_"+ws.id).innerHTML = `<table class="tm-table">
        <thead><tr><th>Nombre</th><th>CPU</th><th>Memoria</th><th>Disco</th></tr></thead>
        <tbody>${winRows}${rows}</tbody>
      </table>`;
      $$("tbody tr",body).forEach(row=> row.addEventListener("dblclick",()=>{
        if(row.dataset.winid) WindowManager.closeWindow(row.dataset.winid);
      }));
      $$("tbody tr",body).forEach(row=> row.addEventListener("contextmenu",(e)=>{
        e.preventDefault();
        if(!row.dataset.winid) return;
        ContextMenu.show(e.clientX,e.clientY,[{id:"end",label:"Finalizar tarea",icon:"⛔",action:()=>WindowManager.closeWindow(row.dataset.winid)}]);
      }));
    }
    function renderPerformance(){
      const cpu = OS.cpuHistory[OS.cpuHistory.length-1]||10;
      const ram = OS.ramHistory[OS.ramHistory.length-1]||30;
      $("#tmContent_"+ws.id).innerHTML = `<div class="tm-summary">
        <div class="tm-summary-card"><h5>CPU</h5><div class="tm-big">${cpu.toFixed(0)}%</div><div class="tm-graph" id="tmCpuGraph_${ws.id}"></div></div>
        <div class="tm-summary-card"><h5>Memoria</h5><div class="tm-big">${ram.toFixed(0)}%</div><div class="tm-graph" id="tmRamGraph_${ws.id}"></div></div>
        <div class="tm-summary-card"><h5>Disco 0 (SSD)</h5><div class="tm-big">${(Math.random()*30+5).toFixed(0)}%</div></div>
        <div class="tm-summary-card"><h5>GPU 0 (virtual)</h5><div class="tm-big">${(Math.random()*40+5).toFixed(0)}%</div></div>
        <div class="tm-summary-card"><h5>Red</h5><div class="tm-big">${(Math.random()*4).toFixed(1)} Mbps</div></div>
      </div>`;
      drawGraph($("#tmCpuGraph_"+ws.id), OS.cpuHistory);
      drawGraph($("#tmRamGraph_"+ws.id), OS.ramHistory);
    }
    function drawGraph(container, history){
      if(!container) return;
      container.innerHTML = history.slice(-24).map(v=>`<span style="height:${Math.max(3,v)}%;"></span>`).join("");
    }
    function renderApps(){
      const wins = OS.windowOrder.map(id=>OS.windows[id]).filter(Boolean);
      $("#tmContent_"+ws.id).innerHTML = wins.length ? `<table class="tm-table"><thead><tr><th>Aplicación</th><th>Estado</th><th></th></tr></thead>
        <tbody>${wins.map(w=>`<tr><td>${w.icon} ${escapeHtml(w.title)}</td><td>${w.minimized?"En segundo plano":"En ejecución"}</td>
        <td><button class="app-btn" data-close="${w.id}">Finalizar tarea</button></td></tr>`).join("")}</tbody></table>`
        : `<div class="empty-state"><span class="es-icon">🗔</span><p>No hay aplicaciones abiertas</p></div>`;
      $$("[data-close]",body).forEach(b=> b.addEventListener("click",()=>WindowManager.closeWindow(b.dataset.close)));
    }
    function renderServices(){
      const services = ["AudioSrv","BITS","DHCP Client","Windows Update","Print Spooler","Themes","Fluent Shell Experience Host","WSearch"];
      $("#tmContent_"+ws.id).innerHTML = `<table class="tm-table"><thead><tr><th>Servicio</th><th>Estado</th><th>Tipo de inicio</th></tr></thead>
        <tbody>${services.map(s=>`<tr><td>${s}</td><td style="color:var(--success)">En ejecución</td><td>Automático</td></tr>`).join("")}</tbody></table>`;
    }
    const RENDERERS = {processes:renderProcesses, performance:renderPerformance, apps:renderApps, services:renderServices};
    function refresh(){ (RENDERERS[state.tab]||renderProcesses)(); }
    $$(".tm-tab",body).forEach(tab=> tab.addEventListener("click",()=>{
      state.tab = tab.dataset.tab;
      $$(".tm-tab",body).forEach(t=>t.classList.toggle("active",t===tab));
      refresh();
    }));
    document.addEventListener("os:perftick",()=>{ if(state.tab==="performance" && OS.windows[ws.id]) renderPerformance(); });
    refresh();
  }
  APP_REGISTRY.taskManager = {name:"Administrador de tareas", icon:"📊", width:700, height:520, render};
})();

/* ============================================================================
   21j. APLICACIÓN — RELOJ (Mundial / Alarmas / Cronómetro / Temporizador)
============================================================================ */
(function registerClockApp(){
  const WORLD_CITIES = [
    {city:"Nueva York", offset:-4}, {city:"Londres", offset:1}, {city:"Tokio", offset:9}, {city:"Sídney", offset:11}
  ];
  function render(body, ws){
    const state = {
      tab:"world",
      alarms:[{id:uid("al"),time:"07:00",label:"Despertar",on:true},{id:uid("al"),time:"13:30",label:"Almuerzo",on:false}],
      stopwatch:{running:false, elapsed:0, laps:[], startedAt:0},
      timer:{running:false, total:300, remaining:300, startedAt:0}
    };
    body.innerHTML = `<div class="app-root">
      <div class="clock-tabs">
        <div class="clock-tab active" data-tab="world">🌍 Reloj mundial</div>
        <div class="clock-tab" data-tab="alarms">⏰ Alarmas</div>
        <div class="clock-tab" data-tab="stopwatch">⏱️ Cronómetro</div>
        <div class="clock-tab" data-tab="timer">⏳ Temporizador</div>
      </div>
      <div class="clock-panel" id="clockPanel_${ws.id}"></div>
    </div>`;
    const panel = $("#clockPanel_"+ws.id);

    function renderWorld(){
      const now = new Date();
      panel.innerHTML = `<div class="world-clock-item"><div><strong>Local</strong><div style="font-size:11px;color:var(--text-3);">${formatFullDate(now)}</div></div><div class="alarm-time">${formatTime(now)}</div></div>
        ${WORLD_CITIES.map(c=>{
          const local = new Date(now.getTime() + (c.offset*60 - now.getTimezoneOffset())*60000);
          return `<div class="world-clock-item"><div><strong>${c.city}</strong><div style="font-size:11px;color:var(--text-3);">UTC${c.offset>=0?"+":""}${c.offset}</div></div><div class="alarm-time">${formatTime(local)}</div></div>`;
        }).join("")}`;
    }
    function renderAlarms(){
      panel.innerHTML = state.alarms.map(a=>`<div class="alarm-item" data-id="${a.id}">
        <div><div class="alarm-time">${a.time}</div><div class="alarm-label">${escapeHtml(a.label)}</div></div>
        <div class="toggle-switch${a.on?" on":""}" data-alarmtoggle="${a.id}"></div>
      </div>`).join("") + `<button class="app-btn primary" id="addAlarmBtn_${ws.id}" style="margin-top:10px;">+ Añadir alarma</button>`;
      $$("[data-alarmtoggle]",panel).forEach(t=> t.addEventListener("click",()=>{
        const a = state.alarms.find(x=>x.id===t.dataset.alarmtoggle);
        a.on=!a.on; SoundEngine.toggleOn(); renderAlarms();
      }));
      $("#addAlarmBtn_"+ws.id).addEventListener("click",()=>{
        const t = prompt("Hora de la alarma (HH:MM):","08:00");
        if(t) { state.alarms.push({id:uid("al"),time:t,label:"Nueva alarma",on:true}); renderAlarms(); }
      });
    }
    function fmtStopwatch(ms){
      const totalSec = Math.floor(ms/1000);
      const m=Math.floor(totalSec/60), s=totalSec%60, cs=Math.floor((ms%1000)/10);
      return pad2(m)+":"+pad2(s)+"."+pad2(cs);
    }
    let swInterval=null;
    function renderStopwatch(){
      const sw = state.stopwatch;
      panel.innerHTML = `<div class="clock-big-display" id="swDisplay_${ws.id}">${fmtStopwatch(sw.elapsed)}</div>
        <div class="clock-controls">
          <button class="round-btn primary" id="swStartStop_${ws.id}">${sw.running?"Detener":"Iniciar"}</button>
          <button class="round-btn" id="swLap_${ws.id}">Vuelta</button>
          <button class="round-btn" id="swReset_${ws.id}">Reiniciar</button>
        </div>
        <div style="margin-top:20px;">${sw.laps.map((l,i)=>`<div class="timer-lap"><span>Vuelta ${i+1}</span><span>${fmtStopwatch(l)}</span></div>`).join("")}</div>`;
      $("#swStartStop_"+ws.id).addEventListener("click",()=>{
        sw.running = !sw.running;
        SoundEngine.click();
        if(sw.running){ sw.startedAt = Date.now()-sw.elapsed; swInterval=setInterval(()=>{ sw.elapsed=Date.now()-sw.startedAt; $("#swDisplay_"+ws.id).textContent=fmtStopwatch(sw.elapsed); },31); }
        else clearInterval(swInterval);
        renderStopwatch();
      });
      $("#swLap_"+ws.id).addEventListener("click",()=>{ if(sw.running){ sw.laps.unshift(sw.elapsed); renderStopwatch(); } });
      $("#swReset_"+ws.id).addEventListener("click",()=>{ clearInterval(swInterval); sw.running=false; sw.elapsed=0; sw.laps=[]; renderStopwatch(); });
    }
    let timerInterval=null;
    function fmtTimer(sec){ const m=Math.floor(sec/60), s=sec%60; return pad2(m)+":"+pad2(s); }
    function renderTimer(){
      const tm = state.timer;
      panel.innerHTML = `<div class="clock-big-display" id="tmDisplay_${ws.id}">${fmtTimer(tm.remaining)}</div>
        <div style="display:flex;justify-content:center;gap:8px;margin-bottom:16px;">
          ${[60,300,600,1800].map(s=>`<button class="app-btn" data-preset="${s}">${s/60} min</button>`).join("")}
        </div>
        <div class="clock-controls">
          <button class="round-btn primary" id="tmStartStop_${ws.id}">${tm.running?"Pausar":"Iniciar"}</button>
          <button class="round-btn" id="tmReset_${ws.id}">Reiniciar</button>
        </div>`;
      $$("[data-preset]",panel).forEach(b=> b.addEventListener("click",()=>{
        tm.total=+b.dataset.preset; tm.remaining=tm.total; renderTimer();
      }));
      $("#tmStartStop_"+ws.id).addEventListener("click",()=>{
        tm.running=!tm.running; SoundEngine.click();
        if(tm.running){
          timerInterval = setInterval(()=>{
            tm.remaining--;
            if(tm.remaining<=0){
              clearInterval(timerInterval); tm.running=false; tm.remaining=0;
              NotificationCenter.push({title:"Temporizador finalizado",msg:"El tiempo configurado ha terminado.",icon:"⏳",app:"Reloj"});
              SoundEngine.notify();
            }
            $("#tmDisplay_"+ws.id).textContent = fmtTimer(tm.remaining);
          },1000);
        } else clearInterval(timerInterval);
        renderTimer();
      });
      $("#tmReset_"+ws.id).addEventListener("click",()=>{ clearInterval(timerInterval); tm.running=false; tm.remaining=tm.total; renderTimer(); });
    }
    const RENDERERS = {world:renderWorld, alarms:renderAlarms, stopwatch:renderStopwatch, timer:renderTimer};
    $$(".clock-tab",body).forEach(tab=> tab.addEventListener("click",()=>{
      state.tab = tab.dataset.tab;
      $$(".clock-tab",body).forEach(t=>t.classList.toggle("active",t===tab));
      (RENDERERS[state.tab])();
    }));
    document.addEventListener("os:clocktick",()=>{ if(state.tab==="world" && OS.windows[ws.id]) renderWorld(); });
    renderWorld();
    ws.onClose = ()=>{ clearInterval(swInterval); clearInterval(timerInterval); };
  }
  APP_REGISTRY.clock = {name:"Reloj", icon:"🕐", width:420, height:520, render};
})();

/* ============================================================================
   21k. APLICACIÓN — CALENDARIO
============================================================================ */
(function registerCalendar(){
  function render(body, ws){
    const state = {viewDate: new Date()};
    body.innerHTML = `<div class="cal-root">
      <div class="cal-header">
        <div class="cal-title" id="calTitle_${ws.id}"></div>
        <div class="cal-nav">
          <button class="app-icon-btn" data-a="prev">‹</button>
          <button class="app-icon-btn" data-a="today">●</button>
          <button class="app-icon-btn" data-a="next">›</button>
        </div>
      </div>
      <div class="cal-grid-wrap"><div class="cal-grid" id="calGrid_${ws.id}"></div></div>
    </div>`;
    function refresh(){
      const d = state.viewDate;
      $("#calTitle_"+ws.id).textContent = MONTHS[d.getMonth()].charAt(0).toUpperCase()+MONTHS[d.getMonth()].slice(1)+" de "+d.getFullYear();
      const first = new Date(d.getFullYear(),d.getMonth(),1);
      const startDow = first.getDay();
      const daysInMonth = new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
      const daysInPrevMonth = new Date(d.getFullYear(),d.getMonth(),0).getDate();
      const today = new Date();
      let html = WEEKDAYS_SHORT.map(w=>`<div class="cal-dow">${w}</div>`).join("");
      for(let i=0;i<startDow;i++) html += `<div class="cal-day other"><div class="cal-day-num">${daysInPrevMonth-startDow+i+1}</div></div>`;
      for(let day=1; day<=daysInMonth; day++){
        const isToday = day===today.getDate() && d.getMonth()===today.getMonth() && d.getFullYear()===today.getFullYear();
        const hasEvent = (day%7===0 || day===15);
        html += `<div class="cal-day${isToday?" today":""}"><div class="cal-day-num">${day}</div>${hasEvent?'<div class="cal-event-dot"></div>':""}</div>`;
      }
      $("#calGrid_"+ws.id).innerHTML = html;
    }
    $(".cal-nav",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="prev") state.viewDate = new Date(state.viewDate.getFullYear(),state.viewDate.getMonth()-1,1);
      if(btn.dataset.a==="next") state.viewDate = new Date(state.viewDate.getFullYear(),state.viewDate.getMonth()+1,1);
      if(btn.dataset.a==="today") state.viewDate = new Date();
      refresh();
    });
    refresh();
  }
  APP_REGISTRY.calendar = {name:"Calendario", icon:"📅", width:640, height:560, render};
})();

/* ============================================================================
   21l. APLICACIÓN — TIENDA DE APLICACIONES
============================================================================ */
(function registerStore(){
  const STORE_APPS = [
    {id:"spotify-like", name:"Music Stream", icon:"🎧", cat:"Música"},
    {id:"photoedit", name:"PhotoEdit Pro", icon:"🖌️", cat:"Fotografía"},
    {id:"taskflow", name:"TaskFlow", icon:"✅", cat:"Productividad"},
    {id:"chatconnect", name:"ChatConnect", icon:"💬", cat:"Social"},
    {id:"codeide", name:"CodeIDE Lite", icon:"💻", cat:"Desarrollo"},
    {id:"videoedit", name:"VideoEdit Studio", icon:"🎬", cat:"Vídeo"},
    {id:"fitnesstrack", name:"FitTrack", icon:"🏃", cat:"Salud"},
    {id:"cloudnotes", name:"CloudNotes", icon:"🗒️", cat:"Productividad"}
  ];
  function render(body, ws){
    body.innerHTML = `<div class="app-root" style="padding:20px;overflow:auto;display:block;">
      <div class="store-hero"><h2>Descubre nuevas aplicaciones</h2><p>Una selección de apps ficticias para esta simulación educativa.</p></div>
      <div class="store-app-grid" id="storeGrid_${ws.id}"></div>
    </div>`;
    const grid = $("#storeGrid_"+ws.id);
    grid.innerHTML = STORE_APPS.map(a=>`
      <div class="store-app-card">
        <div class="store-app-icon">${a.icon}</div>
        <div class="store-app-name">${a.name}</div>
        <div class="store-app-cat">${a.cat}</div>
        <button class="store-install-btn${OS.installedApps.includes(a.id)?" installed":""}" data-id="${a.id}">${OS.installedApps.includes(a.id)?"Instalado ✓":"Instalar"}</button>
        <div class="store-progress" id="prog_${a.id}_${ws.id}"><div class="store-progress-fill"></div></div>
      </div>`).join("");
    grid.addEventListener("click",(e)=>{
      const btn = e.target.closest(".store-install-btn"); if(!btn || btn.classList.contains("installed")) return;
      const id = btn.dataset.id;
      const progWrap = $("#prog_"+id+"_"+ws.id);
      progWrap.classList.add("show");
      const fill = $(".store-progress-fill",progWrap);
      let p=0;
      btn.textContent = "Instalando…"; btn.disabled=true;
      const iv = setInterval(()=>{
        p += Math.random()*22+10;
        fill.style.width = Math.min(100,p)+"%";
        if(p>=100){
          clearInterval(iv);
          btn.textContent="Instalado ✓"; btn.classList.add("installed"); btn.disabled=false;
          OS.installedApps.push(id);
          NotificationCenter.push({title:"Instalación completa",msg:(STORE_APPS.find(a=>a.id===id)||{}).name+" se instaló correctamente.",icon:"✅",app:"Tienda"});
        }
      },180);
    });
  }
  APP_REGISTRY.store = {name:"Tienda", icon:"🛍️", width:760, height:580, render};
})();

/* ============================================================================
   21m. APLICACIÓN — ASISTENTE DE IA (COPILOTO)
============================================================================ */
(function registerAIAssistant(){
  const SUGGESTIONS = ["Organiza mi escritorio","¿Qué aplicaciones tengo abiertas?","Cambia el fondo de pantalla","Cuéntame un dato curioso","Ayúdame con la Terminal"];
  const RESPONSES = [
    {k:["hola","buenas","hey"], r:"¡Hola! Soy el asistente de IA de esta simulación de Windows 12. ¿En qué puedo ayudarte hoy?"},
    {k:["nombre","quien eres","quién eres"], r:"Soy un asistente de inteligencia artificial simulado, integrado en el sistema para ayudarte a navegar por las aplicaciones."},
    {k:["hora"], r:"Ahora mismo son las "+formatTime(new Date())+"."},
    {k:["fecha","dia es hoy","día es hoy"], r:"Hoy es "+formatFullDate(new Date())+"."},
    {k:["abre calculadora","abrir calculadora","calculadora"], r:"Abriendo la Calculadora…", action:()=>AppManager.open("calculator",{})},
    {k:["abre terminal","abrir terminal","terminal"], r:"Abriendo la Terminal…", action:()=>AppManager.open("terminal",{})},
    {k:["abre configuracion","abrir configuración","ajustes"], r:"Abriendo Configuración…", action:()=>AppManager.open("settings",{})},
    {k:["organiza mi escritorio","organizar escritorio"], r:"He ordenado tus iconos por nombre en el escritorio.", action:()=>{ const d=FS.get("desktop"); d.children.sort((a,b)=>FS.get(a).name.localeCompare(FS.get(b).name)); DesktopIcons.render(); }},
    {k:["cambia el fondo","cambiar fondo","fondo de pantalla"], r:"He cambiado tu fondo de pantalla por otro de la colección.", action:()=>{
      const ids = Object.keys(WALLPAPERS); const next = ids[(ids.indexOf(OS.wallpaperId)+1)%ids.length]; WallpaperManager.apply(next);
    }},
    {k:["dato curioso","curiosidad"], r:"Dato curioso: el primer sistema operativo con interfaz gráfica ampliamente comercializado fue el Xerox Alto en 1973, mucho antes que Windows o macOS."},
    {k:["gracias"], r:"¡De nada! Aquí estaré si necesitas algo más."},
    {k:["ayuda","help"], r:"Puedo abrir aplicaciones, cambiar ajustes básicos, contarte la hora/fecha o simplemente charlar. Prueba a pedirme algo como 'abre la calculadora'."}
  ];
  function findResponse(text){
    const lower = text.toLowerCase();
    const match = RESPONSES.find(r=> r.k.some(k=>lower.includes(k)));
    if(match) return match;
    const generic = [
      "Interesante. Cuéntame más sobre eso.",
      "Entiendo. Ten en cuenta que esta es una IA simulada con respuestas predefinidas para fines educativos.",
      "No tengo una respuesta específica para eso, pero puedo ayudarte a abrir aplicaciones o cambiar configuraciones del sistema.",
      "¡Buena pregunta! En esta simulación mis respuestas son limitadas, pero intento ser útil."
    ];
    return {r: generic[Math.floor(Math.random()*generic.length)]};
  }
  function render(body, ws){
    body.innerHTML = `<div class="ai-chat-root">
      <div class="ai-chat-messages" id="aiMsgs_${ws.id}"></div>
      <div class="ai-chat-suggestions" id="aiSugg_${ws.id}">
        ${SUGGESTIONS.map(s=>`<div class="ai-suggestion-chip">${s}</div>`).join("")}
      </div>
      <div class="ai-chat-input-row">
        <input type="text" class="ai-chat-input" id="aiInput_${ws.id}" placeholder="Escribe un mensaje…">
        <button class="ai-chat-send" id="aiSend_${ws.id}">➤</button>
      </div>
    </div>`;
    const msgs = $("#aiMsgs_"+ws.id);
    function addMsg(text,who){
      const m = el("div","ai-msg "+who,escapeHtml(text));
      msgs.appendChild(m); msgs.scrollTop = msgs.scrollHeight;
    }
    function botReply(text){
      const typing = el("div","ai-msg bot ai-typing","<span></span><span></span><span></span>");
      msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
      setTimeout(()=>{
        typing.remove();
        const res = findResponse(text);
        addMsg(res.r,"bot");
        if(res.action) res.action();
      }, 500+Math.random()*500);
    }
    function send(){
      const input = $("#aiInput_"+ws.id);
      const text = input.value.trim();
      if(!text) return;
      addMsg(text,"user");
      input.value="";
      botReply(text);
    }
    addMsg("Hola, soy tu asistente de IA integrado. Pregúntame algo o pide que abra una aplicación.","bot");
    $("#aiSend_"+ws.id).addEventListener("click",send);
    $("#aiInput_"+ws.id).addEventListener("keydown",(e)=>{ e.stopPropagation(); if(e.key==="Enter") send(); });
    $("#aiSugg_"+ws.id).addEventListener("click",(e)=>{
      const chip = e.target.closest(".ai-suggestion-chip"); if(!chip) return;
      $("#aiInput_"+ws.id).value = chip.textContent;
      send();
    });
  }
  APP_REGISTRY.aiAssistant = {name:"Copiloto IA", icon:"✨", width:420, height:600, render};
})();

/* ============================================================================
   21n. APLICACIÓN — CORREO
============================================================================ */
(function registerMail(){
  const MAILS = [
    {id:1,from:"Equipo Windows 12",subject:"Bienvenido a tu nuevo correo",preview:"Gracias por probar esta simulación…",time:"09:12",unread:true,
      body:"Hola,\n\nGracias por explorar esta simulación conceptual de Windows 12. Esta aplicación de correo es completamente ficticia y funciona con datos de ejemplo, sin conexión a servidores reales.\n\nSaludos,\nEl equipo del proyecto"},
    {id:2,from:"Notificaciones",subject:"Tu prueba gratuita está activa",preview:"Disfruta de todas las funciones premium…",time:"Ayer",unread:true,
      body:"Tu periodo de prueba está activo hasta el final de esta simulación educativa. No se requiere ninguna acción por tu parte."},
    {id:3,from:"Boletín semanal",subject:"Novedades de la semana",preview:"Estas son las novedades más destacadas…",time:"Lunes",unread:false,
      body:"Esta semana en el ecosistema simulado:\n- Mejoras de rendimiento\n- Nuevos fondos de pantalla\n- Corrección de errores menores"},
    {id:4,from:"Soporte técnico",subject:"¿Cómo podemos ayudarte?",preview:"Estamos aquí para resolver tus dudas…",time:"Martes",unread:false,
      body:"Si tienes alguna duda sobre el funcionamiento de esta simulación, recuerda que todo el contenido es educativo y se ejecuta enteramente en tu navegador."}
  ];
  function render(body, ws){
    body.innerHTML = `<div class="mail-root">
      <div class="mail-list" id="mailList_${ws.id}"></div>
      <div class="mail-reader" id="mailReader_${ws.id}"></div>
    </div>`;
    let activeId = MAILS[0].id;
    function renderList(){
      $("#mailList_"+ws.id).innerHTML = MAILS.map(m=>`
        <div class="mail-item${m.unread?" unread":""}${m.id===activeId?" active":""}" data-id="${m.id}">
          <span class="mail-time">${m.time}</span>
          <div class="mail-from">${escapeHtml(m.from)}</div>
          <div class="mail-subject">${escapeHtml(m.subject)}</div>
          <div class="mail-preview">${escapeHtml(m.preview)}</div>
        </div>`).join("");
      $$(".mail-item",body).forEach(item=> item.addEventListener("click",()=>{
        activeId = +item.dataset.id;
        const mail = MAILS.find(m=>m.id===activeId);
        mail.unread=false;
        renderList(); renderReader();
      }));
    }
    function renderReader(){
      const mail = MAILS.find(m=>m.id===activeId);
      $("#mailReader_"+ws.id).innerHTML = `<h2>${escapeHtml(mail.subject)}</h2>
        <div class="mail-reader-meta">De: ${escapeHtml(mail.from)} · ${mail.time}</div>
        <div class="mail-reader-body">${escapeHtml(mail.body).replace(/\n/g,"<br>")}</div>`;
    }
    renderList(); renderReader();
  }
  APP_REGISTRY.mail = {name:"Correo", icon:"📧", width:820, height:560, render};
})();

/* ============================================================================
   21o. APLICACIÓN — CONTACTOS
============================================================================ */
(function registerContacts(){
  const CONTACTS = [
    {id:1,name:"Ana García",role:"Diseñadora UX",email:"ana.garcia@correo-ejemplo.com",phone:"+34 600 111 222"},
    {id:2,name:"Carlos Ruiz",role:"Desarrollador",email:"carlos.ruiz@correo-ejemplo.com",phone:"+34 600 333 444"},
    {id:3,name:"Lucía Fernández",role:"Gerente de producto",email:"lucia.fernandez@correo-ejemplo.com",phone:"+34 600 555 666"},
    {id:4,name:"Diego Torres",role:"Soporte técnico",email:"diego.torres@correo-ejemplo.com",phone:"+34 600 777 888"}
  ];
  function initials(name){ return name.split(" ").map(w=>w[0]).slice(0,2).join(""); }
  function render(body, ws){
    body.innerHTML = `<div class="contacts-root">
      <div class="contacts-list" id="contactsList_${ws.id}"></div>
      <div class="contact-detail" id="contactDetail_${ws.id}"></div>
    </div>`;
    let activeId = CONTACTS[0].id;
    function renderList(){
      $("#contactsList_"+ws.id).innerHTML = CONTACTS.map(c=>`
        <div class="contact-item${c.id===activeId?" active":""}" data-id="${c.id}" style="background:${c.id===activeId?'var(--surface-active)':''}">
          <div class="contact-avatar">${initials(c.name)}</div><div>${escapeHtml(c.name)}</div>
        </div>`).join("");
      $$(".contact-item",body).forEach(item=> item.addEventListener("click",()=>{ activeId=+item.dataset.id; renderList(); renderDetail(); }));
    }
    function renderDetail(){
      const c = CONTACTS.find(x=>x.id===activeId);
      $("#contactDetail_"+ws.id).innerHTML = `
        <div class="contact-avatar cd-avatar">${initials(c.name)}</div>
        <h2>${escapeHtml(c.name)}</h2>
        <div style="color:var(--text-3);font-size:12.5px;">${escapeHtml(c.role)}</div>
        <div class="contact-detail-row">✉️ ${escapeHtml(c.email)}</div>
        <div class="contact-detail-row">📞 ${escapeHtml(c.phone)}</div>`;
    }
    renderList(); renderDetail();
  }
  APP_REGISTRY.contacts = {name:"Contactos", icon:"👥", width:640, height:520, render};
})();

/* ============================================================================
   21p. APLICACIÓN — CLIMA
============================================================================ */
(function registerWeather(){
  const CITIES = {
    "Madrid":{temp:24,cond:"Soleado",icon:"☀️",days:[["Lun",25,"☀️"],["Mar",23,"⛅"],["Mié",21,"🌦️"],["Jue",22,"☀️"],["Vie",26,"☀️"]]},
    "Buenos Aires":{temp:18,cond:"Parcialmente nublado",icon:"⛅",days:[["Lun",17,"⛅"],["Mar",19,"☀️"],["Mié",16,"🌧️"],["Jue",18,"⛅"],["Vie",20,"☀️"]]},
    "Ciudad de México":{temp:21,cond:"Lluvia ligera",icon:"🌦️",days:[["Lun",20,"🌦️"],["Mar",22,"⛅"],["Mié",23,"☀️"],["Jue",19,"🌧️"],["Vie",21,"⛅"]]},
    "Tokio":{temp:27,cond:"Húmedo",icon:"🌤️",days:[["Lun",28,"🌤️"],["Mar",29,"☀️"],["Mié",26,"🌧️"],["Jue",27,"⛅"],["Vie",28,"☀️"]]}
  };
  function render(body, ws){
    let city = "Madrid";
    body.innerHTML = `<div class="weather-root">
      <select class="weather-city-select" id="weatherCitySelect_${ws.id}">${Object.keys(CITIES).map(c=>`<option value="${c}">${c}</option>`).join("")}</select>
      <div id="weatherMain_${ws.id}"></div>
    </div>`;
    function refresh(){
      const w = CITIES[city];
      $("#weatherMain_"+ws.id).innerHTML = `
        <div class="weather-hero">
          <div class="wh-icon">${w.icon}</div>
          <div class="wh-temp">${w.temp}°C</div>
          <div>${w.cond} · ${city}</div>
        </div>
        <div class="weather-days-row">
          ${w.days.map(([d,t,i])=>`<div class="weather-day-card"><div>${d}</div><div style="font-size:22px;margin:6px 0;">${i}</div><div>${t}°</div></div>`).join("")}
        </div>`;
    }
    $("#weatherCitySelect_"+ws.id).addEventListener("change",(e)=>{ city=e.target.value; refresh(); });
    refresh();
  }
  APP_REGISTRY.weather = {name:"Clima", icon:"⛅", width:520, height:540, render};
})();

/* ============================================================================
   21q. APLICACIÓN — NOTICIAS
============================================================================ */
(function registerNews(){
  const NEWS = [
    {cat:"Tecnología",icon:"💻",title:"El diseño Fluent evoluciona hacia interfaces más adaptativas",desc:"Los sistemas modernos apuestan por transparencias y materiales dinámicos que reaccionan al contenido."},
    {cat:"Ciencia",icon:"🔭",title:"Nuevas observaciones amplían el catálogo de exoplanetas",desc:"Un equipo internacional presenta datos sobre mundos potencialmente habitables."},
    {cat:"Economía",icon:"📈",title:"Los mercados tecnológicos muestran señales de estabilidad",desc:"Analistas destacan un trimestre con crecimiento moderado en el sector."},
    {cat:"Cultura",icon:"🎨",title:"El arte generado con asistencia de IA gana espacio en galerías",desc:"Museos de varias ciudades incorporan piezas híbridas humano-máquina."},
    {cat:"Deportes",icon:"🏆",title:"Un cierre de temporada histórico atrapa a los aficionados",desc:"La definición se resolvió en los últimos minutos ante un estadio repleto."},
    {cat:"Tecnología",icon:"🤖",title:"Los asistentes conversacionales se integran en más sistemas operativos",desc:"La tendencia busca simplificar tareas cotidianas mediante lenguaje natural."}
  ];
  function render(body, ws){
    const cats = ["Todas",...new Set(NEWS.map(n=>n.cat))];
    let activeCat = "Todas";
    body.innerHTML = `<div class="news-root">
      <div class="news-cats" id="newsCats_${ws.id}">${cats.map(c=>`<div class="news-cat-chip${c==="Todas"?" active":""}" data-cat="${c}">${c}</div>`).join("")}</div>
      <div id="newsList_${ws.id}"></div>
    </div>`;
    function refresh(){
      const items = activeCat==="Todas" ? NEWS : NEWS.filter(n=>n.cat===activeCat);
      $("#newsList_"+ws.id).innerHTML = items.map(n=>`
        <div class="news-card"><div class="news-card-thumb">${n.icon}</div><div><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.desc)}</p><span style="font-size:10.5px;color:var(--text-3);">${n.cat}</span></div></div>`).join("");
    }
    $("#newsCats_"+ws.id).addEventListener("click",(e)=>{
      const chip = e.target.closest(".news-cat-chip"); if(!chip) return;
      activeCat = chip.dataset.cat;
      $$(".news-cat-chip",body).forEach(c=>c.classList.toggle("active",c===chip));
      refresh();
    });
    refresh();
  }
  APP_REGISTRY.news = {name:"Noticias", icon:"📰", width:640, height:600, render};
})();

/* ============================================================================
   21r. APLICACIÓN — GALERÍA / VISOR DE IMÁGENES
============================================================================ */
(function registerGallery(){
  function render(body, ws){
    const images = FS.getChildren("pictures").filter(n=>n.kind==="image");
    body.innerHTML = `<div class="gallery-root"><div class="gallery-grid" id="galGrid_${ws.id}"></div></div>`;
    $("#galGrid_"+ws.id).innerHTML = images.map(img=>`<div class="gallery-thumb" data-id="${img.id}" style="background:var(--surface-2);">${img.content||"🖼️"}</div>`).join("")
      || `<div class="empty-state"><span class="es-icon">🖼️</span><p>No hay imágenes en la biblioteca</p></div>`;
    $$(".gallery-thumb",body).forEach(t=> t.addEventListener("click",()=> AppManager.open("imageViewer",{fileId:t.dataset.id})));
  }
  APP_REGISTRY.gallery = {name:"Galería", icon:"🖼️", width:700, height:520, render};
})();
(function registerImageViewer(){
  function render(body, ws, params){
    const images = FS.getChildren("pictures").filter(n=>n.kind==="image");
    let index = Math.max(0, images.findIndex(i=>i.id===params.fileId));
    if(index<0) index=0;
    body.innerHTML = `<div class="image-viewer-root">
      <div class="image-viewer-stage" id="ivStage_${ws.id}"></div>
      <div class="image-viewer-bar">
        <button class="app-icon-btn" data-a="prev" style="color:#fff;">‹</button>
        <span style="color:#fff;font-size:12px;align-self:center;" id="ivName_${ws.id}"></span>
        <button class="app-icon-btn" data-a="next" style="color:#fff;">›</button>
        <button class="app-icon-btn" data-a="setwallpaper" style="color:#fff;" title="Establecer como fondo">🖼️ Establecer como fondo</button>
      </div>
    </div>`;
    function refresh(){
      const img = images[index];
      if(!img){ $("#ivStage_"+ws.id).textContent="📭"; return; }
      $("#ivStage_"+ws.id).textContent = img.content || "🖼️";
      $("#ivName_"+ws.id).textContent = img.name;
      WindowManager.setWindowTitle(ws.id, img.name+" - Visor de fotos");
    }
    $(".image-viewer-bar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="prev") index=(index-1+images.length)%images.length;
      if(btn.dataset.a==="next") index=(index+1)%images.length;
      if(btn.dataset.a==="setwallpaper") Toast.show({title:"Fondo actualizado",msg:"Se aplicó una imagen de muestra como ambiente decorativo.",icon:"🖼️"});
      refresh();
    });
    refresh();
  }
  APP_REGISTRY.imageViewer = {name:"Visor de fotos", icon:"🖼️", width:640, height:520, render};
})();

/* ============================================================================
   21s. APLICACIÓN — REPRODUCTOR MULTIMEDIA
============================================================================ */
(function registerMediaPlayer(){
  function render(body, ws, params){
    const tracks = FS.getChildren("music");
    let index = params.fileId ? Math.max(0,tracks.findIndex(t=>t.id===params.fileId)) : 0;
    let playing=false, progress=0, iv=null;
    body.innerHTML = `<div class="media-root">
      <div class="media-art" id="mpArt_${ws.id}">🎵</div>
      <div style="text-align:center;">
        <div class="media-title" id="mpTitle_${ws.id}"></div>
        <div class="media-artist">Artista desconocido · Álbum simulado</div>
      </div>
      <div class="media-progress"><div class="media-progress-fill" id="mpFill_${ws.id}"></div></div>
      <div class="media-time-row"><span id="mpCur_${ws.id}">0:00</span><span id="mpDur_${ws.id}">3:24</span></div>
      <div class="media-controls">
        <button class="media-ctrl-btn" data-a="prev">⏮</button>
        <button class="media-ctrl-btn play" data-a="play" id="mpPlayBtn_${ws.id}">▶</button>
        <button class="media-ctrl-btn" data-a="next">⏭</button>
      </div>
    </div>`;
    function fmt(sec){ return Math.floor(sec/60)+":"+pad2(Math.floor(sec%60)); }
    function refresh(){
      const t = tracks[index] || {name:"Sin pistas"};
      $("#mpTitle_"+ws.id).textContent = t.name.replace(/\.[a-z0-9]+$/i,"");
      WindowManager.setWindowTitle(ws.id, t.name+" - Reproductor multimedia");
    }
    function tick(){
      progress += 1/204;
      if(progress>=1){ progress=0; next(); }
      $("#mpFill_"+ws.id).style.width=(progress*100)+"%";
      $("#mpCur_"+ws.id).textContent = fmt(progress*204);
    }
    function playPause(){
      playing=!playing;
      $("#mpPlayBtn_"+ws.id).textContent = playing?"⏸":"▶";
      $("#mpArt_"+ws.id).classList.toggle("playing",playing);
      if(playing) iv=setInterval(tick,1000); else clearInterval(iv);
    }
    function next(){ index=(index+1)%Math.max(1,tracks.length); progress=0; refresh(); }
    function prev(){ index=(index-1+tracks.length)%Math.max(1,tracks.length); progress=0; refresh(); }
    $(".media-controls",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="play") playPause();
      if(btn.dataset.a==="next") next();
      if(btn.dataset.a==="prev") prev();
    });
    refresh();
    ws.onClose = ()=> clearInterval(iv);
  }
  APP_REGISTRY.mediaPlayer = {name:"Reproductor multimedia", icon:"🎵", width:360, height:520, resizable:false, render};
})();

/* ============================================================================
   21t. APLICACIÓN — NAVEGADOR FICTICIO
============================================================================ */
(function registerBrowser(){
  const FAKE_RESULTS = (q)=>[
    {url:"www.fluentweb-ejemplo.com", title:q+" — Guía completa y actualizada", desc:"Todo lo que necesitas saber sobre "+q+", explicado paso a paso con ejemplos prácticos y recursos adicionales."},
    {url:"docs.simulacion-ejemplo.org", title:"Documentación: "+q, desc:"Referencia técnica detallada relacionada con "+q+", pensada para desarrolladores y curiosos."},
    {url:"wiki-conceptual.example", title:q+" — Artículo enciclopédico", desc:"Un resumen enciclopédico sobre "+q+" con historia, contexto y curiosidades destacadas."},
    {url:"foro-comunidad.example", title:"Discusión de la comunidad sobre "+q, desc:"Usuarios comparten opiniones y experiencias relacionadas con "+q+" en este hilo de la comunidad."}
  ];
  const SHORTCUTS = [["Correo","📧","mail"],["Noticias","📰","news"],["Clima","⛅","weather"],["Tienda","🛍️","store"],["Vídeos","🎬","mediaPlayer"],["Configuración","⚙️","settings"]];
  function render(body, ws){
    const state = {tabs:[{id:uid("tab"),title:"Nueva pestaña",url:""}], active:0};
    body.innerHTML = `<div class="browser-root">
      <div class="browser-tabs" id="browserTabs_${ws.id}"></div>
      <div class="browser-toolbar">
        <button class="app-icon-btn" data-a="back">←</button>
        <button class="app-icon-btn" data-a="fwd">→</button>
        <button class="app-icon-btn" data-a="reload">⟳</button>
        <div class="browser-address">
          <span>🔒</span>
          <input type="text" id="browserAddr_${ws.id}" placeholder="Buscar o escribir una dirección web">
        </div>
      </div>
      <div class="browser-content" id="browserContent_${ws.id}"></div>
    </div>`;
    function renderTabs(){
      $("#browserTabs_"+ws.id).innerHTML = state.tabs.map((t,i)=>`
        <div class="browser-tab${i===state.active?" active":""}" data-i="${i}">
          <span>🌐</span><span>${escapeHtml(t.title)}</span><span class="bt-close" data-close="${i}">✕</span>
        </div>`).join("") + `<button class="browser-new-tab" id="browserNewTab_${ws.id}">+</button>`;
    }
    function newTabPage(){
      return `<div class="browser-newtab-page">
        <div class="bnt-logo">🌐 <strong>StartPage</strong></div>
        <div class="browser-search-box"><span>🔍</span><input type="text" id="browserHomeSearch_${ws.id}" placeholder="Buscar en la web (simulado)"></div>
        <div class="browser-shortcuts">
          ${SHORTCUTS.map(([label,icon,appId])=>`<div class="browser-shortcut" data-openapp="${appId}"><div class="browser-shortcut-icon">${icon}</div><span>${label}</span></div>`).join("")}
        </div>
      </div>`;
    }
    function resultsPage(q){
      const results = FAKE_RESULTS(q);
      return `<div class="browser-results">
        <p style="color:#666;font-size:12px;margin-bottom:16px;">Resultados de ejemplo para "<strong>${escapeHtml(q)}</strong>" (contenido simulado, sin conexión real a internet)</p>
        ${results.map(r=>`<div class="browser-result"><div class="browser-result-url">${r.url}</div><div class="browser-result-title">${escapeHtml(r.title)}</div><div class="browser-result-desc">${escapeHtml(r.desc)}</div></div>`).join("")}
      </div>`;
    }
    function renderContent(){
      const tab = state.tabs[state.active];
      const contentBox = $("#browserContent_"+ws.id);
      $("#browserAddr_"+ws.id).value = tab.url;
      if(!tab.url){ contentBox.innerHTML = newTabPage(); wireHome(); }
      else contentBox.innerHTML = resultsPage(tab.url);
      WindowManager.setWindowTitle(ws.id, tab.title+" - Navegador");
    }
    function wireHome(){
      const input = $("#browserHomeSearch_"+ws.id);
      if(input) input.addEventListener("keydown",(e)=>{ e.stopPropagation(); if(e.key==="Enter") navigate(input.value); });
      $$("[data-openapp]",body).forEach(sc=> sc.addEventListener("click",()=> AppManager.open(sc.dataset.openapp,{})));
    }
    function navigate(q){
      if(!q.trim()) return;
      const tab = state.tabs[state.active];
      tab.url = q; tab.title = q.length>18?q.slice(0,18)+"…":q;
      renderTabs(); renderContent();
    }
    $(".browser-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="reload") renderContent();
      if(btn.dataset.a==="back" || btn.dataset.a==="fwd") Toast.show({title:"Navegador",msg:"No hay más historial en esta pestaña.",icon:"🌐"});
    });
    $("#browserAddr_"+ws.id).addEventListener("keydown",(e)=>{ e.stopPropagation(); if(e.key==="Enter") navigate(e.target.value); });
    body.addEventListener("click",(e)=>{
      const tabEl = e.target.closest(".browser-tab");
      const closeEl = e.target.closest(".bt-close");
      const newTabBtn = e.target.closest("#browserNewTab_"+ws.id);
      if(closeEl){
        const i = +closeEl.dataset.close;
        state.tabs.splice(i,1);
        if(!state.tabs.length) state.tabs.push({id:uid("tab"),title:"Nueva pestaña",url:""});
        state.active = Math.max(0,Math.min(state.active,state.tabs.length-1));
        renderTabs(); renderContent(); return;
      }
      if(newTabBtn){ state.tabs.push({id:uid("tab"),title:"Nueva pestaña",url:""}); state.active=state.tabs.length-1; renderTabs(); renderContent(); return; }
      if(tabEl){ state.active = +tabEl.dataset.i; renderTabs(); renderContent(); }
    });
    renderTabs(); renderContent();
  }
  APP_REGISTRY.browser = {name:"Navegador", icon:"🌐", width:900, height:620, render};
})();

/* ============================================================================
   21u. APLICACIÓN — CENTRO DE SEGURIDAD
============================================================================ */
(function registerSecurity(){
  function render(body, ws){
    body.innerHTML = `<div class="app-root" style="padding:20px;overflow:auto;display:block;">
      <div class="security-status-card">
        <div class="security-status-icon">🛡️</div>
        <div><h3 style="margin:0;">Tu dispositivo está protegido</h3><p style="font-size:12px;color:var(--text-3);margin-top:4px;">Última comprobación: hoy · Sin amenazas detectadas</p></div>
      </div>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Protección antivirus y contra amenazas</span><span class="settings-row-sub" style="color:var(--success);">Activa</span></div>${(function(){return `<div class="toggle-switch on"></div>`;})()}</div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Firewall de red</span><span class="settings-row-sub" style="color:var(--success);">Activo</span></div><div class="toggle-switch on"></div></div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Control de aplicaciones y navegador</span><span class="settings-row-sub" style="color:var(--success);">Activo</span></div><div class="toggle-switch on"></div></div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Protección familiar</span><span class="settings-row-sub">No configurada</span></div><div class="toggle-switch"></div></div>
      </div>
      <h3 style="font-size:14px;margin:18px 0 8px;color:var(--text-2);">Historial de análisis (simulado)</h3>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Análisis rápido</span><span class="settings-row-sub">Completado hoy · 0 amenazas</span></div></div>
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Análisis completo</span><span class="settings-row-sub">Completado hace 3 días · 0 amenazas</span></div></div>
      </div>
    </div>`;
    $$(".toggle-switch",body).forEach(t=> t.addEventListener("click",()=>{ t.classList.toggle("on"); SoundEngine.toggleOn(); }));
  }
  APP_REGISTRY.security = {name:"Centro de seguridad", icon:"🛡️", width:640, height:560, render};
})();

/* ============================================================================
   21v. APLICACIÓN — ADMINISTRADOR DE ALMACENAMIENTO
============================================================================ */
(function registerStorageManager(){
  function render(body, ws){
    const segments = [
      {label:"Sistema y aplicaciones", pct:24, color:"#0078d4"},
      {label:"Documentos", pct:10, color:"#60cdff"},
      {label:"Imágenes", pct:14, color:"#e0527a"},
      {label:"Vídeos", pct:16, color:"#8e5fe0"},
      {label:"Música", pct:6, color:"#e0a125"},
      {label:"Libre", pct:30, color:"var(--surface-hover)"}
    ];
    body.innerHTML = `<div class="app-root" style="padding:20px;overflow:auto;display:block;">
      <h2 style="margin-bottom:14px;">Almacenamiento — Disco local (C:)</h2>
      <div class="settings-card">
        <p style="font-size:12.5px;color:var(--text-2);margin-bottom:10px;">512 GB totales (simulado) · ${(512*0.3).toFixed(0)} GB libres</p>
        <div class="storage-bar-seg">${segments.map(s=>`<div style="width:${s.pct}%;background:${s.color};"></div>`).join("")}</div>
        <div class="storage-legend">${segments.map(s=>`<div class="storage-legend-item"><span class="storage-legend-dot" style="background:${s.color};"></span>${s.label} · ${(512*s.pct/100).toFixed(0)} GB</div>`).join("")}</div>
      </div>
      <h3 style="font-size:14px;margin:18px 0 8px;color:var(--text-2);">Herramientas</h3>
      <div class="settings-card">
        <div class="settings-row"><div class="settings-row-text"><span class="settings-row-title">Sentido de almacenamiento</span><span class="settings-row-sub">Libera espacio automáticamente</span></div><button class="app-btn" id="runCleanup_${ws.id}">Ejecutar ahora</button></div>
      </div>
    </div>`;
    $("#runCleanup_"+ws.id).addEventListener("click",()=>{
      Toast.show({title:"Limpieza completada",msg:"Se liberaron 2.4 GB de archivos temporales simulados.",icon:"🧹"});
    });
  }
  APP_REGISTRY.storageManager = {name:"Almacenamiento", icon:"💾", width:600, height:520, render};
})();

/* ============================================================================
   21w. APLICACIÓN — VISOR DE PDF (simulado)
============================================================================ */
(function registerPdfViewer(){
  function render(body, ws, params){
    const node = params.fileId ? FS.get(params.fileId) : FS.getChildren("downloads").find(n=>n.kind==="pdf");
    const pages = 3;
    let page=1;
    body.innerHTML = `<div class="app-root">
      <div class="app-toolbar">
        <button class="app-icon-btn" data-a="prev">‹</button>
        <span id="pdfPageLabel_${ws.id}" style="font-size:12.5px;"></span>
        <button class="app-icon-btn" data-a="next">›</button>
        <div class="app-sep-v"></div>
        <button class="app-btn" data-a="print">🖨️ Imprimir</button>
      </div>
      <div style="flex:1;overflow:auto;background:#525659;" id="pdfStage_${ws.id}"></div>
    </div>`;
    function refresh(){
      $("#pdfPageLabel_"+ws.id).textContent = "Página "+page+" de "+pages;
      $("#pdfStage_"+ws.id).innerHTML = `<div class="pdf-page">
        <h2 style="margin-bottom:14px;">${escapeHtml(node?node.name.replace(/\.pdf$/i,""):"Documento")}</h2>
        <p>Este es un visor de PDF simulado con fines educativos. El contenido mostrado es un marcador de posición generado localmente; no se ha cargado ningún archivo real.</p>
        <p style="margin-top:14px;color:#888;">— Página ${page} de ${pages} —</p>
      </div>`;
    }
    $(".app-toolbar",body).addEventListener("click",(e)=>{
      const btn = e.target.closest("[data-a]"); if(!btn) return;
      if(btn.dataset.a==="prev" && page>1){ page--; refresh(); }
      if(btn.dataset.a==="next" && page<pages){ page++; refresh(); }
      if(btn.dataset.a==="print") Toast.show({title:"Impresión",msg:"No hay impresoras configuradas en esta simulación.",icon:"🖨️"});
    });
    refresh();
  }
  APP_REGISTRY.pdfViewer = {name:"Visor de PDF", icon:"📕", width:560, height:640, render};
})();

/* ============================================================================
   21x. APLICACIÓN — GESTOR DE DESCARGAS
============================================================================ */
(function registerDownloads(){
  function render(body, ws){
    const files = FS.getChildren("downloads");
    body.innerHTML = `<div class="app-root" style="padding:16px;overflow:auto;display:block;">
      ${files.length ? files.map(f=>`
        <div class="downloads-item">
          <span style="font-size:24px;">${FS.icon_for(f)}</span>
          <div style="flex:1;">
            <div style="font-size:13px;">${escapeHtml(f.name)}</div>
            <div style="font-size:11px;color:var(--text-3);">${formatBytes(f.size||1200000)} · Completado</div>
          </div>
        </div>`).join("") : `<div class="empty-state"><span class="es-icon">⬇️</span><p>No hay descargas recientes</p></div>`}
    </div>`;
  }
  APP_REGISTRY.downloads = {name:"Descargas", icon:"⬇️", width:520, height:480, render};
})();

/* ============================================================================
   21y. APLICACIÓN — GRABADORA DE VOZ (simulada)
============================================================================ */
(function registerRecorder(){
  function render(body, ws){
    let recording=false, seconds=0, iv=null;
    body.innerHTML = `<div class="recorder-root">
      <div class="recorder-wave" id="recWave_${ws.id}">${Array.from({length:24}).map(()=>"<span></span>").join("")}</div>
      <div class="recorder-time" id="recTime_${ws.id}">00:00</div>
      <button class="round-btn primary" id="recBtn_${ws.id}" style="width:80px;height:80px;font-size:26px;">🎙️</button>
      <p style="color:var(--text-3);font-size:11.5px;">Grabación simulada — no se accede al micrófono real</p>
      <div id="recList_${ws.id}" style="width:100%;max-width:320px;"></div>
    </div>`;
    const recordings=[];
    function fmt(s){ return pad2(Math.floor(s/60))+":"+pad2(s%60); }
    function renderList(){
      $("#recList_"+ws.id).innerHTML = recordings.map((r,i)=>`<div class="downloads-item"><span>🎙️</span><div style="flex:1;">Grabación ${i+1}</div><span style="font-size:11px;color:var(--text-3);">${fmt(r)}</span></div>`).join("");
    }
    $("#recBtn_"+ws.id).addEventListener("click",()=>{
      recording=!recording;
      const btn = $("#recBtn_"+ws.id);
      btn.style.background = recording ? "var(--danger)" : "";
      if(recording){
        seconds=0;
        iv=setInterval(()=>{
          seconds++;
          $("#recTime_"+ws.id).textContent = fmt(seconds);
          $$("#recWave_"+ws.id+" span").forEach(s=> s.style.height = (6+Math.random()*46)+"px");
        },300);
      } else {
        clearInterval(iv);
        recordings.unshift(seconds);
        renderList();
        $$("#recWave_"+ws.id+" span").forEach(s=> s.style.height="10px");
      }
    });
    ws.onClose = ()=> clearInterval(iv);
  }
  APP_REGISTRY.recorder = {name:"Grabadora de voz", icon:"🎙️", width:380, height:480, resizable:false, render};
})();

/* ============================================================================
   21z. APLICACIÓN — CÁMARA (simulada)
============================================================================ */
(function registerCamera(){
  function render(body, ws){
    body.innerHTML = `<div class="camera-root">
      <div class="camera-viewfinder" id="camView_${ws.id}">
        <div class="camera-flash" id="camFlash_${ws.id}"></div>
        📷
      </div>
      <button class="camera-shutter" id="camShutter_${ws.id}"></button>
      <p style="color:rgba(255,255,255,.5);font-size:11.5px;">Cámara simulada — no se accede al hardware real</p>
    </div>`;
    $("#camShutter_"+ws.id).addEventListener("click",()=>{
      const flash = $("#camFlash_"+ws.id);
      flash.classList.add("flash");
      SoundEngine.click();
      setTimeout(()=>flash.classList.remove("flash"),320);
      const n = FS.createFile("pictures", FS.uniqueName("pictures","Foto.jpg"),"image","📷","jpg");
      DesktopIcons.render();
      Toast.show({title:"Foto capturada",msg:"Se guardó en Imágenes.",icon:"📷"});
    });
  }
  APP_REGISTRY.camera = {name:"Cámara", icon:"📷", width:520, height:520, resizable:false, render};
})();

/* ============================================================================
   22. INICIALIZACIÓN GENERAL DEL SISTEMA
   Este bloque es el que realmente "enciende" la simulación: conecta todos los
   módulos anteriores, pinta el escritorio y lanza la secuencia de arranque.
============================================================================ */
function wireGlobalTaskbarButtons(){
  $("#btnAI").addEventListener("click",(e)=>{
    e.stopPropagation();
    SoundEngine.click();
    closeAllFlyouts();
    AppManager.open("aiAssistant",{});
  });
}

function wireGlobalShortcuts(){
  document.addEventListener("keydown",(e)=>{
    // Ctrl+Espacio / Ctrl+Escape como alternativa accesible a la tecla Windows
    if((e.ctrlKey && e.key==="Escape") || (e.ctrlKey && e.code==="Space")){
      e.preventDefault();
      StartMenu.toggle();
    }
  });
  // Reanuda el contexto de audio en la primera interacción (política de autoplay de navegadores)
  const resumeAudio = ()=>{
    try{ SoundEngine.click.__warmed = true; }catch(err){}
    document.removeEventListener("pointerdown", resumeAudio);
    document.removeEventListener("keydown", resumeAudio);
  };
  document.addEventListener("pointerdown", resumeAudio, {once:true});
  document.addEventListener("keydown", resumeAudio, {once:true});
}

function handleViewportResize(){
  window.addEventListener("resize", debounce(()=>{
    // Mantiene las ventanas dentro de los límites visibles tras rotar / redimensionar
    Object.values(OS.windows).forEach(ws=>{
      if(ws.maximized){
        Object.assign(ws.el.style,{width:"100vw",height:"calc(100vh - 8px)"});
        return;
      }
      const maxW = window.innerWidth-16, maxH = window.innerHeight-16;
      if(ws.width>maxW){ ws.width=maxW; ws.el.style.width=maxW+"px"; }
      if(ws.height>maxH){ ws.height=maxH; ws.el.style.height=maxH+"px"; }
      if(ws.x+ws.width>window.innerWidth){ ws.x=Math.max(4,window.innerWidth-ws.width-4); ws.el.style.left=ws.x+"px"; }
      if(ws.y+ws.height>window.innerHeight){ ws.y=Math.max(4,window.innerHeight-ws.height-4); ws.el.style.top=ws.y+"px"; }
    });
  }, 200));
}

function initSystem(){
  // 1) Tema y fondo de pantalla por defecto
  ThemeManager.apply();
  WallpaperManager.apply(OS.wallpaperId);

  // 2) Escritorio: iconos + selección + menú contextual
  DesktopIcons.initDesktopSurface();
  DesktopIcons.render();

  // 3) Pantalla de bloqueo
  initLockScreen();

  // 4) Barra de tareas
  Taskbar.initAutohide();
  Taskbar.initTrayClock();
  Taskbar.syncRunning();
  wireGlobalTaskbarButtons();

  // 5) Flyouts / paneles del sistema
  StartMenu.initEvents();
  GlobalSearch.initEvents();
  ControlCenter.initEvents();
  NotificationCenter.initEvents();
  WidgetsPanel.initEvents();
  TaskView.initEvents();
  AltTabManager.initEvents();
  PowerModal.initEvents();

  // 6) Efectos, atajos y responsividad
  attachRipple(document.body);
  wireGlobalShortcuts();
  handleViewportResize();

  // 7) Notificación de bienvenida inicial (queda en el historial, no interrumpe el arranque)
  OS.notifications = [];

  // 8) Arranca la secuencia de arranque visual
  runBootSequence();
}

if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", initSystem);
} else {
  initSystem();
}
