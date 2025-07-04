import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    console.log('✅ 구글 로그인 성공');
  } catch (error) {
    console.error('❌ 구글 로그인 실패:', error);
    alert('구글 로그인에 실패했습니다. 다시 시도해주세요.');
  }
};