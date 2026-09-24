import type { ReactNode } from 'react';

export function Feuille({ marge, children }: { marge: ReactNode; children: ReactNode }) {
  return (
    <div className="feuille min-h-dvh">
      <div className="grid min-h-dvh grid-cols-1 sm:grid-cols-[var(--marge-x)_1fr]">
        <div className="px-8 pt-ligne text-sm font-bold uppercase tracking-wide text-graphite-doux sm:px-3 sm:text-right">
          {marge}
        </div>
        <main className="px-8 pb-[calc(var(--spacing-ligne)*3)] sm:pt-ligne sm:pr-10 sm:pl-10">
          {children}
        </main>
      </div>
    </div>
  );
}
