import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  memoryLocalCache, 
  getFirestore 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAGMtO8p8GUuObANwL47LnX-GWNwVpViHY",
  authDomain: "hd-box-scanner.firebaseapp.com",
  projectId: "hd-box-scanner",
  storageBucket: "hd-box-scanner.firebasestorage.app",
  messagingSenderId: "661323757219",
  appId: "1:661323757219:web:629fab5c343a0274fbf116",
  measurementId: "G-E31EFSXW1C"
};

const app = initializeApp(firebaseConfig);

// Switching to memory cache temporarily to resolve Internal Assertion Errors
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

export const auth = getAuth(app);
getAnalytics(app);