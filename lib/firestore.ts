import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "./firebase";

// UID 기반 신청서 불러오기
export const fetchUserApplications = async (userId: string, role: string) => {
  const q = query(
    collection(db, "applications"),
    where("userId", "==", userId),
    where("role", "==", role),
    where("status", "in", ["미접", "접속"])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 거래 참여 기능
export const participateInApplication = async (applicationId: string, participantId: string) => {
  const ref = doc(db, "applications", applicationId);
  await updateDoc(ref, {
    status: "진행중",
    participantId,
    startedAt: serverTimestamp(),
  });
};

// 신청서 작성
export const createApplication = async (data: any) => {
  await addDoc(collection(db, "applications"), data);
};
