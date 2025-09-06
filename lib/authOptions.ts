// lib/authOptions.ts

import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { cert } from "firebase-admin/app";

// Firebase Admin SDK 서비스 계정 설정
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID!,
      clientSecret: process.env.KAKAO_CLIENT_SECRET!,
    }),
  ],
  adapter: FirestoreAdapter({
    credential: cert(serviceAccount),
  }),
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      // ✅ 로그인 시 user.id(Firebase uid) 또는 token.sub(OAuth uid)를 token.uid에 저장
      if (user) {
        token.uid = user.id || token.sub || null;
      }
      return token;
    },
    async session({ session, token }) {
      // ✅ 항상 session.user.id가 존재하도록 보장 (Firestore Document ID 용)
      if (session.user) {
        session.user.id = (token.uid as string) ?? (token.sub as string) ?? "";
      }
      return session;
    },
  },
};
