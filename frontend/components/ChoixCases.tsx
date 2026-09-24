export type Choix = { value: string; label: string };

type ChoixCasesProps = {
  name: string;
  legend: string;
  choix: readonly Choix[];
  defaultValue: string;
};

export function ChoixCases({ name, legend, choix, defaultValue }: ChoixCasesProps) {
  return (
    <fieldset className="mt-ligne">
      <legend className="block h-ligne leading-[32px] text-graphite-doux">{legend}</legend>
      {choix.map(({ value, label }) => {
        const id = `${name}-${value}`;
        return (
          <div key={value} className="flex h-ligne items-center gap-3">
            <input
              id={id}
              type="radio"
              name={name}
              value={value}
              defaultChecked={value === defaultValue}
              className="entoure size-4 shrink-0 accent-encre"
            />
            <label htmlFor={id} className="leading-[32px]">
              {label}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
