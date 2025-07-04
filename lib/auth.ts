import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { app } from './firebase';

const authInstance = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(authInstance, googleProvider);
  } catch (error) {
    console.error(error);
    alert('로그인에 실패했습니다.');
  }
};