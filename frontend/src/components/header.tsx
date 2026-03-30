'use client';

import React from 'react';
import { Button } from './ui/button';
import { Menu, FileText } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex items-center gap-2 lg:hidden">
        <FileText className="h-5 w-5 text-primary" />
        <span className="font-semibold">PDFlow</span>
      </div>

      <div className="flex-1" />
    </header>
  );
}
