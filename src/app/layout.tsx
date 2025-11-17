// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import LayoutClient from './LayoutClient';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'KhananNetra - Mining Monitoring System',
  description: 'Government platform for mining activity monitoring and compliance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <LayoutClient>{children}</LayoutClient>
    </html>
  );
}