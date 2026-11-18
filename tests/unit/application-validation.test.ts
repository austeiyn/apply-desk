import { describe, expect, it } from "vitest";
import { jobDetailsSchema, UNTITLED_JOB } from "@/lib/validation/application";

const description = "We're hiring a Senior Web Developer in Wellington to build accessible WordPress sites. ".repeat(2);

describe("job details", () => {
  it("accepts a blank title when the advertisement text is pasted, for the analysis to fill in", () => {
    const v = jobDetailsSchema.parse({ jobTitle: "", jobDescription: description });
    expect(v.jobTitle).toBe(UNTITLED_JOB);
  });

  it("asks for a title when there's no description to read it from", () => {
    const r = jobDetailsSchema.safeParse({ jobTitle: " ", jobDescription: "Short note" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["jobTitle"]);
  });

  it("keeps a title the user typed", () => {
    expect(jobDetailsSchema.parse({ jobTitle: "Data Analyst", jobDescription: "" }).jobTitle).toBe("Data Analyst");
  });
});
