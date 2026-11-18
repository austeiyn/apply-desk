import { describe, expect, it } from "vitest";
import { jobFromClip } from "@/lib/jobs/clip";

const description = "<p>Kererū Insights is hiring a Data Analyst.</p><ul><li>Build dashboards in Power BI</li><li>Write SQL against our warehouse</li></ul>" + "<p>Work with product teams to measure outcomes and explain findings clearly.</p>".repeat(3);

describe("jobFromClip", () => {
  it("reads JobPosting JSON-LD sent from the user's browser", () => {
    const ld = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Data Analyst",
      hiringOrganization: { "@type": "Organization", name: "Kererū Insights" },
      jobLocation: { "@type": "Place", address: { addressLocality: "Auckland", addressCountry: "NZ" } },
      employmentType: "FULL_TIME",
      description,
    });
    const job = jobFromClip({ url: "https://www.example.com/job/1", title: "Data Analyst job", ld: [ld], text: "" });
    expect(job.jobTitle).toBe("Data Analyst");
    expect(job.companyName).toBe("Kererū Insights");
    expect(job.location).toContain("Auckland");
    expect(job.description).toContain("Power BI");
    expect(job.source).toBe("structured");
  });

  it("falls back to the visible page text, escaped", () => {
    const text = ["Data Analyst", "Kererū Insights · Auckland", "<script>alert(1)</script> About the role", "You'll build dashboards and write SQL. ".repeat(10)].join("\n");
    const job = jobFromClip({ url: "https://www.example.com/job/2", title: "Data Analyst | Example Jobs", ld: [], text });
    expect(job.description).toContain("<script>alert(1)</script> About the role");
    expect(job.description).toContain("write SQL");
  });

  it("can't break out of the JSON-LD script block", () => {
    const hostile = JSON.stringify({ "@type": "JobPosting", title: "</script><script>alert(1)</script>", description });
    const job = jobFromClip({ url: "https://www.example.com/job/3", title: "x", ld: [hostile], text: "" });
    expect(job.jobTitle).toBe("</script><script>alert(1)</script>");
    expect(job.description).toContain("Power BI");
  });
});
