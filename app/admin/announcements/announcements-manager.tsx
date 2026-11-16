"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useAction } from "@/components/shared/use-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field, Switch } from "@/components/ui/form-controls";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import type { Announcement } from "@/lib/db/types";
import { formatDateTime } from "@/lib/utils";

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isLive(a: Announcement): boolean {
  const now = Date.now();
  return a.is_active && Date.parse(a.starts_at) <= now && (!a.ends_at || Date.parse(a.ends_at) > now);
}

function Editor({ item, onClose }: { item: Announcement | null; onClose: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({
    title: item?.title ?? "",
    message: item?.message ?? "",
    level: item?.level ?? "info",
    isActive: item?.is_active ?? true,
    startsAt: toLocal(item?.starts_at ?? null),
    endsAt: toLocal(item?.ends_at ?? null),
  });
  const save = useAction(saveAnnouncementAction, {
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit announcement" : "New announcement"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save.run(item?.id ?? null, {
              ...v,
              startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : null,
              endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : null,
            });
          }}
        >
          {save.error ? <Alert variant="error">{save.error}</Alert> : null}
          <Field label="Title" htmlFor="ann-title" required>
            <Input id="ann-title" maxLength={200} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Message" htmlFor="ann-message" required>
            <Textarea id="ann-message" rows={3} maxLength={2000} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Style" htmlFor="ann-level">
              <NativeSelect id="ann-level" value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })}>
                <option value="info">Information</option>
                <option value="success">Good news</option>
                <option value="warning">Warning</option>
              </NativeSelect>
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <Switch checked={v.isActive} onCheckedChange={(c) => setV({ ...v, isActive: c })} /> Active
            </label>
            <Field label="Starts" htmlFor="ann-start" optional>
              <Input id="ann-start" type="datetime-local" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} />
            </Field>
            <Field label="Ends" htmlFor="ann-end" optional>
              <Input id="ann-end" type="datetime-local" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.pending}>
              {item ? "Save" : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AnnouncementsManager({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ item: Announcement | null } | null>(null);
  const remove = useAction(deleteAnnouncementAction, { onSuccess: () => router.refresh() });
  return (
    <div className="space-y-4">
      <Button onClick={() => setEditing({ item: null })}>
        <Plus /> New announcement
      </Button>
      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements" description="Publish maintenance notices, new features or important updates." />
      ) : (
        announcements.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  {isLive(a) ? <Badge variant="success">Live</Badge> : a.is_active ? <Badge variant="warning">Scheduled / ended</Badge> : <Badge variant="outline">Inactive</Badge>}
                  <Badge variant={a.level === "warning" ? "warning" : a.level === "success" ? "success" : "info"}>{a.level}</Badge>
                </div>
                <p className="text-sm text-foreground/85">{a.message}</p>
                <p className="text-xs text-muted-foreground">
                  From {formatDateTime(a.starts_at)}
                  {a.ends_at ? ` until ${formatDateTime(a.ends_at)}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Edit announcement" onClick={() => setEditing({ item: a })}>
                  <Pencil />
                </Button>
                <ConfirmButton title="Delete this announcement?" description="It will disappear for all users." onConfirm={() => remove.run(a.id)}>
                  <Button size="icon-sm" variant="ghost" aria-label="Delete announcement" className="text-muted-foreground hover:text-destructive">
                    <Trash2 />
                  </Button>
                </ConfirmButton>
              </div>
            </CardContent>
          </Card>
        ))
      )}
      {editing ? <Editor item={editing.item} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
