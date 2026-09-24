import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deal Qualification System | Vercel Solutions Engineering',
  description:
    'Automated enterprise deal qualification workbench evaluating AE/SA discovery against MEDDPICC criteria with System 1 and System 2 agent intelligence.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-[#f4f4f5] antialiased selection:bg-[#0070f3] selection:text-white">
        {children}
      </body>
    </html>
  );
}
