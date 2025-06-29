import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

export async function fetchNicknames(userId: string) {
  const snapshot = await getDocs(collection(db, 'users', userId, 'nicknames'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as { id: string, nickname: string }[];
}

export async function addNickname(userId: string, nickname: string) {
  await addDoc(collection(db, 'users', userId, 'nicknames'), {
    nickname,
    createdAt: new Date(),
  });
}

export async function deleteNickname(userId: string, nicknameId: string) {
  await deleteDoc(doc(db, 'users', userId, 'nicknames', nicknameId));
}
