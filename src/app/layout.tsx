import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Line Tracker — Sharp Lines & Public Money',
  description: 'Track NBA, NHL, and College Basketball lines with sharp money and public betting data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
