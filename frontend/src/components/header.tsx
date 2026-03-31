'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { Menu, FileText } from 'lucide-react';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <Link href="/" className="flex items-center gap-2">
        <div className="flex items-center justify-center h-7 w-7 rounded-md bg-primary text-primary-foreground">
          <FileText className="h-4 w-4" />
        </div>
        <span className="font-semibold tracking-tight">PDFlow</span>
      </Link>

      <div className="flex-1" />
    </header>
  );
}
