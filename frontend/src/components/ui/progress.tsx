'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indeterminate?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indeterminate = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative h-3 w-full overflow-hidden rounded-full bg-secondary',
        className
      )}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div
        className={cn(
          'h-full bg-primary rounded-full',
          indeterminate
            ? 'w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]'
            : 'transition-all duration-300 ease-in-out'
        )}
        style={
          indeterminate
            ? undefined
            : { width: `${Math.min(100, Math.max(0, value))}%` }
        }
      />
    </div>
  )
);
Progress.displayName = 'Progress';

export { Progress };
