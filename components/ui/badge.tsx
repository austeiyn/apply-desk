import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground ring-border",
        brand: "bg-accent text-accent-foreground ring-teal-200",
        success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
        warning: "bg-amber-50 text-amber-800 ring-amber-200",
        danger: "bg-rose-50 text-rose-700 ring-rose-200",
        info: "bg-sky-50 text-sky-800 ring-sky-200",
        outline: "bg-transparent text-muted-foreground ring-border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
