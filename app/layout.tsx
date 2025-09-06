// app/layout.tsx

import "./globals.css";
import { ReactNode } from "react";
import Providers from "./providers";

export const metadata = {
  title: "TocToc",
  description: "TocToc 거래 플랫폼",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head />
      <body className="relative pb-16">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
