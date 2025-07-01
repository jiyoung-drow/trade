import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata = {
  title: 'Your App Title',
  description: 'Your App Description',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="relative pb-16 max-w-md mx-auto">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
