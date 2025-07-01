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
    if (pathname === '/login' || pathname === '/signup') {
      setShouldRender(false);
      return;
    } else {
      setShouldRender(true);
    }

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

  const base = role === 'buyer' ? '/dashboard/buyer' : '/dashboard/seller';
  const mypage = role === 'buyer' ? '/mypage/buyer' : '/mypage/seller';
  const write = '/application/new';

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
      <button
        onClick={() => router.push(base)}
        style={{
          color: pathname.startsWith(base) ? '#0070f3' : '#333',
          fontWeight: pathname.startsWith(base) ? 'bold' : 'normal',
        }}
      >
        거래목록
      </button>
      <button
        onClick={() => router.push(write)}
        style={{
          color: pathname.startsWith(write) ? '#0070f3' : '#333',
          fontWeight: pathname.startsWith(write) ? 'bold' : 'normal',
        }}
      >
        신청서 작성
      </button>
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
