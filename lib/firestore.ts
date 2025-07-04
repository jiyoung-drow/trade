import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ✅ UID 기반 신청서 불러오기
export const fetchUserApplications = async (userId: string, role: string) => {
  const q = query(
    collection(db, "applications"),
    where("uid", "==", userId),
    where("role", "==", role),
    where("status", "in", ["미접", "접속"])
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✅ 거래 참여 기능
export const participateInApplication = async (
  applicationId: string,
  participantId: string
) => {
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

// ✅ 역할별 상대방 신청서만 가져오기 + 비밀가격 가공
export const fetchAvailableApplications = async (
  uid: string,
  role: "buyer" | "seller"
) => {
  const oppositeRole = role === "buyer" ? "seller" : "buyer";
  const q = query(
    collection(db, "applications"),
    where("role", "==", oppositeRole),
    where("status", "in", ["미접", "접속"])
  );

  const snapshot = await getDocs(q);
  const now = Date.now();

  const filtered = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as any;
      const createdAt = data.createdAt?.toDate().getTime() || 0;
      const elapsedSeconds = (now - createdAt) / 1000;

      if (elapsedSeconds > 600) return null; // 10분 초과 제외
      if (data.uid === uid) return null; // 자신의 신청서 제외

      // 비밀가격 가공 (문구 표시 X)
      if (role === "buyer") {
        data.price = (data.price || 0) + 100;
      } else if (role === "seller") {
        data.price = Math.max((data.price || 0) - 50, 0);
      }

      return { id: docSnap.id, ...data };
    })
    .filter(Boolean);

  return filtered;
};

// ✅ 10분 경과 신청서 삭제
export const deleteApplication = async (applicationId: string) => {
  const ref = doc(db, "applications", applicationId);
  await deleteDoc(ref);
};
