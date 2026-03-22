import React from 'react';

interface ScreenContainerProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export default function ScreenContainer({ children, title, subtitle, rightAction }: ScreenContainerProps) {
  return (
    <div className="screen-container flex flex-col min-h-full pb-24">
      {title && (
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.15em] mt-1 opacity-60">{subtitle}</p>
            )}
          </div>
          {rightAction && <div>{rightAction}</div>}
        </div>
      )}
      <div className="flex-1 space-y-5">
        {children}
      </div>
    </div>
  );
}
