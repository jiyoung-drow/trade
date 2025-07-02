'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<'buyer' | 'seller' | null>(null);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // 로그인, 회원가입 페이지에서는 탭바 숨김
    if (pathname === '/login' || pathname === '/signup') {
      setShouldRender(false);
      return;
    } else {
      setShouldRender(true);
    }

    // 로그인 상태 및 역할 확인
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role === 'buyer' || data.role === 'seller') {
            setRole(data.role);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [pathname]);

  if (!shouldRender || !role) return null;

  // 역할별 경로 설정
  const base = role === 'buyer' ? '/dashboard/buyer' : '/dashboard/seller';
  const inprogress = role === 'buyer' ? '/inprogress/buyer' : '/inprogress/seller';
  const write = '/application/new';
  const mypage = role === 'buyer' ? '/mypage/buyer' : '/mypage/seller';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        width: '100%',
        maxWidth: '480px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        borderTop: '1px solid #ccc',
        backgroundColor: '#fff',
        padding: '8px 0',
        zIndex: 50,
      }}
    >
      {/* 거래목록 버튼 */}
      <button
        onClick={() => router.push(base)}
        style={{
          color: pathname.startsWith(base) ? '#0070f3' : '#333',
          fontWeight: pathname.startsWith(base) ? 'bold' : 'normal',
        }}
      >
        거래목록
      </button>

      {/* 거래중 버튼 */}
      <button
        onClick={() => router.push(inprogress)}
        style={{
          color: pathname.startsWith(inprogress) ? '#0070f3' : '#333',
          fontWeight: pathname.startsWith(inprogress) ? 'bold' : 'normal',
        }}
      >
        거래중
      </button>

      {/* 신청서 작성 버튼 */}
      <button
        onClick={() => router.push(write)}
        style={{
          color: pathname.startsWith(write) ? '#0070f3' : '#333',
          fontWeight: pathname.startsWith(write) ? 'bold' : 'normal',
        }}
      >
        신청서 작성
      </button>

      {/* 마이페이지 버튼 */}
      <button
        onClick={() => router.push(mypage)}
        style={{
          color: pathname.startsWith(mypage) ? '#0070f3' : '#333',
          fontWeight: pathname.startsWith(mypage) ? 'bold' : 'normal',
        }}
      >
        마이페이지
      </button>
    </div>
  );
}
