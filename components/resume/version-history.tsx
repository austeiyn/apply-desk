"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Loader2, RotateCcw } from "lucide-react";
import { restoreResumeVersionAction } from "@/app/dashboard/documents/actions";
import { useAction } from "@/components/shared/use-action";
import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { createClient } from "@/lib/supabase/client";
import { diffLines, type DiffLine } from "@/lib/diff";
import { ResumeContentSchema, resumeToPlainText, type ResumeContent } from "@/lib/resume/types";
import { cn, formatDateTime } from "@/lib/utils";

export interface VersionMeta {
  version: number;
  change_summary: string | null;
  created_at: string;
}

export function VersionHistory({
  open,
  onOpenChange,
  resumeId,
  versions,
  current,
  currentVersion,
  dirty,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resumeId: string;
  versions: VersionMeta[];
  current: ResumeContent;
  currentVersion: number;
  dirty: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const restore = useAction(restoreResumeVersionAction, {
    onSuccess: () => {
      onOpenChange(false);
      setSelected(null);
      setDiff(null);
      router.refresh();
    },
  });

  const compare = async (version: number) => {
    setSelected(version);
    setLoading(true);
    setDiff(null);
    // RLS restricts this read to the owner's own resume versions.
    const { data } = await createClient().from("resume_versions").select("content_json").eq("resume_id", resumeId).eq("version", version).maybeSingle();
    const parsed = ResumeContentSchema.safeParse(data?.content_json);
    setDiff(parsed.success ? diffLines(resumeToPlainText(parsed.data), resumeToPlainText(current)) : []);
    setLoading(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-2xl sm:w-[90%]" aria-describedby={undefined}>
        <div className="border-b p-4 pr-12">
          <DialogPrimitive.Title className="text-base font-semibold">Version history</DialogPrimitive.Title>
          <p className="text-sm text-muted-foreground">Every save creates a version. Compare any version with what&apos;s in the editor, or restore it.</p>
        </div>
        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] sm:grid-cols-[200px_1fr] sm:grid-rows-1">
          <ul className="max-h-48 overflow-y-auto border-b sm:max-h-none sm:border-b-0 sm:border-r">
            {versions.map((v) => (
              <li key={v.version}>
                <button
                  className={cn("w-full px-4 py-2.5 text-left text-sm hover:bg-muted", selected === v.version && "bg-accent")}
                  onClick={() => void compare(v.version)}
                >
                  <span className="font-medium">
                    Version {v.version}
                    {v.version === currentVersion ? <span className="ml-1 text-xs font-normal text-brand">(current)</span> : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{v.change_summary ?? "Edited"}</span>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(v.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="min-h-0 overflow-y-auto p-4">
            {selected === null ? (
              <p className="text-sm text-muted-foreground">Select a version to compare it with the editor.</p>
            ) : loading ? (
              <Loader2 className="size-5 animate-spin text-brand" />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="rounded bg-coral-50 px-1 text-coral-700 line-through">Version {selected}</span> →{" "}
                    <span className="rounded bg-mint-50 px-1 text-mint-700">editor</span>
                  </p>
                  {selected !== currentVersion ? (
                    <Button size="sm" onClick={() => restore.run(resumeId, selected)} loading={restore.pending}>
                      <RotateCcw /> Restore version {selected}
                    </Button>
                  ) : null}
                </div>
                {dirty ? <Alert variant="warning">Restoring replaces your unsaved changes.</Alert> : null}
                {diff && diff.every((d) => d.type === "same") ? <p className="text-sm text-muted-foreground">No differences.</p> : null}
                <pre className="overflow-x-auto rounded-lg border bg-card p-3 font-sans text-xs leading-relaxed">
                  {diff?.map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        "whitespace-pre-wrap px-1",
                        d.type === "add" && "bg-mint-50 text-mint-700",
                        d.type === "del" && "bg-coral-50 text-coral-700 line-through",
                        d.type === "same" && "text-muted-foreground",
                      )}
                    >
                      {d.type === "add" ? "+ " : d.type === "del" ? "− " : "  "}
                      {d.text || " "}
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </DialogPrimitive.Root>
  );
}
