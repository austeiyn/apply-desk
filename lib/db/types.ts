import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

export type Profile = Row<"profiles">;
export type CandidateProfile = Row<"candidate_profiles">;
export type WorkExperience = Row<"work_experiences">;
export type Education = Row<"education">;
export type Skill = Row<"skills">;
export type Certification = Row<"certifications">;
export type Project = Row<"projects">;
export type ProfileExtra = Row<"profile_extras">;
export type SourceCv = Row<"source_cvs">;
export type JobApplication = Row<"job_applications">;
export type ApplicationEvent = Row<"application_events">;
export type Interview = Row<"interviews">;
export type GeneratedResume = Row<"generated_resumes">;
export type ResumeVersion = Row<"resume_versions">;
export type GeneratedCoverLetter = Row<"generated_cover_letters">;
export type InterviewPreparation = Row<"interview_preparations">;
export type ApplicationMaterial = Row<"application_materials">;
export type Announcement = Row<"announcements">;
export type AuditLog = Row<"audit_logs">;
export type PlatformSetting = Row<"platform_settings">;

/** Everything the AI and document generators know about a candidate. */
export interface CandidateBundle {
  profile: Profile;
  candidate: CandidateProfile;
  experiences: WorkExperience[];
  education: Education[];
  skills: Skill[];
  certifications: Certification[];
  projects: Project[];
  extras: ProfileExtra[];
}
