import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PDFlow — Free Online PDF Tools | Merge, Split, Compress & Convert',
  alternates: {
    canonical: '/',
  },
};

const features = [
  {
    title: 'Merge PDFs',
    description:
      'Combine multiple PDF files into a single document in seconds. Drag and drop your files, reorder pages, and download a perfectly merged PDF.',
    href: '/dashboard/upload',
  },
  {
    title: 'Split PDF',
    description:
      'Extract specific pages or split a large PDF into smaller files. Choose exactly which pages you need — no software installation required.',
    href: '/dashboard/upload',
  },
  {
    title: 'Compress PDF',
    description:
      'Reduce PDF file size without losing quality. Optimise documents for email, web uploads, or archiving while keeping text and images crisp.',
    href: '/dashboard/upload',
  },
  {
    title: 'Convert PDF to PNG',
    description:
      'Turn PDF pages into high-quality PNG images. Perfect for presentations, thumbnails, or sharing individual pages as images.',
    href: '/dashboard/upload',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Free Online PDF Tools
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Merge, split, compress, and convert your PDFs entirely in the cloud.
          No installs, no sign-up walls — just fast, secure document processing.
        </p>
        <div className="mt-10">
          <Link
            href="/dashboard/upload"
            className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Start Processing — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-card-foreground">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
              <Link
                href={feature.href}
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Try it now &rarr;
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Brief trust section */}
      <section className="border-t bg-muted/40 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground">
            Why Choose PDFlow?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Your files are processed securely in the cloud and automatically
            deleted after processing. PDFlow is free to use, works on any
            device, and requires zero software installation.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PDFlow. All rights reserved.</p>
      </footer>
    </main>
  );
}
