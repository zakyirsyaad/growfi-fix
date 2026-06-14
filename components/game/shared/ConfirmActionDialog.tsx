"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scanlines border-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] [&>button]:text-[#91d985] [&>button:hover]:text-[#f7d767]">
        <DialogHeader>
          <DialogTitle className="pixel-heading text-sm text-[#f2fbf1]">
            {title}
          </DialogTitle>
          <DialogDescription className="font-sans text-[#91d985]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <button
            type="button"
            className="pixel-btn pixel-btn-ghost px-4 py-3"
            onClick={() => onOpenChange(false)}
          >
            CANCEL
          </button>
          <button
            type="button"
            className="pixel-btn pixel-btn-primary px-4 py-3"
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel.toUpperCase()}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
