import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ✅ UID 기반 신청서 불러오기
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

// ✅ 거래 참여 기능
export const participateInApplication = async (applicationId: string, participantId: string) => {
  const ref = doc(db, "applications", applicationId);
  await updateDoc(ref, {
    status: "진행중",
    participantId,
    startedAt: serverTimestamp(),
  });
};

// ✅ 신청서 작성
export const createApplication = async (data: any) => {
  await addDoc(collection(db, "applications"), data);
};

// ✅ 구매자 거래목록용 신청서 불러오기
export const fetchAvailableApplications = async (uid: string, role: string) => {
  const q = query(
    collection(db, "applications"),
    where("role", "!=", role),
    where("status", "in", ["미접", "접속"])
  );
  return await getDocs(q);
};

// ✅ 10분 경과 신청서 삭제
export const deleteApplication = async (applicationId: string) => {
  const ref = doc(db, "applications", applicationId);
  await deleteDoc(ref);
};
