/* ============================================================
   WebOS — firebase-config.js
   Inicializa Firebase y expone window.WebOSFirebase con:
     - registerUser(name, email, password)
     - loginUser(email, password)
     - logoutUser()
     - saveUserState(uid, stateData)
     - loadUserState(uid)
     - isConfigured
   script.js consume esta API para que cada cuenta guarde y recupere
   su propio sistema de archivos, configuración y apps instaladas.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Tu configuración de Firebase (proyecto "webos-2070c").
const firebaseConfig = {
  apiKey: "AIzaSyAJnMgfmNORB4QwHnDMxPHuRgNFxHevxC4",
  authDomain: "webos-2070c.firebaseapp.com",
  projectId: "webos-2070c",
  storageBucket: "webos-2070c.firebasestorage.app",
  messagingSenderId: "19886575046",
  appId: "1:19886575046:web:5667aa4ffa0bab9fbff6c7",
  measurementId: "G-JS4V8K9ZNE",
};

// Avatar simulado y determinístico a partir del UID, para no depender de
// Storage (subir fotos) en este proyecto educativo.
const AVATARS = ['🙂', '😎', '🚀', '🐱', '🦊', '🌙', '⭐', '🎮', '🐧', '🌸'];
function avatarForUid(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

let app = null;
let auth = null;
let db = null;
let configured = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  configured = true;
} catch (err) {
  console.error('WebOS: no se pudo inicializar Firebase.', err);
  configured = false;
}

/** Crea una cuenta nueva y su documento de usuario en Firestore. */
async function registerUser(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  const avatar = avatarForUid(cred.user.uid);
  await setDoc(doc(db, 'users', cred.user.uid), {
    profile: { name, avatar, email },
    state: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { uid: cred.user.uid, name, avatar };
}

/** Inicia sesión y devuelve el perfil guardado (nombre/avatar). */
async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  let name = cred.user.displayName || email.split('@')[0];
  let avatar = avatarForUid(cred.user.uid);
  try {
    const snap = await getDoc(doc(db, 'users', cred.user.uid));
    if (snap.exists() && snap.data().profile) {
      name = snap.data().profile.name || name;
      avatar = snap.data().profile.avatar || avatar;
    }
  } catch (err) {
    console.error('WebOS: no se pudo leer el perfil del usuario.', err);
  }
  return { uid: cred.user.uid, name, avatar };
}

function logoutUser() {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

/** Guarda (mezclando) el estado del sistema del usuario en Firestore. */
async function saveUserState(uid, stateData) {
  if (!db || !uid) return false;
  try {
    await setDoc(
      doc(db, 'users', uid),
      { state: stateData, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.error('WebOS: error al guardar el estado en Firestore.', err);
    return false;
  }
}

/** Recupera el último estado guardado del usuario, o null si no existe. */
async function loadUserState(uid) {
  if (!db || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().state || null;
    return null;
  } catch (err) {
    console.error('WebOS: error al cargar el estado desde Firestore.', err);
    return null;
  }
}

window.WebOSFirebase = {
  isConfigured: configured,
  registerUser,
  loginUser,
  logoutUser,
  saveUserState,
  loadUserState,
};

// Avisa a script.js (que se carga antes, por ser un script clásico) que
// Firebase ya terminó de inicializarse, por si necesita refrescar la UI.
window.dispatchEvent(new CustomEvent('webos-firebase-ready'));
