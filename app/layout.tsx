import type { Metadata, Viewport } from 'next';
import { Instrument_Sans } from 'next/font/google';
import './globals.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-instrument-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
  ),
  title: 'Deal Qualification System | Vercel Solutions Engineering',
  description:
    'Enterprise deal qualification workbench evaluating AE and SA discovery notes against MEDDPICC criteria with structured stage-gate scoring and CRM writeback.',
  openGraph: {
    title: 'Deal Qualification System | Vercel Solutions Engineering',
    description:
      'Enterprise deal qualification workbench evaluating AE and SA discovery notes against MEDDPICC criteria with structured stage-gate scoring and CRM writeback.',
    type: 'website',
    siteName: 'Deal Desk OS',
  },
  twitter: {
    card: 'summary',
    title: 'Deal Qualification System | Vercel Solutions Engineering',
    description:
      'Enterprise deal qualification workbench evaluating AE and SA discovery notes against MEDDPICC criteria with structured stage-gate scoring and CRM writeback.',
  },
};

export const viewport: Viewport = {
  themeColor: '#F8F8F6',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={instrumentSans.variable}>
      <body className="font-sans min-h-screen bg-[#F8F8F6] text-[#111215] antialiased selection:bg-[#0F52BA] selection:text-white">
        {children}
      </body>
    </html>
  );
}
