"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive, Label as LabelPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:opacity-50", className)}
      {...props}
    />
  );
}

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input bg-card shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-brand-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand data-[state=unchecked]:bg-input",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  );
}

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  description?: React.ReactNode;
  error?: string | string[];
  optional?: boolean;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + help text + error, with ARIA wiring handled by the caller's id. */
function Field({ label, htmlFor, description, error, optional, required, className, children }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] text-foreground">
        {label}
        {required ? <span className="text-destructive" aria-hidden>*</span> : null}
        {optional ? <span className="text-xs font-normal text-muted-foreground">Optional</span> : null}
      </Label>
      {children}
      {description && !message ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {message ? (
        <p className="text-xs font-medium text-destructive" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export { Label, Checkbox, Switch, Field };
