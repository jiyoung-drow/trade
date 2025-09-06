"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  runTransaction, // runTransaction import
  collection, // collection import
  serverTimestamp, // serverTimestamp import
  getDocs, // ⭐ getDocs import 추가 ⭐
} from "firebase/firestore";

interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  balance?: number; // balance 필드
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // 잔액 수정을 위한 상태
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingBalanceValue, setEditingBalanceValue] = useState<number | string>("");

  // 사용자 목록 불러오기 (밸런스 포함)
  const fetchUsers = async () => {
    try {
      setLoading(true);
      // Firestore에서 직접 모든 사용자 문서를 가져옵니다.
      // Firebase Admin SDK를 사용하는 API 엔드포인트가 더 안전하지만,
      // 여기서는 클라이언트에서 직접 읽는 방식으로 구현합니다.
      // 실제 서비스에서는 보안 규칙을 강화하고 서버측 API를 사용하는 것을 권장합니다.
      const usersCollectionRef = collection(db, "users");
      const querySnapshot = await getDocs(usersCollectionRef); // getDocs 사용

      const usersWithDetails: UserData[] = [];
      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        usersWithDetails.push({
          uid: docSnap.id,
          email: userData.email || 'N/A',
          displayName: userData.displayName || 'N/A',
          role: userData.role || 'unknown',
          balance: userData.balance ?? 0,
        });
      });
      setUsers(usersWithDetails);
    } catch (error) {
      console.error("사용자 불러오기 오류:", error);
      alert("사용자 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 관리자 권한 확인 + 유저 불러오기
  useEffect(() => {
    const checkAdmin = async () => {
      if (status === "loading") return;

      if (!session?.user?.id) {
        alert("로그인이 필요합니다.");
        router.push("/auth/signin");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", session.user.id));
        const role = userDoc.data()?.role;

        if (role === "admin") {
          setIsAdmin(true);
          await fetchUsers(); // 관리자일 경우 사용자 목록 불러오기
        } else {
          alert("관리자만 접근 가능합니다.");
          router.push("/");
        }
      } catch (error) {
        console.error("권한 확인 오류:", error);
        alert("권한 확인 중 오류 발생");
        router.push("/");
      }
    };

    if (status === "authenticated") checkAdmin();
    else if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [session, status, router]);

  // 사용자 삭제
  const deleteUser = async (uid: string) => {
    // alert 대신 커스텀 모달 사용 권장
    if (!window.confirm("정말 이 사용자를 삭제하시겠습니까?")) return;

    try {
      // Firebase Admin SDK를 사용하는 API 엔드포인트를 통해 사용자 삭제
      // 클라이언트에서 직접 Firebase Auth 사용자를 삭제하는 것은 보안상 권장되지 않습니다.
      // 여기서는 예시로 API 호출을 가정합니다.
      const res = await fetch("/api/admin/deleteUser", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid }),
      });

      if (res.ok) {
        alert("삭제 완료");
        fetchUsers(); // 사용자 목록 새로 고침
      } else {
        const errorData = await res.json();
        alert(`삭제 실패: ${errorData.message || res.statusText}`);
      }
    } catch (error) {
      console.error("삭제 오류:", error);
      alert("삭제 요청 중 오류 발생");
    }
  };

  // 잔액 수정 모드 활성화
  const handleEditBalanceClick = (user: UserData) => {
    setEditingUserId(user.uid);
    setEditingBalanceValue(user.balance ?? 0);
  };

  // 잔액 수정 취소
  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingBalanceValue("");
  };

  // 잔액 저장 (업데이트)
  const handleSaveBalance = async (user: UserData) => {
    if (!session?.user?.id || !session.user.email) {
      alert("관리자 정보가 없습니다. 다시 로그인해주세요.");
      return;
    }

    const newBalance = Number(editingBalanceValue);
    if (isNaN(newBalance) || newBalance < 0) {
      alert("유효한 잔액을 입력해주세요 (0 이상).");
      return;
    }

    if (newBalance === user.balance) {
      alert("잔액 변동이 없습니다.");
      handleCancelEdit();
      return;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const userDocSnap = await transaction.get(userRef);

        if (!userDocSnap.exists()) {
          throw new Error("사용자 문서를 찾을 수 없습니다.");
        }

        const oldBalance = userDocSnap.data()?.balance ?? 0;
        const adjustmentAmount = newBalance - oldBalance;

        // 1. 사용자 잔액 업데이트
        transaction.update(userRef, {
          balance: newBalance,
        });

        // 2. transactions 컬렉션에 관리자 조정 기록 추가
        const transactionsCollectionRef = collection(db, "transactions");
        transaction.set(doc(transactionsCollectionRef), {
          uid: user.uid, // 조정된 사용자 UID
          type: "admin_adjustment", // 관리자 조정 타입
          amount: adjustmentAmount, // 조정된 금액 (차액)
          description: `관리자 수동 잔액 조정: ${oldBalance.toLocaleString()}원 -> ${newBalance.toLocaleString()}원`,
          timestamp: serverTimestamp(),
          adminUid: session.user.id,
          adminEmail: session.user.email,
        });
      });

      alert("사용자 잔액이 성공적으로 업데이트되었습니다.");
      fetchUsers(); // 목록 새로 고침
      handleCancelEdit(); // 수정 모드 종료
    } catch (error: any) {
      console.error("잔액 업데이트 오류:", error);
      alert(`잔액 업데이트 중 오류가 발생했습니다: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  // 데이터 로딩 or 권한 확인 중
  if (status === "loading" || isAdmin === null || loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  if (isAdmin === false) {
    return null; // 관리자가 아니면 아무것도 렌더링하지 않음 (리다이렉트는 useEffect에서 처리)
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-center text-pink-500">
        관리자 사용자 관리
      </h1>

      {users.length === 0 ? (
        <p className="text-center text-gray-500">사용자 데이터가 없습니다.</p>
      ) : (
        <table className="w-full border table-auto">
          <thead>
            <tr className="bg-gray-100 border-b text-sm">
              <th className="p-2 text-left">UID</th>
              <th className="p-2 text-left">이메일</th>
              <th className="p-2 text-left">역할</th>
              <th className="p-2 text-left">잔액</th> {/* 잔액 헤더 */}
              <th className="p-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid} className="border-b text-sm">
                <td className="p-2 text-xs break-all">{user.uid}</td>
                <td className="p-2">{user.email}</td>
                <td className="p-2">{user.role || "-"}</td>
                <td className="p-2">
                  {editingUserId === user.uid ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editingBalanceValue}
                        onChange={(e) => setEditingBalanceValue(e.target.value)}
                        className="w-24 border rounded px-1 py-0.5 text-sm"
                        min="0"
                      />
                      <button
                        onClick={() => handleSaveBalance(user)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded text-xs"
                        disabled={loading}
                      >
                        저장
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-2 py-0.5 rounded text-xs"
                        disabled={loading}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span>{user.balance !== undefined ? user.balance.toLocaleString() : "-"}원</span>
                      <button
                        onClick={() => handleEditBalanceClick(user)}
                        className="bg-indigo-400 hover:bg-indigo-500 text-white px-2 py-0.5 rounded text-xs"
                      >
                        수정
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-2 text-center">
                  {user.uid === session?.user?.id ? (
                    <span className="text-gray-400 text-xs">본인</span>
                  ) : (
                    <button
                      onClick={() => deleteUser(user.uid)}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                    >
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
