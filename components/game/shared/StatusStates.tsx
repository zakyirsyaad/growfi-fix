import { AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full bg-[#153d21]" />
      <Skeleton className="h-24 w-full bg-[#153d21]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 w-full bg-[#153d21]" />
        <Skeleton className="h-24 w-full bg-[#153d21]" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="pixel-card flex items-start gap-3 border-[#a31948] p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9ebd]" />
      <div>
        <div className="pixel-heading text-xs text-[#ff9ebd]">Action failed</div>
        <p className="mt-1 font-sans text-sm text-[#ffe5ee]">{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="pixel-card-dashed flex min-h-32 flex-col items-center justify-center gap-2 p-6 text-center">
      <Inbox className="h-8 w-8 text-[#5e8c52]" />
      <div className="pixel-heading text-xs text-[#f2fbf1]">{title}</div>
      {description ? (
        <p className="max-w-sm font-sans text-sm text-[#91d985]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
