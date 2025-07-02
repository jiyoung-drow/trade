'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function TradeInProgressSeller() {
  const { itemId } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [item, setItem] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [nicknameList, setNicknameList] = useState<string[]>(['닉네임1', '닉네임2']);
  const [selectedNickname, setSelectedNickname] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(600);

  useEffect(() => {
    const timer = setInterval(() => {
      if (item?.startedAt) {
        const elapsed = (Date.now() - item.startedAt.toDate().getTime()) / 1000;
        const remaining = 600 - elapsed;
        setTimeLeft(remaining > 0 ? Math.floor(remaining) : 0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [item]);

  useEffect(() => {
    const fetchItem = async (currentUser: any) => {
      const itemRef = doc(db, 'items', itemId as string);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        setItem({ id: itemSnap.id, ...itemSnap.data() });
      }

      onSnapshot(collection(itemRef, 'links'), (snapshot) => {
        setLinks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });
    };

    onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }
      setUser(currentUser);
      fetchItem(currentUser);
    });
  }, [itemId, router]);

  const handleSendNickname = async () => {
    if (!selectedNickname) {
      alert('닉네임을 선택하세요.');
      return;
    }
    await addDoc(collection(db, 'items', itemId as string, 'checks'), {
      nickname: selectedNickname,
      sentBy: user.uid,
      checkedAt: serverTimestamp(),
    });
    alert('닉네임 전송 완료');
  };

  const handleUploadPhoto = async () => {
    if (!photoFile) {
      alert('사진을 선택하세요.');
      return;
    }
    const storageRef = ref(storage, `items/${itemId}/photos/${Date.now()}_${photoFile.name}`);
    await uploadBytes(storageRef, photoFile);
    const url = await getDownloadURL(storageRef);
    await addDoc(collection(db, 'items', itemId as string, 'photos'), {
      imageUrl: url,
      uploadedAt: serverTimestamp(),
      uploadedBy: user.uid,
    });
    alert('사진 업로드 완료');
    setPhotoFile(null);
  };

  const handleApprove = async () => {
    await addDoc(collection(db, 'items', itemId as string, 'approvals'), {
      status: 'approved',
      approvedBy: user.uid,
      approvedAt: serverTimestamp(),
    });
    alert('승인 처리 완료');
  };

  const handleReject = async () => {
    await addDoc(collection(db, 'items', itemId as string, 'approvals'), {
      status: 'rejected',
      approvedBy: user.uid,
      approvedAt: serverTimestamp(),
    });
    alert('거절 처리 완료');
  };

  const handleRequestPhoto = async () => {
    await addDoc(collection(db, 'items', itemId as string, 'approvals'), {
      status: 'photoRequested',
      approvedBy: user.uid,
      approvedAt: serverTimestamp(),
    });
    alert('인증사진 요청 완료');
  };

  if (!item) return <div className="p-6 text-center">로딩 중...</div>;

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-lg font-bold">💼 거래 진행중 (판매자)</h1>
      <div className="border p-3 rounded">
        <div className="font-semibold">{item.title}</div>
        <div className="text-sm text-gray-600">남은 시간: {timeLeft}초</div>
      </div>

      <div>
        <h2 className="font-semibold mt-4">구매자가 보낸 링크</h2>
        {links.length === 0 ? (
          <p className="text-sm text-gray-500">아직 링크가 없습니다.</p>
        ) : (
          links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline text-blue-600"
            >
              {link.url}
            </a>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold mt-4">닉네임 전송</h2>
        <select
          value={selectedNickname}
          onChange={(e) => setSelectedNickname(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="">닉네임 선택</option>
          {nicknameList.map((nick, idx) => (
            <option key={idx} value={nick}>
              {nick}
            </option>
          ))}
        </select>
        <button
          onClick={handleSendNickname}
          className="w-full bg-green-500 text-white p-2 rounded"
        >
          닉네임 전송
        </button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold mt-4">인증 사진 업로드</h2>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
        />
        <button
          onClick={handleUploadPhoto}
          className="w-full bg-purple-500 text-white p-2 rounded"
        >
          사진 업로드
        </button>
      </div>

      <div className="space-y-2 mt-4">
        <h2 className="font-semibold">반려 사유 처리</h2>
        <button
          onClick={handleApprove}
          className="w-full bg-blue-500 text-white p-2 rounded"
        >
          승인
        </button>
        <button
          onClick={handleReject}
          className="w-full bg-red-500 text-white p-2 rounded"
        >
          거절
        </button>
        <button
          onClick={handleRequestPhoto}
          className="w-full bg-yellow-500 text-white p-2 rounded"
        >
          인증사진 요청
        </button>
      </div>
    </div>
  );
}
