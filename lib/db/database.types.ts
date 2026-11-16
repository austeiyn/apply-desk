
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_usage": {
                  Row: {
                    "cache_read_tokens": number,"created_at": string,"duration_ms": number | null,"error_code": string | null,"feature": string,"id": string,"input_tokens": number,"model": string | null,"output_tokens": number,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cache_read_tokens"?: number,"created_at"?: string,"duration_ms"?: number | null,"error_code"?: string | null,"feature": string,"id"?: string,"input_tokens"?: number,"model"?: string | null,"output_tokens"?: number,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "cache_read_tokens"?: number,"created_at"?: string,"duration_ms"?: number | null,"error_code"?: string | null,"feature"?: string,"id"?: string,"input_tokens"?: number,"model"?: string | null,"output_tokens"?: number,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"is_active": boolean,"level": string,"message": string,"starts_at": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"level"?: string,"message": string,"starts_at"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_active"?: boolean,"level"?: string,"message"?: string,"starts_at"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"application_events": {
                  Row: {
                    "application_id": string,"created_at": string,"description": string | null,"event_type": string,"from_status": string | null,"id": string,"to_status": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"description"?: string | null,"event_type": string,"from_status"?: string | null,"id"?: string,"to_status"?: string | null,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"description"?: string | null,"event_type"?: string,"from_status"?: string | null,"id"?: string,"to_status"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_events_app_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "application_events_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"application_materials": {
                  Row: {
                    "application_id": string | null,"content_json": NonNullable<Json>,"created_at": string,"id": string,"kind": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"content_json": NonNullable<Json>,"created_at"?: string,"id"?: string,"kind": string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string | null,"content_json"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"kind"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "application_materials_app_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "application_materials_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_email": string | null,"actor_user_id": string | null,"created_at": string,"id": string,"metadata": NonNullable<Json>,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_email"?: string | null,"actor_user_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_email"?: string | null,"actor_user_id"?: string | null,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_logs_actor_user_id_fkey"
      columns: ["actor_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"candidate_profiles": {
                  Row: {
                    "contact_email": string | null,"country": string | null,"created_at": string,"current_occupation": string | null,"github_url": string | null,"id": string,"linkedin_url": string | null,"location": string | null,"phone": string | null,"portfolio_url": string | null,"preferences": NonNullable<Json>,"preferred_employment_types": (string)[],"preferred_industries": (string)[],"preferred_job_titles": (string)[],"preferred_locations": string | null,"professional_summary": string | null,"professional_title": string | null,"salary_expectation": string | null,"updated_at": string,"user_id": string,"website_url": string | null,"work_arrangements": (string)[],"years_experience": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_email"?: string | null,"country"?: string | null,"created_at"?: string,"current_occupation"?: string | null,"github_url"?: string | null,"id"?: string,"linkedin_url"?: string | null,"location"?: string | null,"phone"?: string | null,"portfolio_url"?: string | null,"preferences"?: NonNullable<Json>,"preferred_employment_types"?: (string)[],"preferred_industries"?: (string)[],"preferred_job_titles"?: (string)[],"preferred_locations"?: string | null,"professional_summary"?: string | null,"professional_title"?: string | null,"salary_expectation"?: string | null,"updated_at"?: string,"user_id": string,"website_url"?: string | null,"work_arrangements"?: (string)[],"years_experience"?: number | null
                  }
                  Update: {
                    "contact_email"?: string | null,"country"?: string | null,"created_at"?: string,"current_occupation"?: string | null,"github_url"?: string | null,"id"?: string,"linkedin_url"?: string | null,"location"?: string | null,"phone"?: string | null,"portfolio_url"?: string | null,"preferences"?: NonNullable<Json>,"preferred_employment_types"?: (string)[],"preferred_industries"?: (string)[],"preferred_job_titles"?: (string)[],"preferred_locations"?: string | null,"professional_summary"?: string | null,"professional_title"?: string | null,"salary_expectation"?: string | null,"updated_at"?: string,"user_id"?: string,"website_url"?: string | null,"work_arrangements"?: (string)[],"years_experience"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidate_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"certifications": {
                  Row: {
                    "created_at": string,"credential_id": string | null,"credential_url": string | null,"expiry_date": string | null,"id": string,"institution": string | null,"issue_date": string | null,"name": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"credential_id"?: string | null,"credential_url"?: string | null,"expiry_date"?: string | null,"id"?: string,"institution"?: string | null,"issue_date"?: string | null,"name": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"credential_id"?: string | null,"credential_url"?: string | null,"expiry_date"?: string | null,"id"?: string,"institution"?: string | null,"issue_date"?: string | null,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"education": {
                  Row: {
                    "achievements": string,"created_at": string,"field_of_study": string | null,"graduation_date": string | null,"id": string,"institution": string,"qualification": string,"sort_order": number,"start_date": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievements"?: string,"created_at"?: string,"field_of_study"?: string | null,"graduation_date"?: string | null,"id"?: string,"institution": string,"qualification": string,"sort_order"?: number,"start_date"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievements"?: string,"created_at"?: string,"field_of_study"?: string | null,"graduation_date"?: string | null,"id"?: string,"institution"?: string,"qualification"?: string,"sort_order"?: number,"start_date"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "education_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"generated_cover_letters": {
                  Row: {
                    "application_id": string | null,"content": string,"created_at": string,"id": string,"origin": string,"title": string,"tone": string,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"origin"?: string,"title": string,"tone"?: string,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "application_id"?: string | null,"content"?: string,"created_at"?: string,"id"?: string,"origin"?: string,"title"?: string,"tone"?: string,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "generated_cover_letters_app_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "generated_cover_letters_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"generated_resumes": {
                  Row: {
                    "application_id": string | null,"content_json": NonNullable<Json>,"created_at": string,"id": string,"last_change_summary": string | null,"origin": string,"title": string,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id"?: string | null,"content_json": NonNullable<Json>,"created_at"?: string,"id"?: string,"last_change_summary"?: string | null,"origin"?: string,"title": string,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "application_id"?: string | null,"content_json"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"last_change_summary"?: string | null,"origin"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "generated_resumes_app_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "generated_resumes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"interview_preparations": {
                  Row: {
                    "application_id": string,"content_json": NonNullable<Json>,"created_at": string,"id": string,"notes": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"content_json": NonNullable<Json>,"created_at"?: string,"id"?: string,"notes"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"content_json"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"notes"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interview_preparations_app_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "interview_preparations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"interviews": {
                  Row: {
                    "application_id": string,"created_at": string,"duration_minutes": number | null,"id": string,"interview_type": string,"interviewers": string | null,"location": string | null,"notes": string,"outcome": string,"scheduled_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": string,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"interview_type"?: string,"interviewers"?: string | null,"location"?: string | null,"notes"?: string,"outcome"?: string,"scheduled_at": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "application_id"?: string,"created_at"?: string,"duration_minutes"?: number | null,"id"?: string,"interview_type"?: string,"interviewers"?: string | null,"location"?: string | null,"notes"?: string,"outcome"?: string,"scheduled_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interviews_app_fk"
      columns: ["application_id","user_id"]
isOneToOne: false
      referencedRelation: "job_applications"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "interviews_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"job_applications": {
                  Row: {
                    "analysis_updated_at": string | null,"application_date": string | null,"application_status": string,"company_name": string,"created_at": string,"deadline": string | null,"employment_type": string | null,"final_outcome": string | null,"follow_up_date": string | null,"id": string,"job_analysis": Json | null,"job_description": string,"job_title": string,"job_url": string | null,"location": string | null,"next_action": string | null,"next_action_date": string | null,"notes": string,"offered_salary": string | null,"preferred_qualifications": string,"recruiter_email": string | null,"recruiter_name": string | null,"recruiter_phone": string | null,"required_qualifications": string,"required_skills": string,"responsibilities": string,"salary_range": string | null,"source": string,"status_changed_at": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "analysis_updated_at"?: string | null,"application_date"?: string | null,"application_status"?: string,"company_name"?: string,"created_at"?: string,"deadline"?: string | null,"employment_type"?: string | null,"final_outcome"?: string | null,"follow_up_date"?: string | null,"id"?: string,"job_analysis"?: Json | null,"job_description"?: string,"job_title": string,"job_url"?: string | null,"location"?: string | null,"next_action"?: string | null,"next_action_date"?: string | null,"notes"?: string,"offered_salary"?: string | null,"preferred_qualifications"?: string,"recruiter_email"?: string | null,"recruiter_name"?: string | null,"recruiter_phone"?: string | null,"required_qualifications"?: string,"required_skills"?: string,"responsibilities"?: string,"salary_range"?: string | null,"source"?: string,"status_changed_at"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "analysis_updated_at"?: string | null,"application_date"?: string | null,"application_status"?: string,"company_name"?: string,"created_at"?: string,"deadline"?: string | null,"employment_type"?: string | null,"final_outcome"?: string | null,"follow_up_date"?: string | null,"id"?: string,"job_analysis"?: Json | null,"job_description"?: string,"job_title"?: string,"job_url"?: string | null,"location"?: string | null,"next_action"?: string | null,"next_action_date"?: string | null,"notes"?: string,"offered_salary"?: string | null,"preferred_qualifications"?: string,"recruiter_email"?: string | null,"recruiter_name"?: string | null,"recruiter_phone"?: string | null,"required_qualifications"?: string,"required_skills"?: string,"responsibilities"?: string,"salary_range"?: string | null,"source"?: string,"status_changed_at"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "job_applications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"platform_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "platform_settings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profile_extras": {
                  Row: {
                    "created_at": string,"date": string | null,"description": string,"id": string,"kind": string,"organisation": string | null,"title": string,"updated_at": string,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date"?: string | null,"description"?: string,"id"?: string,"kind": string,"organisation"?: string | null,"title": string,"updated_at"?: string,"url"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string | null,"description"?: string,"id"?: string,"kind"?: string,"organisation"?: string | null,"title"?: string,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_extras_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_status": string,"avatar_url": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"last_active_at": string | null,"onboarding_completed_at": string | null,"role": string,"status_changed_at": string | null,"status_reason": string | null,"support_access_expires_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_status"?: string,"avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id": string,"last_active_at"?: string | null,"onboarding_completed_at"?: string | null,"role"?: string,"status_changed_at"?: string | null,"status_reason"?: string | null,"support_access_expires_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "account_status"?: string,"avatar_url"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"last_active_at"?: string | null,"onboarding_completed_at"?: string | null,"role"?: string,"status_changed_at"?: string | null,"status_reason"?: string | null,"support_access_expires_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"description": string,"end_date": string | null,"id": string,"project_url": string | null,"role": string | null,"start_date": string | null,"technologies": (string)[],"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"end_date"?: string | null,"id"?: string,"project_url"?: string | null,"role"?: string | null,"start_date"?: string | null,"technologies"?: (string)[],"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"end_date"?: string | null,"id"?: string,"project_url"?: string | null,"role"?: string | null,"start_date"?: string | null,"technologies"?: (string)[],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start"?: string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"resume_versions": {
                  Row: {
                    "change_summary": string | null,"content_json": NonNullable<Json>,"created_at": string,"id": string,"resume_id": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "change_summary"?: string | null,"content_json": NonNullable<Json>,"created_at"?: string,"id"?: string,"resume_id": string,"user_id": string,"version": number
                  }
                  Update: {
                    "change_summary"?: string | null,"content_json"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"resume_id"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "resume_versions_resume_fk"
      columns: ["resume_id","user_id"]
isOneToOne: false
      referencedRelation: "generated_resumes"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "resume_versions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"skills": {
                  Row: {
                    "created_at": string,"id": string,"proficiency": string | null,"skill_category": string,"skill_name": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"proficiency"?: string | null,"skill_category"?: string,"skill_name": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"proficiency"?: string | null,"skill_category"?: string,"skill_name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "skills_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"source_cvs": {
                  Row: {
                    "applied_at": string | null,"created_at": string,"extracted_text": string | null,"extraction_error": string | null,"extraction_status": string,"file_name": string,"file_size": number,"id": string,"is_primary": boolean,"label": string | null,"mime_type": string,"parsed_data": Json | null,"storage_path": string,"updated_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string | null,"created_at"?: string,"extracted_text"?: string | null,"extraction_error"?: string | null,"extraction_status"?: string,"file_name": string,"file_size": number,"id"?: string,"is_primary"?: boolean,"label"?: string | null,"mime_type": string,"parsed_data"?: Json | null,"storage_path": string,"updated_at"?: string,"user_id": string,"version"?: number
                  }
                  Update: {
                    "applied_at"?: string | null,"created_at"?: string,"extracted_text"?: string | null,"extraction_error"?: string | null,"extraction_status"?: string,"file_name"?: string,"file_size"?: number,"id"?: string,"is_primary"?: boolean,"label"?: string | null,"mime_type"?: string,"parsed_data"?: Json | null,"storage_path"?: string,"updated_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_cvs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"work_experiences": {
                  Row: {
                    "achievements": string,"company": string,"created_at": string,"employment_type": string | null,"end_date": string | null,"id": string,"is_current": boolean,"job_title": string,"location": string | null,"responsibilities": string,"sort_order": number,"start_date": string | null,"technologies": (string)[],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievements"?: string,"company": string,"created_at"?: string,"employment_type"?: string | null,"end_date"?: string | null,"id"?: string,"is_current"?: boolean,"job_title": string,"location"?: string | null,"responsibilities"?: string,"sort_order"?: number,"start_date"?: string | null,"technologies"?: (string)[],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievements"?: string,"company"?: string,"created_at"?: string,"employment_type"?: string | null,"end_date"?: string | null,"id"?: string,"is_current"?: boolean,"job_title"?: string,"location"?: string | null,"responsibilities"?: string,"sort_order"?: number,"start_date"?: string | null,"technologies"?: (string)[],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "work_experiences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_activity_series":
{ Args: { "p_days"?: number }; Returns: {
              "ai_requests": number,"applications": number,"cover_letters": number,"day": string,"registrations": number,"resumes": number
            }[]
                           },
"admin_ai_usage_by_feature":
{ Args: { "p_days"?: number }; Returns: {
              "avg_duration_ms": number,"errors": number,"feature": string,"input_tokens": number,"output_tokens": number,"requests": number
            }[]
                           },
"admin_ai_usage_by_model":
{ Args: { "p_days"?: number }; Returns: {
              "input_tokens": number,"model": string,"output_tokens": number,"requests": number
            }[]
                           },
"admin_application_status_breakdown":
{ Args: Record<PropertyKey, never>; Returns: {
              "application_status": string,"total": number
            }[]
                           },
"admin_list_users":
{ Args: { "p_created_from"?: string,"p_created_to"?: string,"p_limit"?: number,"p_offset"?: number,"p_search"?: string,"p_status"?: string }; Returns: {
              "account_status": string,"ai_request_count": number,"application_count": number,"created_at": string,"document_count": number,"email": string,"full_name": string,"id": string,"last_active_at": string,"onboarding_completed_at": string,"role": string,"status_reason": string,"support_access_expires_at": string,"total_count": number
            }[]
                           },
"admin_log_action":
{ Args: { "p_action": string,"p_metadata"?: Json,"p_target_id"?: string,"p_target_type"?: string }; Returns: undefined
                           },
"admin_platform_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_set_account_status":
{ Args: { "p_reason"?: string,"p_status": string,"p_user_id": string }; Returns: undefined
                           },
"assert_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"check_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"grant_admin_role":
{ Args: { "p_email": string }; Returns: string
                           },
"has_support_access":
{ Args: { "target": string }; Returns: boolean
                           },
"is_active_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"revoke_admin_role":
{ Args: { "p_email": string }; Returns: string
                           },
"touch_last_active":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
