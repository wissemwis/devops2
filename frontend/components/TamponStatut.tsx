import type { Statut } from '@/services/mesQuestionnaires';

const TAMPONS: Record<Statut, { label: string; className: string }> = {
  brouillon: { label: 'brouillon', className: 'border border-dashed border-crayon text-crayon' },
  publie: { label: 'PUBLIÉ', className: 'border-2 border-encre font-bold text-encre -rotate-2' },
  ferme: { label: 'FERMÉ', className: 'border-2 border-tampon font-bold text-tampon' },
};

export function TamponStatut({ statut }: { statut: Statut }) {
  const tampon = TAMPONS[statut];
  return (
    <span
      className={`inline-block shrink-0 rounded-sm px-2 text-sm leading-6 tracking-wide ${tampon.className}`}
    >
      {tampon.label}
    </span>
  );
}
