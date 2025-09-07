import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import { FirestoreAdapter } from "@auth/firebase-adapter";
import { cert } from "firebase-admin/app";

// ✅ 환경 변수에서 서비스 계정 키 전체를 불러와 파싱
const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!firebaseServiceAccountKey) {
  throw new Error("❌ FIREBASE_SERVICE_ACCOUNT_KEY is not defined in the environment variables.");
}

const serviceAccount = JSON.parse(firebaseServiceAccountKey);
// Netlify 환경 변수에서 줄바꿈 문자를 올바르게 처리
serviceAccount.privateKey = serviceAccount.private_key.replace(/\\n/g, "\n");


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
