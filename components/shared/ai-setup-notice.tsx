import { KeyRound } from "lucide-react";
import { Alert } from "@/components/ui/feedback";

/** Shown wherever an AI feature is unavailable because the deployment lacks an API key. */
export function AiSetupNotice({ isAdmin, className }: { isAdmin?: boolean; className?: string }) {
  return (
    <Alert variant="warning" title="AI features aren't configured yet" className={className}>
      <span className="inline-flex items-start gap-1.5">
        <KeyRound className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {isAdmin
            ? "Add ANTHROPIC_API_KEY to the server environment (Netlify → Site configuration → Environment variables) and redeploy. Everything else in ApplyDesk works without it."
            : "The platform administrator hasn't enabled AI generation yet. You can still build your profile, track applications and write documents manually."}
        </span>
      </span>
    </Alert>
  );
}
