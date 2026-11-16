import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy (draft)" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="[Insert date before launch]">
      <p>
        This policy explains what personal information ApplyDesk (&ldquo;we&rdquo;, operated by [Legal entity name], [address]) collects,
        why, and the choices you have. Questions can be sent to [privacy contact email].
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your name, email address and password (stored as a secure hash by our authentication provider).</li>
        <li><strong>Career profile:</strong> details you enter or confirm, such as work history, education, skills, certifications, projects and preferences.</li>
        <li><strong>Uploaded CVs:</strong> the original files you upload and the text extracted from them.</li>
        <li><strong>Job applications:</strong> job advertisements you add, generated resumes, cover letters, interview preparation, notes, recruiter contact details and tracker information.</li>
        <li><strong>Usage information:</strong> counts of AI requests and tokens used per feature, sign-in timestamps and basic technical logs needed to operate and secure the service.</li>
      </ul>

      <h2>How we use your information</h2>
      <ul>
        <li>To provide the service: analysing job advertisements, generating and storing documents, and tracking your applications.</li>
        <li>To protect the service: rate limiting, abuse prevention and security auditing.</li>
        <li>To understand aggregate usage (for example, total documents generated) so we can improve ApplyDesk.</li>
      </ul>
      <p>We do not sell your personal information and do not use your documents for advertising.</p>

      <h2>AI processing</h2>
      <p>
        When you use an AI feature, the relevant parts of your profile and the job advertisement are sent to our AI provider, Anthropic, to
        generate a response. [Confirm and describe the provider&apos;s data retention and training terms applicable to your account before launch.]
        AI output is presented to you for review and is not shared with employers by us.
      </p>

      <h2>Who can access your data</h2>
      <ul>
        <li>Your workspace is private to your account and protected by database row-level security.</li>
        <li>Platform administrators can see account-level details (name, email, registration date, status) and aggregate activity counts. They cannot see your CVs, documents, notes or application details unless you grant temporary, read-only support access from Settings; such access expires automatically and is audit-logged.</li>
        <li>Service providers that host and operate the platform: [Supabase (database, authentication, file storage)], [Netlify (web hosting)], [Anthropic (AI processing)], and [email delivery provider].</li>
      </ul>

      <h2>Storage, security and retention</h2>
      <p>
        Data is stored with our infrastructure providers in [region]. Files are kept in private storage and are only accessible through
        short-lived signed links. We keep your information for as long as your account is active. When you delete your account we
        permanently delete your profile, files, documents and applications. We retain anonymised aggregate usage counts (with no link to you)
        and security audit records of administrative actions for [period].
      </p>

      <h2>Your rights and choices</h2>
      <ul>
        <li>Access and correct your information at any time in your profile.</li>
        <li>Download a copy of your data from Settings (JSON export).</li>
        <li>Delete individual documents, CVs and applications, or your entire account, from within the app.</li>
        <li>Contact [privacy contact email] to make a privacy request or complaint. You may also contact your local privacy regulator.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use strictly necessary cookies to keep you signed in. Your browser may also store small preferences (such as dismissed
        announcements). We do not use advertising cookies.
      </p>

      <h2>Changes</h2>
      <p>We will notify you of material changes to this policy by email or in-app announcement.</p>
    </LegalPage>
  );
}
