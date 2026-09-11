
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";


const firebaseConfig = {
  apiKey: "AIzaSyCBJl9Mdd951HZKqVhSSuGkYMpkT-fiXQY",
  authDomain: "copa-blumenau.firebaseapp.com",
  projectId: "copa-blumenau",
  storageBucket: "copa-blumenau.firebasestorage.app",
  messagingSenderId: "260337873679",
  appId: "1:260337873679:web:466d1835fea7203e31047a",
  measurementId: "G-X6WB889Y5Z",
  
  databaseURL: "https://copa-blumenau-default-rtdb.firebaseio.com" 
};


const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];


export const db = getDatabase(app);