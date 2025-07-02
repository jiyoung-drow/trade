'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function CreateAdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.data();
        if (data.role === 'superadmin') {
          setIsSuperAdmin(true);
        } else {
          router.push('/admin/login');
        }
      } else {
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), { email, role: 'admin', createdAt: new Date() });
      alert('관리자 계정 생성 완료');
      setEmail('');
      setPassword('');
    } catch (error) {
      alert(error.message);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6">
      <h1 className="text-2xl font-bold mb-4">관리자 계정 생성</h1>
      <form onSubmit={handleCreateAdmin} className="space-y-4 w-full max-w-xs">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="관리자 이메일" className="w-full border rounded p-2" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className="w-full border rounded p-2" />
        <button type="submit" className="w-full bg-green-500 text-white p-2 rounded">생성</button>
      </form>
    </div>
  );
}
