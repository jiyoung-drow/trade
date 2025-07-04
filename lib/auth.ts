// lib/auth.ts

import { signInWithPopup, signInWithRedirect, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export const signInWithGoogle = async () => {
  try {
    // 로그인 전에 persistence 설정을 먼저 적용하여 충돌 방지
    await setPersistence(auth, browserLocalPersistence);

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isIOS) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      await signInWithPopup(auth, googleProvider);
    }
  } catch (error) {
    console.error('Google 로그인 실패:', error);
    alert('구글 로그인에 실패했습니다. 다시 시도해주세요.');
  }
};
