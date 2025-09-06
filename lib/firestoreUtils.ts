// lib/firestoreUtils.ts
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
export const createApplication = async (data: any) => {
  await addDoc(collection(db, "applications"), { ...data, createdAt: serverTimestamp() });
};

export const fetchUserApplications = async (userId: string, role: string) => {
  const q = query(collection(db, "applications"), where("uid", "==", userId), where("role", "==", role));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const deleteApplication = async (applicationId: string) => {
  await deleteDoc(doc(db, "applications", applicationId));
};

export const updateApplicationStatus = async (applicationId: string, status: string) => {
  await updateDoc(doc(db, "applications", applicationId), { tradeStatus: status });
};