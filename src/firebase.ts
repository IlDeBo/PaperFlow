import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAId2ql4cwgQm1ifvxdxkiwWGmUxfHrhdQ",
  authDomain: "paperflow-34f84.firebaseapp.com",
  projectId: "paperflow-34f84",
  storageBucket: "paperflow-34f84.firebasestorage.app",
  messagingSenderId: "594633469269",
  appId: "1:594633469269:web:7e0efdd1a697a7948213dc"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;