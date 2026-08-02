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

  function createWindow(opts){
    const id = "win"+(OS.nextWinId++);
    const width = opts.width || 760;
    const height = opts.height || 520;
    const cascadeOffset = (OS.windowOrder.length % 8) * 26;
    const x = opts.x!==undefined ? opts.x : clamp(120+cascadeOffset, 20, window.innerWidth-width-20);
    const y = opts.y!==undefined ? opts.y : clamp(70+cascadeOffset, 20, window.innerHeight-height-100);

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
