import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service (draft)" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="[Insert date before launch]">
      <p>
        These terms govern your use of ApplyDesk, operated by [Legal entity name] (&ldquo;we&rdquo;). By creating an account you agree to them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You must provide accurate information and keep your password secure.</li>
        <li>You are responsible for activity under your account. Tell us promptly at [support email] if you suspect unauthorised access.</li>
        <li>You must be at least [16] years old to use ApplyDesk.</li>
      </ul>

      <h2>Your content and accuracy</h2>
      <ul>
        <li>You keep ownership of the content you upload and the documents you create.</li>
        <li>
          AI-generated material is a draft. You are responsible for reviewing it and for the accuracy of anything you submit to an employer.
          Do not submit claims about your experience, qualifications or results that are untrue.
        </li>
        <li>ApplyDesk does not guarantee interviews, offers or compatibility with any particular applicant tracking system.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use ApplyDesk to create fraudulent applications or impersonate another person.</li>
        <li>Do not attempt to access other users&apos; data, disrupt the service, or bypass usage limits or security controls.</li>
        <li>Only import job advertisements you are entitled to access. ApplyDesk does not bypass logins, paywalls or access restrictions.</li>
      </ul>

      <h2>Usage limits and availability</h2>
      <p>
        To keep the service sustainable we apply limits to AI usage, which may change. We aim for high availability but the service is
        provided &ldquo;as is&rdquo; without warranties to the extent permitted by law. [Insert limitation of liability appropriate to your jurisdiction.]
      </p>

      <h2>Suspension and termination</h2>
      <p>
        We may suspend accounts that breach these terms or put the service or other users at risk. You can delete your account at any time
        from Settings; deletion is permanent.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will give notice of material changes. These terms are governed by the laws of [jurisdiction].
        Contact: [support email].
      </p>
    </LegalPage>
  );
}
