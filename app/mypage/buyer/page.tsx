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
} from 'firebase/firestore';
import { User } from 'firebase/auth';

export default function BuyerMyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [adminAccount, setAdminAccount] = useState<any>(null);

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

        const adminAccountDoc = await getDoc(doc(db, 'settings', 'adminBankAccount'));
        if (adminAccountDoc.exists()) {
          setAdminAccount(adminAccountDoc.data());
        }

        return () => unsubscribeSnapshot();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCharge = async () => {
    const amount = prompt('충전하실 금액을 입력하세요.');
    const depositorName = prompt('입금자명을 입력하세요.');

    if (!amount || !depositorName) {
      alert('금액과 입금자명을 모두 입력해 주세요.');
      return;
    }

    await addDoc(collection(db, 'chargeRequests'), {
      uid: user?.uid,
      amount: Number(amount),
      depositorName,
      status: '대기중',
      createdAt: new Date(),
    });

    alert(
      `다음 계좌로 ${amount}원을 입금하신 뒤 충전 신청이 완료되었습니다.\n\n` +
      `은행명: ${adminAccount?.bankName}\n` +
      `계좌번호: ${adminAccount?.accountNumber}\n` +
      `예금주: ${adminAccount?.holderName}\n\n` +
      `관리자가 확인 후 충전 처리해 드립니다.`
    );
  };

  const handleWithdraw = async () => {
    const bankName = prompt('출금받을 은행명을 입력하세요.');
    const accountNumber = prompt('출금받을 계좌번호를 입력하세요.');
    const holderName = prompt('예금주 성함을 입력하세요.');
    const amount = prompt('출금하실 금액을 입력하세요.');

    if (!bankName || !accountNumber || !holderName || !amount) {
      alert('모든 정보를 입력해 주세요.');
      return;
    }

    await addDoc(collection(db, 'withdrawRequests'), {
      uid: user?.uid,
      bankName,
      accountNumber,
      holderName,
      amount: Number(amount),
      status: '대기중',
      createdAt: new Date(),
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
      <h1 className="text-xl font-bold">구매자 마이페이지</h1>
      <div className="text-lg">보유 금액: {balance.toLocaleString()}원</div>
      <div className="flex space-x-2">
        <button
          onClick={handleCharge}
          className="flex-1 bg-green-500 text-white rounded p-2"
        >
          충전하기
        </button>
        <button
          onClick={handleWithdraw}
          className="flex-1 bg-blue-500 text-white rounded p-2"
        >
          출금하기
        </button>
      </div>
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
