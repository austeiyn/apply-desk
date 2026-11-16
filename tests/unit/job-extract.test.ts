import { describe, expect, it } from "vitest";
import { extractJobFromHtml, htmlToText, looksBlocked } from "@/lib/jobs/extract";

const description = `<p>We're hiring a <strong>Senior Web Developer</strong> to join our Wellington team.</p>
<h3>What you'll do</h3><ul><li>Build accessible WordPress sites</li><li>Mentor junior developers</li></ul>
<h3>About you</h3><ul><li>5+ years with PHP and JavaScript</li><li>Experience with React (preferred)</li></ul>
<p>${"Additional detail about the team and the role. ".repeat(10)}</p>`;

const jsonLdPage = `<!doctype html><html><head><title>Job | Board</title>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Board" },
    {
      "@type": "JobPosting",
      title: "Senior Web Developer",
      description,
      hiringOrganization: { "@type": "Organization", name: "Harbour & Co" },
      jobLocation: { "@type": "Place", address: { addressLocality: "Wellington", addressRegion: "Wellington", addressCountry: "NZ" } },
      employmentType: ["FULL_TIME"],
      baseSalary: { "@type": "MonetaryAmount", currency: "NZD", value: { "@type": "QuantitativeValue", minValue: 110000, maxValue: 130000, unitText: "YEAR" } },
      validThrough: "2026-12-20T23:59:59+13:00",
      skills: ["WordPress", "PHP", "JavaScript"],
    },
  ],
})}</script>
<script>window.evil = "<script>alert(1)</script>"</script></head>
<body><nav>Menu</nav><main>Fallback content</main></body></html>`;

describe("extractJobFromHtml", () => {
  it("prefers schema.org JobPosting data", () => {
    const job = extractJobFromHtml(jsonLdPage);
    expect(job.source).toBe("structured");
    expect(job.jobTitle).toBe("Senior Web Developer");
    expect(job.companyName).toBe("Harbour & Co");
    expect(job.location).toBe("Wellington, NZ");
    expect(job.employmentType).toBe("Full-time");
    expect(job.salaryRange).toBe("NZD 110,000–130,000 per year");
    expect(job.deadline).toBe("2026-12-20");
    expect(job.requiredSkills).toContain("• WordPress");
    expect(job.description).toContain("• Build accessible WordPress sites");
    expect(job.description).not.toContain("<");
  });

  it("falls back to the main page content without scripts or navigation", () => {
    const html = `<html><head><title>Data Analyst - Acme</title><meta property="og:site_name" content="Acme Careers"></head>
      <body><nav>Home Jobs About</nav><script>steal()</script>
      <div class="job-description"><h1>Data Analyst</h1><p>${"Analyse data and present insights to stakeholders. ".repeat(20)}</p>
      <ul><li>SQL</li><li>Power BI</li></ul></div><footer>© Acme</footer></body></html>`;
    const job = extractJobFromHtml(html);
    expect(job.source).toBe("page");
    expect(job.jobTitle).toBe("Data Analyst");
    expect(job.companyName).toBe("Acme Careers");
    expect(job.description).toContain("• SQL");
    expect(job.description).not.toContain("steal()");
    expect(job.description).not.toContain("Home Jobs About");
  });
});

describe("htmlToText", () => {
  it("removes markup and dangerous elements", () => {
    const text = htmlToText(`<p>Hello <img src=x onerror=alert(1)><script>bad()</script><b>world</b></p><ul><li>One</li></ul>`);
    expect(text).toBe("Hello world\n\n• One");
  });
});

describe("looksBlocked", () => {
  it("detects bot challenges and login walls", () => {
    expect(looksBlocked("<title>Just a moment...</title><div id='cf-chl-widget'>")).toBe(true);
    expect(looksBlocked('<form><h1>Sign in</h1><input type="password"></form>')).toBe(true);
    expect(looksBlocked("<h1>Developer</h1><p>Apply now</p>")).toBe(false);
  });
});
