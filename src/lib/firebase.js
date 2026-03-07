import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDQJogtuT7BCuKCvhmD4pa2xmUWmiI4wZI",
  authDomain: "sourdough-8753c.firebaseapp.com",
  projectId: "sourdough-8753c",
  storageBucket: "sourdough-8753c.firebasestorage.app",
  messagingSenderId: "342720635191",
  appId: "1:342720635191:web:daa7a05e4232e484d8fab2",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
