'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function CreateAdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/admin/login');
        return;
      }
      const userDoc = await db.collection('users').doc(user.uid).get();
      const data = userDoc.data();
      if (data?.role === 'superadmin') {
        setIsSuperAdmin(true);
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), {
        email,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
      alert('관리자 계정이 생성되었습니다.');
      setEmail('');
      setPassword('');
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('계정 생성 실패');
      }
    }
  };

  if (!isSuperAdmin) {
    return <div className="p-6 text-center">접근 권한이 없습니다.</div>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">👑 슈퍼관리자 - 관리자 계정 생성</h1>
      <form onSubmit={handleCreateAdmin} className="space-y-3">
        <input
          type="email"
          placeholder="관리자 이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="초기 비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
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