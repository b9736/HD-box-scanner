import { initializeApp } from "firebase/app";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
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
export const db = getFirestore(app);
getAnalytics(app);

enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Persistence not supported by browser');
    }
});