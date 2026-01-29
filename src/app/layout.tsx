import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'EV Runtime Preview',
  description: 'Local runtime preview for EV-first training flows.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
