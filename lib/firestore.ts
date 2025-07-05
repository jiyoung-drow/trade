// lib/firestore.ts

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
  arrayUnion,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ✅ 마이페이지용 신청서 가져오기
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

// ✅ 거래 참여
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

// ✅ 거래목록용 상대방 신청서 가져오기
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

  return snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as any;
      const createdAt = data.createdAt?.toDate().getTime() || 0;
      const elapsedSeconds = (now - createdAt) / 1000;
      if (elapsedSeconds > 600 || data.uid === uid) return null;

      let adjustedPrice = data.unitPrice || 0;
      let adjustedPriceIfConnected = data.priceIfConnected || null;

      if (role === "buyer") {
        if (data.status === "미접") {
          adjustedPrice += 100;
          if (adjustedPriceIfConnected !== null) adjustedPriceIfConnected += 50;
        } else if (data.status === "접속") {
          adjustedPrice += 50;
        }
      } else if (role === "seller") {
        if (data.status === "미접") {
          adjustedPrice = Math.max(adjustedPrice - 100, 0);
          if (adjustedPriceIfConnected !== null)
            adjustedPriceIfConnected = Math.max(adjustedPriceIfConnected - 50, 0);
        } else if (data.status === "접속") {
          adjustedPrice = Math.max(adjustedPrice - 50, 0);
        }
      }

      return {
        id: docSnap.id,
        ...data,
        unitPrice: adjustedPrice,
        priceIfConnected: adjustedPriceIfConnected,
      };
    })
    .filter(Boolean);
};

// ✅ 거래중 신청서 가져오기
export const fetchInProgressApplications = async (
  userId: string,
  role: "buyer" | "seller"
) => {
  const q = query(
    collection(db, "applications"),
    where("uid", "==", userId),
    where("status", "==", "진행중")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✅ 신청서 삭제
export const deleteApplication = async (applicationId: string) => {
  await deleteDoc(doc(db, "applications", applicationId));
};

// ✅ 닉네임 전송 (판매자)
export const sendNickname = async (applicationId: string, nickname: string) => {
  const ref = doc(db, "applications", applicationId);
  await updateDoc(ref, {
    sentNicknames: arrayUnion({
      nickname,
      sentAt: new Date().toISOString(),
    }),
  });
};

// ✅ 닉네임 확인 (구매자)
export const confirmNickname = async (applicationId: string, nickname: string) => {
  const ref = doc(db, "applications", applicationId);
  await updateDoc(ref, {
    receivedNicknames: arrayUnion({
      nickname,
      receivedAt: new Date().toISOString(),
      status: "확인",
    }),
  });
  await checkAndCompleteTransaction(applicationId);
};

// ✅ 닉네임 반려 (구매자)
export const rejectNickname = async (
  applicationId: string,
  nickname: string,
  reason: "접속한 계정" | "확인 불가"
) => {
  const ref = doc(db, "applications", applicationId);
  await updateDoc(ref, {
    receivedNicknames: arrayUnion({
      nickname,
      receivedAt: new Date().toISOString(),
      status: "반려",
      reason,
    }),
  });
  await checkAndCompleteTransaction(applicationId);
};

// ✅ 판매자 반려 처리 기록
export const recordSellerAction = async (
  applicationId: string,
  nickname: string,
  action: "승인" | "거절"
) => {
  const ref = doc(db, "applications", applicationId);

  if (action === "거절") {
    await updateDoc(ref, {
      sellerActions: arrayUnion({ nickname, action, actedAt: new Date().toISOString() }),
      settlementAmount: 0,
      status: "완료",
      customerMessage: "거절된 닉네임입니다. 고객센터로 문의해주세요.",
      completedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      sellerActions: arrayUnion({ nickname, action, actedAt: new Date().toISOString() }),
    });
    await checkAndCompleteTransaction(applicationId);
  }
};

// ✅ 거래 완료 처리
export const completeTransaction = async (
  applicationId: string,
  settlementAmount: number
) => {
  const ref = doc(db, "applications", applicationId);
  await updateDoc(ref, {
    status: "완료",
    settlementAmount,
    completedAt: serverTimestamp(),
  });
};

// ✅ 판매자 닉네임 저장
export const saveNicknameForSeller = async (uid: string, nickname: string) => {
  const ref = doc(db, `users/${uid}/savedNicknames/${nickname}`);
  await setDoc(ref, { nickname });
};

// ✅ 판매자 저장 닉네임 불러오기
export const fetchSavedNicknamesForSeller = async (uid: string) => {
  const q = collection(db, `users/${uid}/savedNicknames`);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => doc.data().nickname);
};

// ✅ 자동 정산 처리
export const checkAndCompleteTransaction = async (applicationId: string) => {
  const ref = doc(db, "applications", applicationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const quantity = data.quantity || 0;
  const sentNicknames = data.sentNicknames?.length || 0;
  const sellerActions = data.sellerActions || [];

  const completedNicknames = sellerActions.filter(
    (a: any) => a.action === "승인" || a.action === "거절"
  ).length;

  if (sentNicknames === quantity && completedNicknames === quantity && data.status !== "완료") {
    const settlementAmount = (data.unitPrice || 0) * quantity;
    await completeTransaction(applicationId, settlementAmount);
    console.log(`✅ 모든 닉네임 처리 완료, 자동 정산 완료: ${applicationId}`);
  }
};

// ✅ 완료된 신청서 개수 가져오기
export const fetchCompletedApplicationsCount = async (
  userId: string,
  role: "buyer" | "seller"
) => {
  const q = query(
    collection(db, "applications"),
    where("uid", "==", userId),
    where("role", "==", role),
    where("status", "==", "완료")
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
};

// ✅ 특정 신청서 상세 데이터 가져오기
export const fetchApplicationDetail = async (applicationId: string) => {
  const ref = doc(db, "applications", applicationId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

// ✅ 신청서 상태 강제 업데이트
export const forceUpdateApplicationStatus = async (
  applicationId: string,
  newStatus: "미접" | "접속" | "진행중" | "완료"
) => {
  const ref = doc(db, "applications", applicationId);
  await updateDoc(ref, {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });
};

// ✅ 역할별 전체 신청서 개수 가져오기
export const fetchTotalApplicationsCount = async (role: "buyer" | "seller") => {
  const q = query(collection(db, "applications"), where("role", "==", role));
  const snapshot = await getDocs(q);
  return snapshot.size;
};

// ✅ 완료 거래의 정산 금액 합계 가져오기
export const fetchTotalSettlementAmount = async (role: "buyer" | "seller") => {
  const q = query(
    collection(db, "applications"),
    where("role", "==", role),
    where("status", "==", "완료")
  );
  const snapshot = await getDocs(q);

  let total = 0;
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    total += data.settlementAmount || 0;
  });

  return total;
};