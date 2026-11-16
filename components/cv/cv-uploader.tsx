"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { registerCvUploadAction } from "@/app/dashboard/cv/actions";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { toast } from "@/components/ui/sonner";
import { CV_MAX_BYTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fileKind(file: File): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  return null;
}

type Stage = "idle" | "uploading" | "extracting" | "analysing";

export function CvUploader({
  userId,
  aiConfigured,
  compact,
  onDone,
}: {
  userId: string;
  aiConfigured: boolean;
  compact?: boolean;
  /** When provided, called instead of navigating to the review page. */
  onDone?: (result: { cvId: string; parsed: boolean }) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const parse = useAiJob<{ cvId: string }>("/api/ai/cv-parse");

  const busy = stage !== "idle";

  async function handle(file: File) {
    setError(null);
    const kind = fileKind(file);
    if (!kind) return setError("Upload a PDF or Word (.docx) file. Older .doc files aren't supported; save as .docx first.");
    if (file.size > CV_MAX_BYTES) return setError("That file is larger than 10 MB.");
    if (file.size === 0) return setError("That file is empty.");

    setStage("uploading");
    const path = `${userId}/${crypto.randomUUID()}.${kind}`;
    const contentType = kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const { error: uploadError } = await createClient().storage.from("source-cvs").upload(path, file, { contentType, upsert: false });
    if (uploadError) {
      setStage("idle");
      return setError("Upload failed. Check your connection and try again.");
    }

    setStage("extracting");
    const registered = await registerCvUploadAction({ storagePath: path, fileName: file.name });
    if (!registered.ok) {
      setStage("idle");
      return setError(registered.error);
    }

    if (!aiConfigured) {
      setStage("idle");
      toast.success("CV uploaded. Text extracted.");
      if (onDone) onDone({ cvId: registered.data.id, parsed: false });
      else router.refresh();
      return;
    }

    setStage("analysing");
    const result = await parse.run({ cvId: registered.data.id });
    setStage("idle");
    if (result.ok) {
      if (onDone) onDone({ cvId: registered.data.id, parsed: true });
      else router.push(`/dashboard/cv/${registered.data.id}/review`);
    } else {
      setError(`Your CV was saved, but automatic extraction didn't finish: ${result.error} You can retry from the list below.`);
      router.refresh();
    }
  }

  const label =
    stage === "uploading"
      ? "Uploading securely…"
      : stage === "extracting"
        ? "Reading your document…"
        : stage === "analysing"
          ? (parse.progress ?? "Extracting your experience…")
          : null;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) void handle(file);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card px-6 text-center transition-colors",
          compact ? "py-8" : "py-12",
          dragging ? "border-brand bg-accent/50" : "border-input",
        )}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
            <Loader2 className="size-7 animate-spin text-brand" />
            <p className="text-sm font-medium">{label}</p>
            {stage === "analysing" ? <p className="text-xs text-muted-foreground">This usually takes 20–60 seconds.</p> : null}
          </div>
        ) : (
          <>
            <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <FileUp className="size-5" />
            </div>
            <p className="font-medium">Drop your CV here, or choose a file</p>
            <p className="mt-1 text-sm text-muted-foreground">PDF or Word (.docx), up to 10 MB. Stored privately.</p>
            <Button className="mt-4" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            {aiConfigured ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-brand" /> We&apos;ll extract your details for you to review. Nothing is saved to your profile until you confirm.
              </p>
            ) : null}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Upload CV"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handle(file);
          }}
        />
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
