'use client';

import Cookies from 'js-cookie';
import { User } from 'firebase/auth';

export const setAuthCookie = async (user: User) => {
  try {
    const token = await user.getIdToken();
    Cookies.set('token', token, { expires: 1 });
    console.log('Auth cookie set successfully');
  } catch (error) {
    console.error('Error setting auth cookie:', error);
  }
};
