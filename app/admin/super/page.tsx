'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function SuperAdminPage() {
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
        if (!data || data.role !== 'superadmin') {
          alert('접근 권한이 없습니다.');
          router.push('/admin/login');
          return;
        }

        setLoading(false);
      });
    };

    checkAuth();
  }, [router]);

  const handleEditAdminAccount = async () => {
    const newAccount = prompt('새 계좌번호를 입력하세요:');
    if (!newAccount) return alert('변경이 취소되었습니다.');
    try {
      await setDoc(doc(db, 'settings', 'adminAccount'), { account: newAccount }, { merge: true });
      alert('계좌번호가 업데이트되었습니다.');
    } catch (error) {
      console.error(error);
      alert('계좌번호 업데이트 중 오류가 발생했습니다.');
    }
  };

  const handleEditContactLink = async () => {
    const newLink = prompt('새 고객센터 문의 링크(URL)를 입력하세요:');
    if (!newLink) return alert('변경이 취소되었습니다.');
    try {
      await setDoc(doc(db, 'settings', 'contactLink'), { url: newLink }, { merge: true });
      alert('고객센터 링크가 업데이트되었습니다.');
    } catch (error) {
      console.error(error);
      alert('고객센터 링크 업데이트 중 오류가 발생했습니다.');
    }
  };

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">👑 슈퍼관리자 페이지</h1>
      <p className="text-sm text-gray-600">
        슈퍼관리자 전용 기능에 접근할 수 있습니다.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-4">
        <button
          onClick={() => router.push('/admin/requests')}
          className="bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          충전/출금 승인
        </button>
        <button
          onClick={() => router.push('/admin/members')}
          className="bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        >
          회원 관리
        </button>
        <button
          onClick={() => router.push('/admin/applications')}
          className="bg-purple-500 text-white py-2 rounded hover:bg-purple-600"
        >
          신청서 관리
        </button>
        <button
          onClick={() => router.push('/admin/statistics')}
          className="bg-orange-500 text-white py-2 rounded hover:bg-orange-600"
        >
          통계 페이지
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-6">
        <button
          onClick={handleEditAdminAccount}
          className="bg-gray-700 text-white py-2 rounded hover:bg-gray-800"
        >
          계좌번호 수정
        </button>
        <button
          onClick={handleEditContactLink}
          className="bg-pink-600 text-white py-2 rounded hover:bg-pink-700"
        >
          고객센터 링크 수정
        </button>
      </div>
    </div>
  );
}
