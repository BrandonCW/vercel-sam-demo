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
    <html lang="en">
      <body className="min-h-screen bg-[#F8F8F6] text-[#111215] antialiased selection:bg-[#0F52BA] selection:text-white">
        {children}
      </body>
    </html>
  );
}
