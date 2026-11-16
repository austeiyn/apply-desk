"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettingsAction } from "@/app/admin/actions";
import { useAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Switch } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import type { PlatformSettings } from "@/lib/settings";

function ToggleRow({ label, description, checked, onChange, id }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SettingsForm({ initial }: { initial: PlatformSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const save = useAction(updateSettingsAction, { onSuccess: () => router.refresh() });
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run(v);
      }}
      className="grid gap-6 lg:grid-cols-2"
    >
      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <ToggleRow
            id="registration_open"
            label="Open registration"
            description="Allow anyone to create an account. Existing users can always sign in."
            checked={v.registration_open}
            onChange={(c) => setV({ ...v, registration_open: c })}
          />
          <div className="pt-3">
            <Field label="Support email" htmlFor="support_email" description="Shown to users for help and privacy requests." optional>
              <Input id="support_email" type="email" value={v.support_email} onChange={(e) => setV({ ...v, support_email: e.target.value })} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI features and limits</CardTitle>
          <CardDescription>Limits are per user and count successful or refused requests. Set 0 for no limit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow id="ai_enabled" label="Enable AI features" description="Turn off to pause all AI generation immediately." checked={v.ai_enabled} onChange={(c) => setV({ ...v, ai_enabled: c })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Requests per user per day" htmlFor="ai_daily">
              <Input id="ai_daily" type="number" min={0} max={10000} value={v.ai_daily_request_limit} onChange={(e) => setV({ ...v, ai_daily_request_limit: Number(e.target.value) })} />
            </Field>
            <Field label="Requests per user per 30 days" htmlFor="ai_monthly">
              <Input id="ai_monthly" type="number" min={0} max={100000} value={v.ai_monthly_request_limit} onChange={(e) => setV({ ...v, ai_monthly_request_limit: Number(e.target.value) })} />
            </Field>
            <Field label="Max stored CV files per user" htmlFor="max_cvs">
              <Input id="max_cvs" type="number" min={1} max={50} value={v.max_source_cvs} onChange={(e) => setV({ ...v, max_source_cvs: Number(e.target.value) })} />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={save.pending} disabled={!dirty}>
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
