'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

export default function AdminMembersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
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
        if (!data || (data.role !== 'superadmin' && data.role !== 'admin')) {
          alert('접근 권한이 없습니다.');
          router.push('/admin/login');
          return;
        }

        const snapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(fetchedUsers);
        setFilteredUsers(fetchedUsers);
        setLoading(false);
      });
    };

    checkAuthAndFetch();
  }, [router]);

  const handleSearch = (value: string) => {
    setSearch(value);
    const filtered = users.filter((user) =>
      (user.email?.toLowerCase().includes(value.toLowerCase()) ||
        user.role?.toLowerCase().includes(value.toLowerCase()))
    );
    setFilteredUsers(filtered);
  };

  const toggleAdmin = async (userId: string, currentRole: string) => {
    if (!confirm('관리자 권한을 변경하시겠습니까?')) return;
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await updateDoc(doc(db, 'users', userId), { role: newRole });
    const updatedUsers = users.map(user =>
      user.id === userId ? { ...user, role: newRole } : user
    );
    setUsers(updatedUsers);
    setFilteredUsers(updatedUsers.filter((user) =>
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.role?.toLowerCase().includes(search.toLowerCase())
    ));
    alert(`권한이 ${newRole}으로 변경되었습니다.`);
  };

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">🛠️ 회원 관리</h1>
      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="이메일 또는 역할로 검색"
        className="w-full border rounded p-2"
      />

      {filteredUsers.length === 0 ? (
        <p className="text-gray-600 mt-4">검색 결과가 없습니다.</p>
      ) : (
        filteredUsers.map((user) => (
          <div
            key={user.id}
            className="border rounded p-3 mb-2 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{user.email || user.id}</div>
              <div className="text-sm text-gray-600">역할: {user.role}</div>
            </div>
            {user.role !== 'superadmin' && (
              <button
                onClick={() => toggleAdmin(user.id, user.role)}
                className="bg-gray-700 text-white text-sm px-3 py-1 rounded hover:bg-gray-800"
              >
                {user.role === 'admin' ? '권한 회수' : '관리자 부여'}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
