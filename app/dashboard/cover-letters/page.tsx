import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, Sparkles } from "lucide-react";
import { DownloadMenu } from "@/components/documents/download-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Table, TBody, TD, TH, THead, TR } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth/session";
import { COVER_LETTER_TONES } from "@/lib/constants";
import { relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Cover Letters" };

export default async function CoverLettersPage() {
  const { supabase, userId } = await requireUser();
  const { data: letters } = await supabase
    .from("generated_cover_letters")
    .select("id, title, tone, version, origin, updated_at, application_id, job_applications(job_title, company_name)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader title="Cover Letters" description="Personalised cover letters for your applications. Open one to edit, change its tone or download it." />
      {!letters?.length ? (
        <EmptyState
          icon={ScrollText}
          title="No cover letters yet"
          description="Cover letters are written for a specific application. Open an application and use its Cover letter tab."
          action={
            <Button asChild>
              <Link href="/dashboard/applications">Go to applications</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="pl-4">Title</TH>
                <TH>Application</TH>
                <TH>Tone</TH>
                <TH>Updated</TH>
                <TH className="pr-4 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {letters.map((l) => {
                const app = Array.isArray(l.job_applications) ? l.job_applications[0] : l.job_applications;
                return (
                  <TR key={l.id}>
                    <TD className="max-w-xs pl-4">
                      <Link href={`/dashboard/cover-letters/${l.id}`} className="flex items-center gap-2 font-medium hover:text-brand">
                        <span className="truncate">{l.title}</span>
                        {l.origin === "ai" ? (
                          <Badge variant="brand">
                            <Sparkles />
                          </Badge>
                        ) : null}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">
                      {app ? (
                        <Link href={`/dashboard/applications/${l.application_id}`} className="hover:text-brand">
                          {app.job_title}
                          {app.company_name ? ` · ${app.company_name}` : ""}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{COVER_LETTER_TONES.find((t) => t.value === l.tone)?.label.split(" and ")[0] ?? l.tone}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{relativeTime(l.updated_at)}</TD>
                    <TD className="pr-4">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/cover-letters/${l.id}`}>Edit</Link>
                        </Button>
                        <DownloadMenu kind="cover-letter" id={l.id} />
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </>
  );
}
