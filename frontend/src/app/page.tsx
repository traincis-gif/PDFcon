'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, Merge, Scissors, Minimize2, Image, ArrowRight, Shield, Zap, Cloud } from 'lucide-react';

const features = [
  {
    icon: <Merge className="h-6 w-6" />,
    title: 'Merge PDFs',
    description: 'Combine multiple PDF files into a single document in seconds.',
  },
  {
    icon: <Scissors className="h-6 w-6" />,
    title: 'Split PDFs',
    description: 'Extract specific pages or split a PDF into individual pages.',
  },
  {
    icon: <Minimize2 className="h-6 w-6" />,
    title: 'Compress',
    description: 'Reduce file size while maintaining quality for easy sharing.',
  },
  {
    icon: <Image className="h-6 w-6" />,
    title: 'Convert to PNG',
    description: 'Turn document pages into high-quality PNG images.',
  },
];

const highlights = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Lightning Fast',
    description: 'Processing starts immediately. Most jobs complete in under 30 seconds.',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Secure',
    description: 'Files are encrypted in transit and deleted after processing.',
  },
  {
    icon: <Cloud className="h-5 w-5" />,
    title: 'Cloud-Based',
    description: 'No software to install. Works on any device with a browser.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">PDFlow</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium mb-6 text-muted-foreground">
            PDF processing made simple
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
            Process your documents
            <br />
            <span className="text-primary">with confidence</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Merge, split, compress, and convert PDFs in seconds. No software to install,
            no complicated settings. Just upload and go.
          </p>
          <div className="flex items-center gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start for Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Log in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Everything you need for document processing
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border bg-background p-6 hover:shadow-md transition-shadow"
              >
                <div className="rounded-full bg-primary/10 text-primary w-12 h-12 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {highlights.map((h) => (
              <div key={h.title} className="text-center">
                <div className="rounded-full bg-primary/10 text-primary w-10 h-10 flex items-center justify-center mx-auto mb-3">
                  {h.icon}
                </div>
                <h3 className="font-semibold mb-1">{h.title}</h3>
                <p className="text-sm text-muted-foreground">{h.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>PDFlow</span>
          </div>
          <p>Built for fast, secure document processing.</p>
        </div>
      </footer>
    </div>
  );
}
