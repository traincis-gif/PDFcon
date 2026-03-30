import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'PDFlow — Free Online PDF Tools',
    template: '%s — PDFlow',
  },
  description:
    'Free online PDF tools — merge, split, compress, and convert PDFs to PNG instantly. No installation required. Fast, secure, cloud-based document processing with PDFlow.',
  keywords: [
    'PDF tools',
    'merge PDF',
    'split PDF',
    'compress PDF',
    'convert PDF to PNG',
    'online PDF editor',
    'free PDF tools',
    'PDF merger',
    'PDF splitter',
    'PDF compressor',
    'PDFlow',
  ],
  metadataBase: new URL('https://pdflow.io'),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'PDFlow — Free Online PDF Tools',
    description:
      'Merge, split, compress, and convert PDFs online for free. Fast, secure, and easy to use.',
    type: 'website',
    siteName: 'PDFlow',
    url: 'https://pdflow.io',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFlow — Free Online PDF Tools',
    description:
      'Merge, split, compress, and convert PDFs online for free. Fast, secure, and easy to use.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
