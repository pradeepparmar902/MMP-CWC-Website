import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC5fpnnlP8h062_E5Z6WLoVjDa1_2H9kxc",
  authDomain: "mmp-cwc.firebaseapp.com",
  projectId: "mmp-cwc",
  storageBucket: "mmp-cwc.firebasestorage.app",
  messagingSenderId: "337145605995",
  appId: "1:337145605995:web:d3a3d01bea0e867e83a62e",
  measurementId: "G-53HT7NRWXL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, analytics };
