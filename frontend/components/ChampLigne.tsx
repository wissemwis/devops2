type ChampLigneProps = {
  id: string;
  name: string;
  label: string;
  type: 'email' | 'password';
  autoComplete: string;
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
};

export function ChampLigne({
  id,
  name,
  label,
  type,
  autoComplete,
  defaultValue,
  invalid,
  describedBy,
}: ChampLigneProps) {
  return (
    <div className="mt-ligne">
      <label htmlFor={id} className="block h-ligne leading-[32px] text-graphite-doux">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="entoure block h-ligne w-full border-b-2 border-graphite bg-papier px-1 leading-[30px] text-graphite transition-colors duration-[120ms] focus:border-encre aria-invalid:border-stylo-rouge"
      />
    </div>
  );
}
