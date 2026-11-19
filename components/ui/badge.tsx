import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground ring-border",
        brand: "bg-grape-50 text-grape-700 ring-grape-200",
        success: "bg-mint-50 text-mint-700 ring-mint-200",
        warning: "bg-sun-50 text-sun-700 ring-sun-200",
        danger: "bg-coral-50 text-coral-700 ring-coral-200",
        info: "bg-ocean-50 text-ocean-700 ring-ocean-200",
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
