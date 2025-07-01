'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function AdminUserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  const fetchUsers = async () => {
    const snapshot = await getDocs(collection(db, 'users'));
    const userList = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsers(userList);
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('정말 이 유저를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch('/api/admin/deleteUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ 유저 삭제 완료');
        fetchUsers();
      } else {
        setMessage(`❌ 삭제 실패: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      setMessage('삭제 중 오류 발생');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold mb-2">관리자 - 유저 관리</h1>
      {message && <p>{message}</p>}

      {users.map((user) => (
        <div key={user.id} className="border p-2 rounded flex justify-between items-center">
          <div>
            <p>UID: {user.id}</p>
            <p>Role: {user.role}</p>
            <p>Email: {user.email || '이메일 없음'}</p>
          </div>
          <button
            onClick={() => handleDelete(user.id)}
            className="bg-red-500 text-white px-2 py-1 rounded"
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}
