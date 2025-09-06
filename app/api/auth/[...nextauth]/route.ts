// app/api/auth/[...nextauth]/route.ts

// NextAuth, NextAuthOptions, 그리고 사용할 프로바이더를 불러옵니다.
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// authOptions 객체를 정의합니다. 이 객체는 NextAuth의 설정 정보를 담습니다.
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
};

// NextAuth 함수를 사용하여 핸들러를 생성합니다.
// 이렇게 하면 authOptions 객체가 라우트 핸들러로 변환됩니다.
const handler = NextAuth(authOptions);

// Next.js App Router가 인식할 수 있도록 GET과 POST로 핸들러를 내보냅니다.
// 이 부분이 핵심입니다. authOptions를 직접 내보내면 안 됩니다.
export { handler as GET, handler as POST };