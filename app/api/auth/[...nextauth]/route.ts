// app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  // 공급자 (Providers) 설정
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // 콜백 (Callbacks) 설정
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
};

// NextAuth 핸들러를 생성합니다.
// Next.js 라우터는 이 핸들러를 통해 GET 및 POST 요청을 처리하게 됩니다.
const handler = NextAuth(authOptions);

// Next.js App Router가 인식할 수 있도록 GET과 POST로 핸들러를 내보냅니다.
// 이렇게 하면 "authOptions"를 직접 export하는 오류를 해결할 수 있습니다.
export { handler as GET, handler as POST };