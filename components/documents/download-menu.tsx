"use client";

import { Download, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/misc";

/** DOCX/PDF download links for a stored document. */
export function DownloadMenu({
  kind,
  id,
  size = "sm",
  variant = "outline",
  disabled,
  beforeDownload,
}: {
  kind: "resume" | "cover-letter";
  id: string;
  size?: "sm" | "default";
  variant?: "outline" | "default";
  disabled?: boolean;
  /** e.g. save pending edits first; return false to cancel. */
  beforeDownload?: () => Promise<boolean>;
}) {
  const go = async (format: "pdf" | "docx") => {
    if (beforeDownload && !(await beforeDownload())) return;
    window.location.href = `/api/documents/${kind}/${id}?format=${format}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled}>
          <Download /> Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void go("docx")}>
          <FileDown /> Word document (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void go("pdf")}>
          <FileDown /> PDF document (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
