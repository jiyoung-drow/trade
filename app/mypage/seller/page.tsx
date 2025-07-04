'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function SellerMyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState(0);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setBalance(data.balance ?? 0);
          setBank(data.bank ?? '');
          setAccount(data.account ?? '');
          setName(data.name ?? '');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleWithdrawRequest = async () => {
    if (!user) return;
    if (!bank || !account || !name || !amount) {
      alert('모든 정보를 입력해주세요.');
      return;
    }

    await addDoc(collection(db, 'withdrawRequests'), {
      uid: user.uid,
      email: user.email,
      role: 'seller',
      bank,
      account,
      name,
      amount: Number(amount),
      createdAt: serverTimestamp(),
    });

    alert('출금 요청이 완료되었습니다.');
    setShowWithdraw(false);
  };

  const handleWithdrawClick = () => {
    alert('월 2회 출금 가능합니다. 신중히 출금 신청 부탁드립니다!');
    setShowWithdraw(true);
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">마이페이지 (판매자)</h1>
      <p>보유 금액: {balance.toLocaleString()}원</p>

      <button
        onClick={handleWithdrawClick}
        className="w-full bg-red-500 hover:bg-red-600 text-white rounded p-2"
      >
        출금 신청
      </button>

      {showWithdraw && (
        <div className="space-y-2 mt-4 border p-4 rounded">
          <input
            type="text"
            placeholder="은행명"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="w-full border rounded p-2"
          />
          <input
            type="text"
            placeholder="계좌번호"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="w-full border rounded p-2"
          />
          <input
            type="text"
            placeholder="성함"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded p-2"
          />
          <input
            type="number"
            placeholder="출금 금액"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded p-2"
          />
          <button
            onClick={() => setAmount(balance.toString())}
            className="w-full bg-gray-300 hover:bg-gray-400 text-black rounded p-2"
          >
            전액 입력
          </button>
          <button
            onClick={handleWithdrawRequest}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded p-2"
          >
            출금 신청 완료
          </button>
        </div>
      )}
    </div>
  );
}