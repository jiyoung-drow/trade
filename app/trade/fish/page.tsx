"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  arrayUnion,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import TabBar from "@/components/TabBar";
import Link from "next/link";
import { signInWithCustomToken } from "firebase/auth";
import { serverTimestamp, setDoc as firestoreSetDoc } from "firebase/firestore";

interface Application {
  id: string;
  uid: string; // Seller's UID if seller app, Buyer's UID if buyer app
  email: string; // Seller's email if seller app, Buyer's email if buyer app
  role: "buyer" | "seller"; // Role of the original applicant
  itemType: string;
  status: string | null;
  fishName: string | null;
  quantity: number;
  unitPrice: number;
  altUnitPrice: number | null;
  todayOrTomorrow: "today" | "tomorrow";
  approved: boolean;
  rejected: boolean;
  closed: boolean;
  settled: boolean;
  createdAt: Timestamp;
  participants: string[]; // UIDs of users who participated/expressed interest
  accountNickname?: string;
}

interface UserData {
  role: "buyer" | "seller";
  balance: number;
  email: string;
  createdAt: Timestamp;
}

export default function FishTradePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userRole, setUserRole] = useState<"buyer" | "seller" | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"all" | "inProgress">("all");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncFirebaseAuth = async () => {
      if (status === "authenticated" && session?.user?.id && !auth.currentUser) {
        console.log("DEBUG: [Auth Sync] NextAuth 세션 확인됨. Firebase Auth 로그인 시도 중...");
        try {
          const response = await fetch('/api/auth/firebase-custom-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uid: session.user.id }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to fetch custom token: ${response.status} ${errorData.error || response.statusText}`);
          }

          const { token } = await response.json();
          if (!token) {
            throw new Error("Custom token not received.");
          }

          await signInWithCustomToken(auth, token);
          console.log("DEBUG: [Auth Sync] Firebase Auth 로그인 성공!");
        } catch (error) {
          console.error("DEBUG: [Auth Sync] Firebase Auth 로그인 중 오류 발생:", error);
          alert("Firebase 로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
        }
      }
    };

    syncFirebaseAuth();
  }, [session, status]);

  useEffect(() => {
    const fetchUserRoleAndBalance = async () => {
      if (status === "loading" || !session?.user?.id || !auth.currentUser) {
        console.log("DEBUG: [User Role] 역할 및 잔액 가져오기 스킵: 세션 로딩 중 또는 Firebase Auth 사용자 없음.");
        return;
      }
      console.log("DEBUG: [User Role] Firebase Auth 사용자 확인됨. 역할 및 잔액 확인 시작...");

      try {
        const userRef = doc(db, "users", session.user.id);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as UserData;
          setUserRole(userData.role);
          setUserBalance(userData.balance || 0);
          console.log("DEBUG: [User Role] 사용자 역할 및 잔액 설정됨:", userData.role, userData.balance);
        } else {
          console.log("DEBUG: [User Role] 사용자 문서 없음. 새로 생성합니다.");
          await firestoreSetDoc(userRef, {
            email: session.user.email,
            role: "buyer",
            balance: 0,
            createdAt: serverTimestamp(),
          }, { merge: true });
          setUserRole("buyer");
          setUserBalance(0);
          console.log("DEBUG: [User Role] 사용자 문서 생성 및 역할/잔액 설정 완료 (기본: buyer, 0).");
        }
      } catch (err: any) {
        console.error("DEBUG: [User Role] 사용자 역할 및 잔액 불러오기/생성 오류:", err);
        setError("사용자 정보를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoleAndBalance();
  }, [session?.user?.id, status, auth.currentUser, router]);

  useEffect(() => {
    const fetchApplications = async () => {
      if (!userRole || !session?.user?.id) {
        console.log("DEBUG: [Applications] 신청서 가져오기 스킵: 사용자 역할 또는 세션 없음.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        let q;
        const applicationsRef = collection(db, "applications");

        if (activeTab === "all") {
          const targetRole = userRole === "buyer" ? "seller" : "buyer";
          q = query(
            applicationsRef,
            where("itemType", "==", "물고기"),
            where("role", "==", targetRole),
            where("approved", "==", false),
            where("rejected", "==", false),
            where("closed", "==", false),
            where("settled", "==", false)
          );
          console.log("DEBUG: [Applications] '전체 신청서' 쿼리 준비 (대상 역할:", targetRole, ")");
        } else { // activeTab === "inProgress"
          q = query(
            applicationsRef,
            where("itemType", "==", "물고기"),
            where("approved", "==", true),
            where("rejected", "==", false),
            where("closed", "==", false), // ⭐ 추가: closed가 false인 경우만
            where("settled", "==", false) // ⭐ 추가: settled가 false인 경우만
          );
          console.log("DEBUG: [Applications] '진행 중인 신청서' 쿼리 준비.");
        }

        const querySnapshot = await getDocs(q);
        const fetchedApplications: Application[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data() as Application;
          if (activeTab === "inProgress") {
            const isOwner = data.uid === session.user.id;
            const hasParticipated = data.participants.includes(session.user.id);

            // '진행 중' 탭에서는 현재 사용자가 신청서의 주인이거나 참여자인 경우만 표시
            // 그리고 settled, closed, rejected가 false인 경우만 표시 (쿼리에서 이미 필터링되지만 안전을 위해)
            if ((isOwner || hasParticipated) && !data.settled && !data.closed && !data.rejected) {
              fetchedApplications.push({ ...data, id: doc.id });
            }
          } else {
            fetchedApplications.push({ ...data, id: doc.id });
          }
        });

        setApplications(fetchedApplications);
        console.log("DEBUG: [Applications] 신청서 가져오기 완료. 개수:", fetchedApplications.length);
      } catch (err: any) {
        console.error("DEBUG: [Applications] 신청서 가져오기 오류:", err);
        setError("신청서를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    if (userRole) {
      fetchApplications();
    }
  }, [userRole, activeTab, session?.user?.id]);

  const handleParticipate = async (app: Application) => {
    console.log("DEBUG: [Participate] handleParticipate 함수 시작.");
    if (!session?.user?.id || !auth.currentUser || !userRole) {
      console.log("DEBUG: [Participate] 참여하려면 로그인 및 사용자 역할 정보가 필요합니다. (세션:", session?.user?.id, "Firebase Auth:", auth.currentUser?.uid, "역할:", userRole, ")");
      alert("로그인 및 사용자 역할 정보가 필요합니다.");
      router.push("/auth/signin");
      return;
    }
    console.log("DEBUG: [Participate] Firebase Auth 사용자 확인됨:", auth.currentUser.uid, "사용자 역할:", userRole);

    if (!app.id) {
      console.log("DEBUG: [Participate] 신청서 ID 없음.");
      alert("신청서 ID가 없습니다.");
      return;
    }
    console.log("DEBUG: [Participate] 신청서 ID 확인됨:", app.id);

    const totalApplicationPrice = app.unitPrice * app.quantity;
    console.log("DEBUG: [Participate] 총 신청 금액:", totalApplicationPrice);

    setLoading(true);
    try {
      console.log("DEBUG: [Participate] 트랜잭션 시작 시도.");
      await runTransaction(db, async (transaction) => {
        const appRef = doc(db, "applications", app.id);
        const appDoc = await transaction.get(appRef);

        if (!appDoc.exists()) {
          console.log("DEBUG: [Participate] 트랜잭션 오류: 신청서가 존재하지 않습니다.");
          throw new Error("신청서가 존재하지 않습니다.");
        }

        const currentApp = appDoc.data() as Application;

        if (currentApp.approved || currentApp.rejected || currentApp.closed || currentApp.settled) {
          console.log("DEBUG: [Participate] 트랜잭션 오류: 이미 처리되었거나 참여할 수 없는 신청서입니다.");
          throw new Error("이미 처리되었거나 참여할 수 없는 신청서입니다.");
        }
        if (currentApp.participants.includes(session.user.id)) {
          console.log("DEBUG: [Participate] 트랜잭션 오류: 이미 참여한 신청서입니다.");
          throw new Error("이미 참여한 신청서입니다.");
        }

        let deductedUserRef;
        let deductedUserData;
        let deductedUserUid;

        // Determine whose balance to deduct from based on current user's role and application's role
        if (userRole === "buyer" && currentApp.role === "seller") {
          // Current user is a buyer, participating in a seller's application
          deductedUserUid = session.user.id;
          deductedUserRef = doc(db, "users", deductedUserUid);
          deductedUserData = (await transaction.get(deductedUserRef)).data() as UserData;
          console.log("DEBUG: [Participate] 구매자(현재 사용자) 잔액 차감 준비. UID:", deductedUserUid);
        } else if (userRole === "seller" && currentApp.role === "buyer") {
          // Current user is a seller, participating in a buyer's application
          deductedUserUid = currentApp.uid; // The buyer's UID is the application owner's UID
          deductedUserRef = doc(db, "users", deductedUserUid);
          deductedUserData = (await transaction.get(deductedUserRef)).data() as UserData;
          console.log("DEBUG: [Participate] 구매자(신청서 주인) 잔액 차감 준비. UID:", deductedUserUid);
        } else {
          console.log("DEBUG: [Participate] 유효하지 않은 참여 시나리오. 현재 사용자 역할:", userRole, "신청서 역할:", currentApp.role);
          throw new Error("유효하지 않은 참여 시나리오입니다. 본인의 신청서에 참여할 수 없습니다.");
        }

        if (!deductedUserData) {
          console.log("DEBUG: [Participate] 트랜잭션 오류: 차감할 사용자 정보를 찾을 수 없습니다.");
          throw new Error("차감할 사용자 정보를 찾을 수 없습니다.");
        }

        console.log("DEBUG: [Participate] 트랜잭션 내 차감 대상 사용자 잔액:", deductedUserData.balance);
        if (deductedUserData.balance < totalApplicationPrice) {
          console.log("DEBUG: [Participate] 트랜잭션 오류: 보유 금액 부족 (트랜잭션 내 재확인).");
          throw new Error("보유 금액이 부족하여 거래에 참여할 수 없습니다.");
        }

        // Deduct funds
        transaction.update(deductedUserRef, {
          balance: deductedUserData.balance - totalApplicationPrice,
        });
        console.log("DEBUG: [Participate] 잔액 업데이트 (트랜잭션 내):", deductedUserData.balance, "->", deductedUserData.balance - totalApplicationPrice);

        // Record transaction
        transaction.set(doc(collection(db, "transactions")), {
          uid: deductedUserUid, // Deducted user's UID
          type: "deduction",
          amount: totalApplicationPrice,
          timestamp: serverTimestamp(),
          description: `물고기 거래 참여: ${currentApp.fishName} (${currentApp.quantity}개)`,
        });
        console.log("DEBUG: [Participate] 거래 내역 기록 완료.");

        // Add current user to participants & approve application
        const updatedParticipants = [...currentApp.participants, session.user.id];
        console.log("DEBUG: [Participate] 업데이트될 참여자 배열 (트랜잭션 내):", updatedParticipants);

        transaction.update(appRef, {
          participants: updatedParticipants,
          approved: true,
        });
        console.log("DEBUG: [Participate] 신청서 업데이트 트랜잭션 준비 완료.");
      });

      console.log("DEBUG: [Participate] 참여 신청이 성공적으로 완료되었습니다! (트랜잭션 커밋 성공)");
      alert("참여 신청이 완료되었습니다! 금액이 차감되고 신청서가 승인되었습니다.");
      
      // Re-fetch current user's balance to ensure UI reflects actual balance
      const userRef = doc(db, "users", session.user.id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
          setUserBalance(userSnap.data()?.balance || 0);
      }

      setActiveTab("inProgress");
      // ⭐ 변경: 필터링 로직 개선 - settled, closed, rejected가 아닌 것만 남기도록 ⭐
      setApplications((prevApps) =>
        prevApps.map((appItem) =>
          appItem.id === app.id
            ? { ...appItem, participants: [...appItem.participants, session.user.id], approved: true }
            : appItem
        ).filter(appItem => !appItem.settled && !appItem.closed && !appItem.rejected) // ⭐ 추가된 필터링 ⭐
      );

    } catch (error: any) {
      console.error("DEBUG: [Participate] 참여 신청 실패 (트랜잭션 오류):", error);
      alert("참여 신청 중 오류가 발생했습니다: " + error.message);
    } finally {
      setLoading(false);
      console.log("DEBUG: [Participate] handleParticipate 함수 종료.");
    }
  };


  if (loading || status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        로딩 중...
      </div>
    );
  }

  if (status !== "authenticated" || !auth.currentUser) {
    if (status === "authenticated" && !auth.currentUser) {
        return <div>Firebase 사용자 인증 동기화 중...</div>;
    }
    router.push("/auth/signin");
    return null;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        오류: {error}
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        사용자 역할 정보가 필요합니다.
      </div>
    );
  }

  return (
    <>
      <TabBar />
      <div className="max-w-md mx-auto p-4 pt-8 pb-20 font-sans">
        <h1 className="text-2xl font-bold text-center text-green-600 mb-6">
          물고기 거래 🎣
        </h1>

        <div className="flex justify-around mb-6 border-b border-gray-200">
          <button
            className={`py-2 px-4 text-sm font-semibold ${
              activeTab === "all"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("all")}
          >
            전체 신청서
          </button>
          <button
            className={`py-2 px-4 text-sm font-semibold ${
              activeTab === "inProgress"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab("inProgress")}
          >
            진행 중인 신청서
          </button>
        </div>

        {applications.length === 0 ? (
          <p className="text-center text-gray-500 mt-10">
            표시할 신청서가 없습니다.
          </p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white p-4 rounded-lg shadow-md border border-gray-200 flex flex-col items-stretch"
              >
                <Link href={`/trade/fish/${app.id}`} className="block mb-2">
                  <p className="text-base font-semibold text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis">
                    {app.fishName} ({app.status}) {app.unitPrice}원
                  </p>
                </Link>

                {/* Participate Button - Only visible if:
                    - Current tab is "all" (participation is from 'all' list)
                    - Not the owner
                    - Hasn't already participated
                    - Not rejected, approved, closed, or settled (must be pending for participation) */}
                {activeTab === "all" && // Only show participate button in 'all' tab
                  session?.user?.id !== app.uid &&
                  !app.participants.includes(session?.user?.id as string) &&
                  !app.rejected &&
                  !app.approved && // Important: only show if NOT YET approved
                  !app.closed &&
                  !app.settled && (
                    <button
                      onClick={() => handleParticipate(app)} // Pass the whole app object
                      className={`mt-2 w-full py-2 rounded font-semibold transition-colors duration-200
                        ${
                          userRole === "buyer"
                            ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                            : "bg-orange-500 hover:bg-orange-600 text-white"
                        }`}
                    >
                      {userRole === "buyer" ? "구매하기" : "판매하기"}
                    </button>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
