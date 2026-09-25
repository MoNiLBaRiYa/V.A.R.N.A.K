import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'V.A.R.N.A.K. — Climate-Aware Paint Recommendation Platform',
  description: 'Visual Architecture & Radiance Navigation with Artificial Knowledge',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
