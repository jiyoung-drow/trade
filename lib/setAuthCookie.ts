// lib/setAuthCookie.ts
import Cookies from "js-cookie";
import { getIdToken } from "firebase/auth";
import { User } from "firebase/auth";

export const setAuthCookie = async (user: User) => {
  const token = await getIdToken(user);
  Cookies.set("token", token, { expires: 1 });
};