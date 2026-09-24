import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Next } from 'next/font/google';
import './globals.css';

const atkinson = Atkinson_Hyperlegible_Next({
  variable: '--font-atkinson',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Espace auteur — Questionnaires',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${atkinson.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
