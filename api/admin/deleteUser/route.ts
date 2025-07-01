'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function ApplicationNewPage() {
  const router = useRouter();
  const [role, setRole] = useState<'buyer' | 'seller' | null>(null);
  const [status, setStatus] = useState('미접');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [nickname, setNickname] = useState('');
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role === 'buyer' || data.role === 'seller') {
            setRole(data.role);
          }
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      setMessage('로그인이 필요합니다.');
      return;
    }

    try {
      const applicationData: any = {
        status,
        quantity,
        price,
        createdAt: Timestamp.now(),
        userId: user.uid,
        role,
      };

      if (role === 'seller') {
        applicationData.nickname = nickname;
        applicationData.bank = bank;
        applicationData.account = account;
      }

      await addDoc(collection(db, 'applications'), applicationData);
      alert('✅ 신청서가 작성되었습니다.');
      router.push(role === 'buyer' ? '/dashboard/buyer' : '/dashboard/seller');
    } catch (error) {
      console.error(error);
      setMessage('신청서 작성 중 오류가 발생했습니다.');
    }
  };

  if (!role) return <p className="p-4">권한 확인 중...</p>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold mb-2">신청서 작성</h1>
      {message && <p>{message}</p>}

      <label className="block">
        상태:
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border p-1 rounded w-full"
        >
          <option value="미접">미접</option>
          <option value="접속">접속</option>
        </select>
      </label>

      <label className="block">
        수량:
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          className="border p-1 rounded w-full"
        />
      </label>

      <label className="block">
        가격:
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(parseInt(e.target.value))}
          className="border p-1 rounded w-full"
        />
      </label>

      {role === 'seller' && (
        <>
          <label className="block">
            닉네임:
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="border p-1 rounded w-full"
            />
          </label>

          <label className="block">
            은행명:
            <input
              type="text"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="border p-1 rounded w-full"
            />
          </label>

          <label className="block">
            계좌번호:
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="border p-1 rounded w-full"
            />
          </label>
        </>
      )}

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full mt-2 hover:bg-blue-700 transition"
      >
        신청서 작성 완료
      </button>
    </div>
  );
}
