'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function SelectRolePage() {
  const [user, setUser] = useState<User | null>(null); // ✅ 타입 수정
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/');
        return;
      }
      setUser(currentUser);

      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data().role) {
        const role = userSnap.data().role;
        router.push(role === 'buyer' ? '/mypage/buyer' : '/mypage/seller');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const selectRole = async (role: 'buyer' | 'seller') => { // ✅ 타입 추가
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      email: user.email,
      role,
    });
    router.push(role === 'buyer' ? '/mypage/buyer' : '/mypage/seller');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
      <h1 className="text-xl font-bold">역할을 선택하세요</h1>
      <button
        onClick={() => selectRole('buyer')}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        구매자
      </button>
      <button
        onClick={() => selectRole('seller')}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        판매자
      </button>
    </div>
  );
}
