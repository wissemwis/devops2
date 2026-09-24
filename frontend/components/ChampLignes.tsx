type ChampLignesProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
};

export function ChampLignes({ id, name, label, defaultValue, rows = 3 }: ChampLignesProps) {
  return (
    <div className="mt-ligne">
      <label htmlFor={id} className="block h-ligne leading-[32px] text-graphite-doux">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="lignes entoure block min-h-[calc(var(--spacing-ligne)*3)] w-full resize-y px-1 leading-[32px] text-graphite"
      />
    </div>
  );
}
