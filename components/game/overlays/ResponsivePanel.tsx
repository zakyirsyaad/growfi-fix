"use client";

import type React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export function ResponsivePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const mobile = useMediaQuery("(max-width: 767px)");

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="scanlines border-t-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] [&>div:first-child]:bg-[#3d9f4b]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="pixel-heading text-sm text-[#f2fbf1]">
              {title}
            </DrawerTitle>
            {description ? (
              <DrawerDescription className="font-sans text-[#91d985]">
                {description}
              </DrawerDescription>
            ) : null}
          </DrawerHeader>
          <ScrollArea className="max-h-[70vh] px-5 pb-5">{children}</ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "scanlines border-l-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] [&>button]:text-[#91d985] [&>button]:opacity-100 [&>button:hover]:text-[#f7d767]",
          wide ? "w-[min(94vw,900px)] sm:max-w-none" : undefined,
        )}
      >
        <SheetHeader className="border-b-2 border-[#153d21] pb-4">
          <SheetTitle className="pixel-heading text-base text-[#f2fbf1]">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription className="font-sans text-[#91d985]">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <ScrollArea className="mt-5 h-[calc(100vh-7rem)] pr-4">
          {children}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
