'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

export default function SuperAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
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

        // 슈퍼관리자 확인 후 전체 사용자 리스트 불러오기
        const snapshot = await getDocs(collection(db, 'users'));
        setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });
    };

    checkAuthAndFetch();
  }, [router]);

  // 권한 변경 핸들러
  const toggleAdmin = async (userId: string, currentRole: string) => {
    const confirmToggle = confirm('관리자 권한을 변경하시겠습니까?');
    if (!confirmToggle) return;

    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await updateDoc(doc(db, 'users', userId), { role: newRole });
    setUsers(users.map(user => user.id === userId ? { ...user, role: newRole } : user));
    alert(`권한이 ${newRole}으로 변경되었습니다.`);
  };

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">👑 슈퍼관리자 페이지</h1>
      <p className="text-sm text-gray-600 mb-6">
        전체 유저 목록 및 관리자 권한 제어 기능 (슈퍼관리자 전용)
      </p>

      {users.map((user) => (
        <div
          key={user.id}
          className="border rounded p-3 mb-2 flex justify-between items-center"
        >
          <div>
            <div className="font-semibold">{user.name || user.email || user.id}</div>
            <div className="text-sm text-gray-600">역할: {user.role}</div>
          </div>
          {user.role !== 'superadmin' && (
            <button
              onClick={() => toggleAdmin(user.id, user.role)}
              className="bg-purple-500 text-white text-sm px-3 py-1 rounded hover:bg-purple-600"
            >
              {user.role === 'admin' ? '권한 회수' : '관리자 부여'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
