import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });

export const metadata: Metadata = {
  title: 'AgenticCRM',
  description: 'Self-hosted AI-powered WhatsApp CRM — a Sapheron Project',
  icons: { icon: '/logo.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#090b11', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
