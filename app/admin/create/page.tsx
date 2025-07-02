'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function AdminCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.push('/admin/login');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.data();

        if (data?.role === 'superadmin') {
          setIsSuperAdmin(true);
        } else {
          router.push('/admin/login');
        }

        setLoading(false);
      });
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  if (!isSuperAdmin) {
    return null; // 권한 없는 경우 화면 숨김
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">👑 슈퍼관리자 - 관리자 생성 페이지</h1>
      <form className="space-y-3">
        <input
          type="email"
          placeholder="관리자 이메일"
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          placeholder="초기 비밀번호"
          className="w-full p-2 border rounded"
        />
        <select className="w-full p-2 border rounded">
          <option value="admin">일반 관리자</option>
          <option value="superadmin">슈퍼관리자</option>
        </select>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          관리자 생성
        </button>
      </form>
    </div>
  );
}
