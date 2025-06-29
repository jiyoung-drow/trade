import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = { /* ... */ };
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export { onAuthStateChanged };
export const db = getFirestore(app);
