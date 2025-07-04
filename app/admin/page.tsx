'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          alert('로그인이 필요합니다.');
          router.push('/admin/login');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.data();
        if (!data || (data.role !== 'admin' && data.role !== 'superadmin')) {
          alert('관리자 권한이 없습니다.');
          router.push('/admin/login');
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
      <p className="text-gray-600 mb-2">관리 기능으로 이동하세요.</p>
      <div className="flex flex-col space-y-2">
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
