"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-card !text-foreground !shadow-lg",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

export { toast } from "sonner";
