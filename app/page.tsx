// ✅ 전체 page.tsx 수정본 (디버그 로그 추가)
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// Firebase Auth에서 User 타입을 명시적으로 임포트합니다.
import { signOut as firebaseSignOut, onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase"; // Firebase 초기화 설정 파일 경로에 맞게 확인
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function HomePage() {
  const { data: session, status } = useSession(); // NextAuth 세션 상태
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [firebaseUserInitialized, setFirebaseUserInitialized] = useState(false); // Firebase Auth 상태 초기화 여부

  // firebaseAuthUser 상태의 타입을 User | null로 명시적으로 지정합니다.
  const [firebaseAuthUser, setFirebaseAuthUser] = useState<User | null>(null);

  useEffect(() => {
    // Firebase 인증 상태 변화를 감지하는 리스너 설정
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseAuthUser(user); // Firebase 사용자 객체 업데이트 (null 또는 User 객체)
      setFirebaseUserInitialized(true); // Firebase Auth 상태가 이제 초기화되었음을 표시
      console.log("DEBUG: onAuthStateChanged 리스너 실행됨. Firebase User:", user ? user.uid : "null");
    });

    // 컴포넌트 언마운트 시 리스너 해제 (메모리 누수 방지)
    return () => unsubscribe();
  }, []); // 이 useEffect는 컴포넌트 마운트 시 한 번만 실행됩니다.

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      // 1. NextAuth 세션 로딩 중이거나 Firebase Auth 상태가 아직 초기화되지 않았다면 대기
      if (status === "loading") {
        console.log("DEBUG: NextAuth 세션 로딩 중... 대기");
        setLoading(true);
        return;
      }
      if (!firebaseUserInitialized) {
        console.log("DEBUG: Firebase Auth 상태 초기화 대기 중... 대기");
        setLoading(true);
        return;
      }

      // 2. NextAuth 세션이 인증되지 않았거나 이메일이 없다면, 로딩 완료 후 함수 종료
      if (status !== "authenticated" || !session?.user?.email) {
        console.log("DEBUG: NextAuth 세션이 인증되지 않았거나 이메일이 없습니다. 로그인 페이지로 리다이렉트가 필요할 수 있습니다.");
        setLoading(false);
        // router.replace("/login"); // 예시: 로그인 페이지 경로 (필요시 주석 해제)
        return;
      }

      // 3. NextAuth 세션은 인증되었으나, Firebase User 객체가 없다면 (Firebase Auth 문제)
      if (!firebaseAuthUser) {
        console.warn("DEBUG: Firebase 인증 실패 (NextAuth는 인증되었으나 Firebase User 객체 없음). 역할 선택 페이지로 이동합니다.");
        setLoading(false);
        router.replace("/role");
        return;
      }
      
      // 여기까지 왔다면, NextAuth와 Firebase Auth 모두 인증되었고 firebaseAuthUser 객체가 존재함.
      console.log("DEBUG: NextAuth 및 Firebase Auth 모두 인증 완료. Firestore 역할 확인 시작.");

      try {
        const userRef = doc(db, "users", firebaseAuthUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          console.log(`DEBUG: Firestore 문서 없음 (UID: ${firebaseAuthUser.uid}) → 새로 생성 및 역할 선택 페이지로 리다이렉트`);
          await setDoc(userRef, {
            email: session.user.email ?? "",
            role: null, // 초기 역할은 null로 설정, 사용자가 선택해야 함
            uid: firebaseAuthUser.uid,
            createdAt: serverTimestamp(),
          });
          router.replace("/role"); // 역할 선택 페이지로 리다이렉트
          return;
        }

        const role = snap.data()?.role;
        console.log(`DEBUG: Firestore에서 역할 확인됨: '${role}'`); // ⭐ 이 로그의 값을 가장 중요하게 확인하세요! ⭐

        if (role === "buyer") {
          console.log("DEBUG: 역할 'buyer' 확인됨. 구매자 마이페이지로 이동합니다.");
          router.replace("/mypage/buyer");
        } else if (role === "seller") {
          console.log("DEBUG: 역할 'seller' 확인됨. 판매자 마이페이지로 이동합니다.");
          router.replace("/mypage/seller");
        } else {
          console.warn(`DEBUG: 역할이 null 또는 예상치 못한 값 ('${role}') → 역할 선택 페이지로 이동`);
          router.replace("/role"); // 역할이 없거나 잘못된 경우 역할 선택 페이지로 리다이렉트
        }
      } catch (e) {
        console.error("DEBUG: Firestore 접근 중 오류 발생:", e);
        router.replace("/role"); // Firestore 접근 중 오류 발생 시 폴백
      } finally {
        setLoading(false); // 모든 로직 완료 후 로딩 해제
      }
    };

    // NextAuth 세션 상태, Firebase Auth 사용자 객체, Firebase Auth 초기화 상태, 라우터가 변경될 때마다 실행
    checkUserAndRedirect();
  }, [session, status, firebaseAuthUser, firebaseUserInitialized, router]);

  const handleLogout = async () => {
    try {
      // Firebase 사용자 로그인 상태 확인 후 로그아웃
      if (auth.currentUser) {
        await firebaseSignOut(auth);
        console.log("✅ Firebase 로그아웃 성공");
      }
      // NextAuth 로그아웃
      await signOut({ redirect: false });
      console.log("✅ NextAuth 로그아웃 성공");
      // Google 계정 로그아웃을 강제하는 URL (선택 사항, 사용자 경험에 따라 다름)
      window.location.href =
        "https://accounts.google.com/Logout?continue=https://appengine.google.com/_ah/logout?continue=http://localhost:3000";
    } catch (e) {
      console.error("❌ 로그아웃 실패:", e);
    }
  };

  // NextAuth 세션 또는 역할 확인 로딩 중일 때 표시
  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen flex justify-center items-center">
        <p className="text-gray-500">역할 확인 중...</p>
      </main>
    );
  }

  // 로딩이 완료되면 실제 UI 렌더링
  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-white to-blue-50 text-center px-4 font-sans">
      <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-8 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-violet-400 drop-shadow-sm">
        TocToc 🪐
      </h1>

      {session ? (
        <>
          <img
            src={session.user?.image ?? "/google-logo.png"}
            alt="Profile"
            className="w-24 h-24 rounded-full shadow mb-4"
          />
          <p className="text-lg font-semibold">
            {session.user?.name ?? "이름 없음"}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            {session.user?.email ?? ""}
          </p>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-full shadow mt-2"
          >
            로그아웃
          </button>
        </>
      ) : (
        <button
          onClick={() =>
            signIn("google", {
              callbackUrl: "/",
              prompt: "select_account",
            })
          }
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full shadow text-lg font-semibold"
        >
          구글 로그인으로 시작하기
        </button>
      )}
    </main>
  );
}
