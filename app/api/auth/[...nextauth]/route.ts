// app/api/auth/[...nextauth]/route.ts

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// NextAuth 설정 옵션 객체를 정의합니다.
// 이 객체는 직접 내보내는 것이 아닙니다.
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
const handler = NextAuth(authOptions);

// 생성된 핸들러를 Next.js가 인식하는 GET과 POST 이름으로 내보냅니다.
// 이렇게 하면 라우트 파일의 타입 오류가 해결됩니다.
export { handler as GET, handler as POST };