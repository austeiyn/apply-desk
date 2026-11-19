import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { coverLetterStyle } from "@/lib/data/documents";
import { renderCoverLetterDocx } from "@/lib/documents/docx";
import { renderCoverLetterPdf } from "@/lib/documents/pdf";
import { fileResponse, parseFormat } from "@/lib/documents/response";
import { safeFileName } from "@/lib/utils";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/documents/cover-letter/[id]">) {
  const { id } = await ctx.params;
  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  if (!format) return Response.json({ error: "Choose pdf or docx." }, { status: 400 });

  const session = await getSession();
  if (!session || session.profile.account_status !== "active") return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const { supabase, userId, profile } = session;
  const { data: letter } = await supabase
    .from("generated_cover_letters")
    .select("title, content, style, application_id, job_applications(company_name, job_title)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!letter) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: cp } = await supabase.from("candidate_profiles").select("contact_email, phone, location, country").eq("user_id", userId).single();
  const job = Array.isArray(letter.job_applications) ? letter.job_applications[0] : letter.job_applications;
  const header = {
    fullName: profile.full_name,
    contact: [[cp?.location, cp?.country].filter(Boolean).join(", "), cp?.phone, cp?.contact_email || profile.email].filter(Boolean).join("  |  "),
    date: new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }),
    recipient: job?.company_name ? [job.company_name] : [],
  };
  const fileName = safeFileName([profile.full_name, "Cover Letter", job?.company_name], format);
  const style = await coverLetterStyle(supabase, userId, letter);
  const body =
    format === "pdf" ? await renderCoverLetterPdf(letter.content, header, letter.title, style) : await renderCoverLetterDocx(letter.content, header, letter.title, style);
  return fileResponse(body, format, fileName);
}
