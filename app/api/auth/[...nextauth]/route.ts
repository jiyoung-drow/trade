// app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // ✅ 사용자 고유 ID를 session.user에 포함시켜줌
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
};

// NextAuth 핸들러를 생성합니다.
// 이 핸들러는 GET 및 POST 요청을 모두 처리합니다.
const handler = NextAuth(authOptions);

// Next.js App Router가 인식할 수 있도록 핸들러를 GET과 POST로 export합니다.
export { handler as GET, handler as POST };