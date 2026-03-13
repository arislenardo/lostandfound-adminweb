import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC95ADsBG-L3HEsNj9uks0dK6JL4xwKQRE",
  authDomain: "lostandfound-e1333.firebaseapp.com",
  projectId: "lostandfound-e1333",
  storageBucket: "lostandfound-e1333.firebasestorage.app",
  messagingSenderId: "806374511294",
  appId: "1:806374511294:web:60cf1bae32791c4122c4ef",
  measurementId: "G-JR9Y9MHYJQ"
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
