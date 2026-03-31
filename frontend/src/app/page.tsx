'use client';

import React, { useState, useCallback } from 'react';
import { FileDropzone } from '@/components/file-dropzone';
import { PdfEditor } from '@/components/pdf-editor';
import { ResponsiveAdSlot, AdSlot } from '@/components/ad-slot';
import {
  FileText,
  Merge,
  Scissors,
  Minimize2,
  FileOutput,
  Droplets,
  ScanText,
  PenTool,
  Upload,
  MousePointerClick,
  Download,
  Shield,
  Clock,
  Lock,
  BadgeCheck,
} from 'lucide-react';

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [editorMode, setEditorMode] = useState(false);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    if (newFiles.length > 0) {
      setFiles(newFiles);
      setEditorMode(true);
    }
  }, []);

  // Editor mode: minimal header + FileEditor — NO ads
  if (editorMode) {
    return (
      <div className="h-screen flex flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <button
            onClick={() => {
              setEditorMode(false);
              setFiles([]);
            }}
            className="flex items-center gap-2 group"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-primary-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">PDFlow</span>
          </button>
        </header>
        <PdfEditor
          initialFiles={files}
          onStartOver={() => {
            setEditorMode(false);
            setFiles([]);
          }}
        />
      </div>
    );
  }

  // Landing mode: SEO-rich content with hero dropzone
  return (
    <main className="min-h-screen bg-background">
      {/* Hero section */}
      <section className="flex flex-col items-center justify-center px-4 pt-16 pb-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground">
            <FileText className="h-5.5 w-5.5" />
          </div>
          <span className="text-2xl font-bold tracking-tight">PDFlow</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-center tracking-tight max-w-3xl mb-4">
          Free Online PDF Editor — Edit, Convert, Merge & More
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground text-center max-w-2xl mb-10">
          Edit PDF text directly, merge multiple files, compress for smaller size, convert between formats, and sign documents — all in your browser, completely free.
        </p>

        {/* Hero dropzone */}
        <div className="w-full max-w-2xl">
          <FileDropzone
            files={files}
            onFilesChange={handleFilesChange}
            mode="hero"
            multiple={false}
          />
        </div>
      </section>

      {/* Top leaderboard ad */}
      <ResponsiveAdSlot id="landing-top" className="my-8" />

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="sr-only">PDF Tools and Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<FileText className="h-6 w-6" />}
            title="Edit PDF Text"
            description="Click on any text in your PDF and edit it directly in the browser. Change wording, fix typos, and update content without needing desktop software."
          />
          <FeatureCard
            icon={<Merge className="h-6 w-6" />}
            title="Merge PDFs"
            description="Combine multiple PDF files into a single document. Drag and drop to reorder pages before merging for the perfect result."
          />
          <FeatureCard
            icon={<Scissors className="h-6 w-6" />}
            title="Split PDF"
            description="Extract specific pages or split a large PDF into smaller files. Choose exactly which pages you need from any document."
          />
          <FeatureCard
            icon={<Minimize2 className="h-6 w-6" />}
            title="Compress PDF"
            description="Reduce PDF file size while maintaining quality. Ideal for email attachments and faster uploads with optimized compression."
          />
          <FeatureCard
            icon={<FileOutput className="h-6 w-6" />}
            title="Convert PDF to Word"
            description="Convert PDF documents to editable Word, Excel, or PowerPoint files. Also convert images, DOCX, XLSX, and PPTX back to PDF format."
          />
          <FeatureCard
            icon={<Droplets className="h-6 w-6" />}
            title="Add Watermark"
            description="Protect your documents with custom text or image watermarks. Adjust position, opacity, and rotation to match your branding needs."
          />
          <FeatureCard
            icon={<ScanText className="h-6 w-6" />}
            title="OCR Text Recognition"
            description="Extract text from scanned PDFs and images using optical character recognition. Make scanned documents searchable and copyable."
          />
          <FeatureCard
            icon={<PenTool className="h-6 w-6" />}
            title="Digital Signature"
            description="Sign PDF documents electronically. Draw your signature or type it, then place it anywhere on the page for quick, professional signing."
          />
        </div>
      </section>

      {/* Inline rectangle ad */}
      <div className="flex justify-center my-4">
        <AdSlot id="landing-inline" size="rectangle" />
      </div>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StepCard
            step={1}
            icon={<Upload className="h-8 w-8" />}
            title="Upload Your File"
            description="Drag and drop your PDF, Word, Excel, PowerPoint, or image file into the editor. No account or sign-up needed."
          />
          <StepCard
            step={2}
            icon={<MousePointerClick className="h-8 w-8" />}
            title="Edit & Transform"
            description="Choose from a full suite of tools: edit text, merge, split, compress, convert, add watermarks, or sign your document."
          />
          <StepCard
            step={3}
            icon={<Download className="h-8 w-8" />}
            title="Download Result"
            description="Your processed file is ready in seconds. Download it directly to your device — no watermarks, no limitations."
          />
        </div>
      </section>

      {/* Bottom leaderboard ad */}
      <ResponsiveAdSlot id="landing-bottom" className="my-8" />

      {/* Trust indicators */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <TrustBadge icon={<BadgeCheck className="h-5 w-5" />} text="No Registration" />
          <TrustBadge icon={<Clock className="h-5 w-5" />} text="Files Deleted in 30 Min" />
          <TrustBadge icon={<Lock className="h-5 w-5" />} text="256-bit Encryption" />
          <TrustBadge icon={<Shield className="h-5 w-5" />} text="No Watermarks" />
        </div>
      </section>

      {/* FAQ section with schema.org FAQPage markup */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <FaqItem
            question="Is PDFlow free?"
            answer="Yes, PDFlow is completely free to use. There are no hidden charges, no premium tiers for basic features, and no limits on how many files you can process."
          />
          <FaqItem
            question="Do I need to register or create an account?"
            answer="No registration is needed. Just open PDFlow in your browser, upload your file, and start editing. Your documents are processed without requiring any personal information."
          />
          <FaqItem
            question="Is my data safe?"
            answer="Your privacy is a priority. All files are processed securely and automatically deleted from our servers within 30 minutes. We use 256-bit encryption for all file transfers."
          />
          <FaqItem
            question="What file formats are supported?"
            answer="PDFlow supports PDF, Microsoft Word (DOCX), Excel (XLSX), PowerPoint (PPTX), and common image formats including PNG, JPG, and TIFF. You can convert between any of these formats."
          />
        </div>
        {/* FAQPage structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'Is PDFlow free?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes, PDFlow is completely free to use. There are no hidden charges, no premium tiers for basic features, and no limits on how many files you can process.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Do I need to register or create an account?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'No registration is needed. Just open PDFlow in your browser, upload your file, and start editing. Your documents are processed without requiring any personal information.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Is my data safe?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Your privacy is a priority. All files are processed securely and automatically deleted from our servers within 30 minutes. We use 256-bit encryption for all file transfers.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What file formats are supported?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'PDFlow supports PDF, Microsoft Word (DOCX), Excel (XLSX), PowerPoint (PPTX), and common image formats including PNG, JPG, and TIFF. You can convert between any of these formats.',
                  },
                },
              ],
            }),
          }}
        />
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PDFlow. Free online PDF editor.</p>
      </footer>
    </main>
  );
}

/* ---- Sub-components ---- */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border bg-card p-6 transition-colors hover:bg-accent/50">
      <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </article>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="flex flex-col items-center text-center">
      <div className="relative mb-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="absolute -top-2 -right-2 flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {step}
        </span>
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </article>
  );
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border bg-card p-3">
      <span className="text-primary">{icon}</span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <article className="rounded-lg border bg-card p-5">
      <h3 className="text-base font-semibold mb-2">{question}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
    </article>
  );
}
