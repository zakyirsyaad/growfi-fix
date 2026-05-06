import { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  actions
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-xs font-black uppercase tracking-wide text-leaf-700">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-black text-leaf-950 md:text-4xl">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
