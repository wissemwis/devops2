import type { ReactNode } from 'react';

export function AnnotationErreur({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="relative mt-ligne leading-[32px] text-stylo-rouge">
      <span
        aria-hidden="true"
        className="absolute right-[calc(100%+1rem)] font-bold sm:right-[calc(100%+3.25rem)]"
      >
        !
      </span>
      {children}
    </p>
  );
}
