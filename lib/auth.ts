// lib/auth.ts

import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error(error);
    alert('로그인에 실패했습니다.');
  }
};
