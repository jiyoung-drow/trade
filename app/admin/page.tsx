// app/admin/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth, googleProvider } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          role: 'pending',
          createdAt: new Date(),
        });
        alert('관리자 승인이 필요합니다. 관리자에게 문의하세요.');
        await signOut(auth);
        return;
      }

      const data = userSnap.data();
      if (data.role === 'admin' || data.role === 'superadmin') {
        alert('관리자 로그인에 성공했습니다.');
        setLoading(false);
      } else {
        alert('관리자 권한이 없습니다.');
        await signOut(auth);
        router.push('/');
      }
    } catch (error) {
      console.error('구글 로그인 오류:', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setLoading(false);
          return;
        }
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.data();
        if (!data || (data.role !== 'admin' && data.role !== 'superadmin')) {
          alert('관리자 권한이 없습니다.');
          await signOut(auth);
          router.push('/');
          return;
        }
        setLoading(false);
      });
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold mb-4">🛠️ 관리자 페이지</h1>
      <p className="text-gray-600 mb-2">관리자 전용 구글 로그인 후 사용하세요.</p>

      <button
        onClick={handleGoogleLogin}
        className="w-full bg-red-500 hover:bg-red-600 text-white rounded p-2"
      >
        구글 로그인으로 관리자 로그인
      </button>

      <div className="flex flex-col space-y-2 mt-4">
        <button
          onClick={() => router.push('/admin/users')}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded p-2"
        >
          회원 관리
        </button>
        <button
          onClick={() => router.push('/admin/transactions')}
          className="w-full bg-green-500 hover:bg-green-600 text-white rounded p-2"
        >
          충전/출금 승인
        </button>
        <button
          onClick={() => router.push('/admin/applications')}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white rounded p-2"
        >
          신청서 관리
        </button>
        <button
          onClick={() => router.push('/admin/statistics')}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded p-2"
        >
          통계 페이지
        </button>
      </div>
    </div>
  );
}
