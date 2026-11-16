import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { renderResumeDocx } from "@/lib/documents/docx";
import { renderResumePdf } from "@/lib/documents/pdf";
import { fileResponse, parseFormat } from "@/lib/documents/response";
import { ResumeContentSchema } from "@/lib/resume/types";
import { safeFileName } from "@/lib/utils";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/documents/resume/[id]">) {
  const { id } = await ctx.params;
  const format = parseFormat(request.nextUrl.searchParams.get("format"));
  if (!format) return Response.json({ error: "Choose pdf or docx." }, { status: 400 });

  const session = await getSession();
  if (!session || session.profile.account_status !== "active") return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found" }, { status: 404 });

  // RLS ensures only the owner can read the row.
  const { data: resume } = await session.supabase
    .from("generated_resumes")
    .select("title, content_json")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!resume) return Response.json({ error: "Not found" }, { status: 404 });

  const parsed = ResumeContentSchema.safeParse(resume.content_json);
  if (!parsed.success) return Response.json({ error: "This resume's content is invalid. Open it in the editor and save it again." }, { status: 422 });

  const content = parsed.data;
  const fileName = safeFileName([content.contact.full_name, "Resume", content.meta.company_name ?? undefined], format);
  const body = format === "pdf" ? await renderResumePdf(content, resume.title) : await renderResumeDocx(content, resume.title);
  return fileResponse(body, format, fileName);
}
