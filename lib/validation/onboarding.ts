import { z } from "zod";
import { EMPLOYMENT_TYPE_VALUES } from "@/lib/constants";
import { optionalText, requiredText, stringList } from "./common";

export const onboardingBasicsSchema = z.object({
  fullName: requiredText(200, "Enter your full name."),
  professionalTitle: optionalText(200),
  location: optionalText(200),
  country: optionalText(100),
  phone: optionalText(50),
});

export const onboardingPrefsSchema = z.object({
  preferredJobTitles: stringList(20),
  workArrangements: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3).default([]),
  preferredEmploymentTypes: z.array(z.enum(EMPLOYMENT_TYPE_VALUES)).max(10).default([]),
  preferredLocations: optionalText(500),
});
