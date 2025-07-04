'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { User } from 'firebase/auth';

export default function SellerMyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const q = query(
          collection(db, 'applications'),
          where('uid', '==', currentUser.uid)
        );
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          setApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });

        const balanceDoc = await getDoc(doc(db, 'balances', currentUser.uid));
        if (balanceDoc.exists()) {
          setBalance(balanceDoc.data().amount || 0);
        }

        return () => unsubscribeSnapshot();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleWithdraw = async () => {
    if (!user) return;

    const bankName = prompt('출금받을 은행명을 입력하세요.');
    const accountNumber = prompt('출금받을 계좌번호를 입력하세요.');
    const holderName = prompt('예금주 성함을 입력하세요.');
    const amountStr = prompt('출금하실 금액을 입력하세요.');

    if (!bankName || !accountNumber || !holderName || !amountStr) {
      alert('모든 정보를 입력해 주세요.');
      return;
    }

    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert('유효한 출금 금액을 입력해 주세요.');
      return;
    }

    // ✅ 보유금액 체크
    if (amount > balance) {
      alert('보유 금액을 초과하여 출금할 수 없습니다.');
      return;
    }

    await addDoc(collection(db, 'withdrawRequests'), {
      uid: user.uid,
      email: user.email,
      bankName,
      accountNumber,
      holderName,
      amount,
      status: '대기중',
      requestedAt: Timestamp.now(),
    });

    alert('출금 신청이 완료되었습니다. 관리자가 확인 후 처리해 드립니다.');
  };

  const handleDelete = async (id: string) => {
    if (confirm('해당 신청서를 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'applications', id));
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">판매자 마이페이지</h1>
      <div className="text-lg">보유 금액: {balance.toLocaleString()}원</div>
      <button
        onClick={handleWithdraw}
        className="w-full bg-blue-500 text-white rounded p-2"
      >
        출금하기
      </button>
      {applications.length === 0 ? (
        <p>작성한 신청서가 없습니다.</p>
      ) : (
        applications.map((app) => (
          <div key={app.id} className="border rounded p-4 space-y-1">
            <p>항목: {app.item}</p>
            <p>수량: {app.quantity}</p>
            <p>상태: {app.status}</p>
            <p>작성일: {app.createdAt?.toDate().toLocaleString() ?? '---'}</p>
            <button
              onClick={() => handleDelete(app.id)}
              className="bg-red-500 text-white rounded p-1 mt-2 w-full"
            >
              삭제
            </button>
          </div>
        ))
      )}
    </div>
  );
}
