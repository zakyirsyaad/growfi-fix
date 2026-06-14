import { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-4">
      <div>
        {eyebrow ? (
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-black text-foreground md:text-4xl">
          {title}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}
