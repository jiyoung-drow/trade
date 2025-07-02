'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function BuyerMyPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showCharge, setShowCharge] = useState(false);
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [payerName, setPayerName] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setBalance(data.balance || 0);
          setBank(data.bank || '');
          setAccount(data.account || '');
          setName(data.name || '');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleWithdrawRequest = async () => {
    if (!bank || !account || !name || !amount) {
      alert('모든 정보를 입력해주세요.');
      return;
    }

    await addDoc(collection(db, 'withdrawRequests'), {
      uid: user.uid,
      email: user.email,
      role: 'buyer',
      bank,
      account,
      name,
      amount: Number(amount),
      createdAt: serverTimestamp(),
    });

    alert('출금 요청이 완료되었습니다.');
    setShowWithdraw(false);
  };

  const handleChargeRequest = async () => {
    if (!payerName || !chargeAmount) {
      alert('입금자명과 충전 금액을 입력해주세요.');
      return;
    }

    await addDoc(collection(db, 'chargeRequests'), {
      uid: user.uid,
      email: user.email,
      role: 'buyer',
      payerName,
      chargeAmount: Number(chargeAmount),
      createdAt: serverTimestamp(),
    });

    alert('충전 요청이 완료되었습니다.');
    setShowCharge(false);
    setPayerName('');
    setChargeAmount('');
  };

  const handleWithdrawClick = () => {
    alert('월 1회 출금 가능합니다. 신중히 출금 신청 부탁드립니다!');
    setShowWithdraw(true);
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">마이페이지 (구매자)</h1>
      <p>보유 금액: {balance.toLocaleString()}원</p>

      {/* 출금 버튼 */}
      <button
        onClick={handleWithdrawClick}
        className="w-full bg-red-500 hover:bg-red-600 text-white rounded p-2"
      >
        출금 신청
      </button>

      {/* 충전 버튼 */}
      <button
        onClick={() => setShowCharge(true)}
        className="w-full bg-green-500 hover:bg-green-600 text-white rounded p-2"
      >
        충전 요청
      </button>

      {/* 출금 입력 폼 */}
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
            onClick={() => setAmount(balance)}
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

      {/* 충전 입력 폼 */}
      {showCharge && (
        <div className="space-y-2 mt-4 border p-4 rounded">
          <p>입금 후 아래 내용을 입력하고 충전 요청 버튼을 눌러주세요.</p>
          <p className="text-sm text-gray-600">관리자 계좌: 국민은행 123456-78-91011</p>
          <input
            type="text"
            placeholder="입금자명"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            className="w-full border rounded p-2"
          />
          <input
            type="number"
            placeholder="충전 금액"
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
            className="w-full border rounded p-2"
          />
          <button
            onClick={handleChargeRequest}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded p-2"
          >
            충전 요청 완료
          </button>
        </div>
      )}
    </div>
  );
}
