"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Eye, FileText, MoreHorizontal, RefreshCw, Star, Trash2 } from "lucide-react";
import { deleteCvAction, getCvDownloadUrlAction, setPrimaryCvAction } from "@/app/dashboard/cv/actions";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { useAction } from "@/components/shared/use-action";
import { useAiJob } from "@/components/shared/use-ai-job";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/misc";
import { toast } from "@/components/ui/sonner";
import { formatDate } from "@/lib/utils";

export interface CvListItem {
  id: string;
  file_name: string;
  label: string | null;
  mime_type: string;
  file_size: number;
  version: number;
  is_primary: boolean;
  extraction_status: string;
  extraction_error: string | null;
  extracted_text: string | null;
  created_at: string;
  applied_at: string | null;
}

const STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "info" | "danger" }> = {
  pending: { label: "Processing", variant: "default" },
  extracted: { label: "Text extracted", variant: "info" },
  parsed: { label: "Ready to review", variant: "warning" },
  applied: { label: "Applied to profile", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

function CvRow({ cv, aiConfigured }: { cv: CvListItem; aiConfigured: boolean }) {
  const router = useRouter();
  const [showText, setShowText] = useState(false);
  const { run: makePrimary } = useAction(setPrimaryCvAction);
  const { run: remove } = useAction(deleteCvAction);
  const parse = useAiJob<{ cvId: string }>("/api/ai/cv-parse");
  const status = STATUS[cv.extraction_status] ?? STATUS.pending!;

  const download = async () => {
    const res = await getCvDownloadUrlAction(cv.id);
    if (res.ok) window.location.href = res.data.url;
    else toast.error(res.error);
  };

  const extract = async () => {
    const res = await parse.run({ cvId: cv.id });
    if (res.ok) router.push(`/dashboard/cv/${cv.id}/review`);
    else toast.error(res.error);
  };

  return (
    <div className="flex flex-col gap-3 border-t p-4 first:border-t-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{cv.label || cv.file_name}</p>
            {cv.is_primary ? (
              <Badge variant="brand">
                <Star /> Primary
              </Badge>
            ) : null}
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Version {cv.version} · {cv.mime_type === "application/pdf" ? "PDF" : "Word"} · {(cv.file_size / 1024).toFixed(0)} KB · Uploaded{" "}
            {formatDate(cv.created_at)}
          </p>
          {cv.extraction_error && cv.extraction_status !== "parsed" && cv.extraction_status !== "applied" ? (
            <p className="text-xs text-destructive">{cv.extraction_error}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {cv.extraction_status === "parsed" ? (
          <Button asChild size="sm">
            <Link href={`/dashboard/cv/${cv.id}/review`}>
              <CheckCircle2 /> Review extracted data
            </Link>
          </Button>
        ) : aiConfigured && cv.extraction_status !== "applied" ? (
          <Button size="sm" variant="outline" onClick={extract} loading={parse.running}>
            {parse.running ? (parse.progress ?? "Extracting…") : "Extract to profile"}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="CV actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={download}>
              <Download /> Download original
            </DropdownMenuItem>
            {cv.extracted_text ? (
              <DropdownMenuItem onSelect={() => setShowText(true)}>
                <Eye /> View extracted text
              </DropdownMenuItem>
            ) : null}
            {aiConfigured && cv.extraction_status === "applied" ? (
              <DropdownMenuItem onSelect={extract}>
                <RefreshCw /> Extract again
              </DropdownMenuItem>
            ) : null}
            {!cv.is_primary ? (
              <DropdownMenuItem onSelect={() => makePrimary(cv.id)}>
                <Star /> Make primary
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmButton
          title="Delete this CV?"
          description="The original file and its extracted text will be permanently deleted. Information already added to your profile is kept."
          onConfirm={() => remove(cv.id)}
        >
          <Button size="icon-sm" variant="ghost" aria-label="Delete CV" className="text-muted-foreground hover:text-destructive">
            <Trash2 />
          </Button>
        </ConfirmButton>
      </div>
      <Dialog open={showText} onOpenChange={setShowText}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Extracted text</DialogTitle>
            <DialogDescription>This is the raw text we read from {cv.file_name}.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-sm">{cv.extracted_text}</pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CvList({ cvs, aiConfigured }: { cvs: CvListItem[]; aiConfigured: boolean }) {
  return (
    <div className="rounded-xl border bg-card">
      {cvs.map((cv) => (
        <CvRow key={cv.id} cv={cv} aiConfigured={aiConfigured} />
      ))}
    </div>
  );
}
