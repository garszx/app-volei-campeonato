// firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Substitua com as chaves do seu projeto no Firebase Console
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Evita inicializar o Firebase mais de uma vez no Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Exporta o banco de dados em tempo real e o storage (para os brasões)
export const db = getDatabase(app);
export const storage = getStorage(app);