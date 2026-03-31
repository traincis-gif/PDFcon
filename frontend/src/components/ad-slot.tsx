'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const AD_SIZES = {
  banner: { width: 468, height: 60 },
  leaderboard: { width: 728, height: 90 },
  rectangle: { width: 300, height: 250 },
  skyscraper: { width: 160, height: 600 },
} as const;

interface AdSlotProps {
  id: string;
  size: 'banner' | 'leaderboard' | 'rectangle' | 'skyscraper';
  className?: string;
}

export function AdSlot({ id, size, className }: AdSlotProps) {
  const dimensions = AD_SIZES[size];
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div
      className={cn(
        'ad-slot flex items-center justify-center mx-auto',
        className
      )}
      style={{
        width: `${dimensions.width}px`,
        maxWidth: '100%',
        height: `${dimensions.height}px`,
      }}
      data-ad-slot={id}
      data-ad-size={size}
      aria-hidden="true"
      role="presentation"
    >
      {isDev && (
        <div
          className="w-full h-full border-2 border-dashed border-muted-foreground/20 rounded-md flex flex-col items-center justify-center gap-1"
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">
            Advertisement
          </span>
          <span className="text-[10px] text-muted-foreground/30">
            {dimensions.width} x {dimensions.height}
          </span>
        </div>
      )}
    </div>
  );
}

/** Responsive ad slot: shows leaderboard on desktop, banner on mobile */
export function ResponsiveAdSlot({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className={cn('ad-slot mx-auto', className)} aria-hidden="true" role="presentation">
      {/* Leaderboard on md+ screens */}
      <div
        className="hidden md:flex items-center justify-center mx-auto"
        style={{ width: '728px', maxWidth: '100%', height: '90px' }}
        data-ad-slot={`${id}-leaderboard`}
        data-ad-size="leaderboard"
      >
        {isDev && (
          <div className="w-full h-full border-2 border-dashed border-muted-foreground/20 rounded-md flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">
              Advertisement
            </span>
            <span className="text-[10px] text-muted-foreground/30">728 x 90</span>
          </div>
        )}
      </div>
      {/* Banner on small screens */}
      <div
        className="flex md:hidden items-center justify-center mx-auto"
        style={{ width: '468px', maxWidth: '100%', height: '60px' }}
        data-ad-slot={`${id}-banner`}
        data-ad-size="banner"
      >
        {isDev && (
          <div className="w-full h-full border-2 border-dashed border-muted-foreground/20 rounded-md flex flex-col items-center justify-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">
              Advertisement
            </span>
            <span className="text-[10px] text-muted-foreground/30">468 x 60</span>
          </div>
        )}
      </div>
    </div>
  );
}
