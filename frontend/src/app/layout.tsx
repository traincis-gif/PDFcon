import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'PDFlow — Free Online PDF Editor | Edit, Convert, Merge PDF',
    template: '%s — PDFlow',
  },
  description:
    'Edit PDF text inline, merge, split, compress, convert Word/Excel/PPT to PDF, OCR, add watermarks, and sign documents — all free, no registration required.',
  keywords: [
    'pdf editor',
    'edit pdf online',
    'merge pdf',
    'split pdf',
    'compress pdf',
    'pdf to word',
    'word to pdf',
    'excel to pdf',
    'ppt to pdf',
    'ocr pdf',
    'watermark pdf',
    'free pdf editor',
    'online pdf tools',
    'sign pdf',
    'pdf converter',
    'pdf compressor',
    'pdf merger',
    'pdf splitter',
    'edit pdf text',
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
    title: 'PDFlow — Free Online PDF Editor | Edit, Convert, Merge PDF',
    description:
      'Edit PDF text inline, merge, split, compress, and convert documents online for free. No registration needed.',
    type: 'website',
    siteName: 'PDFlow',
    url: 'https://pdflow.io',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFlow — Free Online PDF Editor | Edit, Convert, Merge PDF',
    description:
      'Edit PDF text inline, merge, split, compress, and convert documents online for free. No registration needed.',
  },
  verification: {
    google: 'GOOGLE_SITE_VERIFICATION_PLACEHOLDER',
    yandex: 'YANDEX_VERIFICATION_PLACEHOLDER',
  },
  other: {
    'theme-color-light': '#ffffff',
    'theme-color-dark': '#0f172a',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'PDFlow',
  description:
    'Free online PDF editor — edit text inline, merge, split, compress, convert Word/Excel/PPT, OCR, watermark, and sign documents.',
  url: 'https://pdflow.io',
  applicationCategory: 'Productivity',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" />
        <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
