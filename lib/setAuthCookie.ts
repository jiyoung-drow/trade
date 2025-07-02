// lib/setAuthCookie.ts

import { getIdToken } from "firebase/auth";
import Cookies from "js-cookie";

export const setAuthCookie = async (user) => {
  const token = await getIdToken(user);
  Cookies.set("firebaseAuthToken", token, { expires: 1 });
};

export const removeAuthCookie = () => {
  Cookies.remove("firebaseAuthToken");
};
